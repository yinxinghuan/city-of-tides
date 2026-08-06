import { DurableObject } from "cloudflare:workers";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SEASON_LENGTH = 7 * DAY;
const REGIONS = ["lighthouse", "station", "market", "archive"];
const TRACE_KINDS = ["message", "warning", "aid", "repair", "route"];
const TRACE_TTL = {
  message: 48 * HOUR,
  warning: 72 * HOUR,
  aid: 96 * HOUR,
  repair: 168 * HOUR,
  route: 168 * HOUR,
};
const PROJECT_IDS = {
  lighthouse: "relight-the-beacon",
  station: "raise-the-causeway",
  market: "restore-the-rain-market",
  archive: "seal-the-city-ledger",
};
const ANCHOR_TITLES = {
  lighthouse: "The Beacon That Remembered",
  station: "The Raised Causeway",
  market: "The Market Under Rain",
  archive: "The Ledger Above the Tide",
};

function json(data, status = 200) {
  return Response.json(data, { status });
}

function fail(code, status = 400, extra = {}) {
  return json({ accepted: false, code, ...extra }, status);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cleanText(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function seasonFor(now, sequence = 1) {
  const startsAt = Math.floor(now / SEASON_LENGTH) * SEASON_LENGTH;
  return {
    id: `tide-${Math.floor(startsAt / SEASON_LENGTH)}`,
    sequence,
    startsAt,
    endsAt: startsAt + SEASON_LENGTH,
  };
}

function initialArchive(now) {
  return {
    schemaVersion: 1,
    worldId: "main",
    rulesetId: "city-of-tides-v1",
    version: 1,
    cursor: 0,
    season: seasonFor(now),
    events: [],
    processedActionIds: [],
  };
}

function projectViews(archive) {
  const contributions = new Map();
  for (const regionId of REGIONS) contributions.set(PROJECT_IDS[regionId], new Map());
  for (const event of archive.events) {
    if (event.type !== "project_contributed" || event.seasonId !== archive.season.id) continue;
    const byUser = contributions.get(event.payload.projectId);
    if (byUser) byUser.set(event.payload.authorUserId, event.payload.amount);
  }
  return Object.fromEntries(REGIONS.map((regionId) => {
    const byUser = contributions.get(PROJECT_IDS[regionId]);
    const progress = clamp([...byUser.values()].reduce((sum, value) => sum + value, 0), 0, 100);
    return [regionId, {
      id: PROJECT_IDS[regionId],
      regionId,
      progress,
      target: 100,
      contributorUserIds: [...byUser.keys()],
      completed: progress >= 100,
    }];
  }));
}

function readTraces(archive, now) {
  const created = new Map();
  const supports = new Map();
  const claims = new Map();
  for (const event of archive.events) {
    if (event.type === "trace_created") created.set(event.payload.traceId, { payload: event.payload, event });
    if (event.type === "trace_reinforced") {
      if (!supports.has(event.payload.traceId)) supports.set(event.payload.traceId, new Set());
      supports.get(event.payload.traceId).add(event.payload.authorUserId);
    }
    if (event.type === "aid_claimed") {
      if (!claims.has(event.payload.traceId)) claims.set(event.payload.traceId, new Set());
      claims.get(event.payload.traceId).add(event.payload.authorUserId);
    }
  }
  return [...created.values()].map(({ payload, event }) => {
    const supportUserIds = [...(supports.get(payload.traceId) || [])];
    const claimedByUserIds = [...(claims.get(payload.traceId) || [])];
    const anchoredForSeason = supportUserIds.length >= 3 && event.seasonId === archive.season.id;
    const expired = !anchoredForSeason && (now >= payload.expiresAt || event.seasonId !== archive.season.id);
    return {
      ...payload,
      sourceEventId: event.id,
      createdAt: event.createdAt,
      seasonId: event.seasonId,
      supportUserIds,
      supportCount: supportUserIds.length,
      anchoredForSeason,
      expired,
      remainingCharges: payload.charges == null ? undefined : Math.max(0, payload.charges - claimedByUserIds.length),
      claimedByUserIds,
    };
  });
}

function makeEvent(archive, action, type, payload, offset = 0) {
  return {
    id: crypto.randomUUID(),
    seq: archive.cursor + offset + 1,
    worldVersion: archive.version + 1,
    actionId: action.actionId,
    actorUserId: action.actorUserId,
    type,
    payload,
    seasonId: archive.season.id,
    createdAt: action.createdAt,
  };
}

function commitEvents(archive, action, events) {
  return {
    ...archive,
    version: archive.version + 1,
    cursor: archive.cursor + events.length,
    events: [...archive.events, ...events],
    processedActionIds: [...archive.processedActionIds, action.actionId].slice(-800),
  };
}

function applyAction(archive, action, allowForceResolve) {
  const traces = readTraces(archive, action.createdAt);
  if (action.type === "create_trace") {
    const { regionId, kind, replyToId } = action.payload;
    const message = cleanText(action.payload.message);
    if (!REGIONS.includes(regionId) || !TRACE_KINDS.includes(kind) || !message) throw { code: "INVALID_ACTION" };
    const activeOwn = traces.filter((trace) => !trace.expired && trace.regionId === regionId && trace.authorUserId === action.actorUserId);
    if (activeOwn.length >= 2) throw { code: "RATE_LIMITED" };
    if (replyToId) {
      const target = traces.find((trace) => trace.traceId === replyToId);
      if (!target) throw { code: "ENTITY_NOT_FOUND" };
      if (target.expired) throw { code: "TRACE_EXPIRED" };
    }
    const payload = {
      traceId: crypto.randomUUID(),
      authorUserId: action.actorUserId,
      authorName: cleanText(action.actorName, 40) || "Traveller",
      authorAvatarUrl: cleanText(action.actorAvatarUrl, 500),
      regionId,
      kind,
      message,
      expiresAt: action.createdAt + TRACE_TTL[kind],
      ...(replyToId ? { replyToId } : {}),
      ...(kind === "aid" ? { charges: 3 } : {}),
    };
    const events = [makeEvent(archive, action, "trace_created", payload)];
    return { archive: commitEvents(archive, action, events), events, grants: [] };
  }

  if (action.type === "reinforce_trace") {
    const target = traces.find((trace) => trace.traceId === action.payload.traceId);
    if (!target) throw { code: "ENTITY_NOT_FOUND" };
    if (target.expired) throw { code: "TRACE_EXPIRED" };
    if (target.authorUserId === action.actorUserId || target.supportUserIds.includes(action.actorUserId)) throw { code: "ALREADY_SUPPORTED" };
    const payload = { traceId: target.traceId, authorUserId: action.actorUserId };
    const events = [makeEvent(archive, action, "trace_reinforced", payload)];
    return { archive: commitEvents(archive, action, events), events, grants: [] };
  }

  if (action.type === "claim_aid") {
    const target = traces.find((trace) => trace.traceId === action.payload.traceId);
    if (!target) throw { code: "ENTITY_NOT_FOUND" };
    if (target.expired) throw { code: "TRACE_EXPIRED" };
    if (target.kind !== "aid" || target.remainingCharges <= 0 || target.claimedByUserIds.includes(action.actorUserId)) throw { code: "ITEM_UNAVAILABLE" };
    const receiptId = crypto.randomUUID();
    const payload = { traceId: target.traceId, authorUserId: action.actorUserId, receiptId };
    const events = [makeEvent(archive, action, "aid_claimed", payload)];
    const grant = { id: receiptId, userId: action.actorUserId, traceId: target.traceId, createdAt: action.createdAt, grant: { kind: "lamp_cell", quantity: 1 } };
    return { archive: commitEvents(archive, action, events), events, grants: [grant] };
  }

  if (action.type === "contribute_project") {
    const regionId = action.payload.regionId;
    if (!REGIONS.includes(regionId)) throw { code: "INVALID_ACTION" };
    const projects = projectViews(archive);
    if (projects[regionId].contributorUserIds.includes(action.actorUserId)) throw { code: "ALREADY_CONTRIBUTED" };
    const payload = {
      projectId: PROJECT_IDS[regionId],
      authorUserId: action.actorUserId,
      amount: 25,
      message: cleanText(action.payload.message),
    };
    const events = [makeEvent(archive, action, "project_contributed", payload)];
    return { archive: commitEvents(archive, action, events), events, grants: [] };
  }

  if (action.type === "resolve_season") {
    if (action.createdAt < archive.season.endsAt && !(allowForceResolve && action.payload.force)) throw { code: "SEASON_OPEN" };
    const projects = projectViews(archive);
    const events = [];
    for (const regionId of REGIONS) {
      const project = projects[regionId];
      if (!project.completed || project.contributorUserIds.length < 3) continue;
      const alreadyAnchored = archive.events.some((event) => event.type === "anchor_committed" && event.payload.projectId === project.id);
      if (alreadyAnchored) continue;
      const payload = {
        anchorId: crypto.randomUUID(), regionId, projectId: project.id,
        contributorUserIds: project.contributorUserIds, title: ANCHOR_TITLES[regionId],
      };
      events.push(makeEvent(archive, action, "anchor_committed", payload, events.length));
    }
    events.push(makeEvent(archive, action, "season_resolved", { seasonId: archive.season.id }, events.length));
    let next = commitEvents(archive, action, events);
    const startsAt = action.createdAt < archive.season.endsAt ? action.createdAt : archive.season.endsAt;
    next = { ...next, season: { id: `tide-${Math.floor(startsAt / SEASON_LENGTH)}-${archive.season.sequence + 1}`, sequence: archive.season.sequence + 1, startsAt, endsAt: startsAt + SEASON_LENGTH } };
    return { archive: next, events, grants: [] };
  }

  throw { code: "INVALID_ACTION" };
}

export class WorldRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS world (world_key TEXT PRIMARY KEY, ruleset_id TEXT NOT NULL, version INTEGER NOT NULL, cursor INTEGER NOT NULL, snapshot_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS world_event (id TEXT PRIMARY KEY, seq INTEGER NOT NULL UNIQUE, world_version INTEGER NOT NULL, action_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, type TEXT NOT NULL, region_id TEXT, entity_id TEXT, payload_json TEXT NOT NULL, season_id TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'public', created_at INTEGER NOT NULL, expires_at INTEGER)");
    this.sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_world_action_event ON world_event(action_id, id)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS action_result_cache (action_id TEXT PRIMARY KEY, response_json TEXT NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS grant_receipt (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, action_id TEXT NOT NULL, source_entity_id TEXT NOT NULL, grant_json TEXT NOT NULL, created_at INTEGER NOT NULL, acknowledged_at INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS report (id TEXT PRIMARY KEY, reporter_user_id TEXT NOT NULL, entity_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL)");
    this.sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_report_identity_entity ON report(reporter_user_id, entity_id)");
  }

  getWorld(worldKey, now, rulesetId = "city-of-tides-v1") {
    const row = [...this.sql.exec("SELECT snapshot_json FROM world WHERE world_key = ?", worldKey)][0];
    if (row) return JSON.parse(row.snapshot_json);
    const archive = initialArchive(now);
    this.sql.exec("INSERT INTO world (world_key, ruleset_id, version, cursor, snapshot_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", worldKey, rulesetId, archive.version, archive.cursor, JSON.stringify(archive), now, now);
    return archive;
  }

  advanceExpiredSeasons(worldKey, archive, now) {
    let current = archive;
    // Lazy server-side rollover: the first reader after a boundary closes the
    // elapsed season. This keeps production independent from a client button.
    for (let rollover = 0; rollover < 12 && now >= current.season.endsAt; rollover += 1) {
      const action = {
        actionId: `system-season-${current.season.id}`,
        actorUserId: "__system__",
        actorName: "City Ledger",
        actorAvatarUrl: "",
        expectedVersion: current.version,
        createdAt: current.season.endsAt,
        type: "resolve_season",
        payload: { force: false },
      };
      const result = applyAction(current, action, false);
      const response = {
        accepted: true, duplicate: false, code: "COMMITTED", version: result.archive.version,
        cursor: result.archive.cursor, server_time: now, committed_events: result.events,
        snapshot_patch: {}, entity_updates: [], grant_receipts: [],
      };
      this.saveCommit(worldKey, action, result, response);
      current = result.archive;
    }
    return current;
  }

  hiddenEntityIds() {
    return new Set([...this.sql.exec("SELECT entity_id FROM report GROUP BY entity_id HAVING COUNT(DISTINCT reporter_user_id) >= 3")].map((row) => row.entity_id));
  }

  saveCommit(worldKey, action, result, response) {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("UPDATE world SET version = ?, cursor = ?, snapshot_json = ?, updated_at = ? WHERE world_key = ?", result.archive.version, result.archive.cursor, JSON.stringify(result.archive), action.createdAt, worldKey);
      for (const event of result.events) {
        const regionId = event.payload.regionId || null;
        const entityId = event.payload.traceId || event.payload.projectId || event.payload.anchorId || null;
        const expiresAt = event.payload.expiresAt || null;
        this.sql.exec("INSERT INTO world_event (id, seq, world_version, action_id, actor_user_id, type, region_id, entity_id, payload_json, season_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", event.id, event.seq, event.worldVersion, event.actionId, event.actorUserId, event.type, regionId, entityId, JSON.stringify(event.payload), event.seasonId, event.createdAt, expiresAt);
      }
      for (const grant of result.grants) {
        this.sql.exec("INSERT INTO grant_receipt (id, user_id, action_id, source_entity_id, grant_json, created_at) VALUES (?, ?, ?, ?, ?, ?)", grant.id, grant.userId, action.actionId, grant.traceId, JSON.stringify(grant.grant), grant.createdAt);
      }
      this.sql.exec("INSERT INTO action_result_cache (action_id, response_json) VALUES (?, ?)", action.actionId, JSON.stringify(response));
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();
    if (request.method === "POST" && url.pathname === "/api/world/ensure") {
      const body = await request.json().catch(() => ({}));
      const worldKey = cleanText(body.world_key, 64) || "main";
      const archive = this.advanceExpiredSeasons(worldKey, this.getWorld(worldKey, now, cleanText(body.ruleset_id, 80) || "city-of-tides-v1"), now);
      if (body.ruleset_id && body.ruleset_id !== archive.rulesetId) return fail("RULESET_MISMATCH", 409);
      return json({ world_id: archive.worldId, version: archive.version, cursor: archive.cursor, server_time: now, active_season: archive.season });
    }

    if (request.method === "GET" && url.pathname === "/api/world/state") {
      const worldKey = cleanText(url.searchParams.get("world_key"), 64) || "main";
      const afterCursor = Number(url.searchParams.get("after_cursor") || 0);
      const eventLimit = clamp(Number(url.searchParams.get("event_limit") || 50), 1, 200);
      const archive = this.advanceExpiredSeasons(worldKey, this.getWorld(worldKey, now), now);
      const hiddenIds = this.hiddenEntityIds();
      const publicArchive = { ...archive, events: archive.events.filter((event) => !event.payload?.traceId || !hiddenIds.has(event.payload.traceId)) };
      const traces = readTraces(publicArchive, now).filter((trace) => !trace.expired);
      const regionId = url.searchParams.get("region_id");
      const activeTraces = traces.filter((trace) => !regionId || trace.regionId === regionId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
      const events = archive.events.filter((event) => event.seq > afterCursor).slice(0, eventLimit);
      return json({
        world_id: archive.worldId, version: archive.version, cursor: archive.cursor, server_time: now,
        snapshot: publicArchive, active_season: archive.season, events, active_traces: activeTraces,
        projects: Object.values(projectViews(archive)),
        anchors: archive.events.filter((event) => event.type === "anchor_committed").map((event) => event.payload),
        has_more_events: archive.events.filter((event) => event.seq > afterCursor).length > events.length,
      });
    }

    if (request.method === "POST" && url.pathname === "/api/world/action") {
      const body = await request.json().catch(() => ({}));
      // PUBLIC_BETA permits a deliberately bounded production experiment while
      // the platform team finishes a signed identity verifier for custom Workers.
      if (this.env.LAB_MODE !== "true" && this.env.PUBLIC_BETA !== "true") return fail("AUTH_REQUIRED", 401, { identity_verification_required: true });
      const worldKey = cleanText(body.world_key, 64) || "main";
      const actorUserId = cleanText(body.user_id || body.telegram_id, 100);
      if (!actorUserId || actorUserId === "__alteru_guest__") return fail("AUTH_REQUIRED", 401);
      const actionId = cleanText(body.action_id, 100);
      if (!actionId) return fail("INVALID_ACTION");
      const cached = [...this.sql.exec("SELECT response_json FROM action_result_cache WHERE action_id = ?", actionId)][0];
      if (cached) return json({ ...JSON.parse(cached.response_json), duplicate: true });
      const archive = this.getWorld(worldKey, now);
      if (Number(body.ruleset_version) !== 1) return fail("RULESET_MISMATCH", 409);
      if (Number(body.expected_version) !== archive.version) return fail("VERSION_CONFLICT", 409, { current_version: archive.version, cursor: archive.cursor, retryable: true });
      if (body.type === "create_trace") {
        const recent = [...this.sql.exec("SELECT COUNT(*) AS n FROM world_event WHERE actor_user_id = ? AND type = 'trace_created' AND created_at > ?", actorUserId, now - 30 * 1000)][0]?.n || 0;
        const today = [...this.sql.exec("SELECT COUNT(*) AS n FROM world_event WHERE actor_user_id = ? AND type = 'trace_created' AND created_at > ?", actorUserId, now - DAY)][0]?.n || 0;
        if (recent >= 1 || today >= 20) return fail("RATE_LIMITED", 429);
      }
      const action = {
        actionId, actorUserId, actorName: cleanText(body.actor_profile?.name, 40), actorAvatarUrl: cleanText(body.actor_profile?.avatar_url, 500),
        expectedVersion: archive.version, createdAt: now, type: cleanText(body.type, 60), payload: body.payload || {},
      };
      let result;
      try { result = applyAction(archive, action, this.env.LAB_MODE === "true"); }
      catch (error) { return fail(error?.code || "INVALID_ACTION", error?.code === "RATE_LIMITED" ? 429 : 400); }
      const response = {
        accepted: true, duplicate: false, code: "COMMITTED", version: result.archive.version,
        cursor: result.archive.cursor, server_time: now, committed_events: result.events,
        snapshot_patch: {}, entity_updates: [], grant_receipts: result.grants,
      };
      this.saveCommit(worldKey, action, result, response);
      return json(response);
    }

    if (request.method === "GET" && url.pathname === "/api/world/grants") {
      if (this.env.LAB_MODE !== "true" && this.env.PUBLIC_BETA !== "true") return fail("AUTH_REQUIRED", 401, { identity_verification_required: true });
      const userId = cleanText(url.searchParams.get("user_id"), 100);
      if (!userId) return fail("AUTH_REQUIRED", 401);
      const rows = [...this.sql.exec("SELECT id, source_entity_id, grant_json, created_at FROM grant_receipt WHERE user_id = ? AND acknowledged_at IS NULL ORDER BY created_at ASC", userId)];
      return json({ receipts: rows.map((row) => ({ receipt_id: row.id, source_entity_id: row.source_entity_id, grant: JSON.parse(row.grant_json), created_at: row.created_at })) });
    }

    if (request.method === "POST" && url.pathname === "/api/world/grant/ack") {
      const body = await request.json().catch(() => ({}));
      if (this.env.LAB_MODE !== "true" && this.env.PUBLIC_BETA !== "true") return fail("AUTH_REQUIRED", 401, { identity_verification_required: true });
      const receiptId = cleanText(body.receipt_id, 100);
      const userId = cleanText(body.user_id || body.telegram_id, 100);
      if (!receiptId || !userId) return fail("AUTH_REQUIRED", 401);
      this.sql.exec("UPDATE grant_receipt SET acknowledged_at = ? WHERE id = ? AND user_id = ?", now, receiptId, userId);
      return json({ ok: true, receipt_id: receiptId });
    }

    if (request.method === "GET" && url.pathname === "/api/world/history") {
      const archive = this.getWorld(cleanText(url.searchParams.get("world_key"), 64) || "main", now);
      return json({ seasons: archive.events.filter((event) => event.type === "season_resolved"), anchors: archive.events.filter((event) => event.type === "anchor_committed"), cursor: archive.cursor });
    }

    if (request.method === "POST" && url.pathname === "/api/world/report") {
      const body = await request.json().catch(() => ({}));
      if (this.env.LAB_MODE !== "true" && this.env.PUBLIC_BETA !== "true") return fail("AUTH_REQUIRED", 401, { identity_verification_required: true });
      const reporter = cleanText(body.user_id || body.telegram_id, 100);
      const entityId = cleanText(body.entity_id, 100);
      if (!reporter || reporter === "__alteru_guest__" || !entityId) return fail("INVALID_ACTION");
      const existing = [...this.sql.exec("SELECT id FROM report WHERE reporter_user_id = ? AND entity_id = ?", reporter, entityId)][0];
      if (existing) return json({ ok: true, report_id: existing.id, duplicate: true });
      const today = [...this.sql.exec("SELECT COUNT(*) AS n FROM report WHERE reporter_user_id = ? AND created_at > ?", reporter, now - DAY)][0]?.n || 0;
      if (today >= 20) return fail("RATE_LIMITED", 429);
      const id = crypto.randomUUID();
      this.sql.exec("INSERT INTO report (id, reporter_user_id, entity_id, reason, created_at) VALUES (?, ?, ?, ?, ?)", id, reporter, entityId, cleanText(body.reason, 240), now);
      const count = [...this.sql.exec("SELECT COUNT(DISTINCT reporter_user_id) AS n FROM report WHERE entity_id = ?", entityId)][0]?.n || 0;
      return json({ ok: true, report_id: id, hidden: count >= 3 });
    }

    if (request.method === "POST" && url.pathname === "/api/world/lab/reset" && this.env.LAB_MODE === "true") {
      const worldKey = cleanText((await request.json().catch(() => ({}))).world_key, 64) || "main";
      const archive = initialArchive(now);
      this.ctx.storage.transactionSync(() => {
        this.sql.exec("DELETE FROM world_event");
        this.sql.exec("DELETE FROM action_result_cache");
        this.sql.exec("DELETE FROM grant_receipt");
        this.sql.exec("UPDATE world SET version = ?, cursor = ?, snapshot_json = ?, updated_at = ? WHERE world_key = ?", archive.version, archive.cursor, JSON.stringify(archive), now, worldKey);
      });
      return json({ ok: true, snapshot: archive });
    }

    return new Response("Not Found", { status: 404 });
  }
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/health") {
    const identityMode = env.LAB_MODE === "true" ? "unverified-staging" : env.PUBLIC_BETA === "true" ? "unverified-production-beta" : "writes-disabled-until-platform-verifier";
    return json({ ok: true, service: "city-of-tides", storage: "durable-object-sqlite", lab_mode: env.LAB_MODE === "true", public_beta: env.PUBLIC_BETA === "true", identity_mode: identityMode });
  }
  if (!url.pathname.startsWith("/api/world/")) return new Response("Not Found", { status: 404 });
  let worldKey = url.searchParams.get("world_key") || "main";
  if (request.method === "POST") {
    const clone = request.clone();
    const body = await clone.json().catch(() => ({}));
    worldKey = cleanText(body.world_key, 64) || worldKey;
  }
  const id = env.WORLD.idFromName(worldKey);
  return env.WORLD.get(id).fetch(request);
}
