import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4175/'
const browser = await chromium.launch({ headless: true })
mkdirSync('_qa/ui', { recursive: true })

async function newPage(width, height, locale = 'zh-CN', platformLayout = true) {
  const context = await browser.newContext({ viewport: { width, height }, locale, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  if (platformLayout) await page.route('https://images.aiwaves.tech/alteru/guest-shell.js', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }))
  await page.route('https://chat.aiwaves.tech/aigram/api/gen-image', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }) }))
  await page.addInitScript(() => {
    localStorage.setItem('game_locale', 'zh')
    localStorage.setItem('city-of-tides-muted', '1')
  })
  return { context, page, errors }
}

async function clickChoice(page, label) {
  const button = page.locator('.st-quick-replies button').filter({ hasText: label }).first()
  await button.waitFor({ state: 'visible' })
  await button.click()
  await page.locator('.st-typing').waitFor({ state: 'detached' })
}

try {
  const mobile = await newPage(390, 844)
  const page = mobile.page
  await page.goto(`${baseURL}?story_mode=demo&lang=zh`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
  await page.locator('.st-entry').waitFor()
  await page.screenshot({ path: '_qa/ui/city-v2-entry-platform-layout-390x844.png' })
  await page.locator('.st-primary').click()
  await page.locator('.st-shell').waitFor()
  const initialScroll = await page.locator('.st-conversation').evaluate((node) => node.scrollTop)
  if (initialScroll !== 0) throw new Error(`opening did not begin at the story background: scrollTop=${initialScroll}`)
  await page.getByText(/昨夜寄到你手里的包裹只有三样东西/).waitFor()
  await page.screenshot({ path: '_qa/ui/city-v2-opening-platform-layout-390x844.png' })

  await clickChoice(page, '先去把翻船的人')
  await page.getByText(/他叫尼洛，是屋顶摆渡人/).waitFor()
  await page.screenshot({ path: '_qa/ui/city-v2-nilo-platform-layout-390x844.png' })
  console.log('city v2 browser: Nilo rescue reached')

  await clickChoice(page, '把米拉的录音放给尼洛听')
  console.log('city v2 browser: recording played')
  await clickChoice(page, '邀请尼洛同行')
  console.log('city v2 browser: Nilo joined')
  await clickChoice(page, '握住铜栏听米拉的回声')
  console.log('city v2 browser: Mira echo choice resolved')
  await page.getByText(/四十七个人，一个都不能从记录里消失/).waitFor()
  await page.screenshot({ path: '_qa/ui/city-v2-mira-echo-platform-layout-390x844.png' })
  await clickChoice(page, '先离开上涨的水面')
  console.log('city v2 browser: overlook reached')
  await page.getByText(/灯塔区、沉水车站、雨棚市场和钟楼档案馆/).waitFor()
  await page.screenshot({ path: '_qa/ui/city-v2-overlook-platform-layout-390x844.png' })

  await page.getByRole('button', { name: '世界' }).click()
  await page.getByRole('button', { name: /尼洛.*正在同行/ }).waitFor()
  await page.locator('.st-drawer-tabs button').filter({ hasText: '城市' }).click()
  for (const district of ['灯塔区', '沉水车站', '雨棚市场', '钟楼档案馆']) {
    if (!(await page.locator('.st-map button').filter({ hasText: district }).count())) throw new Error(`missing open district: ${district}`)
  }
  await page.screenshot({ path: '_qa/ui/city-v2-world-platform-layout-390x844.png' })
  if (mobile.errors.length) throw new Error(mobile.errors.join('\n'))

  const localArchive = await page.evaluate(() => JSON.parse(localStorage.getItem('city-of-tides-v2-save') || '{}'))
  console.log(`city v2 browser: persisted scene ${localArchive.worlds?.['city-of-tides']?.scene ?? 'missing'}`)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: /继续游戏/ }).click()
  if (await page.getByRole('dialog').count()) throw new Error('continue game did not dismiss the resume dialog')
  await page.waitForFunction(() => {
    const node = document.querySelector('.st-conversation')
    return node && (node.scrollHeight - node.clientHeight <= 20 || node.scrollTop >= node.scrollHeight - node.clientHeight - 40)
  })
  const resumed = await page.locator('.st-conversation').evaluate((node) => ({ top: node.scrollTop, max: node.scrollHeight - node.clientHeight }))
  if (resumed.max > 20 && resumed.top < resumed.max - 40) throw new Error(`continue game did not reach the latest point: ${JSON.stringify(resumed)}`)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '重新开始' }).click()
  await page.getByText(/当前存档会被覆盖/).waitFor()
  await page.getByRole('button', { name: '确认从头开始' }).click()
  await page.locator('.st-entry').waitFor()

  await mobile.context.close()

  const freeform = await newPage(390, 844)
  await freeform.page.goto(`${baseURL}?story_mode=demo&lang=zh`, { waitUntil: 'networkidle' })
  await freeform.page.locator('.st-primary').click()
  const customAction = '我先检查渡船尾部有没有人动过这个包裹'
  await freeform.page.getByRole('textbox', { name: '自定义行动' }).fill(customAction)
  await freeform.page.getByRole('button', { name: '发送行动' }).click()
  await freeform.page.getByText(customAction, { exact: true }).waitFor()
  if (freeform.errors.length) throw new Error(freeform.errors.join('\n'))
  await freeform.context.close()

  const narrow = await newPage(320, 568)
  await narrow.page.goto(`${baseURL}?story_mode=demo&lang=zh`, { waitUntil: 'networkidle' })
  await narrow.page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
  await narrow.page.locator('.st-entry').waitFor()
  await narrow.page.screenshot({ path: '_qa/ui/city-v2-entry-platform-layout-320x568.png' })
  await narrow.page.locator('.st-primary').click()
  await narrow.page.getByText(/昨夜寄到你手里的包裹只有三样东西/).waitFor()
  await narrow.page.screenshot({ path: '_qa/ui/city-v2-opening-platform-layout-320x568.png' })
  if (narrow.errors.length) throw new Error(narrow.errors.join('\n'))
  await narrow.context.close()

  const desktop = await newPage(1280, 900)
  await desktop.page.goto(`${baseURL}?story_mode=demo&lang=zh`, { waitUntil: 'networkidle' })
  await desktop.page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
  await desktop.page.locator('.st-entry').waitFor()
  await desktop.page.screenshot({ path: '_qa/ui/city-v2-entry-platform-layout-1280x900.png' })
  if (desktop.errors.length) throw new Error(desktop.errors.join('\n'))
  await desktop.context.close()

  const external = await newPage(1024, 768, 'zh-CN', false)
  await external.page.goto(`${baseURL}?story_mode=demo&lang=zh`, { waitUntil: 'networkidle' })
  await external.page.locator('.st-entry').waitFor()
  await external.page.waitForTimeout(1200)
  await external.page.screenshot({ path: '_qa/ui/city-v2-entry-external-guest-1024x768.png' })
  await external.context.close()

  const english = await newPage(390, 844, 'en-US')
  await english.page.goto(`${baseURL}?story_mode=demo&lang=en`, { waitUntil: 'networkidle' })
  await english.page.getByText('CITY OF TIDES', { exact: true }).waitFor()
  await english.page.getByRole('button', { name: /Return to the city/i }).waitFor()
  if (english.errors.length) throw new Error(english.errors.join('\n'))
  await english.context.close()

  console.log('city v2 browser ok · background-first · one-click route · Nilo continuity · Mira echo · four districts · resume · responsive · bilingual')
} finally {
  await browser.close()
}
