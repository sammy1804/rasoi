import { KITCHEN } from './kitchen'
import type { Food, FoodCategory, FoodUnit } from './types'

/**
 * Built-in food library. Values are approximate, per 100 g (or 100 ml),
 * for typical Indian home cooking with modest oil. They are estimates —
 * homemade food varies, which is why every logged entry is editable.
 */

type N = [kcal: number, protein: number, carbs: number, fat: number, fibre: number]

const g: FoodUnit = { name: 'g', grams: 1 }
const ml: FoodUnit = { name: 'ml', grams: 1 }
const katori = (grams: number): FoodUnit => ({ name: 'katori', grams, label: `katori (~${grams} g)` })
const cup = (grams: number): FoodUnit => ({ name: 'cup', grams, label: `cup (~${grams} g)` })
const piece = (grams: number, name = 'piece'): FoodUnit => ({ name, grams })
const tbsp = (grams: number): FoodUnit => ({ name: 'tbsp', grams })
const tsp = (grams: number): FoodUnit => ({ name: 'tsp', grams })
const glass = (mlAmount = 250): FoodUnit => ({ name: 'glass', grams: mlAmount, label: `glass (~${mlAmount} ml)` })

function food(
  id: string,
  name: string,
  category: FoodCategory,
  n: N,
  units: FoodUnit[],
  defaultAmount: number,
  extra: Partial<Food> = {},
): Food {
  const [kcal, protein, carbs, fat, fibre] = n
  return {
    id,
    name,
    category,
    per100: { kcal, protein, carbs, fat, fibre },
    units,
    defaultUnit: units[0].name,
    defaultAmount,
    ...extra,
  }
}

