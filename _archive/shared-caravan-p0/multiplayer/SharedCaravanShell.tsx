import { useMemo, useRef, useState } from 'react'
import { theWildRoad } from '../story/cartridges/theWildRoad'
import { usePlayerProfile } from '../story/usePlayerProfile'
import { CheckIcon, MuteIcon, ResetIcon, RouteIcon, SendIcon, UsersIcon, VersionIcon, VolumeIcon, WarningIcon } from './icons'
import { intentCopyKey, noteCopyKey, useLabI18n, type CopyKey } from './i18n'
import { useLabAudio } from './useLabAudio'
import { useSharedCaravan } from './useSharedCaravan'
import type { AbsencePolicy, IntentKind, RoundIntent, WorldEvent, WorldStats } from './types'

const actions: Array<{ kind: IntentKind; cost: CopyKey }> = [
  { kind: 'scout', cost: 'scoutCost' },
  { kind: 'forage', cost: 'forageCost' },
  { kind: 'negotiate', cost: 'negotiateCost' },
  { kind: 'guard', cost: 'guardCost' },
]

function delta(value: number) { return value > 0 ? `+${value}` : String(value) }

function StatStrip({ stats, locale }: { stats: WorldStats; locale: 'zh' | 'en' }) {
  const items = [
    { id: 'vitality', label: locale === 'zh' ? '体力' : 'Vitality', value: stats.vitality, min: 0, max: 100 },
    { id: 'supplies', label: locale === 'zh' ? '补给' : 'Supplies', value: stats.supplies, min: 0, max: 12 },
    { id: 'renown', label: locale === 'zh' ? '名望' : 'Renown', value: stats.renown, min: -100, max: 100 },
  ]
  return <div className="sc-stats" aria-label={locale === 'zh' ? '共享数值' : 'Shared stats'}>
    {items.map((item) => {
      const width = ((item.value - item.min) / (item.max - item.min)) * 100
      return <div className="sc-stat" key={item.id}>
        <div className="sc-stat__line"><span>{item.label}</span><strong>{item.value}</strong></div>
        <div className="sc-stat__track"><span style={{ width: `${Math.max(0, Math.min(100, width))}%` }} /></div>
      </div>
    })}
  </div>
}

function MemberAvatar({ memberId, initials, name, hostAvatar }: { memberId: string; initials: string; name: string; hostAvatar: string }) {
  if (memberId === 'host') return <img className="sc-avatar" src={hostAvatar} alt="" draggable={false} />
  return <span className="sc-avatar sc-avatar--initial" aria-hidden="true">{initials}</span>
}

function EventRow({ event, memberNames, locale, t }: { event: WorldEvent; memberNames: Record<string, string>; locale: 'zh' | 'en'; t: (key: CopyKey, vars?: Record<string, string | number>) => string }) {
  const clock = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(event.createdAt)
  if (event.type === 'intent_submitted' || event.type === 'intent_replaced') {
    const payload = event.payload as { intent: RoundIntent }
    const intent = payload.intent
    return <article className="sc-event sc-event--intent">
      <div className="sc-event__meta"><span>{memberNames[intent.authorUserId]}</span><span>{clock}</span></div>
      <div className="sc-event__body">
        <span className="sc-event__stamp"><CheckIcon /></span>
        <div><strong>{t(intentCopyKey[intent.kind])}</strong><p>{intent.action}</p>{intent.delegatedByPolicy && <small>{t('delegated')}</small>}</div>
      </div>
      {event.type === 'intent_replaced' && <span className="sc-event__tag">{t('replace')}</span>}
    </article>
  }
  if (event.type === 'round_started') {
    const payload = event.payload as { nextRound: number }
    return <div className="sc-round-divider"><span>{t('round')} {payload.nextRound}</span></div>
  }
  const payload = event.payload as {
    intents: RoundIntent[]; deltas: WorldStats; notes: string[]; absentMemberIds: string[]; location: string; objective: string
  }
  return <article className={`sc-event sc-event--resolution ${payload.notes.includes('forage-conflict') ? 'sc-event--conflict' : ''}`}>
    <div className="sc-event__meta"><span>{t('result')} · {t('round')} {event.round}</span><span>v{event.version}</span></div>
    <h3>{payload.location}</h3>
    <p className="sc-event__objective">{payload.objective}</p>
    <div className="sc-event__sources">
      {payload.intents.map((intent) => <span key={intent.id}>{memberNames[intent.authorUserId]} · {t(intentCopyKey[intent.kind])}{intent.delegatedByPolicy ? ` · ${t('delegated')}` : ''}</span>)}
    </div>
    <ul>{payload.notes.map((note) => noteCopyKey[note] && <li key={note}>{note === 'forage-conflict' ? <WarningIcon /> : <CheckIcon />}{t(noteCopyKey[note])}</li>)}</ul>
    <div className="sc-deltas" aria-label={t('deltas')}>
      <span>{locale === 'zh' ? '体力' : 'Vitality'} <strong>{delta(payload.deltas.vitality)}</strong></span>
      <span>{locale === 'zh' ? '补给' : 'Supplies'} <strong>{delta(payload.deltas.supplies)}</strong></span>
      <span>{locale === 'zh' ? '名望' : 'Renown'} <strong>{delta(payload.deltas.renown)}</strong></span>
    </div>
  </article>
}

