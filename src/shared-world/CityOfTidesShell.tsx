import { useEffect, useMemo, useRef, useState } from 'react'
import { HOUR, readWorld, REGIONS, TRACE_EFFECT } from './engine'
import { AnchorIcon, BellIcon, BoxIcon, CheckIcon, CloseIcon, FlagIcon, MapIcon, MuteIcon, PlusIcon, ReplyIcon, SendIcon, TraceIcon, VolumeIcon, WaveIcon } from './icons'
import { anchorKey, grantStatusKey, inventoryItemKey, localizeTraceMessage, noticeKey, projectKey, regionDescKey, regionKey, statusKey, traceActionKey, traceKindKey, useCityI18n } from './i18n'
import type { Locale, RegionId, TraceKind, TraceView, Traveller } from './types'
import { useCityWorld } from './useCityWorld'
import { useTideAudio } from './useTideAudio'
import { isInAigramNow, openAigramProfile } from '../shared/runtime/bridge'

type DrawerTab = 'regions' | 'pack' | 'season' | 'anchors' | 'lab'
type TextSize = 'small' | 'standard' | 'large'

const ACTIONS: Record<RegionId, TraceKind[]> = {
  lighthouse: ['repair', 'warning', 'aid'],
  station: ['route', 'warning', 'repair'],
  market: ['aid', 'message', 'repair'],
  archive: ['message', 'route', 'repair'],
}

function Avatar({ traveller, mine = false }: { traveller?: Traveller; mine?: boolean }) {
  return <span className={`ct-avatar ${mine ? 'ct-avatar--mine' : ''}`} aria-hidden="true">{traveller?.avatarUrl ? <img src={traveller.avatarUrl} alt="" draggable={false}/> : traveller?.initials || '?'}</span>
}

function TraceMessage({ trace, traveller, mine, activeUserId, locale, t, onOpen, onClaim }: {
  trace: TraceView
  traveller?: Traveller
  mine: boolean
  activeUserId: string
  locale: Locale
  t: ReturnType<typeof useCityI18n>['t']
  onOpen: () => void
  onClaim: () => void
}) {
  const hours = Math.max(1, Math.ceil((trace.expiresAt - Date.now()) / HOUR))
  const canClaim = trace.kind === 'aid' && (trace.remainingCharges ?? 0) > 0 && !trace.claimedByUserIds.includes(activeUserId)
  const author = traveller || { id: trace.authorUserId, name: trace.authorName || '?', initials: (trace.authorName || '?').slice(0, 2).toUpperCase(), avatarUrl: trace.authorAvatarUrl }
  return <article className={`ct-message ${mine ? 'ct-message--mine' : ''}`}>
    <div className="ct-message__body">
      <div className="ct-message__bubble">
        <span className="ct-message__meta">
          {mine ? <strong className="ct-author-self">{t('you')}</strong> : <button type="button" className="ct-author-chip" disabled={!isInAigramNow()} onClick={(event) => { event.stopPropagation(); openAigramProfile(author.id) }}><Avatar traveller={author}/><strong>{author.name}</strong></button>}
          <small>{t(traceKindKey(trace.kind))}</small><time>{hours}h</time>
        </span>
        <button type="button" className="ct-message__content" onClick={onOpen}><p>{localizeTraceMessage(trace.message, locale)}</p>
        <span className="ct-message__foot">
          {trace.anchoredForSeason ? <><AnchorIcon />{t('anchored')}</> : <><WaveIcon />{t('hoursLeft', { n: hours })}</>}
          {trace.supportCount > 0 && <em><ReplyIcon />{trace.supportCount}</em>}
        </span></button>
      </div>
      {trace.kind === 'aid' && <button type="button" className="ct-inline-aid" disabled={!canClaim} onClick={onClaim}><BoxIcon />{trace.claimedByUserIds.includes(activeUserId) ? t('claimed') : t('charges', { n: trace.remainingCharges ?? 0 })}</button>}
    </div>
  </article>
}

