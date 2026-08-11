import { getGameUuid } from './game-id'

/** Derive the same-Worker API mount from the Remix-replaceable game UUID. */
export function getGameApiBase(): string {
  const gameId = getGameUuid()
  if (!gameId) throw new Error('[runtime] game UUID is required for the game API base')
  return `/${gameId}`
}