export default function SharedCaravanShell() {
  const { locale, setLocale, t } = useLabI18n()
  const profile = usePlayerProfile()
  const audio = useLabAudio()
  const lab = useSharedCaravan()
  const [customAction, setCustomAction] = useState('')
  const [confirmAbsence, setConfirmAbsence] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const memberNames = useMemo(() => Object.fromEntries(lab.archive.members.map((member) => [member.id, member.id === 'host' ? profile.name : member.name])), [lab.archive.members, profile.name])
  const currentIntent = lab.snapshot.intents[lab.selectedMember.id]
  const allReady = lab.readyCount === lab.archive.members.length
  const isCollecting = lab.snapshot.phase === 'collecting'

  const scrollEnd = () => window.setTimeout(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }), 20)
  const submit = (kind: IntentKind, label: string) => {
    const result = lab.submit(kind, label)
    if (!result) { audio.play('conflict'); return }
    audio.play('submit')
    if (Object.keys(result.archive.snapshot.intents).length === 4) window.setTimeout(() => audio.play('ready'), 90)
    scrollEnd()
  }
  const submitCustom = () => {
    const value = customAction.trim()
    if (!value) return
    const result = lab.submitCustom(value)
    if (!result) { audio.play('conflict'); return }
    setCustomAction('')
    audio.play('submit')
    if (Object.keys(result.archive.snapshot.intents).length === 4) window.setTimeout(() => audio.play('ready'), 90)
    scrollEnd()
  }
  const resolve = (allowAbsence: boolean) => {
    const result = lab.resolve(allowAbsence)
    setConfirmAbsence(false)
    if (!result) { audio.play('conflict'); return }
    const payload = result.event?.payload as { notes?: string[] }
    audio.play(payload?.notes?.includes('forage-conflict') ? 'conflict' : 'resolve')
    scrollEnd()
  }

  const noticeText = (() => {
    const notice = lab.notice
    if (!notice) return ''
    if (notice.code === 'VERSION_CONFLICT') return t('errorVersion', { expected: Number(notice.details?.expectedVersion ?? '?'), current: Number(notice.details?.currentVersion ?? lab.snapshot.version) })
    if (notice.code === 'MEMBERS_MISSING') return t('errorMissing')
    if (notice.code === 'ROUND_ALREADY_RESOLVED') return t('errorResolved')
    if (notice.code === 'DUPLICATE') return t('duplicateIgnored')
    if (notice.code === 'COMMITTED') return t('toastCommitted')
    if (notice.code === 'REPLACED') return t('toastReplaced')
    if (notice.code === 'RESOLVED') return t('toastResolved', { n: Number(notice.details?.version ?? lab.snapshot.version) })
    if (notice.code === 'NEXT') return t('toastNext', { n: Number(notice.details?.round ?? lab.snapshot.round) })
    return t('errorGeneric')
  })()

  return <main className="sc-page">
    <section className="sc-shell">
      <header className="sc-world-head">
        <div className="sc-world-head__image" style={{ backgroundImage: `linear-gradient(90deg,rgba(23,33,29,.86),rgba(23,33,29,.2)),url(${theWildRoad.entryImage})` }} />
        <div className="sc-world-head__content">
          <div className="sc-eyebrow"><RouteIcon />{t('lab')}</div>
          <div className="sc-title-row">
            <div><h1>{t('title')}</h1><p>{t('subtitle')}</p></div>
            <div className="sc-head-actions">
              <button type="button" className="sc-icon-button" onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')} aria-label={t('language')}>{locale === 'zh' ? 'EN' : '中'}</button>
              <button type="button" className="sc-icon-button" onClick={audio.toggleMuted} aria-label={audio.muted ? t('muted') : t('sound')}>{audio.muted ? <MuteIcon /> : <VolumeIcon />}</button>
            </div>
          </div>
          <div className="sc-world-meta">
            <span><RouteIcon />{lab.snapshot.location}</span>
            <span><VersionIcon />{t('round')} {lab.snapshot.round} · v{lab.snapshot.version}</span>
            <span className={`sc-phase sc-phase--${lab.snapshot.phase}`}>{lab.snapshot.phase === 'collecting' ? t('collecting') : t('resolved')}</span>
          </div>
          <div className="sc-objective"><span>{t('objective')}</span><strong>{lab.snapshot.objective}</strong></div>
          <StatStrip stats={lab.snapshot.stats} locale={locale} />
        </div>
      </header>

      <div className="sc-layout">
        <section className="sc-ledger" aria-labelledby="sc-ledger-title">
          <div className="sc-section-title"><div><span>{t('world')}</span><h2 id="sc-ledger-title">{t('eventLog')}</h2></div><strong>{lab.archive.events.length}</strong></div>
          <div className="sc-rule"><VersionIcon /><p>{t('ruleSummary')}</p></div>
          <div className="sc-feed" ref={feedRef} aria-live="polite" data-testid="event-feed">
            {lab.archive.events.length === 0 ? <div className="sc-empty"><RouteIcon /><p>{t('noEvents')}</p></div> : lab.archive.events.slice(-80).map((event) => <EventRow key={event.id} event={event} memberNames={memberNames} locale={locale} t={t} />)}
          </div>
        </section>

        <aside className="sc-party" aria-labelledby="sc-party-title">
          <div className="sc-section-title"><div><span>{t('activeAs')}</span><h2 id="sc-party-title"><UsersIcon />{t('submitted', { n: lab.readyCount })}</h2></div></div>
          <p className="sc-party__hint">{t('switchHint')}</p>
          <div className="sc-members" role="list">
            {lab.archive.members.map((member) => {
              const ready = Boolean(lab.snapshot.intents[member.id])
              const active = member.id === lab.selectedMember.id
              return <button type="button" role="listitem" data-member-id={member.id} className={`sc-member ${active ? 'sc-member--active' : ''} ${ready ? 'sc-member--ready' : ''}`} key={member.id} onClick={() => { lab.setSelectedMemberId(member.id); audio.play('switch') }}>
                <span className="sc-member__route-dot">{ready ? <CheckIcon /> : null}</span>
                <MemberAvatar memberId={member.id} initials={member.initials} name={memberNames[member.id]} hostAvatar={profile.avatarUrl} />
                <span className="sc-member__copy"><strong>{memberNames[member.id]}</strong><small>{member.isHost ? t('host') : t('simulated')} · {member.role}</small></span>
                <span className="sc-member__state">{ready ? t('ready') : t('waiting')}</span>
              </button>
            })}
          </div>

          <div className="sc-absence">
            <label htmlFor="absence-policy">{t('absencePolicy')} · {memberNames[lab.selectedMember.id]}</label>
            <select id="absence-policy" value={lab.selectedMember.absencePolicy} disabled={!isCollecting || Boolean(currentIntent)} onChange={(event) => lab.setPolicy(lab.selectedMember.id, event.target.value as AbsencePolicy)}>
              <option value="follow">{t('follow')}</option><option value="guard">{t('guardPolicy')}</option><option value="rest">{t('rest')}</option>
            </select>
          </div>

          <div className="sc-action-panel">
            <div className="sc-action-panel__heading"><span>{t('chooseAction')}</span>{currentIntent && <small>{t('replace')}</small>}</div>
            <div className="sc-action-grid">
              {actions.map(({ kind, cost }) => <button type="button" data-intent-kind={kind} key={kind} disabled={!isCollecting || lab.busy} className={`sc-action ${currentIntent?.kind === kind ? 'sc-action--selected' : ''}`} onClick={() => submit(kind, t(intentCopyKey[kind]))}>
                <strong>{t(intentCopyKey[kind])}</strong><span>{t(cost)}</span>
              </button>)}
            </div>
            <form className="sc-custom" onSubmit={(event) => { event.preventDefault(); submitCustom() }}>
              <label className="sr-only" htmlFor="custom-action">{t('customPlaceholder')}</label>
              <input id="custom-action" value={customAction} onChange={(event) => setCustomAction(event.target.value)} placeholder={t('customPlaceholder')} disabled={!isCollecting || lab.busy} />
              <button type="submit" disabled={!isCollecting || !customAction.trim() || lab.busy} aria-label={t('send')}><SendIcon /></button>
            </form>
          </div>

          {noticeText && <div className={`sc-notice sc-notice--${lab.notice?.kind}`} role={lab.notice?.kind === 'error' ? 'alert' : 'status'}>{lab.notice?.kind === 'error' ? <WarningIcon /> : <CheckIcon />}<span>{noticeText}</span></div>}

          <div className="sc-round-actions">
            {isCollecting ? <>
              <p>{allReady ? t('allReady') : t('missing', { n: lab.missingMembers.length })}</p>
              <button type="button" data-testid="round-resolve" className="sc-primary" disabled={lab.busy} onClick={() => allReady ? resolve(false) : setConfirmAbsence(true)}>{allReady ? t('resolve') : t('resolveMissing')}<RouteIcon /></button>
            </> : <button type="button" data-testid="next-round" className="sc-primary" onClick={() => { const result = lab.nextRound(); if (result) { audio.play('next'); scrollEnd() } else audio.play('conflict') }}>{t('nextRound')}<RouteIcon /></button>}
          </div>

          <details className="sc-lab-controls">
            <summary>{t('experiment')}</summary>
            <div><button type="button" onClick={() => { lab.simulateStaleVersion(); audio.play('conflict') }}><VersionIcon />{t('stale')}</button><button type="button" disabled={!currentIntent} onClick={() => { lab.replayCurrentAction(); audio.play('switch') }}><CheckIcon />{t('duplicate')}</button><button type="button" onClick={() => setConfirmReset(true)}><ResetIcon />{t('reset')}</button></div>
          </details>
        </aside>
      </div>
    </section>

    {(confirmAbsence || confirmReset) && <div className="sc-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setConfirmAbsence(false); setConfirmReset(false) } }}>
      <section className="sc-dialog" role="dialog" aria-modal="true" aria-labelledby="sc-dialog-title">
        <WarningIcon className="sc-dialog__icon" />
        <h2 id="sc-dialog-title">{confirmAbsence ? t('confirmAbsence') : t('resetQuestion')}</h2>
        {confirmAbsence && <><p>{t('confirmAbsenceBody')}</p><ul>{lab.missingMembers.map((member) => <li key={member.id}>{memberNames[member.id]} · {t(member.absencePolicy === 'follow' ? 'follow' : member.absencePolicy === 'guard' ? 'guardPolicy' : 'rest')}</li>)}</ul></>}
        <div className="sc-dialog__actions"><button type="button" onClick={() => { setConfirmAbsence(false); setConfirmReset(false) }}>{t('cancel')}</button><button type="button" className="sc-dialog__confirm" onClick={() => { if (confirmAbsence) resolve(true); else { lab.reset(); setConfirmReset(false); audio.play('next') } }}>{confirmAbsence ? t('confirm') : t('resetConfirm')}</button></div>
      </section>
    </div>}
  </main>
}
