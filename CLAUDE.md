# Rasoi — working notes for Claude

Shared 7-day meal planner + food tracker for two people (Samridhi and Naina). React 18 + TypeScript + Tailwind + framer-motion + vaul. Mobile-first.

## Where it runs

- **Public site (share this):** https://sammy1804.github.io/rasoi/ — built from `dist/` by `.github/workflows/deploy.yml` on every push to the working branch. Anyone can open it; no Claude account needed. Hash-routed (`/#/join/CODE`, `/#/c/<menu>`), so it works on any static host. Needs GitHub Pages enabled once (repo Settings → Pages → Source: GitHub Actions).
- **Claude phone page:** https://claude.ai/artifact/TeKtzRJc1CdJRGS2xTwDfK — built from `dist-mobile/index.html` (one self-contained file). Private to the user; routes in memory; links it generates point at the public site (`publicBase()` in `src/app/target.ts`).
- The user often prompts from their phone. After **every** change they ask for, finish the loop below without waiting to be asked, so both are current.

## The loop for every change

1. Make the change in `src/`.
2. `npm run smoke` — typechecks, builds both targets, and runs the end-to-end checks on an emulated iPhone (onboarding, join by code, ticking, partial portions, add food, cook, groceries by shop, budget, the cook's link on the public build, every tab, no sideways scroll at 360px in light and dark, no console errors). Fix anything that fails. Add a check to `scripts/smoke.cjs` when you add a feature. It takes about 3 minutes: run it with a long timeout.
3. Republish the Claude phone page: Artifact tool, `action: "publish"`, `file_path: /home/user/rasoi/dist-mobile/index.html`, `url: https://claude.ai/artifact/TeKtzRJc1CdJRGS2xTwDfK` (read it first if this conversation has not published it). Never publish without `url` — that would create a second link.
4. Commit and push to the working branch — this redeploys the public site. Check the "Deploy to GitHub Pages" run finished.
5. Tell the user in a line or two what changed and that the same links are updated (pull to refresh).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :5173 (public-site build, hash routes like `/#/join/CODE`) |
| `npm run smoke` | Build both targets + full end-to-end check suite (~3 min) |
| `npm run build:mobile` | Only build `dist-mobile/index.html` |
| `npm run build` | Public site in `dist/` (GitHub Pages; installable as a home-screen app) |
| `npm run typecheck` | TypeScript only |
| `npm run plan:totals` | Print estimated daily kcal/protein of the seeded plan per portion style |

## Two build targets

`src/app/target.ts` → `IS_MOBILE_PAGE` is true for the Claude phone page. Differences: in-memory routing, invites shared as a **code** instead of a link, no manifest. Everything else is identical. `publicLink(route)` builds links for other people and always points at the public site.

## Architecture

- `src/data/types.ts` — entities (User, Household, HouseholdMember, MealPlan, Meal, Food, FoodLog, Recipe, WeightLog…).
- `src/data/store.ts` — in-memory DB persisted to localStorage; who-you-are is per-tab in sessionStorage.
- `src/data/repository.ts` — every read and mutation the UI uses. Swap this for Supabase (`supabase/schema.sql`) to share across phones.
- `src/data/foods.ts`, `src/data/mealPlanSeed.ts` — nutrition estimates and the 7-day rotation with lighter/hearty portions.
- `src/lib/nutrition.ts` (portions, targets, ramp), `src/lib/summary.ts` (day view, insights, weekly review).
- `src/screens/*` — Onboarding, Invite, Home, Week, Log, Progress, Profile.

## Kitchen: cook, groceries, WhatsApp, Zepto

- **Family's cook profile** (`Cook`, `CookLeave` in `types.ts`; actions in `repository.ts`): name, WhatsApp number, Hindi/English, visits (time + which meals), weekly off, marked leave. Family manages it in Week → Cook.
- **The cook's own app** (`src/screens/CookApp.tsx`): she has her own account (`CookAccount`: just name + language, created from Welcome → "मैं कुक हूँ" or by opening a house link) and can work at **several houses**. A house is either a `Cook` record on this phone linked by `userId` (added with the family code — it takes over the profile the family set up rather than duplicating it) or a `CookHouse` added from a family's **house link** (`/h/:data`, `src/screens/HouseLink.tsx`). The app shows the day's route across all houses in time order, each house's menu, a house filter, per-house timings, and days off per house with a WhatsApp message ready for each family. `housesFor()` hides the difference between the two kinds.
- **House link**: `buildHouseSnapshot` packs the house (name, people, her timings, reply number) plus the menu for each weekday, deflate-compressed (~1,200 chars). The plan repeats weekly, so the link stays right until the family changes the plan and re-sends; re-importing refreshes the menu but keeps timings the cook changed herself. This is how a house gets onto the cook's *own* phone without a backend. A typed family code only finds households stored on the same phone.
- **Demo family codes**: `RASOI1` (Samridhi & Naina's "Home") and `RASOI2` ("Mehta house") work on any phone: `ensureDemoHouse` adds the demo house into the existing data. Real codes never contain O, I or 1, so they can't clash. "Try with demo houses" in the cook's empty state adds both.
- **What to cook**: `src/lib/kitchen.ts` → `cookSlots` adds up both people's personal portions per dish (e.g. 5 chapatis = 2 + 3), with the main raw ingredient ("≈ 200 g paneer") and soak reminders for tomorrow. Hindi names, cook notes and raw ingredients per serving live in `src/data/kitchen.ts`. Countable items (chapati, chilla, eggs) are always whole numbers.
- **The cook's link** (`src/screens/CookLink.tsx`, route `/c/:data`): the WhatsApp message ends with a link that carries the whole day's menu inside it (`encodeCookDay` / `decodeCookDay`, ~800 chars). The cook taps it on her own phone and sees pictures, big numbers, a listen button (`src/lib/speech.ts`, phone's built-in Hindi/English voice) and a recipe video per dish (family-chosen link in `household.recipeVideos`, else a YouTube search). "Done" and "I'm not coming" open WhatsApp to `household.contactPhone`. No login, no backend. `CookDay` is plain data shared by the in-app view, the link, speech and the WhatsApp text — keep it serialisable. Bump the version number in the packed format if its shape changes.
- **Cook on a shared phone**: Week → Cook → "Open her app here" (`signInAsCook`), or she picks herself under "On this phone" on the welcome screen.
- **WhatsApp**: `cookMessage` / `weekMenuMessage` / `groceryMessage` build the text; buttons open `https://wa.me/<number>?text=…` (cook's chat) or `wa.me/?text=…` (pick the house group). Automatic group posting needs Meta's WhatsApp Business Groups API (business account, server, webhooks): not possible from a static site.
- **Groceries by shop** (`src/screens/Groceries.tsx`, logic in `src/lib/kitchen.ts`): three kinds of shop — `quick` (Zepto etc., chosen order days; the list covers from the next order day until the one after), `bulk` (DMart, a month of staples), `subscription` (Country Delight; per-weekday amounts and a "set: 500 ml daily" hint, never in order lists). Defaults: milk/curd/paneer → subscription, `PANTRY` → bulk, the rest → quick; per-item override in `household.itemShop`.
- **Filling the cart automatically**: Zepto (`https://mcp.zepto.co.in/mcp`, github.com/zeptonow/mcp) and Swiggy Instamart (`https://mcp.swiggy.com/im`) run official MCP connectors for AI assistants; neither has a normal REST API, and Country Delight / DMart / Blinkit have nothing public. So "Fill my Zepto cart with Claude" copies `orderPrompt(...)`: the user pastes it into a Claude chat that has the store's connector (one-time: add custom connector, sign in with mobile + OTP) and Claude fills the real cart, stopping before payment. Tool names aren't documented, so don't hard-code them. If the user adds the connector to this session and asks you to order, show the cart and total and get an explicit yes before any step that places an order or pays.
- **Budget** (`BudgetPanel`): `PRICES` in `src/data/kitchen.ts` are rough ₹ per kg / litre / piece, editable per item (`household.prices`). `monthlyEstimate` = a typical week × 30/7, split by shop. `household.budgetMonthly`, `SpendLog` entries (logged from ticked items or by hand), month-to-date vs pace.
- **Graphs** (`src/components/charts.tsx`): calories/protein per day, meal-completion grid, macro split, both-people protein (% of own target, one axis), 4-week trend. Chart colours are the validated `--c1/--c2/--c3` tokens; don't add colours without re-running the dataviz palette validator.

## Product rules (from the user — keep them)

- Same household meal, different portions per person. Samridhi: lighter, egg whites only, ~1,650 kcal, 75–90 g protein. Naina: hearty, gradual breakfast ramp, 65–75+ g protein.
- Never include kaddu, matar paneer, plain soy-bean sabzi, unfamiliar regional vegetable names or complicated recipes. Lauki never as a shared meal. Aloo only paired with another veg.
- Paneer as bhurji / kadai / tikka / chilla topping / curd-cashew dip. Soy as keema / crispy chunks / cutlets.
- Numbers are estimates — always say so; never medical advice. No guilt language. Don't encourage daily weighing.
- Design: warm off-white, charcoal type, one muted terracotta accent, soft borders, mobile-first, one-hand use. Light and dark themes come from tokens in `src/index.css` — never hard-code a colour.

## Gotchas

- Don't use `AnimatePresence mode="wait"` for step/page transitions — it got stuck unmounting. Use enter-only keyed `motion.div`.
- The Home swipe area swallows the click that ends a drag (`onClickCapture`); keep that when editing it.
- Data lives in each phone's browser only. The cook's link works around this by carrying the menu itself, but ticks, leave and budget don't sync between phones until a sync layer exists. Options: the artifact `db` capability (everyone needs a claude.ai account and access to the link) or Supabase on a normal web host (the phone page can't call outside hosts).
- `scripts/smoke.cjs` must kill the preview server's whole process group (`detached` + `process.kill(-pid)`), or the port stays busy.
- `npx tsx --tsconfig tsconfig.json scripts/kitchen-preview.ts [YYYY-MM-DD]` prints the demo cook's WhatsApp message (HI + EN), the cook link size, the Zepto order prompt, shop lists and cost estimate — handy when changing kitchen logic.
- Text-to-speech and YouTube links depend on the phone: listen buttons hide themselves where the browser has no speech support (e.g. inside the Claude app's page viewer).
