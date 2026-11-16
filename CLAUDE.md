# Rasoi — working notes for Claude

Shared 7-day meal planner + food tracker for two people (Samridhi and Naina). React 18 + TypeScript + Tailwind + framer-motion + vaul. Mobile-first.

## The phone link (what the user actually opens)

- Live app: https://claude.ai/artifact/TeKtzRJc1CdJRGS2xTwDfK — the user opens this on their phone.
- It is built from `dist-mobile/index.html` (one self-contained file: JS, CSS and fonts inlined).
- The user often prompts from their phone. After **every** change they ask for, finish the loop below without waiting to be asked, so the link is always current.

## The loop for every change

1. Make the change in `src/`.
2. `npm run smoke` — typechecks, builds `dist-mobile/`, and runs the end-to-end checks on an emulated iPhone (onboarding, join by code, ticking, partial portions, add food, demo, every tab, no sideways scroll at 360px in light and dark, no console errors). Fix anything that fails. Add a check to `scripts/smoke.cjs` when you add a feature.
3. Republish the phone link: Artifact tool, `action: "publish"`, `file_path: /home/user/rasoi/dist-mobile/index.html`, `url: https://claude.ai/artifact/TeKtzRJc1CdJRGS2xTwDfK` (read it first if this conversation has not published it). Never publish without `url` — that would create a second link.
4. Commit and push to the working branch.
5. Tell the user in a line or two what changed and that the same link is updated (they may need to pull to refresh).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :5173 (normal web build, real URL routing, `/join/CODE` links) |
| `npm run smoke` | Build mobile page + full end-to-end check suite |
| `npm run build:mobile` | Only build `dist-mobile/index.html` |
| `npm run build` | Normal web build in `dist/` (for Vercel/Netlify; installable as a home-screen app) |
| `npm run typecheck` | TypeScript only |
| `npm run plan:totals` | Print estimated daily kcal/protein of the seeded plan per portion style |

## Two build targets

`src/app/target.ts` → `IS_MOBILE_PAGE` is true for the phone link. Differences: in-memory routing (the hosted page can't use URL paths), invites shared as a **code** instead of a link, no service worker/manifest. Everything else is identical.

## Architecture

- `src/data/types.ts` — entities (User, Household, HouseholdMember, MealPlan, Meal, Food, FoodLog, Recipe, WeightLog…).
- `src/data/store.ts` — in-memory DB persisted to localStorage; who-you-are is per-tab in sessionStorage.
- `src/data/repository.ts` — every read and mutation the UI uses. Swap this for Supabase (`supabase/schema.sql`) to share across phones.
- `src/data/foods.ts`, `src/data/mealPlanSeed.ts` — nutrition estimates and the 7-day rotation with lighter/hearty portions.
- `src/lib/nutrition.ts` (portions, targets, ramp), `src/lib/summary.ts` (day view, insights, weekly review).
- `src/screens/*` — Onboarding, Invite, Home, Week, Log, Progress, Profile.

## Kitchen: cook, groceries, WhatsApp, Zepto

- **Cook** (`Cook`, `CookLeave` in `types.ts`; actions in `repository.ts`): name, WhatsApp number, Hindi/English, visits (time + which meals), weekly off, marked leave. Family manages it in Week → Cook. The cook joins with the household code ("I'm the cook") and gets `src/screens/CookApp.tsx`: big text, Today/Tomorrow/Week, "I'm not coming", "My timings". Joining claims the existing cook profile instead of duplicating it.
- **What to cook**: `src/lib/kitchen.ts` → `cookSlots` adds up both people's personal portions per dish (e.g. 5 chapatis = 2 + 3), with the main raw ingredient ("≈ 200 g paneer") and soak reminders for tomorrow. Hindi names, cook notes and raw ingredients per serving live in `src/data/kitchen.ts`. Countable items (chapati, chilla, eggs) are always whole numbers.
- **WhatsApp**: `cookMessage` / `weekMenuMessage` / `groceryMessage` build the text; buttons open `https://wa.me/<number>?text=…` (cook's chat) or `wa.me/?text=…` (pick the house group). Automatic group posting needs Meta's WhatsApp Business Groups API (business account, server, webhooks): not possible from the phone page.
- **Zepto**: no public API exists (checked Nov 2026), so there are no keys to connect. Groceries are generated from the week's plan; each line opens Zepto search (`zeptoSearchUrl`). If Zepto ever publishes a cart API, plug it in there.
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
- Data on the phone link lives in that phone's browser only. Two phones (or the cook's own phone) don't share data until a sync layer exists. Options: the artifact `db` capability (everyone needs a claude.ai account and access to the link) or Supabase on a normal web host (the phone page can't call outside hosts).
- `scripts/smoke.cjs` must kill the preview server's whole process group (`detached` + `process.kill(-pid)`), or the port stays busy.
- `npx tsx --tsconfig tsconfig.json scripts/kitchen-preview.ts [YYYY-MM-DD]` prints the demo cook's WhatsApp message (EN + HI) and the grocery list — handy when changing kitchen logic.
