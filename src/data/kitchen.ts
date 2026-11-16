import type { Ingredient } from './types'

/**
 * What the cook needs to know about each dish, and what it takes to buy.
 * Ingredients are for ONE default unit of the food (e.g. 1 katori, 1 chapati)
 * and are scaled by weight for other amounts. Rough home-cooking estimates.
 */

type K = { hi: string; ing: [item: string, qty: number, unit?: Ingredient['unit'], soak?: boolean][]; note?: string; noteHi?: string }

export const KITCHEN: Record<string, K> = {
  rice: { hi: 'चावल', ing: [['Rice', 50]] },
  chapati: { hi: 'रोटी', ing: [['Atta', 30]], note: 'No ghee unless asked', noteHi: 'बिना घी के, जब तक न कहें' },
  bread: { hi: 'ब्रेड', ing: [['Brown bread (slices)', 1, 'pc']] },
  ghee: { hi: 'घी', ing: [['Ghee', 5]] },
  'moong-dal': { hi: 'मूंग दाल', ing: [['Moong dal', 40]] },
  'chana-dal': { hi: 'चना दाल', ing: [['Chana dal', 40]], note: 'Soak 1 hour before cooking', noteHi: 'पकाने से 1 घंटा पहले भिगोएँ' },
  dal: { hi: 'अरहर दाल', ing: [['Toor dal', 40]] },
  rajma: { hi: 'राजमा', ing: [['Rajma', 40, 'g', true], ['Onion', 25], ['Tomato', 30]] },
  chhole: { hi: 'छोले', ing: [['Kabuli chana', 40, 'g', true], ['Onion', 25], ['Tomato', 30]] },
  'kala-chana-chaat': { hi: 'काले चने की चाट', ing: [['Kala chana', 45, 'g', true], ['Onion', 20], ['Tomato', 25], ['Lemon', 0.25, 'pc']] },
  'chhole-chaat': { hi: 'छोले चाट', ing: [['Kabuli chana', 45, 'g', true], ['Onion', 20], ['Tomato', 25], ['Cucumber', 25]] },
  'sprouts-salad': { hi: 'अंकुरित मूंग सलाद', ing: [['Moong sprouts', 90], ['Onion', 15], ['Tomato', 15]] },
  'beetroot-carrot': { hi: 'चुकंदर-गाजर सब्ज़ी', ing: [['Beetroot', 70], ['Carrot', 60], ['Onion', 15]] },
  'beetroot-sabzi': { hi: 'चुकंदर की सब्ज़ी', ing: [['Beetroot', 120], ['Onion', 15]] },
  'baingan-bharta': { hi: 'बैंगन भर्ता', ing: [['Baingan (bharta)', 150], ['Onion', 25], ['Tomato', 40]] },
  bhindi: { hi: 'भिंडी', ing: [['Bhindi', 120], ['Onion', 20]] },
  'aloo-beans': { hi: 'आलू बीन्स', ing: [['French beans', 80], ['Potato', 50]], note: 'More beans than aloo', noteHi: 'आलू कम, बीन्स ज़्यादा' },
  'patta-gobi-carrot': { hi: 'पत्ता गोभी गाजर', ing: [['Patta gobi', 90], ['Carrot', 40]] },
  'patta-gobi': { hi: 'पत्ता गोभी', ing: [['Patta gobi', 110], ['Green peas', 20]] },
  gobi: { hi: 'गोभी', ing: [['Gobi', 130]] },
  'gobi-peas': { hi: 'गोभी मटर', ing: [['Gobi', 100], ['Green peas', 35]] },
  'broccoli-stirfry': { hi: 'ब्रोकली शिमला मिर्च', ing: [['Broccoli', 90], ['Capsicum', 40]] },
  'spinach-dal': { hi: 'पालक दाल', ing: [['Moong dal', 35], ['Spinach', 50]] },
  lauki: { hi: 'लौकी', ing: [['Lauki', 140]] },
  'onion-capsicum': { hi: 'प्याज़ शिमला मिर्च', ing: [['Onion', 45], ['Capsicum', 45]] },
  'tomato-capsicum': { hi: 'टमाटर शिमला मिर्च', ing: [['Tomato', 45], ['Capsicum', 40]] },
  'cucumber-tomato': { hi: 'खीरा टमाटर', ing: [['Cucumber', 60], ['Tomato', 45]] },
  salad: { hi: 'सलाद', ing: [['Cucumber', 55], ['Tomato', 40], ['Onion', 15]] },
  cucumber: { hi: 'खीरा', ing: [['Cucumber', 120]] },
  paneer: { hi: 'पनीर (कसा हुआ)', ing: [['Paneer', 1]] },
  'paneer-bhurji': { hi: 'पनीर भुर्जी', ing: [['Paneer', 85], ['Onion', 30], ['Tomato', 35], ['Capsicum', 15]] },
  'kadai-paneer': { hi: 'कड़ाही पनीर', ing: [['Paneer', 90], ['Capsicum', 35], ['Onion', 30], ['Tomato', 40]] },
  'paneer-tikka': { hi: 'पनीर टिक्का', ing: [['Paneer', 18], ['Curd', 5]] },
  'paneer-dip': { hi: 'पनीर-दही-काजू डिप', ing: [['Paneer', 8], ['Curd', 9], ['Cashews', 2]] },
  'soya-keema': { hi: 'सोया कीमा', ing: [['Soya chunks', 30], ['Onion', 30], ['Tomato', 35], ['Green peas', 20]] },
  'soya-crispy': { hi: 'क्रिस्पी मसाला सोया', ing: [['Soya chunks', 30]], note: 'Boil, squeeze, then roast with masala', noteHi: 'उबालें, निचोड़ें, फिर मसाले के साथ भूनें' },
  'soya-cutlet': { hi: 'सोया कटलेट', ing: [['Soya chunks', 12], ['Potato', 20], ['Carrot', 10]] },
  'egg-white': { hi: 'उबले अंडे की सफ़ेदी', ing: [['Eggs', 1, 'pc']], note: 'Boil eggs, serve whites only', noteHi: 'अंडे उबालें, सिर्फ़ सफ़ेदी दें' },
  'egg-whole': { hi: 'उबला अंडा', ing: [['Eggs', 1, 'pc']] },
  'egg-white-bhurji': { hi: 'अंडा सफ़ेदी भुर्जी', ing: [['Eggs', 3, 'pc'], ['Onion', 20], ['Tomato', 20]] },
  'besan-chilla': { hi: 'बेसन चीला', ing: [['Besan', 30], ['Onion', 10], ['Tomato', 10]] },
  muesli: { hi: 'म्यूज़ली', ing: [['Muesli', 1]] },
  'oats-milk': { hi: 'दूध में ओट्स', ing: [['Oats', 40], ['Milk', 200, 'ml']] },
  'peanut-butter': { hi: 'पीनट बटर', ing: [['Peanut butter', 16]] },
  poha: { hi: 'पोहा', ing: [['Poha', 45], ['Onion', 20], ['Green peas', 15]] },
  upma: { hi: 'उपमा', ing: [['Suji', 45], ['Onion', 15], ['Carrot', 15]] },
  idli: { hi: 'इडली', ing: [['Idli batter', 40]] },
  dosa: { hi: 'डोसा', ing: [['Dosa batter', 80]] },
  paratha: { hi: 'आलू पराठा', ing: [['Atta', 50], ['Potato', 50]] },
  curd: { hi: 'दही', ing: [['Curd', 100]] },
  'hp-curd': { hi: 'हाई-प्रोटीन दही', ing: [['High-protein dahi', 100]] },
  milk: { hi: 'दूध', ing: [['Milk', 200, 'ml']] },
  buttermilk: { hi: 'छाछ', ing: [['Curd', 80]] },
  chai: { hi: 'चाय', ing: [['Milk', 75, 'ml']] },
  coffee: { hi: 'कॉफ़ी', ing: [['Milk', 100, 'ml']] },
  banana: { hi: 'केला', ing: [['Bananas', 1, 'pc']] },
  'watermelon-juice': { hi: 'तरबूज़ जूस (गूदे के साथ)', ing: [['Watermelon', 350]], note: 'No sugar, keep the pulp', noteHi: 'चीनी नहीं, गूदा रहने दें' },
  watermelon: { hi: 'तरबूज़', ing: [['Watermelon', 150]] },
  fruit: { hi: 'मौसमी फल', ing: [['Seasonal fruit', 150]] },
  apple: { hi: 'सेब', ing: [['Apples', 1, 'pc']] },
  pineapple: { hi: 'अनानास', ing: [['Pineapple', 160]] },
  papaya: { hi: 'पपीता', ing: [['Papaya', 145]] },
  orange: { hi: 'संतरा', ing: [['Oranges', 1, 'pc']] },
  guava: { hi: 'अमरूद', ing: [['Guava', 1, 'pc']] },
  'coconut-water': { hi: 'नारियल पानी', ing: [['Tender coconut', 1, 'pc']] },
  'lemon-water': { hi: 'नींबू पानी', ing: [['Lemon', 0.5, 'pc']] },
  nuts: { hi: 'बादाम / काजू', ing: [['Almonds', 8], ['Cashews', 7]] },
  almonds: { hi: 'बादाम', ing: [['Almonds', 1.2]] },
  peanuts: { hi: 'मूंगफली', ing: [['Peanuts', 20]] },
  'roasted-chana': { hi: 'भुना चना', ing: [['Roasted chana', 25]] },
  makhana: { hi: 'मखाना', ing: [['Makhana', 15]] },
}

