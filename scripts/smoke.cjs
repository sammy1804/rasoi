/**
 * End-to-end smoke test of the mobile page, on an emulated iPhone.
 * Run with `npm run smoke` (builds dist-mobile first). Exits non-zero on any failure.
 *
 * Covers: onboarding as Samridhi → invite code → sign out → join as Naina by code,
 * ticking, partial portions, adding food, the demo household, every tab, dark mode,
 * and horizontal overflow at 360px.
 */
const { spawn } = require('node:child_process')
const path = require('node:path')
const { chromium, devices } = require('playwright')

const URL = 'http://localhost:4175/'
const root = path.resolve(__dirname, '..')

function startServer(outDir = 'dist-mobile', PORT = 4175) {
  const proc = spawn('npx', ['vite', 'preview', '--outDir', outDir, '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true })
  let log = ''
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      stop(proc)
      reject(new Error('preview server did not start:\n' + log))
    }, 20000)
    const onData = (d) => {
      log += String(d)
      if (log.includes(`localhost:${PORT}`)) {
        clearTimeout(t)
        resolve(proc)
      }
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
  })
}

/** Kill the whole process group (npx → vite), not just the npx wrapper. */
function stop(proc) {
  try {
    process.kill(-proc.pid)
  } catch {
    proc.kill()
  }
}

const results = []
async function step(name, fn) {
  try {
    await fn()
    results.push(['✓', name])
  } catch (e) {
    results.push(['✗', name, e.message.split('\n')[0]])
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg)
}

