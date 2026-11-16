import type { Food, MealSlot, Nutrients, Profile } from '@/data/types'
import { gramsFor, nutrientsFor } from './nutrition'

/**
 * Turning "2 roti, ek katori dal and half a cup of rice" (typed or spoken) into
 * foods and amounts. This matcher runs on the phone with no network, so it
 * works everywhere; where Claude is available (see lib/assistant.ts) it handles
 * photos and looser sentences, and both produce the same `Understood` shape.
 */

export interface UnderstoodItem {
  key: string
  /** what the person said for this item */
  phrase: string
  /** a food from the library, when recognised */
  food?: Food
  amount: number
  unit: string
  /** for things not in the library: a name and an estimate for the amount eaten */
  custom?: { name: string; nutrients?: Nutrients }
  confidence?: 'high' | 'medium' | 'low'
}

export interface Understood {
  items: UnderstoodItem[]
  slot?: MealSlot
  /** the person ate this instead of what was planned, or skipped the planned meal */
  replacePlanned: boolean
  note?: string
  by: 'claude' | 'match'
}

/* ——————————— words ——————————— */

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, ek: 1, 'एक': 1, two: 2, do: 2, 'दो': 2, couple: 2, three: 3, teen: 3, tin: 3, 'तीन': 3, four: 4, char: 4, chaar: 4, 'चार': 4,
  five: 5, paanch: 5, panch: 5, 'पांच': 5, 'पाँच': 5, six: 6, chhe: 6, cheh: 6, 'छह': 6, 'छः': 6, seven: 7, saat: 7, 'सात': 7, eight: 8, aath: 8, 'आठ': 8,
  nine: 9, nau: 9, 'नौ': 9, ten: 10, das: 10, 'दस': 10,
  half: 0.5, aadha: 0.5, adha: 0.5, aadhi: 0.5, 'आधा': 0.5, 'आधी': 0.5, quarter: 0.25, pav: 0.25, 'पाव': 0.25,
  dedh: 1.5, 'डेढ़': 1.5, dhai: 2.5, adhai: 2.5, 'ढाई': 2.5, sava: 1.25, 'सवा': 1.25, '½': 0.5, '¼': 0.25, '¾': 0.75,
}

/** spoken unit → a canonical unit and roughly how much it holds (g or ml) */
const UNIT_WORDS: Record<string, { unit: string; grams?: number }> = {
  katori: { unit: 'katori', grams: 150 }, katoris: { unit: 'katori', grams: 150 }, bowl: { unit: 'katori', grams: 150 }, bowls: { unit: 'katori', grams: 150 }, 'कटोरी': { unit: 'katori', grams: 150 },
  cup: { unit: 'cup', grams: 200 }, cups: { unit: 'cup', grams: 200 }, 'कप': { unit: 'cup', grams: 200 },
  glass: { unit: 'glass', grams: 250 }, glasses: { unit: 'glass', grams: 250 }, gilas: { unit: 'glass', grams: 250 }, 'गिलास': { unit: 'glass', grams: 250 },
  plate: { unit: 'plate', grams: 250 }, plates: { unit: 'plate', grams: 250 }, 'प्लेट': { unit: 'plate', grams: 250 },
  slice: { unit: 'slice' }, slices: { unit: 'slice' }, piece: { unit: 'piece' }, pieces: { unit: 'piece' }, pc: { unit: 'piece' }, pcs: { unit: 'piece' },
  tbsp: { unit: 'tbsp', grams: 15 }, tablespoon: { unit: 'tbsp', grams: 15 }, tablespoons: { unit: 'tbsp', grams: 15 }, spoon: { unit: 'tbsp', grams: 15 }, spoons: { unit: 'tbsp', grams: 15 }, chammach: { unit: 'tbsp', grams: 15 }, 'चम्मच': { unit: 'tbsp', grams: 15 },
  tsp: { unit: 'tsp', grams: 5 }, teaspoon: { unit: 'tsp', grams: 5 }, teaspoons: { unit: 'tsp', grams: 5 },
  handful: { unit: 'handful', grams: 20 }, handfuls: { unit: 'handful', grams: 20 }, mutthi: { unit: 'handful', grams: 20 },
  g: { unit: 'g', grams: 1 }, gm: { unit: 'g', grams: 1 }, gms: { unit: 'g', grams: 1 }, gram: { unit: 'g', grams: 1 }, grams: { unit: 'g', grams: 1 }, 'ग्राम': { unit: 'g', grams: 1 },
  ml: { unit: 'ml', grams: 1 }, kg: { unit: 'g', grams: 1000 }, litre: { unit: 'ml', grams: 1000 }, liter: { unit: 'ml', grams: 1000 },
}