export const BUILTIN_FOODS: Food[] = [
  // ——— Staples ———
  food('rice', 'Rice (cooked)', 'lunch', [130, 2.7, 28, 0.3, 0.4], [cup(150), katori(120), g], 1, { tags: ['chawal', 'staple'] }),
  food('chapati', 'Chapati', 'lunch', [275, 8.5, 50, 4, 7], [piece(40, 'chapati'), g], 2, { tags: ['roti', 'phulka', 'staple'] }),
  food('bread', 'Bread (whole wheat)', 'breakfast', [250, 9.5, 43, 3.5, 6], [piece(28, 'slice'), g], 2, { tags: ['toast'] }),
  food('ghee', 'Ghee', 'basic', [900, 0, 0, 100, 0], [tsp(5), tbsp(14), g], 1, { contains: ['dairy'] }),
  food('oil', 'Cooking oil', 'basic', [884, 0, 0, 100, 0], [tsp(4.5), tbsp(13.5), g], 1),

  // ——— Dals & legumes ———
  food('moong-dal', 'Moong dal', 'lunch', [90, 6, 12, 2.2, 3], [katori(150), cup(200), g], 1, { tags: ['dal', 'yellow dal'] }),
  food('chana-dal', 'Chana dal', 'lunch', [110, 6.5, 15, 3, 4.5], [katori(150), cup(200), g], 1, { tags: ['dal'] }),
  food('dal', 'Dal (arhar / mixed)', 'lunch', [85, 5.5, 11, 2.2, 3], [katori(150), cup(200), g], 1, { tags: ['toor', 'arhar', 'tadka'] }),
  food('rajma', 'Rajma', 'lunch', [120, 6.5, 15, 3.5, 5.5], [katori(150), cup(200), g], 1, { tags: ['kidney beans'] }),
  food('chhole', 'Chhole', 'lunch', [140, 7, 18, 4.5, 6], [katori(150), cup(200), g], 1, { tags: ['chana masala', 'chickpea'] }),
  food('kala-chana-chaat', 'Kala chana chaat', 'snack', [130, 7, 21, 2.2, 6.5], [katori(120), g], 1, { fvPer100: 0.3, produce: ['onion', 'tomato'], tags: ['black chana', 'chaat'] }),
  food('chhole-chaat', 'Chhole chaat', 'snack', [130, 6.5, 19, 3, 5.5], [katori(120), g], 1, { fvPer100: 0.3, produce: ['onion', 'tomato', 'cucumber'], tags: ['chickpea', 'chaat'] }),
  food('sprouts-salad', 'Moong sprouts salad', 'snack', [80, 5.5, 12, 1.2, 3.5], [katori(120), g], 1, { fvPer100: 0.4, produce: ['onion', 'tomato', 'cucumber'] }),

  // ——— Vegetables (sabzi) ———
  food('beetroot-carrot', 'Beetroot + carrot sabzi', 'lunch', [75, 1.6, 10, 3.3, 3], [katori(120), g], 1, { fvPer100: 1.1, produce: ['beetroot', 'carrot'] }),
  food('beetroot-sabzi', 'Beetroot sabzi', 'lunch', [70, 1.7, 10, 3, 2.8], [katori(120), g], 1, { fvPer100: 1.1, produce: ['beetroot'] }),
  food('baingan-bharta', 'Baingan bharta', 'lunch', [85, 1.8, 8, 5.2, 3.5], [katori(120), g], 1, { fvPer100: 1.1, produce: ['baingan', 'tomato', 'onion'], tags: ['brinjal', 'eggplant'] }),
  food('bhindi', 'Bhindi sabzi', 'dinner', [95, 2.2, 9, 6, 3.5], [katori(100), g], 1, { fvPer100: 1.1, produce: ['bhindi', 'onion'], tags: ['okra', 'lady finger'] }),
  food('aloo-beans', 'Aloo + beans', 'lunch', [90, 2, 12, 4, 3], [katori(120), g], 1, { fvPer100: 0.9, produce: ['beans', 'potato'], tags: ['french beans'] }),
  food('patta-gobi-carrot', 'Patta gobi + carrot', 'lunch', [65, 1.6, 8, 3.2, 2.8], [katori(120), g], 1, { fvPer100: 1.1, produce: ['patta gobi', 'carrot'], tags: ['cabbage'] }),
  food('patta-gobi', 'Patta gobi sabzi', 'dinner', [62, 1.5, 7.5, 3.2, 2.6], [katori(120), g], 1, { fvPer100: 1.1, produce: ['patta gobi', 'green peas'], tags: ['cabbage'] }),
  food('gobi', 'Gobi sabzi', 'dinner', [70, 2.2, 7, 4, 2.8], [katori(120), g], 1, { fvPer100: 1.1, produce: ['gobi'], tags: ['cauliflower'] }),
  food('gobi-peas', 'Gobi + peas', 'lunch', [80, 3, 9, 4, 3.5], [katori(120), g], 1, { fvPer100: 1.1, produce: ['gobi', 'green peas'], tags: ['cauliflower', 'matar'] }),
  food('broccoli-stirfry', 'Broccoli + capsicum stir-fry', 'dinner', [65, 3, 7, 3, 3], [katori(120), g], 1, { fvPer100: 1.2, produce: ['broccoli', 'capsicum'] }),
  food('spinach-dal', 'Palak dal', 'lunch', [85, 5.5, 10, 2.5, 3.5], [katori(150), g], 1, { fvPer100: 0.4, produce: ['spinach'], tags: ['optional', 'spinach'] }),
  food('lauki', 'Lauki sabzi', 'lunch', [45, 1, 5, 2.5, 1.8], [katori(120), g], 1, { fvPer100: 1.1, produce: ['lauki'], tags: ['bottle gourd', 'optional'] }),
  food('onion-capsicum', 'Grilled onion + capsicum', 'dinner', [45, 1.2, 7, 1.5, 2], [katori(80), g], 1, { fvPer100: 1.2, produce: ['onion', 'capsicum'] }),
  food('tomato-capsicum', 'Tomato + capsicum', 'breakfast', [30, 1, 5, 0.5, 1.5], [katori(80), g], 1, { fvPer100: 1.2, produce: ['tomato', 'capsicum'] }),
  food('cucumber-tomato', 'Cucumber + tomato', 'lunch', [18, 0.8, 3.6, 0.2, 1.1], [katori(100), cup(120), g], 1, { fvPer100: 1.25, produce: ['cucumber', 'tomato'], tags: ['salad'] }),
  food('salad', 'Cucumber-tomato salad', 'dinner', [20, 0.9, 4, 0.2, 1.2], [katori(100), cup(120), g], 1, { fvPer100: 1.25, produce: ['cucumber', 'tomato', 'onion'], tags: ['kachumber'] }),
  food('cucumber', 'Cucumber', 'lunch', [15, 0.7, 3.6, 0.1, 0.5], [piece(120, 'medium'), g], 0.5, { fvPer100: 1.25, produce: ['cucumber'] }),

  // ——— Paneer ———
  food('paneer', 'Paneer', 'basic', [265, 18.5, 3.5, 20, 0], [g, { name: 'tbsp (grated)', grams: 10 }], 30, { contains: ['dairy'], tags: ['cottage cheese'] }),
  food('paneer-bhurji', 'Paneer bhurji', 'dinner', [185, 12, 5, 13, 1.3], [katori(140), g], 1, { fvPer100: 0.4, produce: ['onion', 'tomato', 'capsicum'], contains: ['dairy'] }),
  food('kadai-paneer', 'Kadai paneer', 'dinner', [185, 11.5, 6.5, 12.5, 1.8], [katori(150), g], 1, { fvPer100: 0.6, produce: ['capsicum', 'tomato', 'onion'], contains: ['dairy'] }),
  food('paneer-tikka', 'Paneer tikka', 'dinner', [220, 15, 5, 15.5, 0.6], [piece(22), g], 5, { contains: ['dairy'], tags: ['grilled'] }),
  food('paneer-dip', 'Paneer-curd-cashew dip', 'breakfast', [190, 10.8, 6.4, 13.9, 0.4], [tbsp(20), g], 2, { contains: ['dairy'], tags: ['spread'] }),

  // ——— Soy ———
  food('soya-keema', 'Soya keema', 'dinner', [136, 11.7, 12, 4.7, 4.3], [katori(150), g], 1, { fvPer100: 0.4, produce: ['onion', 'tomato', 'green peas'], tags: ['soy'] }),
  food('soya-crispy', 'Crispy masala soy chunks', 'snack', [426, 44.6, 28, 14.7, 11], [{ name: 'katori', grams: 35, label: 'katori (30 g dry soy)' }], 1, { tags: ['soy', 'roasted'] }),
  food('soya-cutlet', 'Soya cutlet', 'snack', [190, 12, 18, 7.5, 4], [piece(55, 'cutlet'), g], 2, { produce: ['carrot', 'onion'], tags: ['soy', 'tikki'] }),

  // ——— Eggs ———
  food('egg-white', 'Boiled egg white', 'breakfast', [52, 10.9, 0.7, 0.2, 0], [piece(33, 'white'), g], 2, { contains: ['egg-white'], tags: ['egg'] }),
  food('egg-whole', 'Boiled egg (whole)', 'breakfast', [155, 12.6, 1.1, 10.6, 0], [piece(50, 'egg'), g], 1, { contains: ['egg-white', 'egg-yolk'], tags: ['egg'] }),
  food('egg-white-bhurji', 'Egg white bhurji', 'breakfast', [85, 10, 3, 3.5, 0.6], [katori(100), g], 1, { contains: ['egg-white'], produce: ['onion', 'tomato'], tags: ['egg'] }),

  // ——— Breakfast ———
  food('besan-chilla', 'Besan chilla', 'breakfast', [205, 9.5, 22, 8, 4.5], [piece(75, 'chilla'), g], 2, { fvPer100: 0.2, produce: ['onion', 'tomato'], tags: ['cheela', 'gram flour'] }),
  food('muesli', 'Muesli', 'breakfast', [380, 9, 70, 6, 8], [g, cup(80)], 40),
  food('oats-milk', 'Oats cooked in milk', 'breakfast', [113, 4.9, 15.2, 3.7, 1.7], [{ name: 'bowl', grams: 240, label: 'bowl (40 g oats + 200 ml milk)' }, g], 1, { contains: ['dairy'], tags: ['porridge', 'dalia'] }),
  food('peanut-butter', 'Peanut butter', 'breakfast', [588, 25, 20, 50, 6], [tbsp(16), tsp(5), g], 1, { tags: ['pb'] }),
  food('poha', 'Poha', 'breakfast', [130, 2.6, 23, 3.2, 1.5], [katori(150), g], 1, { produce: ['onion', 'green peas'], tags: ['flattened rice'] }),
  food('upma', 'Upma', 'breakfast', [125, 3, 19, 4, 1.5], [katori(150), g], 1, { produce: ['onion', 'carrot'], tags: ['rava', 'suji'] }),
  food('idli', 'Idli', 'breakfast', [140, 4.5, 29, 0.5, 1.5], [piece(40, 'idli'), g], 2),
  food('dosa', 'Plain dosa', 'breakfast', [168, 3.9, 29, 3.7, 1], [piece(80, 'dosa'), g], 1),
  food('paratha', 'Aloo paratha', 'breakfast', [260, 5.5, 36, 10, 3.5], [piece(100, 'paratha'), g], 1),

  // ——— Dairy ———
  food('curd', 'Curd (dahi)', 'lunch', [65, 3.5, 4.5, 3.3, 0], [katori(100), cup(200), tbsp(15), g], 1, { contains: ['dairy'], tags: ['yogurt', 'dahi'] }),
  food('hp-curd', 'High-protein dahi', 'snack', [75, 8.5, 5, 2, 0], [katori(100), cup(200), g], 1, { contains: ['dairy'], tags: ['greek yogurt', 'skyr'] }),
  food('milk', 'Milk (toned)', 'drink', [58, 3.2, 4.8, 3, 0], [glass(200), cup(240), ml], 1, { contains: ['dairy'] }),
  food('buttermilk', 'Chaas (buttermilk)', 'drink', [20, 1.2, 2, 0.8, 0], [glass(250), ml], 1, { contains: ['dairy'], tags: ['chaas', 'lassi'] }),
  food('chai', 'Chai (with milk, little sugar)', 'drink', [48, 1.6, 6.5, 1.6, 0], [cup(150), ml], 1, { contains: ['dairy'], tags: ['tea'] }),
  food('coffee', 'Coffee (with milk)', 'drink', [45, 2, 5, 1.8, 0], [cup(150), ml], 1, { contains: ['dairy'] }),

  // ——— Fruit & drinks ———
  food('banana', 'Banana', 'fruit', [89, 1.1, 23, 0.3, 2.6], [piece(118, 'medium'), g], 1, { fvPer100: 1.25, produce: ['banana'], tags: ['kela'] }),
  food('watermelon-juice', 'Watermelon juice (with pulp)', 'drink', [32, 0.6, 7.6, 0.2, 0.4], [glass(250), ml], 1, { fvPer100: 0.4, produce: ['watermelon'], tags: ['tarbooz'] }),
  food('watermelon', 'Watermelon', 'fruit', [30, 0.6, 7.6, 0.2, 0.4], [cup(150), g], 1, { fvPer100: 1.25, produce: ['watermelon'] }),
  food('fruit', 'Seasonal fruit', 'fruit', [50, 0.6, 12.5, 0.2, 2], [cup(150), g], 1, { fvPer100: 1.25, produce: ['seasonal fruit'], tags: ['papaya', 'apple', 'guava'] }),
  food('apple', 'Apple', 'fruit', [52, 0.3, 14, 0.2, 2.4], [piece(180, 'medium'), g], 1, { fvPer100: 1.25, produce: ['apple'] }),
  food('pineapple', 'Pineapple', 'fruit', [50, 0.5, 13, 0.1, 1.4], [cup(160), g], 1, { fvPer100: 1.25, produce: ['pineapple'] }),
  food('papaya', 'Papaya', 'fruit', [43, 0.5, 11, 0.3, 1.7], [cup(145), g], 1, { fvPer100: 1.25, produce: ['papaya'] }),
  food('orange', 'Orange', 'fruit', [47, 0.9, 12, 0.1, 2.4], [piece(130, 'medium'), g], 1, { fvPer100: 1.25, produce: ['orange'] }),
  food('guava', 'Guava', 'fruit', [68, 2.6, 14, 1, 5.4], [piece(150, 'medium'), g], 1, { fvPer100: 1.25, produce: ['guava'] }),
  food('coconut-water', 'Coconut water', 'drink', [19, 0.7, 3.7, 0.2, 1.1], [glass(250), ml], 1),
  food('lemon-water', 'Nimbu pani (light sugar)', 'drink', [16, 0, 4, 0, 0], [glass(250), ml], 1),

  // ——— Nuts & snacks ———
  food('nuts', 'Almonds / cashews', 'snack', [566, 19.5, 26, 47, 8], [{ name: 'handful', grams: 15, label: 'handful (~15 g)' }, g, { name: 'nut', grams: 1.3 }], 1, { tags: ['badam', 'kaju', 'dry fruit'] }),
  food('almonds', 'Almonds', 'snack', [579, 21, 22, 50, 12.5], [{ name: 'nut', grams: 1.2 }, g], 10, { tags: ['badam'] }),
  food('peanuts', 'Roasted peanuts', 'snack', [567, 26, 16, 49, 8.5], [{ name: 'handful', grams: 20 }, g], 1, { tags: ['moongphali'] }),
  food('roasted-chana', 'Roasted chana', 'snack', [370, 20, 58, 5.5, 17], [{ name: 'handful', grams: 25 }, g], 1),
  food('makhana', 'Roasted makhana', 'snack', [380, 9.5, 70, 4, 7], [cup(15), g], 1, { tags: ['fox nuts', 'lotus seeds'] }),
  food('dark-chocolate', 'Dark chocolate', 'snack', [550, 7, 46, 38, 10], [{ name: 'square', grams: 8 }, g], 2),
  food('biscuits', 'Digestive biscuits', 'snack', [480, 7, 65, 21, 3.5], [piece(15, 'biscuit'), g], 2),
  food('samosa', 'Samosa', 'snack', [308, 5, 32, 18, 3], [piece(80, 'samosa'), g], 1),
]

// Attach Hindi names, raw ingredients and cook notes.
for (const f of BUILTIN_FOODS) {
  const k = KITCHEN[f.id]
  if (k) {
    f.hi = k.hi
    f.ingredients = k.ing.map(([item, qty, unit = 'g', soak]) => ({ item, qty, unit, soak }))
    f.cookNote = k.note
    f.cookNoteHi = k.noteHi
  }
}

export const BUILTIN_FOOD_MAP: Record<string, Food> = Object.fromEntries(BUILTIN_FOODS.map((f) => [f.id, f]))
