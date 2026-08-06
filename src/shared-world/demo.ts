import { commitWorldAction, createWorld, DAY, HOUR } from './engine'
import type { Traveller, WorldAction, WorldArchive } from './types'

export const DEMO_TRAVELLERS: Traveller[] = [
  { id: 'mira', name: 'Mira', initials: 'MI' },
  { id: 'sana', name: 'Sana', initials: 'SA' },
  { id: 'jon', name: 'Jon', initials: 'JO' },
  { id: 'iko', name: 'Iko', initials: 'IK' },
]

export function createDemoWorld(now = Date.now()): WorldArchive {
  let archive = createWorld(now - 8 * DAY)
  let n = 0
  const base = (actorUserId: string, createdAt: number) => ({
    actionId: `demo-${String(++n).padStart(3, '0')}`,
    actorUserId,
    expectedVersion: archive.version,
    createdAt,
  })
  const commit = (action: WorldAction) => { archive = commitWorldAction(archive, action).archive }

  for (const [index, traveller] of DEMO_TRAVELLERS.entries()) {
    commit({
      ...base(traveller.id, now - 7 * DAY - (4 - index) * HOUR),
      type: 'contribute_project',
      payload: { regionId: 'lighthouse', amount: 25, message: `${traveller.name} carried a lens fragment upstairs.` },
    })
  }
  commit({ ...base('system', now - 6 * DAY), type: 'resolve_season', payload: { force: true } })

  const traces: Array<{ actor: string; ago: number; regionId: 'lighthouse' | 'station' | 'market' | 'archive'; kind: 'warning' | 'route' | 'aid' | 'message' | 'repair'; message: string }> = [
    { actor: 'mira', ago: 2 * HOUR, regionId: 'lighthouse', kind: 'warning', message: 'The third bell arrived before the water rose. Do not trust the lower stairs.' },
    { actor: 'sana', ago: 5 * HOUR, regionId: 'station', kind: 'route', message: 'Blue chalk marks a dry passage behind platform four.' },
    { actor: 'jon', ago: 7 * HOUR, regionId: 'market', kind: 'aid', message: 'Three sealed lamp cells are under the copper counter.' },
    { actor: 'iko', ago: 9 * HOUR, regionId: 'archive', kind: 'message', message: 'I found a ledger page with tomorrow’s date. I left it where the clock shadow ends.' },
    { actor: 'mira', ago: 13 * HOUR, regionId: 'market', kind: 'repair', message: 'The eastern rain gutter works again, for now.' },
    { actor: 'sana', ago: 18 * HOUR, regionId: 'lighthouse', kind: 'repair', message: 'The second-floor relay holds if nobody touches the red wire.' },
  ]
  for (const item of traces) {
    commit({
      ...base(item.actor, now - item.ago),
      type: 'create_trace',
      payload: { regionId: item.regionId, kind: item.kind, message: item.message },
    })
  }
  return archive
}