const SIZE_WORDS: Record<string, number> = { small: 0.75, chhota: 0.75, chota: 0.75, little: 0.75, big: 1.5, large: 1.5, bada: 1.5, badi: 1.5, full: 1 }

const FILLER = new Set(
  'i i\'ve ive had have ate eaten eat took taken was were and of the some my for at in on with to it then also just today this morning afternoon evening night only plus me got made too later after before instead rather than planned plan meal food what wala wali maine mene mainne khaya khayi khaye khai liya li liye piya pi pee tha thi the bhi aur ke ka ki ko mein me se aaj subah dopahar shaam raat nahi nahin kiya kiye skip skipped skipping missed didn\'t didnt did not no nothing मैंने खाया खायी खाई खाए लिया ली पिया पी था थी भी और के का की को में से आज सुबह दोपहर शाम रात नहीं किया छोड़ दिया breakfast lunch dinner snack snacks nashta naashta नाश्ता खाना tiffin'.split(' '),
)

/** extra names people use, by food id */
const ALIASES: Record<string, string[]> = {
  chapati: ['roti', 'rotis', 'rotti', 'phulka', 'phulke', 'chapatti', 'chapathi', 'chapatis', 'रोटी', 'रोटियां', 'चपाती', 'फुल्का'],
  rice: ['chawal', 'chaawal', 'rice', 'plain rice', 'steamed rice', 'चावल', 'भात'],
  dal: ['dal', 'daal', 'dhal', 'arhar dal', 'toor dal', 'tur dal', 'yellow dal', 'dal tadka', 'दाल'],
  'moong-dal': ['moong dal', 'mung dal', 'moong daal', 'मूंग दाल'],
  'chana-dal': ['chana dal', 'chana daal', 'चना दाल'],
  rajma: ['rajma', 'rajmah', 'kidney beans', 'राजमा'],
  chhole: ['chole', 'chhole', 'chana masala', 'chickpea curry', 'छोले'],
  curd: ['dahi', 'curd', 'yogurt', 'yoghurt', 'दही'],
  'hp-curd': ['high protein dahi', 'high protein curd', 'greek yogurt', 'protein dahi', 'hp dahi', 'skyr'],
  milk: ['doodh', 'dudh', 'milk', 'दूध'],
  buttermilk: ['chaas', 'chhaas', 'buttermilk', 'mattha', 'lassi', 'छाछ'],
  chai: ['chai', 'tea', 'chay', 'चाय'],
  coffee: ['coffee', 'कॉफ़ी', 'कॉफी'],
  banana: ['kela', 'banana', 'bananas', 'केला'],
  apple: ['seb', 'apple', 'apples', 'सेब'],
  orange: ['santra', 'orange', 'oranges', 'संतरा'],
  papaya: ['papita', 'papaya', 'पपीता'],
  guava: ['amrood', 'guava', 'अमरूद'],
  pineapple: ['ananas', 'pineapple'],
  watermelon: ['tarbooz', 'tarbuj', 'watermelon', 'तरबूज'],
  'watermelon-juice': ['watermelon juice', 'tarbooz juice', 'tarbooz ka juice'],
  fruit: ['fruit', 'fruits', 'phal', 'fruit bowl', 'फल'],
  'egg-white': ['egg white', 'egg whites', 'boiled egg white', 'boiled egg whites', 'ande ki safedi', 'safedi'],
  'egg-whole': ['egg', 'eggs', 'anda', 'ande', 'boiled egg', 'boiled eggs', 'whole egg', 'अंडा', 'अंडे'],
  'egg-white-bhurji': ['egg bhurji', 'egg white bhurji', 'anda bhurji'],
  paneer: ['paneer', 'raw paneer', 'पनीर'],
  'paneer-bhurji': ['paneer bhurji', 'paneer burji', 'पनीर भुर्जी'],
  'kadai-paneer': ['kadai paneer', 'kadhai paneer', 'karahi paneer', 'paneer sabzi', 'paneer curry', 'कड़ाही पनीर'],
  'paneer-tikka': ['paneer tikka', 'tikka', 'पनीर टिक्का'],
  'paneer-dip': ['paneer dip', 'curd dip', 'cashew dip', 'dip'],
  'besan-chilla': ['chilla', 'cheela', 'chila', 'besan chilla', 'besan cheela', 'चीला', 'बेसन चीला'],
  bread: ['bread', 'toast', 'brown bread', 'ब्रेड'],
  'peanut-butter': ['peanut butter', 'pb'],
  muesli: ['muesli', 'musli', 'cereal', 'granola'],
  'oats-milk': ['oats', 'oatmeal', 'porridge', 'daliya', 'dalia', 'ओट्स'],
  poha: ['poha', 'pohe', 'पोहा'],
  upma: ['upma', 'उपमा'],
  idli: ['idli', 'idlis', 'idly', 'इडली'],
  dosa: ['dosa', 'dosas', 'plain dosa', 'डोसा'],
  paratha: ['paratha', 'parantha', 'aloo paratha', 'parathe', 'पराठा'],
  salad: ['salad', 'kachumber', 'सलाद'],
  'cucumber-tomato': ['cucumber tomato', 'kheera tamatar', 'cucumber and tomato'],
  cucumber: ['cucumber', 'kheera', 'kakdi', 'खीरा'],
  'baingan-bharta': ['baingan bharta', 'bharta', 'baigan bharta', 'baingan', 'brinjal', 'बैंगन भर्ता'],
  bhindi: ['bhindi', 'okra', 'lady finger', 'bhindi sabzi', 'भिंडी'],
  'aloo-beans': ['aloo beans', 'beans sabzi', 'beans', 'aloo and beans'],
  gobi: ['gobi', 'gobhi', 'cauliflower', 'gobi sabzi', 'गोभी'],
  'gobi-peas': ['gobi matar', 'gobi peas', 'gobhi matar'],
  'patta-gobi': ['patta gobi', 'cabbage', 'band gobi', 'bandh gobhi', 'पत्ता गोभी'],
  'patta-gobi-carrot': ['patta gobi carrot', 'cabbage carrot', 'cabbage and carrot'],
  'beetroot-carrot': ['beetroot carrot', 'beetroot and carrot', 'chukandar gajar'],
  'beetroot-sabzi': ['beetroot', 'chukandar', 'beet', 'चुकंदर'],
  'broccoli-stirfry': ['broccoli', 'broccoli stir fry'],
  lauki: ['lauki', 'ghiya', 'bottle gourd', 'लौकी'],
  'spinach-dal': ['palak dal', 'dal palak', 'spinach dal'],
  'soya-keema': ['soya keema', 'soy keema', 'soya kheema'],
  'soya-crispy': ['soya chunks', 'soy chunks', 'crispy soya', 'soya', 'nutrela'],
  'soya-cutlet': ['soya cutlet', 'cutlet', 'cutlets', 'tikki'],
  'kala-chana-chaat': ['kala chana', 'kala chana chaat', 'chana chaat', 'black chana'],
  'chhole-chaat': ['chole chaat', 'chhole chaat', 'chickpea chaat'],
  'sprouts-salad': ['sprouts', 'sprout salad', 'moong sprouts', 'ankurit'],
  nuts: ['nuts', 'dry fruits', 'dry fruit', 'almonds and cashews', 'kaju badam', 'badam kaju', 'mixed nuts'],
  almonds: ['almonds', 'almond', 'badam', 'बादाम'],
  peanuts: ['peanuts', 'moongphali', 'mungfali', 'मूंगफली'],
  'roasted-chana': ['roasted chana', 'bhuna chana', 'chana'],
  makhana: ['makhana', 'makhane', 'fox nuts', 'मखाना'],
  'dark-chocolate': ['dark chocolate', 'chocolate'],
  biscuits: ['biscuit', 'biscuits', 'cookies', 'cookie', 'बिस्कुट'],
  samosa: ['samosa', 'samosas', 'समोसा'],
  ghee: ['ghee', 'घी'],
  'coconut-water': ['coconut water', 'nariyal pani', 'nariyal paani'],
  'lemon-water': ['nimbu pani', 'nimbu paani', 'lemon water', 'lemonade', 'shikanji'],
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/(\d)\s*\/\s*(\d)/g, '$1/$2')
    .replace(/[^\p{L}\p{N}\p{M}/.'½¼¾ ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

interface Index {
  aliases: { alias: string; food: Food; tokens: string[]; weight: number }[]
}

export function buildIndex(foods: Food[]): Index {
  const aliases: Index['aliases'] = []
  for (const food of foods) {
    if (food.archived) continue
    const names = new Set<string>([norm(food.name.replace(/\(.*?\)/g, '')), ...(ALIASES[food.id] ?? []).map(norm)])
    if (food.hi) names.add(norm(food.hi.replace(/\(.*?\)/g, '')))
    for (const alias of names) if (alias) aliases.push({ alias, food, tokens: alias.split(' '), weight: 5 })
    // search tags are weaker hints than a food's own names
    for (const t of food.tags ?? []) if (t.length > 3 && !['custom', 'homemade', 'recipe', 'optional', 'staple'].includes(t) && !names.has(norm(t))) aliases.push({ alias: norm(t), food, tokens: norm(t).split(' '), weight: 0 })
  }
  return { aliases }
}

/** Best library match for a phrase like "paneer bhurji". Longer, more exact names win. */
export function matchFood(phrase: string, index: Index): { food: Food; score: number } | undefined {
  const p = norm(phrase)
  if (!p) return undefined
  const tokens = p.split(' ')
  let best: { food: Food; score: number } | undefined
  for (const a of index.aliases) {
    let score = 0
    if (a.alias === p) score = 100 + a.alias.length
    else if (` ${p} `.includes(` ${a.alias} `)) score = 60 + a.alias.length * 2
    else {
      const hit = a.tokens.filter((t) => tokens.includes(t) || tokens.includes(t + 's') || (t.endsWith('s') && tokens.includes(t.slice(0, -1)))).length
      if (hit === a.tokens.length) score = 50 + a.alias.length
      else if (hit > 0 && a.tokens.length > 1) score = 20 * (hit / a.tokens.length) + (hit / tokens.length) * 15
    }
    if (score > 0) score += a.weight
    if (score > (best?.score ?? 0)) best = { food: a.food, score }
  }
  return best && best.score >= 30 ? best : undefined
}

function parseNumber(tok: string): number | undefined {
  if (tok in NUMBER_WORDS) return NUMBER_WORDS[tok]
  if (/^\d+(\.\d+)?$/.test(tok)) return Number(tok)
  const frac = tok.match(/^(\d+)\/(\d+)$/)
  if (frac && Number(frac[2]) > 0) return Number(frac[1]) / Number(frac[2])
  return undefined
}

/** Pick a unit of this food for a spoken unit, converting by weight when the food has no such unit. */
export function resolveUnit(food: Food, amount: number, spoken?: { unit: string; grams?: number }): { amount: number; unit: string } {
  if (!spoken) return { amount, unit: food.defaultUnit }
  const direct = food.units.find((u) => u.name === spoken.unit)
  if (direct) {
    if (spoken.grams && spoken.grams !== 1 && (spoken.unit === 'g' || spoken.unit === 'ml')) return { amount: amount * spoken.grams, unit: direct.name }
    return { amount, unit: direct.name }
  }
  if (spoken.unit === 'piece' || spoken.unit === 'slice' || !spoken.grams) return { amount, unit: food.defaultUnit }
  // convert by weight into the food's usual unit ("a bowl of rice" → cups)
  const grams = amount * spoken.grams
  const per = gramsFor(food, 1, food.defaultUnit)
  if (food.defaultUnit === 'g' || food.defaultUnit === 'ml') return { amount: Math.round(grams / 5) * 5, unit: food.defaultUnit }
  const count = grams / per
  return { amount: count >= 4 ? Math.round(count) : Math.max(0.25, Math.round(count * 4) / 4), unit: food.defaultUnit }
}

const SLOT_WORDS: [RegExp, MealSlot][] = [
  [/\b(breakfast|nashta|naashta)\b|नाश्ता|सुबह का/, 'breakfast'],
  [/\b(lunch|dopahar)\b|दोपहर/, 'lunch'],
  [/\b(snack|snacks|evening|shaam)\b|शाम/, 'snack'],
  [/\b(dinner|supper|raat)\b|रात/, 'dinner'],
]
const REPLACE_WORDS = /\b(instead|skip|skipped|skipping|missed|didn'?t (eat|have)|did not (eat|have)|nahi(n)? (khaya|khayi|kiya|liya)|chhod diya|rather than)\b|की जगह|के बजाय|नहीं (खाया|किया)|छोड़ दिया/

/** The on-phone matcher. */
export function understandText(text: string, foods: Food[], profile?: Profile): Understood {
  const index = buildIndex(foods)
  const lower = text.toLowerCase()
  const slot = SLOT_WORDS.find(([re]) => re.test(lower))?.[1]
  const replacePlanned = REPLACE_WORDS.test(lower)
  const parts = text
    // what they had "instead of X" is the meal; X itself wasn't eaten
    .replace(/\b(instead of|rather than|in place of)\b[^,;\n]*?(?=,|;|\n|$|\bfor\b|\band\b)/gi, ' ')
    .replace(/(\S+\s+){1,2}(ki jagah|ke bajay|ke bajaye|की जगह|के बजाय)/gi, ' ')
    .replace(/\band a half\b|\bsaadhe\b/gi, ' ½ ')
    .replace(/\band\b|\baur\b|\bwith\b|\bplus\b|और|।|\bthen\b/gi, ',')
    .split(/[,;+&\n]+/)
    .map(norm)
    .filter(Boolean)
  const items: UnderstoodItem[] = []
  parts.forEach((part, pi) => {
    let amount: number | undefined
    let spoken: { unit: string; grams?: number } | undefined
    let size = 1
    const words: string[] = []
    const toks = part.split(' ')
    for (let i = 0; i < toks.length; i++) {
      let t = toks[i]
      // "200g", "250ml"
      const glued = t.match(/^(\d+(?:\.\d+)?)(g|gm|gms|ml|kg)$/)
      if (glued) {
        amount = Number(glued[1])
        spoken = UNIT_WORDS[glued[2]]
        continue
      }
      const n = parseNumber(t)
      if (n !== undefined && (amount === undefined || (n < 1 && amount >= 1))) {
        // "one and a half" / "1 1/2" / "do aadha"
        amount = amount !== undefined && n < 1 ? amount + n : n
        // "a half" → 0.5, not 1.5
        if ((toks[i - 1] === 'a' || toks[i - 1] === 'an') && n < 1 && amount === 1 + n) amount = n
        continue
      }
      if (t in UNIT_WORDS && (amount !== undefined || i === 0 || toks[i + 1] === 'of')) {
        spoken = UNIT_WORDS[t]
        continue
      }
      if (t in SIZE_WORDS) {
        size = SIZE_WORDS[t]
        continue
      }
      if (FILLER.has(t)) continue
      t = t.replace(/'s$/, '')
      words.push(t)
    }
    const phrase = words.join(' ')
    if (!phrase) return
    let m = matchFood(phrase, index)
    // someone who only eats egg whites saying "2 eggs" means the whites
    if (m?.food.id === 'egg-whole' && profile && (profile.diet === 'egg-whites' || profile.diet === 'veg')) {
      const white = foods.find((f) => f.id === 'egg-white')
      if (white) m = { food: white, score: m.score }
    }
    if (m) {
      // "a glass of milk" names a unit without a number: that's one of it
      const base = amount ?? (spoken ? 1 : m.food.defaultAmount)
      const r = resolveUnit(m.food, base, spoken)
      const scaled = size !== 1 ? (r.unit === 'g' || r.unit === 'ml' ? Math.round((r.amount * size) / 5) * 5 : Math.max(0.25, Math.round(r.amount * size * 4) / 4)) : r.amount
      items.push({ key: `m${pi}`, phrase: part, food: m.food, amount: scaled, unit: r.unit, confidence: m.score >= 60 ? 'high' : 'medium' })
    } else {
      items.push({ key: `m${pi}`, phrase: part, amount: amount ?? 1, unit: 'serving', custom: { name: phrase.replace(/^\w/, (c) => c.toUpperCase()) }, confidence: 'low' })
    }
  })
  return { items, slot, replacePlanned, by: 'match' }
}

/* ——————————— Claude ——————————— */

/** The request sent to Claude (with any photos). It answers in JSON that `fromClaude` maps back to the library. */
export function claudePrompt(text: string, foods: Food[], profile: Profile | undefined, photos: number): string {
  const library = foods
    .filter((f) => !f.archived)
    .map((f) => `${f.id} | ${f.name} | ${f.units.map((u) => `${u.name}=${u.grams}g`).join(', ')}`)
    .join('\n')
  return [
    'You turn what a person says they ate, and photos of their meal, into a food log for an Indian home-cooking tracker.',
    '',
    'FOOD LIBRARY (id | name | units with their weight):',
    library,
    '',
    'RULES',
    '- Use a library id whenever the food clearly matches (roti = chapati, dahi = curd, sabzi names in Hindi or English). For a library food, "unit" must be one of that food\'s units and "amount" is how many of that unit were eaten.',
    '- For anything not in the library set "foodId": null, give a short "name", use unit "serving" with amount 1, and estimate kcal, protein, carbs, fat and fibre (grams) for the whole amount eaten.',
    '- From a photo, identify each separate food on the plate and estimate its portion: a standard katori holds about 150 g, a chapati is about 40 g, a cup of cooked rice about 150 g. Use sensible home portions when unsure and mark "confidence" low.',
    '- Count only what was eaten. If they say they skipped the planned meal or ate this instead of it, set "replacePlanned": true.',
    profile ? `- About the person: diet ${profile.diet}${profile.diet === 'egg-whites' ? ' (eats egg whites, never yolks: log eggs as egg-white)' : ''}.` : '',
    '',
    'Reply with only JSON in this shape:',
    '{"slot":"breakfast"|"lunch"|"snack"|"dinner"|null,"replacePlanned":false,"items":[{"foodId":"chapati","name":"Chapati","amount":2,"unit":"chapati","confidence":"high"},{"foodId":null,"name":"Veg pulao","amount":1,"unit":"serving","kcal":320,"protein":7,"carbs":52,"fat":9,"fibre":4,"confidence":"medium"}],"note":""}',
    '"note" is one short sentence only when something is uncertain, else "".',
    '',
    photos ? `${photos} photo${photos > 1 ? 's' : ''} of the meal ${photos > 1 ? 'are' : 'is'} attached.` : 'No photo is attached.',
    text.trim() ? `The person said: "${text.trim()}"` : 'The person said nothing; go by the photo.',
  ]
    .filter((l) => l !== undefined)
    .join('\n')
}

interface ClaudeItem {
  foodId?: string | null
  name?: string
  amount?: number
  unit?: string
  kcal?: number
  protein?: number
  carbs?: number
  fat?: number
  fibre?: number
  confidence?: string
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : fallback)

/** Check and map Claude's reply. Nothing in it is trusted: ids, units and amounts are validated against the library. */
export function fromClaude(raw: unknown, foods: Food[]): Understood | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { slot?: unknown; replacePlanned?: unknown; items?: unknown; note?: unknown }
  if (!Array.isArray(r.items)) return null
  const byId = new Map(foods.map((f) => [f.id, f]))
  const index = buildIndex(foods)
  const items: UnderstoodItem[] = []
  ;(r.items as ClaudeItem[]).slice(0, 20).forEach((it, i) => {
    if (!it || typeof it !== 'object') return
    const name = typeof it.name === 'string' ? it.name.slice(0, 60) : ''
    // trust a library id; if Claude said "not in the library", only override that on an exact name match
    const m = name ? matchFood(name, index) : undefined
    const food = (typeof it.foodId === 'string' && byId.get(it.foodId)) || (m && (it.foodId !== null || m.score >= 100) ? m.food : undefined)
    const confidence = it.confidence === 'high' || it.confidence === 'low' ? it.confidence : 'medium'
    if (food) {
      const unit = food.units.some((u) => u.name === it.unit) ? (it.unit as string) : food.defaultUnit
      const gramLike = unit === 'g' || unit === 'ml'
      const amount = Math.min(gramLike ? 2000 : 20, Math.max(gramLike ? 5 : 0.25, num(it.amount, food.defaultAmount) || food.defaultAmount))
      items.push({ key: `c${i}`, phrase: name || food.name, food, amount: gramLike ? Math.round(amount) : Math.round(amount * 4) / 4, unit, confidence })
    } else if (name) {
      const n: Nutrients = { kcal: Math.min(3000, num(it.kcal)), protein: Math.min(200, num(it.protein)), carbs: Math.min(500, num(it.carbs)), fat: Math.min(300, num(it.fat)), fibre: Math.min(100, num(it.fibre)) }
      items.push({ key: `c${i}`, phrase: name, amount: 1, unit: 'serving', custom: { name, nutrients: n.kcal > 0 ? n : undefined }, confidence })
    }
  })
  const slot = ['breakfast', 'lunch', 'snack', 'dinner'].includes(r.slot as string) ? (r.slot as MealSlot) : undefined
  return { items, slot, replacePlanned: r.replacePlanned === true, note: typeof r.note === 'string' && r.note.trim() ? r.note.trim().slice(0, 200) : undefined, by: 'claude' }
}

/** Estimated nutrients of an understood item as it stands. */
export function itemNutrients(it: UnderstoodItem): Nutrients | undefined {
  if (it.food) return nutrientsFor(it.food, it.amount, it.unit)
  if (it.custom?.nutrients) {
    const n = it.custom.nutrients
    return { kcal: n.kcal * it.amount, protein: n.protein * it.amount, carbs: n.carbs * it.amount, fat: n.fat * it.amount, fibre: n.fibre * it.amount }
  }
  return undefined
}
