import { cityOfTides, cityOfTidesEn } from './cityOfTides'
import type { Locale, StoryCartridge } from '../types'

export const DEFAULT_CARTRIDGE_ID = 'city-of-tides'
export const CARTRIDGES: Record<string, StoryCartridge> = { 'city-of-tides': cityOfTides }
export const CARTRIDGES_EN: Record<string, StoryCartridge> = { 'city-of-tides': cityOfTidesEn }
export function listCartridges(locale: Locale): StoryCartridge[] { return [locale === 'en' ? cityOfTidesEn : cityOfTides] }
export function resolveCartridge(_id: string | null | undefined, locale: Locale = 'zh'): StoryCartridge { return locale === 'en' ? cityOfTidesEn : cityOfTides }
