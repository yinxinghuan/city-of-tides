import type { RegionId, TraceKind } from './types'

export interface SharedAuthorityShadowSample {
  mode: 'shared-world'
  regionId: RegionId
  actions: Array<{ id: TraceKind; status: 'accepted'; disabled: boolean }>
  capturedAt: number
}

export function createSharedAuthorityShadowSample(regionId: RegionId, actions: TraceKind[], disabled: boolean): SharedAuthorityShadowSample {
  return {
    mode: 'shared-world',
    regionId,
    actions: actions.map((id) => ({ id, status: 'accepted', disabled })),
    capturedAt: Date.now(),
  }
}

export function recordSharedAuthorityShadowSample(regionId: RegionId, actions: TraceKind[], disabled: boolean, entered: boolean) {
  if (!entered || typeof window === 'undefined' || new URLSearchParams(window.location.search).get('authority_shadow') === '0') return
  const root = window as typeof window & { __ALTERU_AUTHORITY_SHADOW__?: SharedAuthorityShadowSample[] }
  const sample = createSharedAuthorityShadowSample(regionId, actions, disabled)
  const previous = root.__ALTERU_AUTHORITY_SHADOW__ ?? []
  const tail = previous.at(-1)
  const key = `${sample.regionId}:${sample.actions.map((action) => `${action.id}:${action.disabled}`).join('|')}`
  const previousKey = tail ? `${tail.regionId}:${tail.actions.map((action) => `${action.id}:${action.disabled}`).join('|')}` : ''
  if (key !== previousKey) root.__ALTERU_AUTHORITY_SHADOW__ = [...previous, sample].slice(-100)
}