export default function CityOfTidesShell() {
  const world = useCityWorld()
  const { locale, setLocale, t } = useCityI18n()
  const audio = useTideAudio()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('regions')
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [entered, setEntered] = useState(false)
  const [resumeDialogDismissed, setResumeDialogDismissed] = useState(false)
  const [confirmResumeRestart, setConfirmResumeRestart] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [submittingKind, setSubmittingKind] = useState<TraceKind | null>(null)
  const [message, setMessage] = useState('')
  const [replyToId, setReplyToId] = useState<string | undefined>()
  const [confirmReset, setConfirmReset] = useState(false)
  const [textSize, setTextSize] = useState<TextSize>(() => (localStorage.getItem('city-of-tides-text-size') as TextSize) || 'standard')
  const feedRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const submissionRef = useRef(false)
  const resumeAtLatest = useRef(false)
  const labMode = useMemo(() => new URLSearchParams(window.location.search).get('lab') === '1', [])
  const coverImage = useMemo(() => new URL('./poster.png', document.baseURI).href, [])
  const travellersById = useMemo(() => new Map(world.travellers.map((item) => [item.id, item])), [world.travellers])

  useEffect(() => {
    if (!entered || !world.view) return
    requestAnimationFrame(() => {
      const feed = feedRef.current
      if (!feed) return
      feed.scrollTo({ top: resumeAtLatest.current ? feed.scrollHeight : 0, behavior: 'auto' })
      resumeAtLatest.current = false
    })
  }, [entered])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setDrawerOpen(false); setSelectedTraceId(null) }
      if (event.key.toLowerCase() === 'w' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) setDrawerOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!entered) {
    const entryReady = Boolean(world.archive && world.view && world.playerSaveLoaded)
    const showResumeDialog = world.playerSaveLoaded && world.hasVisited && !resumeDialogDismissed
    const enter = (latest: boolean) => {
      if (!entryReady) return
      resumeAtLatest.current = latest
      setResumeDialogDismissed(true)
      setConfirmResumeRestart(false)
      world.markVisited()
      audio.play('district')
      setEntered(true)
    }
    return <main className="ct-stage ct-stage--entry">
    <section className="ct-entry">
      <figure className="ct-entry__poster"><img src={coverImage} alt={t('coverAlt')} draggable={false}/><figcaption>{t('entryEyebrow')}</figcaption></figure>
      <div className="ct-entry__copy">
        <small>{t('entryEyebrow')}</small>
        <h1>{t('title')}</h1>
        <p className="ct-entry__promise">{t('subtitle')}</p>
        <div className="ct-entry__background"><span>{t('worldBackground')}</span><h2>{t('worldBackgroundTitle')}</h2><p>{t('worldBackgroundBodyA')}</p><p>{t('worldBackgroundBodyB')}</p></div>
        <button type="button" disabled={!entryReady} onClick={() => enter(false)}><WaveIcon/><span>{entryReady ? t('enterCity') : t('enterLoading')}</span></button>
      </div>
    </section>
    {showResumeDialog && <div className="ct-resume-dialog" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="ct-resume-title">
      <small>{confirmResumeRestart ? t('resumeRestart') : t('entryEyebrow')}</small><h2 id="ct-resume-title">{t('resumeTitle')}</h2><p>{t(confirmResumeRestart ? 'resumeRestartWarning' : 'resumeDescription')}</p>
      {!confirmResumeRestart ? <><button type="button" className="ct-resume-dialog__primary" autoFocus onClick={() => enter(true)}>{t('resumeContinue')}<WaveIcon/></button><button type="button" className="ct-resume-dialog__secondary" onClick={() => setConfirmResumeRestart(true)}>{t('resumeRestart')}</button></> : <><button type="button" className="ct-resume-dialog__primary" onClick={() => enter(false)}>{t('resumeRestartConfirm')}</button><button type="button" className="ct-resume-dialog__secondary" autoFocus onClick={() => setConfirmResumeRestart(false)}>{t('resumeRestartCancel')}</button></>}
    </section></div>}
  </main>
  }

  if (!world.archive || !world.view) return <main className="ct-loading"><i/><span/><i/></main>

  const view = world.view
  const regionId = world.selectedRegionId
  const region = view.regions[regionId]
  const traces = view.visibleTracesByRegion[regionId].slice().reverse()
  const project = view.projects[regionId]
  const selectedTrace = selectedTraceId ? view.traces.find((trace) => trace.traceId === selectedTraceId) : undefined
  const hasContributed = project.contributorUserIds.includes(world.activeTraveller.id)
  const noticeCopy = world.notice ? noticeKey(world.notice.code) : null

  const cycleTextSize = () => {
    const next: TextSize = textSize === 'small' ? 'standard' : textSize === 'standard' ? 'large' : 'small'
    localStorage.setItem('city-of-tides-text-size', next)
    setTextSize(next)
  }

  const submitTrace = async (kind: TraceKind, content: string, replyId?: string) => {
    if (submissionRef.current || !content.trim()) return
    submissionRef.current = true
    setSubmittingKind(kind)
    try {
      const result = await world.createTrace(regionId, kind, content.trim(), replyId)
      if (!result) { audio.play('warning'); return }
      audio.play(replyId ? 'reply' : kind === 'warning' ? 'warning' : 'trace')
      setMessage('')
      setReplyToId(undefined)
      setComposerOpen(false)
    } finally {
      submissionRef.current = false
      setSubmittingKind(null)
    }
  }

  const chooseAction = (kind: TraceKind) => {
    audio.play('district')
    if (kind === 'message') {
      setReplyToId(undefined)
      setComposerOpen(true)
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    setComposerOpen(false)
    setReplyToId(undefined)
    setMessage('')
    void submitTrace(kind, t(traceActionKey(kind)))
  }

  const chooseReply = (trace: TraceView) => {
    setReplyToId(trace.traceId)
    setComposerOpen(true)
    setSelectedTraceId(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const reinforce = async (trace: TraceView) => {
    const before = trace.anchoredForSeason
    const result = await world.reinforce(trace.traceId)
    if (!result) { audio.play('warning'); return }
    const after = readWorld(result.archive).traces.find((item) => item.traceId === trace.traceId)?.anchoredForSeason
    audio.play(!before && after ? 'anchor' : 'reply')
    setSelectedTraceId(null)
  }

  const claim = async (trace: TraceView) => {
    const result = await world.claimAid(trace.traceId)
    audio.play(result ? 'trace' : 'warning')
    if (result) setSelectedTraceId(null)
  }

  const selectRegion = (id: RegionId) => {
    world.setSelectedRegionId(id)
    setComposerOpen(false)
    setReplyToId(undefined)
    setMessage('')
    setDrawerOpen(false)
    setSelectedTraceId(null)
    audio.play('district')
  }

  return <main className="ct-stage">
    <section className="ct-shell" data-text-size={textSize}>
      <header className="ct-chat-head">
        <div className="ct-chat-head__top">
          <div className="ct-chat-head__identity"><span>{t('title')}</span><small>{t(regionKey(regionId))} · {t('season')} #{view.season.sequence}</small></div>
          <div className="ct-chat-head__actions">
            <button type="button" onClick={cycleTextSize} aria-label="Text size">Aa</button>
            <button type="button" onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')} aria-label={t('language')}>{locale === 'zh' ? 'EN' : '中'}</button>
            <button type="button" onClick={audio.toggleMuted} aria-label={audio.muted ? t('muted') : t('sound')}>{audio.muted ? <MuteIcon/> : <VolumeIcon/>}</button>
            <button type="button" className="ct-world-button" onClick={() => setDrawerOpen(true)}><MapIcon/><span>{t('world')}</span></button>
          </div>
        </div>
        <div className="ct-chat-stats">
          <div><span>{t('tide')}</span><strong>{view.tide}</strong><i><b style={{ width: `${view.tide}%` }}/></i></div>
          <div><span>{t(statusKey(region.status))}</span><strong>{region.value}</strong><i><b style={{ width: `${region.value}%` }}/></i></div>
          <div><span>{t('traces')}</span><strong>{view.visibleTracesByRegion[regionId].length}/6</strong><i><b style={{ width: `${view.visibleTracesByRegion[regionId].length / 6 * 100}%` }}/></i></div>
        </div>
      </header>

      <div className="ct-conversation" ref={feedRef}>
        <section className="ct-world-background"><small>{t('worldBackground')}</small><h1>{t('worldBackgroundTitle')}</h1><p>{t('worldBackgroundBodyA')}</p><p>{t('worldBackgroundBodyB')}</p></section>
        <div className="ct-section-heading"><span>{t('regionNow')}</span><small>{t('season')} #{view.season.sequence} · {t('introText')}</small></div>
        <section className="ct-narration">
          <span><WaveIcon/></span>
          <div><small>{t('current')}</small><h1>{t(regionKey(regionId))}</h1><p>{t(regionDescKey(regionId))}</p></div>
        </section>
        {view.anchors.filter((anchor) => anchor.regionId === regionId).map((anchor) => <section className="ct-world-event ct-world-event--anchor" key={anchor.id}><AnchorIcon/><div><small>{t('permanent')}</small><strong>{t(anchorKey(anchor.regionId))}</strong><p>{t('anchorEvent')}</p></div></section>)}
        {project.progress > 0 && <section className="ct-world-event"><BellIcon/><div><small>{t('project')}</small><strong>{t(projectKey(regionId))}</strong><p>{project.progress}/{project.target} · {t('contributors', { n: project.contributorUserIds.length })}</p><i><b style={{ width: `${project.progress}%` }}/></i></div></section>}
        <div className="ct-section-heading ct-section-heading--traces"><span>{t('tracesSection')}</span><small>{t('tracesSectionHint')}</small></div>
        {traces.length === 0 ? <section className="ct-empty-event"><TraceIcon/><p>{t('empty')}</p></section> : traces.map((trace) => <TraceMessage key={trace.traceId} trace={trace} traveller={travellersById.get(trace.authorUserId)} mine={trace.authorUserId === world.activeTraveller.id} activeUserId={world.activeTraveller.id} locale={locale} t={t} onOpen={() => setSelectedTraceId(trace.traceId)} onClaim={() => claim(trace)}/>)}
      </div>

      <footer className="ct-composer">
        <div className="ct-action-heading"><div><strong>{t('actionsSection')}</strong><small>{t('actionsSectionHint')}</small></div>{composerOpen && <button type="button" onClick={() => { setComposerOpen(false); setReplyToId(undefined); setMessage('') }}>{t('cancelMessage')}</button>}</div>
        <div className="ct-quick-replies">
          {ACTIONS[regionId].map((kind, index) => <button type="button" key={kind} className={composerOpen && kind === 'message' ? 'is-active' : ''} disabled={world.busy || submittingKind !== null} aria-busy={submittingKind === kind} onClick={() => chooseAction(kind)}><small>{String(index + 1).padStart(2, '0')}</small><span>{submittingKind === kind ? t('actionPending') : t(traceActionKey(kind))}</span></button>)}
        </div>
        {noticeCopy && <div className={`ct-action-feedback ct-action-feedback--${world.notice?.kind}`} aria-live="polite"><CheckIcon/><span>{t(noticeCopy)}</span></div>}
        {composerOpen && <div className="ct-message-composer">
          {replyToId && <div className="ct-reply-bar"><ReplyIcon/><span>{t('reply')} · {travellersById.get(view.traces.find((trace) => trace.traceId === replyToId)?.authorUserId || '')?.name}</span><button type="button" onClick={() => setReplyToId(undefined)} aria-label={t('close')}><CloseIcon/></button></div>}
          <form onSubmit={(event) => { event.preventDefault(); void submitTrace('message', message, replyToId) }}>
            <TraceIcon/><textarea ref={inputRef} value={message} maxLength={120} rows={1} onChange={(event) => setMessage(event.target.value)} placeholder={t('messagePlaceholder')}/><button type="submit" disabled={world.busy || !message.trim()} aria-label={t('submit')}><SendIcon/></button>
          </form>
        </div>}
      </footer>

      {drawerOpen && <div className="ct-drawer">
        <button type="button" className="ct-drawer__scrim" onClick={() => setDrawerOpen(false)} aria-label={t('close')}/>
        <section role="dialog" aria-modal="true" aria-labelledby="ct-drawer-title">
          <header><span className="ct-drawer__spacer"/><div><small>{t('world')}</small><h2 id="ct-drawer-title">{t('title')}</h2></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('close')}><CloseIcon/></button></header>
          <nav className="ct-drawer-tabs">
            <button type="button" className={drawerTab === 'regions' ? 'is-active' : ''} onClick={() => setDrawerTab('regions')}><MapIcon/>{t('regions')}</button>
            <button type="button" className={drawerTab === 'pack' ? 'is-active' : ''} onClick={() => setDrawerTab('pack')}><BoxIcon/>{t('pack')}</button>
            <button type="button" className={drawerTab === 'season' ? 'is-active' : ''} onClick={() => setDrawerTab('season')}><BellIcon/>{t('season')}</button>
            <button type="button" className={drawerTab === 'anchors' ? 'is-active' : ''} onClick={() => setDrawerTab('anchors')}><AnchorIcon/>{t('anchors')}</button>
            {labMode && <button type="button" className={drawerTab === 'lab' ? 'is-active' : ''} onClick={() => setDrawerTab('lab')}><TraceIcon/>{t('experiment')}</button>}
          </nav>
          <div className="ct-drawer-body">
            {drawerTab === 'regions' && <div className="ct-drawer-list">{REGIONS.map((id) => { const item = view.regions[id]; return <button type="button" key={id} className={id === regionId ? 'is-current' : ''} onClick={() => selectRegion(id)}><span className={`ct-place-mark ct-place-mark--${id}`}><i/><i/></span><span><strong>{t(regionKey(id))}</strong><small>{t(regionDescKey(id))}</small></span><b>{item.value}</b><PlusIcon/></button> })}</div>}
            {drawerTab === 'pack' && <div className="ct-pack-panel">
              <header><span><BoxIcon/></span><div><small>{t('pack')}</small><h3>{t(grantStatusKey(world.grantSyncStatus))}</h3></div></header>
              {!world.privateInventoryEnabled ? <p>{t('packUnavailable')}</p> : world.playerInventory.length === 0 ? <p>{t('packEmpty')}</p> : <div className="ct-pack-list">{world.playerInventory.map((item) => { const key = inventoryItemKey(item.kind); return <article key={item.kind}><span><BoxIcon/></span><div><strong>{key ? t(key) : t('itemFallback')}</strong><small>{t('quantity', { n: item.quantity })}</small></div><b>{item.quantity}</b></article> })}</div>}
              {(world.grantSyncStatus === 'pending' || world.grantSyncStatus === 'error') && <button type="button" onClick={() => world.refreshGrants()}>{t('retryGrantSync')}</button>}
            </div>}
            {drawerTab === 'season' && <div className="ct-season-panel"><BellIcon/><small>{t('project')}</small><h3>{t(projectKey(regionId))}</h3><p>{t('seasonExplanation')}</p><div className="ct-progress"><i><b style={{ width: `${project.progress}%` }}/></i><strong>{project.progress}/{project.target}</strong></div><p>{t('contributors', { n: project.contributorUserIds.length })}</p><button type="button" disabled={hasContributed || project.completed || world.busy} onClick={async () => { const result = await world.contribute(regionId, t(projectKey(regionId))); audio.play(result ? 'reply' : 'warning') }}>{hasContributed ? t('contributed') : t('contribute')}</button></div>}
            {drawerTab === 'anchors' && <div className="ct-anchor-list">{view.anchors.length === 0 ? <p>{t('noAnchors')}</p> : view.anchors.map((anchor) => <article key={anchor.id}><AnchorIcon/><div><small>{t(regionKey(anchor.regionId))}</small><h3>{t(anchorKey(anchor.regionId))}</h3><p>{anchor.contributorUserIds.length} {t('contributorUnit')} · {t('permanent')}</p></div></article>)}</div>}
            {drawerTab === 'lab' && labMode && <div className="ct-lab-panel"><p>{t(world.gatewayMode === 'remote' ? 'remoteGateway' : 'localGateway')}</p><div className="ct-lab-travellers">{world.travellers.map((traveller) => <button type="button" key={traveller.id} className={traveller.id === world.activeTraveller.id ? 'is-active' : ''} onClick={() => world.setActiveTravellerId(traveller.id)}><Avatar traveller={traveller}/><span>{traveller.name}</span></button>)}</div><button type="button" onClick={async () => { const result = await world.resolveSeason(); audio.play(result ? 'anchor' : 'warning') }}>{t('resolve')}</button><button type="button" onClick={() => world.simulateConflict()}>{t('conflict')}</button><button type="button" onClick={() => setConfirmReset(true)}>{t('reset')}</button><small>{t('version')} v{view.version} · cursor {view.cursor}</small></div>}
          </div>
        </section>
      </div>}
    </section>

    {selectedTrace && <div className="ct-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTraceId(null) }}><section className="ct-detail" role="dialog" aria-modal="true"><button type="button" className="ct-detail__close" onClick={() => setSelectedTraceId(null)}><CloseIcon/></button><small>{t(traceKindKey(selectedTrace.kind))}</small><h2>{travellersById.get(selectedTrace.authorUserId)?.name || selectedTrace.authorName || '?'}</h2><blockquote>{localizeTraceMessage(selectedTrace.message, locale)}</blockquote><dl><div><dt>{t('lifetime')}</dt><dd>{selectedTrace.anchoredForSeason ? t('anchored') : t('hoursLeft', { n: Math.max(1, Math.ceil((selectedTrace.expiresAt - Date.now()) / HOUR)) })}</dd></div><div><dt>{t('effect')}</dt><dd>{TRACE_EFFECT[selectedTrace.kind] ? `+${TRACE_EFFECT[selectedTrace.kind]}` : '—'}</dd></div><div><dt>{t('reinforcement')}</dt><dd>{selectedTrace.supportCount}</dd></div></dl><div className="ct-detail__actions"><button type="button" onClick={() => chooseReply(selectedTrace)}><ReplyIcon/>{t('reply')}</button><button type="button" disabled={selectedTrace.authorUserId === world.activeTraveller.id || selectedTrace.supportUserIds.includes(world.activeTraveller.id)} onClick={() => reinforce(selectedTrace)}><AnchorIcon/>{t('reinforce')}</button>{selectedTrace.kind === 'aid' && <button type="button" disabled={(selectedTrace.remainingCharges ?? 0) <= 0 || selectedTrace.claimedByUserIds.includes(world.activeTraveller.id)} onClick={() => claim(selectedTrace)}><BoxIcon/>{selectedTrace.claimedByUserIds.includes(world.activeTraveller.id) ? t('claimed') : t('claim')}</button>}{selectedTrace.authorUserId !== world.activeTraveller.id && <button type="button" onClick={async () => { if (await world.reportTrace(selectedTrace.traceId)) setSelectedTraceId(null) }}><FlagIcon/>{t('report')}</button>}</div></section></div>}

    {confirmReset && <div className="ct-detail-backdrop"><section className="ct-detail ct-detail--reset"><AnchorIcon/><h2>{t('reset')}</h2><p>{t('resetQuestion')}</p><div className="ct-detail__actions"><button type="button" onClick={() => setConfirmReset(false)}>{t('cancel')}</button><button type="button" onClick={async () => { await world.reset(); setConfirmReset(false); setDrawerOpen(false) }}>{t('reset')}</button></div></section></div>}
  </main>
}
