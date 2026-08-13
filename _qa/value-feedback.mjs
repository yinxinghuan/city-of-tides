import { chromium } from 'playwright'

const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4187/'
const sizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]

const browser = await chromium.launch({ headless: true })

try {
  for (const size of sizes) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    await page.route('**/note/aigram/ai/game/track/report', (route) => route.fulfill({ status: 204, body: '' }))
    await page.addInitScript(() => {
      localStorage.setItem('game_locale', 'zh')
      localStorage.setItem('city-of-tides-muted', '1')
    })

    const url = new URL(baseURL)
    url.searchParams.set('local', '1')
    await page.goto(url.href, { waitUntil: 'domcontentloaded' })
    await page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
    await page.waitForFunction(() => !document.querySelector('.ct-entry__copy > button')?.hasAttribute('disabled'))
    await page.locator('.ct-entry__copy > button').click()
    await page.waitForSelector('.ct-shell')

    if (await page.locator('.ct-chat-stat__delta').count()) throw new Error(`${size.width}: initial values animated`)
    await page.locator('.ct-quick-replies button').first().click()
    await page.waitForSelector('.ct-chat-stat__delta')

    const deltas = await page.locator('.ct-chat-stat__delta').allTextContents()
    if (!deltas.every((value) => /^[+-]\d+$/.test(value))) throw new Error(`${size.width}: unsigned delta ${deltas.join(',')}`)
    if (!(await page.locator('.ct-chat-stat.has-delta').count())) throw new Error(`${size.width}: changed metric lacked feedback class`)

    const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
    if (layout.scrollWidth > layout.innerWidth) throw new Error(`${size.width}: horizontal overflow ${layout.scrollWidth} > ${layout.innerWidth}`)

    await page.screenshot({ path: `_qa/ui/value-feedback-platform-layout-${size.width}x${size.height}.png`, fullPage: true })
    await page.waitForSelector('.ct-chat-stat__delta', { state: 'detached' })
    if (errors.length) throw new Error(`${size.width}: ${errors.join('\n')}`)
    await context.close()
  }
  console.log('value feedback ok · real changes only · signed delta · 320x568 + 390x844 · no overflow')
} finally {
  await browser.close()
}
