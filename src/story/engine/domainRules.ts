import type { DomainActionResolution, DomainRule, StoryCartridge, StoryFactValue, StorySave } from '../types'

function normalizeAction(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s，。！？、,.!?;；:：'"“”‘’（）()—-]+/g, '')
}

function actionMatches(rule: DomainRule, action: string): boolean {
  const normalized = normalizeAction(action)
  return Boolean(
    rule.action.exact?.some((value) => normalizeAction(value) === normalized)
    || rule.action.includes?.some((value) => normalized.includes(normalizeAction(value))),
  )
}

function factMatches(actual: StoryFactValue | undefined, expected: StoryFactValue): boolean {
  return actual === expected
}

function preconditionsPass(rule: DomainRule, facts: Record<string, StoryFactValue>): boolean {
  if (rule.when.factUnset?.some((key) => facts[key] !== undefined && facts[key] !== false)) return false
  return Object.entries(rule.when.factEquals ?? {}).every(([key, value]) => factMatches(facts[key], value))
}

export function resolveDomainAction(save: StorySave, cartridge: StoryCartridge, action: string): DomainActionResolution | undefined {
  const candidates = (cartridge.domainRules ?? []).filter((rule) => actionMatches(rule, action))
  if (!candidates.length) return undefined
  const accepted = candidates.find((rule) => preconditionsPass(rule, save.facts))
  if (accepted) {
    return {
      kind: 'accepted',
      ruleId: accepted.id,
      text: accepted.successText,
      effects: accepted.effects,
      choices: accepted.successChoices,
    }
  }
  const rejected = candidates[0]
  return {
    kind: 'rejected',
    ruleId: rejected.id,
    text: rejected.rejectionText ?? (cartridge.locale === 'zh'
      ? '这件事已经发生过，眼前的局面不会倒回原点。'
      : 'That moment has already passed; the world will not reset around it.'),
    effects: [],
    choices: rejected.rejectionChoices ?? rejected.successChoices,
  }
}

