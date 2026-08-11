import { chromium } from 'playwright'

const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4187/'
console.log('interaction shell: launching browser')
const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route('**/note/aigram/ai/game/track/report', (route) => route.fulfill({ status: 204, body: '' }))
  await page.addInitScript(() => {
    localStorage.removeItem('city-of-tides-shared-world-lab-v1')
    localStorage.removeItem('city-of-tides-active-traveller')
    localStorage.setItem('game_locale', 'zh')
    localStorage.setItem('city-of-tides-muted', '1')
  })
  const url = new URL(baseURL)
  url.searchParams.set('local', '1')
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  console.log('interaction shell: page loaded')
  await page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
  await page.waitForSelector('.ct-entry')
  await page.waitForFunction(() => !document.querySelector('.ct-entry__copy > button')?.hasAttribute('disabled'))

  if (await page.locator('.ct-shell').count()) throw new Error('main shell appeared before the player entered')
  await page.locator('.ct-entry__copy > button').click()
  await page.waitForSelector('.ct-shell')
  console.log('interaction shell: entered city')
  const initialScroll = await page.locator('.ct-conversation').evaluate((element) => element.scrollTop)
  if (initialScroll !== 0) throw new Error(`initial conversation scrollTop was ${initialScroll}`)

  await page.locator('.ct-world-button').click()
  await page.locator('.ct-drawer-list > button').filter({ hasText: '雨棚市场' }).click()
  console.log('interaction shell: market selected')
  const initialVersion = await page.locator('.ct-action-feedback').count()
  await page.locator('.ct-quick-replies button').filter({ hasText: '留下公共援助' }).click()
  console.log('interaction shell: ordinary action clicked')
  await page.waitForSelector('.ct-action-feedback')
  console.log('interaction shell: ordinary action committed')
  if (await page.locator('.ct-message-composer').count()) throw new Error('ordinary action opened the composer')
  if (await page.locator('.ct-message--mine').count() < 1) throw new Error('ordinary action did not create a player trace')

  const mineAfterAction = await page.locator('.ct-message--mine').count()
  await page.locator('.ct-quick-replies button').filter({ hasText: '留下一句话' }).click()
  await page.waitForSelector('.ct-message-composer')
  console.log('interaction shell: message composer opened')
  if (await page.locator('.ct-message--mine').count() !== mineAfterAction) throw new Error('opening the message composer wrote a trace')
  const send = page.getByRole('button', { name: '写入这道潮痕' })
  if (!(await send.isDisabled())) throw new Error('empty message was submittable')
  await page.getByPlaceholder('最多 120 字…').fill('把灯留给下一位经过这里的人。')
  if (await send.isDisabled()) throw new Error('written message did not enable submit')
  await send.click()
  await page.getByText('把灯留给下一位经过这里的人。', { exact: true }).waitFor()
  console.log('interaction shell: message committed')
  if (await page.locator('.ct-message-composer').count()) throw new Error('composer stayed open after a successful message')
  if (errors.length) throw new Error(errors.join('\n'))
  if (initialVersion > 0) throw new Error('unexpected notice before the first action')
  console.log('interaction shell ok · cover gate · scrollTop 0 · one-click action · message-only composer')
} finally {
  await browser.close()
}