/** Hindi words for the units the cook sees. */
export const UNIT_HI: Record<string, string> = {
  chapati: 'रोटी',
  cup: 'कप',
  katori: 'कटोरी',
  g: 'ग्राम',
  ml: 'ml',
  glass: 'गिलास',
  tbsp: 'चम्मच',
  tsp: 'छोटा चम्मच',
  white: 'अंडे',
  egg: 'अंडे',
  chilla: 'चीले',
  piece: 'पीस',
  slice: 'स्लाइस',
  handful: 'मुट्ठी',
  medium: '',
  bowl: 'बाउल',
  nut: 'दाने',
  serving: 'सर्विंग',
  idli: 'इडली',
  dosa: 'डोसा',
  paratha: 'पराठे',
  cutlet: 'कटलेट',
  'tbsp (grated)': 'चम्मच',
}

/** Groceries that keep for weeks: shown as "check the pantry" rather than "buy". */
export const PANTRY = new Set([
  'Rice', 'Atta', 'Moong dal', 'Chana dal', 'Toor dal', 'Rajma', 'Kabuli chana', 'Kala chana', 'Besan', 'Muesli', 'Oats',
  'Peanut butter', 'Soya chunks', 'Ghee', 'Poha', 'Suji', 'Almonds', 'Cashews', 'Peanuts', 'Roasted chana', 'Makhana',
])

