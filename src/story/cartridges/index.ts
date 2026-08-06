import { theWildRoad, theWildRoadEn } from './theWildRoad'
import type { Locale, StoryCartridge } from '../types'

export const DEFAULT_CARTRIDGE_ID = 'shared-caravan-lab'
export const CARTRIDGES: Record<string, StoryCartridge> = { 'shared-caravan-lab': theWildRoad }
export const CARTRIDGES_EN: Record<string, StoryCartridge> = { 'shared-caravan-lab': theWildRoadEn }
export function listCartridges(locale: Locale): StoryCartridge[] { return [locale === 'en' ? theWildRoadEn : theWildRoad] }
export function resolveCartridge(_id: string | null | undefined, locale: Locale = 'zh'): StoryCartridge { return locale === 'en' ? theWildRoadEn : theWildRoad }
