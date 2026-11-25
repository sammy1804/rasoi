# Rasoi — eat better, together

A shared 7-day meal planner and food tracker for two people who live together. You eat the same home-cooked meals, but each person has their own goals, so each sees their own portions.

> One kitchen. One meal plan. Your own goals.

## Open it

**https://sammy1804.github.io/rasoi/** — the public site. Anyone can open it on any phone; no account needed. It redeploys on every push (GitHub Pages; enable once in repo Settings → Pages → Source: GitHub Actions). Add it to your home screen to use it like an app.

Your data stays on your phone. Light and dark themes follow the phone's setting.

### Put it on your home screen

- **iPhone:** open the link in Safari → Share → **Add to Home Screen** → Add.
- **Android:** open it in Chrome → **Install Rasoi** (or ⋮ → Install app).

It opens full screen from its own icon, works offline, and updates itself: after a new version is pushed you'll see **Update** at the top. On iPhone the home-screen app keeps its own data, so use **Profile → Copy my data** in the old copy and **Bring my data** in the new one. Anything that replaces your data (demo, reset, import) keeps the previous copy: **Profile → Put back the previous data**.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build in dist/
npm run smoke      # build the phone page + run the end-to-end checks on an emulated iPhone
```

`npm run build` also produces an installable home-screen web app (manifest + icons) if you deploy `dist/` to Vercel or Netlify.

Built with React 18, TypeScript, Tailwind CSS, shadcn/ui-style primitives (cva + `cn`, a vaul/Radix bottom-sheet "Drawer"), framer-motion and lucide icons.

## Try it in 2 minutes

1. **Onboard as Samridhi.** Open the app and tap **Create a shared plan**. Tap **Fill in as Samridhi** to prefill her details, or type your own. Then create the household.
2. **Invite.** Copy the invite link (`/join/XXXXXX`) or share the 6-letter code.
3. **Onboard as Naina.** Open the invite link in a **new browser tab**, tap *I'm someone else — join*, then **Fill in as Naina**. Both tabs stay in sync live.
4. **Tick meals.** Tap the circle when you've eaten something. Tap the item, or ✎, to log what you actually had: ½ cup, 75 %, skipped, or a swap (rice ⇄ chapati).
5. Switch people on one phone from **Profile → Switch to Naina**.

Or tap **Try demo** on the welcome screen. It loads Samridhi and Naina with two weeks of history and weekly weigh-ins. **Profile → Reset all data** starts over.

## What's in it

| Area | What it does |
|---|---|
| Onboarding | 6 short screens: welcome → create/join → about you → food preferences → targets → household/invite. Targets are suggested (Mifflin-St Jeor ± 300 kcal), clearly labelled as estimates, and always editable. |
| Personal portions | Each meal item has *lighter* and *hearty* portions; *standard* is interpolated. Example: Kadai paneer is 1 katori (80–100 g paneer) + 1–2 chapatis for Samridhi and 1¼ katori (100–120 g) + 2–3 chapatis + optional curd for Naina. Per-style food swaps are supported too: Samridhi's curd is high-protein dahi. |
| Diet & dislikes | Egg-yolk items are hidden for "egg whites only". Disliked foods are flagged with a gentle "swap?" tag. |
| Breakfast ramp | For small morning appetites: breakfast starts at 70 % and grows 10 % a week. |
| Home | Today's date, a week strip, person tabs, calorie and protein bars, a 4-meal checklist (○ planned · ✓ eaten · ◐ partly · × skipped), extras, a daily summary, optional water and kind, non-judgemental insights. Swipe left or right to change day. |
| Week | 7-day plan in two views, *My portions* or *Shared menu*. Tap any meal to add or remove dishes, or tune the lighter and hearty amounts. A reset button restores the original rotation. |
| Log | Everything you ate with macros, the empty state, and your household's custom foods and recipes. |
| Add food | Search plus categories (Breakfast, Lunch, Dinner, Snacks, Drinks, Fruits, Homemade, Custom), quantity presets, unit switching (piece, katori, cup, g, ml, tbsp…), a custom-food form, and a **recipe builder** that estimates nutrition per serving. |
| Progress | Weekly review: average calories and protein, protein days, meals completed, most-skipped meal, most-eaten foods and vegetable variety. Optional weight is shown as weekly or monthly averages, and weight is never shown to the other person. |
| Sharing | Each person chooses what the other sees: full log, calories, protein and/or meal completion. |

## Say it, type it or snap it

Tap **Add food** (or the camera on any meal) and tell Rasoi what you ate: "2 roti, 1 katori dal and half a cup of rice", "skipped breakfast, had poha and chai instead" — in English, Hinglish or Hindi. It works out the foods and amounts, you confirm, and the planned items you didn't eat can be marked skipped in the same step. Talking uses your phone's speech recognition. Photos are kept with the meal; when you open Rasoi from the Claude link, Claude also reads the photo and works out what's on the plate by itself.

## Steps and workouts

Add the day's steps and workouts from the movement card on Home (type them, or say "8,000 steps and 45 min yoga"). Rasoi estimates the calories burned and lets your calorie target follow the day: a more active day adds calories, a quieter one takes a little off, by at most 250 kcal. Today's target only ever goes up as you move. Progress shows steps, calories burned and calories eaten against each day's own target. You can switch the adjustment off in Profile.

## Kitchen: cook, groceries, budget

- **Your cook** (Week → Cook, or during onboarding): name, WhatsApp number, Hindi or English, when they come and which meals, regular day off. Mark days they're not coming; Home shows it.
- **What to cook, how much**: Rasoi adds up both people's portions (*Chapati — 5: Samridhi 2, Naina 3*), shows the main raw ingredient (*≈ 200 g paneer*) and reminds about soaking rajma or chhole the night before.
- **The cook's link**: the WhatsApp message ends with a link. On her own phone, with no app or login, she sees the menu with pictures and big numbers, can **listen** to it in Hindi or English, and can open a **recipe video** for any dish (your chosen YouTube link, or a search). "Done" and "I'm not coming" send you a WhatsApp message.
- **The cook's own app**: on the welcome screen she taps "मैं कुक हूँ", gives her name and language, and adds every house she cooks at — by tapping a family's **house link** (Week → Cook → "Send to …") or typing a family code. She sees the day's route across all her houses, each menu with amounts, and can mark days off per house. Try it with the demo family codes **RASOI1** and **RASOI2**.
- **Groceries by shop**: fresh items for your next **Zepto** order (pick your order days, e.g. Mon/Wed/Sat), a monthly **DMart** list for staples, and a **Country Delight** plan showing how much milk, curd and paneer to subscribe to. Move any item between shops with ⇄.
- **Automatic cart**: "Fill my Zepto cart with Claude" hands Claude the exact list; with Zepto's connector added to Claude, it fills your real cart and stops before paying. Instamart works the same way.
- **Budget**: set a monthly grocery budget, see what the plan costs by shop, correct any price, log orders, and see how the month is going.
- **Graphs** on Progress: calories and protein per day, meal-completion grid, where calories come from, both of you side by side, and a 4-week trend.

## Data layer

```
src/data/types.ts       entities: User, Household, HouseholdMember, MealPlan, Meal, Food, FoodLog, Recipe, WeightLog (+ water, choices)
src/data/store.ts       observable in-memory DB persisted to localStorage; per-tab session in sessionStorage
src/data/repository.ts  every read/mutation the UI uses (createHousehold, joinHousehold, upsertLog, saveRecipe, …)
src/data/foods.ts       ~80 built-in foods, per-100 g estimates for home cooking
src/data/mealPlanSeed.ts the household's 7-day rotation with lighter/hearty portions
src/data/demo.ts        deterministic demo household
supabase/schema.sql     the equivalent Postgres schema with RLS, join-by-code RPC and realtime
```

**Sharing across two phones.** The prototype keeps data in the browser, so invite links work between tabs of the same browser. To share between two devices:

1. Apply `supabase/schema.sql`.
2. Re-implement the functions in `repository.ts` with supabase-js. The UI only calls these functions.
3. Swap the `storage` listener in `store.ts` for a realtime channel filtered by `household_id`.

## A note on numbers

Calories and protein are approximations for home-cooked food, and every logged entry can be edited. Rasoi is a planning aid, not medical or dietary advice.

`npm run plan:totals` prints the seeded plan's estimated daily totals for each portion style.
