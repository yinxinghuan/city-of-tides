import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4187/'
const prefix = process.env.CAPTURE_PREFIX || 'conversation'
const output = path.resolve(import.meta.dirname, 'ui')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function enterCity(page) {
  await page.waitForFunction(() => {
    const button = document.querySelector('.ct-entry__copy > button')
    return button instanceof HTMLButtonElement && !button.disabled
  })
  await page.locator('.ct-entry__copy > button').click()
  await page.waitForSelector('.ct-shell')
  const scrollTop = await page.locator('.ct-conversation').evaluate((element) => element.scrollTop)
  if (scrollTop !== 0) throw new Error(`conversation entered at scrollTop ${scrollTop}`)
}

async function openState(width, height, { platform = true, lab = false, remote = false, enter = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  if (platform) await page.route('https://images.aiwaves.tech/alteru/guest-shell.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  await page.route('**/note/aigram/ai/game/track/report', (route) => route.fulfill({ status: 204, body: '' }))
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => {
    localStorage.removeItem('city-of-tides-shared-world-lab-v1')
    localStorage.removeItem('city-of-tides-active-traveller')
    localStorage.setItem('game_locale', 'zh')
    localStorage.setItem('city-of-tides-muted', '1')
  })
  const url = new URL(baseURL)
  if (lab) url.searchParams.set('lab', '1')
  if (remote) url.searchParams.set('api_base', 'https://game.aiwaves.tech/city-of-tides-lab')
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ct-entry')
  if (platform) await page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
  if (enter) await enterCity(page)
  return { context, page, errors }
}

async function openWorld(page) {
  await page.locator('.ct-world-button').click()
  await page.waitForSelector('.ct-drawer')
}

for (const [width, height] of [[320, 568], [390, 844], [1024, 768], [1440, 900]]) {
  const { context, page, errors } = await openState(width, height, { enter: false })
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-entry-${width}x${height}.png`) })
  await enterCity(page)
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-initial-${width}x${height}.png`) })
  if (errors.length) throw new Error(`${width}x${height}: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844)
  await openWorld(page)
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-world-drawer-390x844.png`) })
  await page.locator('.ct-drawer-list > button').filter({ hasText: '雨棚市场' }).click()
  await page.locator('.ct-message__content').filter({ hasText: '三枚密封灯芯' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-aid-detail-390x844.png`) })
  await page.getByRole('button', { name: '领取一份' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-after-claim-390x844.png`) })
  if (errors.length) throw new Error(`aid: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844, { lab: true })
  await openWorld(page)
  await page.locator('.ct-drawer-list > button').filter({ hasText: '雨棚市场' }).click()
  for (let index = 0; index < 4; index += 1) {
    await openWorld(page)
    await page.getByRole('button', { name: '实验控制' }).click()
    await page.locator('.ct-lab-travellers button').nth(index).click()
    await page.getByRole('button', { name: '潮汐季' }).click()
    await page.getByRole('button', { name: '贡献 25 点' }).click()
    await page.locator('.ct-drawer__scrim').click({ position: { x: 5, y: 5 } })
  }
  await openWorld(page)
  await page.getByRole('button', { name: '潮汐季' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-season-complete-390x844.png`) })
  await page.getByRole('button', { name: '实验控制' }).click()
  await page.getByRole('button', { name: '模拟季节结算' }).click()
  await page.getByRole('button', { name: '永久锚点' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-anchor-committed-390x844.png`) })
  if (errors.length) throw new Error(`season: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844)
  await openWorld(page)
  await page.locator('.ct-drawer-list > button').filter({ hasText: '钟楼档案馆' }).click()
  await page.locator('.ct-quick-replies button').filter({ hasText: '留下一句话' }).click()
  await page.getByPlaceholder('最多 120 字…').fill('下一次钟响时，请看水面而不是钟楼。')
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-composer-390x844.png`) })
  if (errors.length) throw new Error(`composer: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844)
  await openWorld(page)
  await page.locator('.ct-drawer-list > button').filter({ hasText: '雨棚市场' }).click()
  const before = await page.locator('.ct-message').count()
  await page.locator('.ct-quick-replies button').filter({ hasText: '留下公共援助' }).click()
  await page.waitForFunction((count) => document.querySelectorAll('.ct-message').length > count, before)
  if (await page.locator('.ct-message-composer').count()) throw new Error('ordinary action opened the message composer')
  const afterAction = await page.locator('.ct-message').count()
  await page.locator('.ct-quick-replies button').filter({ hasText: '留下一句话' }).click()
  await page.waitForSelector('.ct-message-composer')
  if (await page.locator('.ct-message').count() !== afterAction) throw new Error('opening a message wrote to the world')
  await page.getByPlaceholder('最多 120 字…').fill('把灯留给下一位经过这里的人。')
  await page.getByRole('button', { name: '写入这道潮痕' }).click()
  await page.getByText('把灯留给下一位经过这里的人。', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-one-click-action-390x844.png`) })
  if (errors.length) throw new Error(`actions: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844, { lab: true, remote: true })
  await openWorld(page)
  await page.getByRole('button', { name: '实验控制' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-remote-connected-390x844.png`) })
  if (errors.length) throw new Error(`remote: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(1024, 768, { platform: false, enter: false })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(output, `${prefix}-external-guest-initial-1024x768.png`) })
  if (errors.length) throw new Error(`external: ${errors.join('\n')}`)
  await context.close()
}

await browser.close()
console.log('capture ok · cover entry + conversation top · 4 viewports · one-click actions · message-only composer · shared-world states · external guest')