/** Hindi names for the main ingredient line the cook sees ("≈ 190 g paneer"). */
export const ITEM_HI: Record<string, string> = {
  Rice: 'चावल', Atta: 'आटा', 'Moong dal': 'मूंग दाल', 'Chana dal': 'चना दाल', 'Toor dal': 'अरहर दाल', Rajma: 'राजमा',
  'Kabuli chana': 'काबुली चना', 'Kala chana': 'काला चना', Paneer: 'पनीर', 'Soya chunks': 'सोया चंक्स', Besan: 'बेसन', Eggs: 'अंडे',
  Beetroot: 'चुकंदर', 'Baingan (bharta)': 'बैंगन', Bhindi: 'भिंडी', 'French beans': 'बीन्स', 'Patta gobi': 'पत्ता गोभी', Gobi: 'गोभी',
  Watermelon: 'तरबूज़', Oats: 'ओट्स', 'Moong sprouts': 'अंकुरित मूंग', Broccoli: 'ब्रोकली', Onion: 'प्याज़', Lauki: 'लौकी',
  Tomato: 'टमाटर', Cucumber: 'खीरा', Poha: 'पोहा', Suji: 'सूजी', Curd: 'दही', Milk: 'दूध', Capsicum: 'शिमला मिर्च',
}

/** Served as-is: listed under "also on the table" instead of the cooking list. */
export const READY_TO_SERVE = new Set([
  'banana', 'apple', 'papaya', 'pineapple', 'orange', 'guava', 'fruit', 'watermelon', 'nuts', 'almonds', 'peanuts', 'bread',
  'peanut-butter', 'muesli', 'milk', 'curd', 'hp-curd', 'makhana', 'roasted-chana', 'ghee', 'biscuits', 'dark-chocolate',
  'coconut-water', 'chai', 'coffee',
])