;(async () => {
  const server = await startServer()
  const browser = await chromium.launch()
  const errors = []
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  }
  try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await ctx.newPage()
    watch(page)
    await page.goto(URL)
    const kcal = async () => Number((await page.getByTestId('metric-kcal').innerText()).match(/([\d,]+)\s*\//)[1].replace(/,/g, ''))
    let code = ''

    await step('Onboard Samridhi and create household', async () => {
      await page.getByRole('button', { name: 'Create a shared plan' }).click()
      await page.getByRole('button', { name: /Continue/ }).click()
      await page.getByRole('button', { name: 'Fill in as Samridhi' }).click()
      await page.getByRole('button', { name: /Continue/ }).click()
      await page.getByRole('button', { name: /Continue/ }).click()
      await page.getByRole('button', { name: /Looks good/ }).click()
      await page.getByRole('button', { name: /^Continue/ }).click()
      await page.getByRole('button', { name: /We cook ourselves/ }).click()
      await page.getByRole('button', { name: /Create household/ }).click()
      code = (await page.getByTestId('join-code').innerText()).trim()
      expect(/^[A-Z0-9]{6}$/.test(code), `bad join code "${code}"`)
      await page.getByRole('button', { name: /See today/ }).click()
    })

    await step('First-run tips and first tick update calories', async () => {
      await page.getByRole('button', { name: 'Got it' }).click()
      await page.getByRole('button', { name: 'Got it' }).click()
      const before = await kcal()
      await page.getByTestId('slot-breakfast').getByRole('button', { name: /mark as eaten/ }).first().click()
      await page.waitForTimeout(300)
      expect((await kcal()) > before, 'calories did not go up after ticking')
    })

    await step('Partial portion (50%) lowers calories', async () => {
      const before = await kcal()
      await page.getByRole('button', { name: 'Edit Besan chilla' }).click()
      await page.getByRole('button', { name: /Partly/ }).click()
      await page.getByRole('button', { name: '50%' }).click()
      await page.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(400)
      expect((await kcal()) < before, 'partial did not reduce calories')
    })

    await step('Add an extra food (chai)', async () => {
      const before = await kcal()
      await page.getByRole('button', { name: 'Add food' }).first().click()
      await page.getByRole('textbox', { name: 'Search foods' }).fill('chai')
      await page.getByRole('button', { name: /Chai \(with milk/ }).click()
      await page.getByRole('button', { name: /^Add · / }).click()
      await page.waitForTimeout(400)
      expect((await kcal()) > before, 'adding chai did not add calories')
    })

    await step('Naina joins by code on the same phone', async () => {
      await page.getByRole('link', { name: 'Profile' }).click()
      await page.getByRole('button', { name: /Sign out/ }).click()
      await page.getByRole('button', { name: /I have an invite/ }).click()
      await page.getByRole('button', { name: /Continue/ }).click()
      await page.getByRole('textbox').fill(code)
      await page.getByRole('button', { name: /^Join / }).click()
      await page.getByRole('button', { name: 'Fill in as Naina' }).click()
      await page.getByRole('button', { name: /Continue/ }).click()
      await page.getByRole('button', { name: /Continue/ }).click()
      await page.getByRole('button', { name: /Join and see/ }).click()
      await page.waitForTimeout(400)
      const tabs = (await page.getByRole('tab').allInnerTexts()).join(' ')
      expect(tabs.includes('Naina') && tabs.includes('Samridhi'), `tabs were: ${tabs}`)
      expect((await page.getByText('Hearty portions').count()) > 0, 'Naina should see hearty portions')
    })

    await step('Add a cook, see groceries with Zepto links', async () => {
      await page.getByRole('link', { name: 'Week' }).click()
      await page.getByRole('radio', { name: 'Cook' }).click()
      await page.getByRole('button', { name: /Add your cook/ }).click()
      await page.getByPlaceholder('e.g. Sunita').fill('Sunita')
      await page.getByPlaceholder('98xxxxxxxx').fill('9812345678')
      await page.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(400)
      expect((await page.getByTestId('cook-card').count()) === 1, 'cook card missing after adding cook')
      expect((await page.getByTestId('cook-menu').count()) + (await page.getByTestId('cook-off').count()) === 1, 'cook menu missing')
      const wa = await page.getByRole('link', { name: /Send to Sunita/ }).first().getAttribute('href')
      expect(wa && wa.startsWith('https://wa.me/919812345678?text='), `bad WhatsApp link ${wa}`)
      await page.getByRole('radio', { name: 'Groceries' }).click()
      await page.waitForTimeout(300)
      const zepto = await page.getByRole('link', { name: /on Zepto/ }).count()
      expect(zepto > 3, `only ${zepto} Zepto links`)
      await page.getByTestId('order-with-claude').click()
      const prompt = await page.getByTestId('order-prompt').innerText()
      expect(prompt.includes('Zepto connector') && /1\. /.test(prompt), 'order prompt for Claude is missing the list')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    })

    await step('Groceries split by shop, and the budget tracks an order', async () => {
      await page.getByRole('radio', { name: 'DMart' }).click()
      expect((await page.getByTestId('bulk-card').innerText()).includes('staples'), 'monthly staples list missing')
      await page.getByRole('radio', { name: 'Country Delight' }).click()
      expect((await page.getByTestId('subscription-card').count()) === 1, 'subscription plan missing')
      await page.getByRole('radio', { name: 'Budget' }).click()
      await page.getByRole('button', { name: /Log an order/ }).click()
      await page.getByRole('spinbutton', { name: 'Amount paid' }).fill('640')
      await page.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(400)
      expect((await page.getByTestId('budget-card').innerText()).includes('₹640'), 'logged order not counted in the budget')
      expect((await page.getByTestId('chart-cost').count()) === 1, 'cost chart missing')
    })

    await step('Mark the cook off tomorrow', async () => {
      await page.getByRole('radio', { name: 'Cook' }).click()
      await page.getByRole('button', { name: /Mark a day off/ }).click()
      await page.getByRole('button', { name: /^Tomorrow/ }).click()
      await page.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(400)
      expect((await page.getByTestId('leave-list').innerText()).includes('Tomorrow'), 'leave not listed')
    })

    await step('Cook signs up on her own, adds two houses, sees her route', async () => {
      await page.getByRole('link', { name: 'Profile' }).click()
      await page.getByRole('button', { name: /Sign out/ }).click()
      await page.getByRole('button', { name: /मैं कुक हूँ/ }).click()
      await page.getByPlaceholder('जैसे: Sunita').fill('Radha')
      await page.getByRole('button', { name: /शुरू करें/ }).click()
      await page.getByTestId('cook-empty').waitFor({ timeout: 5000 })
      // a wrong code explains what to do instead of dead-ending
      await page.getByRole('button', { name: /^घर जोड़ें$/ }).click()
      await page.getByRole('textbox').fill('ZZZZZZ')
      await page.getByRole('button', { name: /^जोड़ें$/ }).click()
      expect((await page.getByRole('alert').innerText()).includes('RASOI1'), 'no help shown for an unknown code')
      // the family's real code (same phone) takes over the profile the family set up
      await page.getByRole('textbox').fill(code)
      await page.getByRole('button', { name: /^जोड़ें$/ }).click()
      await page.getByTestId('cook-house').first().waitFor({ timeout: 5000 })
      await page.getByRole('radio', { name: /कल/ }).click()
      expect((await page.getByTestId('cook-off').count()) === 1, 'tomorrow should show as a day off at the first house')
      await page.getByRole('radio', { name: /आज/ }).click()
      // the demo family code works on any phone
      await page.getByRole('button', { name: /घर जोड़ें/ }).first().click()
      await page.getByRole('textbox').fill('RASOI2')
      await page.getByRole('button', { name: /^जोड़ें$/ }).click()
      await page.waitForTimeout(500)
      expect((await page.getByTestId('my-houses').locator(':scope > li').count()) === 2, 'expected two houses in the cook app')
      expect((await page.getByTestId('cook-house').count()) === 2, 'both houses should show for the day')
      const cooksAtHome = await page.evaluate((c) => {
        const d = JSON.parse(localStorage['rasoi:db:v1'])
        const hh = Object.values(d.households).find((h) => h.code === c)
        return Object.values(d.cooks).filter((x) => x.householdId === hh.id).length
      }, code)
      expect(cooksAtHome === 1, `joining should reuse the family's cook profile, found ${cooksAtHome}`)
      // a day off for one house only, with a WhatsApp message ready for that family
      await page.getByRole('button', { name: /मैं नहीं आऊँगी/ }).click()
      await page.getByRole('button', { name: /^आज/ }).click()
      await page.getByRole('button', { name: 'Mehta house' }).last().click()
      await page.getByRole('button', { name: /सेव करें/ }).click()
      const tell = await page.getByTestId('leave-notify').getByRole('link').count()
      expect(tell === 1, `expected one family to notify, got ${tell}`)
      await page.getByRole('button', { name: /हो गया/ }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: /बाहर निकलें/ }).click()
      await page.getByRole('button', { name: /Naina/ }).click()
      await page.waitForTimeout(300)
    })

    await step('Data survives a reload', async () => {
      await page.reload()
      await page.waitForTimeout(500)
      expect((await page.getByRole('tab').count()) === 2, 'household lost after reload')
    })

    await step('Demo household and every tab render', async () => {
      await page.getByRole('link', { name: 'Profile' }).click()
      await page.getByRole('button', { name: /Load demo household/ }).click()
      await page.getByRole('button', { name: 'Load demo' }).click()
      await page.waitForTimeout(500)
      for (const t of ['Week', 'Log', 'Progress', 'Profile', 'Home']) {
        await page.getByRole('link', { name: t }).click()
        await page.waitForTimeout(250)
      }
      expect((await page.getByTestId('daily-summary').count()) === 1, 'daily summary missing')
      await page.getByRole('link', { name: 'Progress' }).click()
      await page.waitForTimeout(400)
      for (const id of ['chart-kcal', 'chart-protein', 'chart-meals', 'chart-macros', 'chart-together', 'chart-trend']) {
        expect((await page.getByTestId(id).count()) === 1, `${id} missing on Progress`)
      }
      await page.getByRole('link', { name: 'Home' }).click()
      await page.getByTestId('kitchen-strip').waitFor({ timeout: 5000 }).catch(() => {})
      expect((await page.getByTestId('kitchen-strip').count()) === 1, 'cook strip missing on Home')
    })
    await ctx.close()

    await step('No sideways scrolling at 360px (light and dark)', async () => {
      for (const colorScheme of ['light', 'dark']) {
        const c = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, colorScheme })
        const p = await c.newPage()
        watch(p)
        await p.goto(URL)
        await p.getByRole('button', { name: 'Try demo' }).click()
        const check = async (label) => {
          await p.waitForTimeout(300)
          const sw = await p.evaluate(() => document.documentElement.scrollWidth)
          expect(sw <= 360, `${colorScheme} ${label} is ${sw}px wide`)
        }
        for (const t of ['Home', 'Week', 'Log', 'Progress', 'Profile']) {
          await p.getByRole('link', { name: t }).click()
          await check(t)
        }
        await p.getByRole('link', { name: 'Week' }).click()
        for (const sec of ['Groceries', 'Budget', 'Cook']) {
          await p.getByRole('radio', { name: sec }).click()
          await check(sec)
        }
        await p.getByRole('button', { name: /Open her app here/ }).click()
        await check('cook app')
        await c.close()
      }
    })

    // The public site (hash-routed build): the cook's link opens with no login.
    await step('Public site: daily cook link, house link sign-up and demo houses', async () => {
      const web = await startServer('dist', 4176)
      try {
        const c = await browser.newContext({ ...devices['iPhone 13'] })
        const p = await c.newPage()
        watch(p)
        await p.goto('http://localhost:4176/')
        await p.getByRole('button', { name: 'Try demo' }).click()
        await p.getByRole('link', { name: 'Week' }).click()
        await p.getByRole('radio', { name: 'Cook' }).click()
        await p.getByRole('radio', { name: 'Tomorrow' }).click()
        const href = await p.getByRole('link', { name: /Share to group|Share on WhatsApp/ }).first().getAttribute('href')
        const text = decodeURIComponent(href.split('?text=')[1])
        const link = text.match(/https?:\/\/\S+#\/c\/\S+/)
        expect(link, 'no cook link in the WhatsApp message')
        const fresh = await browser.newContext({ ...devices['iPhone 13'] }) // a different phone: no stored data
        const cp = await fresh.newPage()
        watch(cp)
        await cp.goto(link[0].replace(/^https?:\/\/[^/]+\/(rasoi\/)?/, 'http://localhost:4176/'))
        await cp.getByTestId('cook-link').waitFor({ timeout: 8000 })
        expect((await cp.getByTestId('cook-menu').count()) === 1, 'menu not shown from the link')
        expect((await cp.getByRole('link', { name: /वीडियो देखें|Watch how to make/ }).count()) > 0, 'no recipe video buttons')
        expect((await cp.getByRole('button', { name: /सुनें|Listen/ }).count()) > 0, 'no listen buttons')
        const reply = await cp.getByRole('link', { name: /बन गया|Done/ }).getAttribute('href')
        expect(reply.startsWith('https://wa.me/'), 'done button does not open WhatsApp')
        // the house link: on a phone that has never seen Rasoi, it is the cook's whole sign-up
        const share = await p.getByTestId('cook-own-app').getByRole('link', { name: /Share to group|Share on WhatsApp/ }).getAttribute('href')
        const hl = decodeURIComponent(share.split('?text=')[1]).match(/https?:\/\/\S+#\/h\/\S+/)
        expect(hl, 'no house link in the invite message')
        const phone = await browser.newContext({ ...devices['iPhone 13'] })
        const hp = await phone.newPage()
        watch(hp)
        await hp.goto(hl[0].replace(/^https?:\/\/[^/]+\/(rasoi\/)?/, 'http://localhost:4176/'))
        await hp.getByTestId('house-link').waitFor({ timeout: 8000 })
        await hp.getByRole('button', { name: /शुरू करें|Start/ }).click()
        await hp.getByTestId('cook-house').waitFor({ timeout: 8000 })
        expect((await hp.getByTestId('cook-menu').count()) + (await hp.getByTestId('cook-off').count()) === 1, 'menu missing after adding the house by link')
        expect((await hp.getByTestId('my-houses').innerText()).includes('Home'), 'house not listed in the cook app')
        // and the demo houses for someone just trying it out
        const trial = await browser.newContext({ ...devices['iPhone 13'] })
        const tp = await trial.newPage()
        watch(tp)
        await tp.goto('http://localhost:4176/')
        await tp.getByRole('button', { name: /मैं कुक हूँ/ }).click()
        await tp.getByPlaceholder('जैसे: Sunita').fill('Radha')
        await tp.getByRole('button', { name: /शुरू करें/ }).click()
        await tp.getByTestId('try-demo-houses').click()
        await tp.getByTestId('cook-route').waitFor({ timeout: 8000 })
        expect((await tp.getByTestId('cook-route').locator('li').count()) >= 2, 'route should list visits at both demo houses')
        await c.close()
        await fresh.close()
        await phone.close()
        await trial.close()
      } finally {
        stop(web)
      }
    })

    await step('No console errors', async () => expect(errors.length === 0, errors.slice(0, 3).join(' | ')))
  } finally {
    await browser.close()
    stop(server)
  }
  for (const r of results) console.log(r.join('  '))
  const failed = results.filter((r) => r[0] === '✗').length
  console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`)
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
