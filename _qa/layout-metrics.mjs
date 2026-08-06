import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4187/'
for (const width of [320, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } })
  await page.addInitScript(() => { localStorage.setItem('game_locale', 'zh'); localStorage.setItem('city-of-tides-muted', '1') })
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ct-shell')
  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector)
      const rect = element?.getBoundingClientRect()
      return rect ? { x: rect.x, right: rect.right, width: rect.width } : null
    }
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      stage: box('.ct-stage'),
      shell: box('.ct-shell'),
      head: box('.ct-chat-head'),
      header: box('.ct-chat-head__top'),
      identity: box('.ct-chat-head__identity'),
      actions: box('.ct-chat-head__actions'),
      world: box('.ct-world-button'),
      composer: box('.ct-composer'),
      actionButtons: [...document.querySelectorAll('.ct-chat-head__actions > button')].map((element) => { const rect = element.getBoundingClientRect(); return { x: rect.x, right: rect.right, width: rect.width } }),
    }
  })
  console.log(JSON.stringify(metrics))
  await page.close()
}
await browser.close()