export type GroceryGroup = 'Vegetables' | 'Fruit' | 'Dairy & eggs' | 'Staples' | 'Other'
const GROUPS: Record<string, GroceryGroup> = {
  Paneer: 'Dairy & eggs', Curd: 'Dairy & eggs', 'High-protein dahi': 'Dairy & eggs', Milk: 'Dairy & eggs', Eggs: 'Dairy & eggs', Ghee: 'Dairy & eggs',
  Bananas: 'Fruit', Apples: 'Fruit', Pineapple: 'Fruit', Papaya: 'Fruit', Oranges: 'Fruit', Guava: 'Fruit', Watermelon: 'Fruit', 'Seasonal fruit': 'Fruit', Lemon: 'Fruit', 'Tender coconut': 'Fruit',
  'Brown bread (slices)': 'Other', 'Idli batter': 'Other', 'Dosa batter': 'Other',
}
export function groceryGroup(item: string): GroceryGroup {
  if (GROUPS[item]) return GROUPS[item]
  if (PANTRY.has(item)) return 'Staples'
  return 'Vegetables'
}

/** What to type into a store's search for an item. */
const SEARCH: Record<string, string> = {
  'Baingan (bharta)': 'baingan bharta', 'Patta gobi': 'cabbage', Gobi: 'cauliflower', 'Seasonal fruit': 'fresh fruits',
  'Brown bread (slices)': 'brown bread', 'High-protein dahi': 'high protein curd', 'Kabuli chana': 'kabuli chana',
  'Tender coconut': 'tender coconut', 'Soya chunks': 'soya chunks', 'Toor dal': 'toor dal', Eggs: 'eggs',
}
export const searchTerm = (item: string) => SEARCH[item] ?? item.replace(/\s*\(.*\)/, '').toLowerCase()

/** Quick-commerce stores. `mcp` = the store's own connector for AI assistants, which can fill the cart. */
export const QUICK_STORES: { name: string; search: (q: string) => string; mcp?: string }[] = [
  { name: 'Zepto', search: (q) => `https://www.zepto.com/search?query=${encodeURIComponent(q)}`, mcp: 'https://mcp.zepto.co.in/mcp' },
  { name: 'Instamart', search: (q) => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}`, mcp: 'https://mcp.swiggy.com/im' },
  { name: 'Blinkit', search: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
  { name: 'BigBasket', search: (q) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}` },
]
export const quickStore = (name: string) => QUICK_STORES.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())
export function storeSearchUrl(storeName: string, item: string): string | undefined {
  return quickStore(storeName)?.search(searchTerm(item))
}

/** Comes by subscription by default (e.g. Country Delight). Everything in PANTRY defaults to the monthly shop. */
export const SUBSCRIPTION_DEFAULT = new Set(['Milk', 'Curd', 'Paneer'])

/**
 * Rough prices in ₹ per kg (g items), per litre (ml items) or per piece — typical
 * metro quick-commerce prices. They're only a starting estimate; every price is editable.
 */
export const PRICES: Record<string, number> = {
  // vegetables (₹/kg)
  Tomato: 50, Onion: 45, Potato: 40, Cucumber: 50, Capsicum: 100, Beetroot: 60, Carrot: 60, 'Baingan (bharta)': 60, Bhindi: 80,
  'French beans': 100, Gobi: 60, 'Patta gobi': 40, 'Green peas': 120, Broccoli: 160, Spinach: 60, Lauki: 50, 'Moong sprouts': 150,
  // dairy & eggs
  Milk: 70, Curd: 100, Paneer: 450, 'High-protein dahi': 280, Eggs: 8, Ghee: 700,
  // fruit
  Bananas: 6, Apples: 30, Oranges: 15, Guava: 20, Lemon: 6, 'Tender coconut': 60, Papaya: 60, Pineapple: 80, Watermelon: 30, 'Seasonal fruit': 100,
  // staples (₹/kg)
  Rice: 90, Atta: 50, 'Moong dal': 140, 'Chana dal': 100, 'Toor dal': 170, Rajma: 160, 'Kabuli chana': 150, 'Kala chana': 110, Besan: 110,
  Muesli: 500, Oats: 200, 'Peanut butter': 450, 'Soya chunks': 160, Poha: 80, Suji: 60, Almonds: 900, Cashews: 1000, Peanuts: 160,
  'Roasted chana': 200, Makhana: 1200,
  // other
  'Brown bread (slices)': 3.5, 'Idli batter': 100, 'Dosa batter': 100,
}

/** A picture for each dish, so the menu can be followed without reading. */
export const EMOJI: Record<string, string> = {
  rice: '🍚', chapati: '🫓', paratha: '🫓', bread: '🍞', 'moong-dal': '🍲', 'chana-dal': '🍲', dal: '🍲', 'spinach-dal': '🍲', rajma: '🫘', chhole: '🫘',
  'kala-chana-chaat': '🥗', 'chhole-chaat': '🥗', 'sprouts-salad': '🥗', salad: '🥗', 'cucumber-tomato': '🥒', cucumber: '🥒', 'tomato-capsicum': '🍅',
  'beetroot-carrot': '🥕', 'beetroot-sabzi': '🥕', 'baingan-bharta': '🍆', bhindi: '🥬', 'aloo-beans': '🥔', 'patta-gobi-carrot': '🥬', 'patta-gobi': '🥬',
  gobi: '🥦', 'gobi-peas': '🥦', 'broccoli-stirfry': '🥦', lauki: '🥒', 'onion-capsicum': '🫑', paneer: '🧀', 'paneer-bhurji': '🧀', 'kadai-paneer': '🍛',
  'paneer-tikka': '🍢', 'paneer-dip': '🥣', 'soya-keema': '🍛', 'soya-crispy': '🥘', 'soya-cutlet': '🥘', 'egg-white': '🥚', 'egg-whole': '🥚', 'egg-white-bhurji': '🍳',
  'besan-chilla': '🥞', muesli: '🥣', 'oats-milk': '🥣', 'peanut-butter': '🥜', poha: '🍚', upma: '🍚', idli: '⚪', dosa: '🥞', curd: '🥛', 'hp-curd': '🥛', milk: '🥛',
  buttermilk: '🥛', chai: '☕', coffee: '☕', banana: '🍌', 'watermelon-juice': '🍉', watermelon: '🍉', fruit: '🍎', apple: '🍎', pineapple: '🍍', papaya: '🥭',
  orange: '🍊', guava: '🍐', 'coconut-water': '🥥', 'lemon-water': '🍋', nuts: '🥜', almonds: '🥜', peanuts: '🥜', 'roasted-chana': '🥜', makhana: '🍿', ghee: '🧈',
}
