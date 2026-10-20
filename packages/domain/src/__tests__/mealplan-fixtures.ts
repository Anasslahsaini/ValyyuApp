/** Hand-written test data for the meal planner (NOT the real catalogue). */
import type {
  Allergen,
  DietFlags,
  IngredientCategory,
  PlanInput,
  PlanRecipe,
  PriceTable,
  Slot,
} from '../mealplan/types';

type Kind =
  'veg' | 'meat' | 'pork' | 'fish' | 'shell' | 'dairy' | 'egg' | 'gluten' | 'nuts' | 'peanut' | 'soy';
type Def = {
  name: string;
  cat: IngredientCategory;
  kind: Kind;
  price: number;
  unit?: 'kg' | 'l' | 'piece';
  piece?: number;
  pack?: number;
  staple?: boolean;
  ml?: boolean;
};

export const ING: Record<string, Def> = {
  chicken: { name: 'Chicken breast', cat: 'meat', kind: 'meat', price: 9, pack: 500 },
  beef: { name: 'Ground beef', cat: 'meat', kind: 'meat', price: 13, pack: 500 },
  pork: { name: 'Pork chop', cat: 'meat', kind: 'pork', price: 8, pack: 500 },
  salmon: { name: 'Salmon fillet', cat: 'fish', kind: 'fish', price: 18, pack: 250 },
  tuna: { name: 'Canned tuna', cat: 'fish', kind: 'fish', price: 10, pack: 160 },
  shrimp: { name: 'Shrimp', cat: 'fish', kind: 'shell', price: 16, pack: 250 },
  egg: { name: 'Eggs', cat: 'dairy', kind: 'egg', price: 0.3, unit: 'piece', piece: 55 },
  milk: { name: 'Milk', cat: 'dairy', kind: 'dairy', price: 1.1, unit: 'l', ml: true, pack: 1000 },
  cheese: { name: 'Cheddar cheese', cat: 'dairy', kind: 'dairy', price: 10, pack: 200 },
  yogurt: { name: 'Plain yogurt', cat: 'dairy', kind: 'dairy', price: 3, pack: 500 },
  butter: { name: 'Butter', cat: 'dairy', kind: 'dairy', price: 9, pack: 250 },
  rice: { name: 'Rice', cat: 'grain', kind: 'veg', price: 2.2, pack: 1000 },
  pasta: { name: 'Pasta', cat: 'grain', kind: 'gluten', price: 1.8, pack: 500 },
  bread: { name: 'Bread', cat: 'bakery', kind: 'gluten', price: 3, pack: 400 },
  oats: { name: 'Rolled oats', cat: 'grain', kind: 'gluten', price: 2, pack: 500 },
  flour: { name: 'Wheat flour', cat: 'pantry', kind: 'gluten', price: 1.2, pack: 1000 },
  lentils: { name: 'Lentils', cat: 'legume', kind: 'veg', price: 3, pack: 500 },
  chickpeas: { name: 'Chickpeas', cat: 'legume', kind: 'veg', price: 2.5, pack: 400 },
  beans: { name: 'Black beans', cat: 'legume', kind: 'veg', price: 2.5, pack: 400 },
  tofu: { name: 'Tofu', cat: 'other', kind: 'soy', price: 7, pack: 250 },
  tomato: { name: 'Tomatoes', cat: 'produce', kind: 'veg', price: 0.4, unit: 'piece', piece: 120 },
  onion: { name: 'Onion', cat: 'produce', kind: 'veg', price: 0.3, unit: 'piece', piece: 110 },
  garlic: { name: 'Garlic', cat: 'produce', kind: 'veg', price: 8 },
  spinach: { name: 'Spinach', cat: 'produce', kind: 'veg', price: 5, pack: 200 },
  carrot: { name: 'Carrots', cat: 'produce', kind: 'veg', price: 1.4 },
  potato: { name: 'Potatoes', cat: 'produce', kind: 'veg', price: 1.2 },
  zucchini: { name: 'Zucchini', cat: 'produce', kind: 'veg', price: 2.5 },
  pepper: { name: 'Bell pepper', cat: 'produce', kind: 'veg', price: 3.5 },
  mushroom: { name: 'Mushrooms', cat: 'produce', kind: 'veg', price: 6, pack: 250 },
  lettuce: { name: 'Lettuce', cat: 'produce', kind: 'veg', price: 4 },
  banana: { name: 'Bananas', cat: 'produce', kind: 'veg', price: 0.25, unit: 'piece', piece: 120 },
  apple: { name: 'Apples', cat: 'produce', kind: 'veg', price: 2.5 },
  almonds: { name: 'Almonds', cat: 'pantry', kind: 'nuts', price: 14 },
  'peanut-butter': { name: 'Peanut butter', cat: 'pantry', kind: 'peanut', price: 6, pack: 350 },
  'olive-oil': { name: 'Olive oil', cat: 'oil', kind: 'veg', price: 8, unit: 'l', ml: true, staple: true },
  salt: { name: 'Salt', cat: 'spice', kind: 'veg', price: 1, staple: true },
  'coconut-milk': {
    name: 'Coconut milk',
    cat: 'pantry',
    kind: 'veg',
    price: 3.5,
    unit: 'l',
    ml: true,
    pack: 400,
  },
  'tomato-canned': { name: 'Canned tomatoes', cat: 'pantry', kind: 'veg', price: 1.6, pack: 400 },
  honey: { name: 'Honey', cat: 'pantry', kind: 'veg', price: 9 },
};

const flagsOf = (kind: Kind, id: string): { diet: DietFlags; allergens: Allergen[] } => {
  const d: DietFlags = {
    vegan: true,
    vegetarian: true,
    pescatarian: true,
    halalSafe: true,
    glutenFree: true,
    dairyFree: true,
    nutFree: true,
    eggFree: true,
  };
  const a: Allergen[] = [];
  if (kind === 'meat' || kind === 'pork') {
    d.vegan = d.vegetarian = d.pescatarian = false;
    if (kind === 'pork') d.halalSafe = false;
  }
  if (kind === 'fish' || kind === 'shell') {
    d.vegan = d.vegetarian = false;
    a.push(kind === 'fish' ? 'fish' : 'shellfish');
  }
  if (kind === 'dairy') {
    d.vegan = d.dairyFree = false;
    a.push('dairy');
  }
  if (kind === 'egg') {
    d.vegan = d.eggFree = false;
    a.push('egg');
  }
  if (kind === 'gluten') {
    d.glutenFree = false;
    a.push('gluten');
  }
  if (kind === 'nuts') {
    d.nutFree = false;
    a.push('nuts');
  }
  if (kind === 'peanut') {
    d.nutFree = false;
    a.push('peanut');
  }
  if (kind === 'soy') a.push('soy');
  if (id === 'honey') d.vegan = false;
  return { diet: d, allergens: a };
};

export const PRICES: PriceTable = {
  baseCurrency: 'EUR',
  currencyIndex: { EUR: 1, USD: 1.1, MAD: 0.75 },
  items: Object.fromEntries(
    Object.entries(ING).map(([id, d]) => [
      id,
      {
        unit: d.unit ?? 'kg',
        mid: d.price,
        low: Math.round(d.price * 70) / 100,
        high: Math.round(d.price * 140) / 100,
        ...(d.pack ? { packGrams: d.pack } : {}),
      },
    ]),
  ),
};

type Spec = {
  slots?: Slot[];
  mins: [number, number];
  ings: [string, number][];
  kcal: number;
  protein?: number;
  servings?: number;
  tags?: string[];
  cuisine?: string;
  left?: number;
  fav?: boolean;
};
export function recipe(id: string, name: string, s: Spec): PlanRecipe {
  const servings = s.servings ?? 2;
  const ingredients = s.ings.map(([iid, grams]) => {
    const d = ING[iid];
    const { diet, allergens } = flagsOf(d.kind, iid);
    const per = d.unit === 'piece' ? d.price / (d.piece ?? 100) : d.price / 1000;
    return {
      ingredientId: iid,
      name: d.name,
      grams,
      category: d.cat,
      diet,
      allergens,
      staple: d.staple,
      unit: d.unit === 'piece' ? ('piece' as const) : d.ml ? ('ml' as const) : ('g' as const),
      pieceGrams: d.piece,
      packGrams: d.pack,
      cost: d.staple ? 0 : Math.round(grams * per * 100) / 100,
    };
  });
  const cost = ingredients.reduce((x, i) => x + (i.cost ?? 0), 0);
  return {
    id,
    name,
    slots: s.slots ?? ['lunch', 'dinner'],
    servings,
    prepMinutes: s.mins[0],
    cookMinutes: s.mins[1],
    tags: s.tags ?? [],
    cuisine: s.cuisine ?? 'other',
    ingredients,
    perServing: {
      calories: s.kcal,
      protein: s.protein ?? Math.round(s.kcal / 25),
      carbs: Math.round(s.kcal / 8),
      fat: Math.round(s.kcal / 30),
    },
    costPerServing: Math.round((cost / servings) * 100) / 100,
    leftoverDays: s.left ?? 0,
    source: 'catalogue',
    favorite: s.fav,
  };
}

const B: Slot[] = ['breakfast', 'snack'],
  A: Slot[] = ['breakfast', 'lunch', 'dinner'];
export const RECIPES: PlanRecipe[] = [
  // breakfasts
  recipe('oat-bowl', 'Banana oat bowl', {
    slots: B,
    mins: [3, 5],
    ings: [
      ['oats', 80],
      ['milk', 250],
      ['banana', 120],
    ],
    kcal: 420,
    servings: 1,
    tags: ['quick', 'vegetarian'],
    cuisine: 'american',
  }),
  recipe('oat-vegan', 'Vegan oat bowl', {
    slots: B,
    mins: [3, 5],
    ings: [
      ['oats', 80],
      ['coconut-milk', 200],
      ['apple', 100],
    ],
    kcal: 400,
    servings: 1,
    tags: ['quick'],
    cuisine: 'american',
  }),
  recipe('yogurt-apple', 'Yogurt with apple', {
    slots: B,
    mins: [3, 0],
    ings: [
      ['yogurt', 200],
      ['apple', 100],
      ['almonds', 20],
    ],
    kcal: 300,
    servings: 1,
    tags: ['no_cook'],
    cuisine: 'other',
  }),
  recipe('toast-egg', 'Egg on toast', {
    slots: B,
    mins: [3, 7],
    ings: [
      ['bread', 80],
      ['egg', 110],
      ['butter', 10],
    ],
    kcal: 380,
    servings: 1,
    tags: ['quick'],
    cuisine: 'french',
  }),
  recipe('toast-pb', 'Peanut butter toast', {
    slots: B,
    mins: [2, 2],
    ings: [
      ['bread', 80],
      ['peanut-butter', 30],
      ['banana', 100],
    ],
    kcal: 450,
    servings: 1,
    tags: ['quick', 'no_cook'],
    cuisine: 'american',
  }),
  recipe('omelette', 'Mushroom omelette', {
    slots: B,
    mins: [5, 8],
    ings: [
      ['egg', 165],
      ['mushroom', 80],
      ['cheese', 30],
    ],
    kcal: 420,
    servings: 1,
    cuisine: 'french',
  }),
  recipe('pancakes', 'Pancakes', {
    slots: B,
    mins: [10, 15],
    ings: [
      ['flour', 150],
      ['milk', 250],
      ['egg', 110],
    ],
    kcal: 480,
    servings: 2,
    cuisine: 'american',
  }),
  recipe('fruit-bowl', 'Fruit and nuts bowl', {
    slots: B,
    mins: [5, 0],
    ings: [
      ['apple', 150],
      ['banana', 120],
      ['almonds', 30],
    ],
    kcal: 350,
    servings: 1,
    tags: ['no_cook', 'vegan'],
    cuisine: 'other',
  }),
  recipe('yogurt-honey', 'Honey yogurt', {
    slots: B,
    mins: [2, 0],
    ings: [
      ['yogurt', 200],
      ['honey', 20],
    ],
    kcal: 260,
    servings: 1,
    tags: ['no_cook'],
    cuisine: 'mediterranean',
  }),
  recipe('tuna-toast', 'Tuna toast', {
    slots: A,
    mins: [5, 3],
    ings: [
      ['bread', 80],
      ['tuna', 80],
      ['tomato', 60],
    ],
    kcal: 380,
    servings: 1,
    tags: ['quick'],
    cuisine: 'mediterranean',
  }),
  // lunches and dinners
  recipe('chicken-rice', 'Chicken and rice', {
    mins: [10, 25],
    ings: [
      ['chicken', 300],
      ['rice', 200],
      ['pepper', 150],
      ['onion', 110],
      ['olive-oil', 15],
    ],
    kcal: 650,
    servings: 2,
    left: 2,
    tags: ['batch_friendly'],
    cuisine: 'american',
  }),
  recipe('chicken-curry', 'Coconut chicken curry', {
    mins: [15, 30],
    ings: [
      ['chicken', 300],
      ['coconut-milk', 300],
      ['rice', 160],
      ['onion', 110],
      ['spinach', 100],
    ],
    kcal: 700,
    servings: 2,
    left: 2,
    tags: ['batch_friendly'],
    cuisine: 'indian',
  }),
  recipe('beef-pasta', 'Beef bolognese', {
    mins: [10, 35],
    ings: [
      ['beef', 300],
      ['pasta', 200],
      ['tomato-canned', 400],
      ['onion', 110],
      ['garlic', 10],
    ],
    kcal: 760,
    servings: 2,
    left: 2,
    tags: ['batch_friendly'],
    cuisine: 'italian',
  }),
  recipe('pork-potato', 'Pork chops with potatoes', {
    mins: [10, 30],
    ings: [
      ['pork', 400],
      ['potato', 500],
      ['carrot', 200],
    ],
    kcal: 720,
    servings: 2,
    left: 1,
    cuisine: 'french',
  }),
  recipe('salmon-rice', 'Salmon with rice', {
    mins: [10, 15],
    ings: [
      ['salmon', 300],
      ['rice', 160],
      ['zucchini', 200],
    ],
    kcal: 680,
    servings: 2,
    left: 1,
    cuisine: 'asian',
  }),
  recipe('shrimp-pasta', 'Garlic shrimp pasta', {
    mins: [10, 12],
    ings: [
      ['shrimp', 250],
      ['pasta', 200],
      ['garlic', 10],
      ['tomato', 240],
    ],
    kcal: 600,
    servings: 2,
    cuisine: 'italian',
  }),
  recipe('lentil-soup', 'Lentil soup', {
    mins: [10, 30],
    ings: [
      ['lentils', 250],
      ['carrot', 200],
      ['onion', 110],
      ['tomato-canned', 200],
    ],
    kcal: 480,
    servings: 4,
    left: 3,
    tags: ['batch_friendly', 'budget', 'vegan'],
    cuisine: 'middle_eastern',
  }),
  recipe('chickpea-stew', 'Chickpea and spinach stew', {
    mins: [10, 25],
    ings: [
      ['chickpeas', 250],
      ['spinach', 200],
      ['tomato-canned', 400],
      ['onion', 110],
    ],
    kcal: 520,
    servings: 3,
    left: 2,
    tags: ['batch_friendly', 'budget', 'vegan'],
    cuisine: 'maghreb',
  }),
  recipe('bean-chili', 'Black bean chili', {
    mins: [10, 35],
    ings: [
      ['beans', 300],
      ['tomato-canned', 400],
      ['pepper', 200],
      ['onion', 110],
      ['rice', 150],
    ],
    kcal: 560,
    servings: 3,
    left: 2,
    tags: ['batch_friendly', 'budget', 'vegan'],
    cuisine: 'mexican',
  }),
  recipe('tofu-stir-fry', 'Tofu vegetable stir fry', {
    mins: [10, 12],
    ings: [
      ['tofu', 300],
      ['pepper', 200],
      ['zucchini', 200],
      ['rice', 160],
    ],
    kcal: 520,
    servings: 2,
    tags: ['quick', 'vegan'],
    cuisine: 'asian',
  }),
  recipe('veg-pasta', 'Tomato zucchini pasta', {
    mins: [5, 15],
    ings: [
      ['pasta', 200],
      ['zucchini', 250],
      ['tomato', 240],
      ['garlic', 8],
    ],
    kcal: 540,
    servings: 2,
    tags: ['quick', 'vegan'],
    cuisine: 'italian',
  }),
  recipe('shakshuka', 'Shakshuka', {
    mins: [10, 20],
    ings: [
      ['egg', 220],
      ['tomato-canned', 400],
      ['pepper', 150],
      ['onion', 110],
    ],
    kcal: 400,
    servings: 2,
    cuisine: 'maghreb',
  }),
  recipe('cheese-sandwich', 'Grilled cheese sandwich', {
    mins: [3, 7],
    ings: [
      ['bread', 120],
      ['cheese', 80],
      ['butter', 10],
    ],
    kcal: 520,
    servings: 1,
    tags: ['quick'],
    cuisine: 'american',
  }),
  recipe('green-salad', 'Chickpea salad', {
    mins: [10, 0],
    ings: [
      ['chickpeas', 200],
      ['lettuce', 150],
      ['tomato', 240],
      ['olive-oil', 15],
    ],
    kcal: 420,
    servings: 2,
    tags: ['no_cook', 'vegan'],
    cuisine: 'mediterranean',
  }),
  recipe('tuna-salad', 'Tuna rice salad', {
    mins: [10, 0],
    ings: [
      ['tuna', 160],
      ['rice', 150],
      ['tomato', 240],
      ['lettuce', 100],
    ],
    kcal: 480,
    servings: 2,
    tags: ['no_cook'],
    cuisine: 'mediterranean',
  }),
  recipe('mushroom-rice', 'Mushroom risotto', {
    mins: [10, 30],
    ings: [
      ['mushroom', 300],
      ['rice', 200],
      ['onion', 110],
      ['butter', 20],
      ['cheese', 50],
    ],
    kcal: 600,
    servings: 2,
    cuisine: 'italian',
  }),
  recipe('veg-curry', 'Potato spinach curry', {
    mins: [10, 25],
    ings: [
      ['potato', 400],
      ['spinach', 200],
      ['coconut-milk', 250],
      ['rice', 150],
    ],
    kcal: 560,
    servings: 3,
    left: 2,
    tags: ['vegan', 'budget', 'batch_friendly'],
    cuisine: 'indian',
  }),
  recipe('potato-egg', 'Potato egg skillet', {
    mins: [10, 20],
    ings: [
      ['potato', 400],
      ['egg', 165],
      ['onion', 110],
    ],
    kcal: 480,
    servings: 2,
    tags: ['budget'],
    cuisine: 'french',
  }),
  recipe('chicken-salad', 'Chicken salad', {
    mins: [10, 10],
    ings: [
      ['chicken', 200],
      ['lettuce', 150],
      ['tomato', 240],
      ['olive-oil', 15],
    ],
    kcal: 450,
    servings: 2,
    tags: ['high_protein'],
    cuisine: 'mediterranean',
  }),
  recipe('beef-tacos', 'Beef and bean tacos', {
    mins: [10, 15],
    ings: [
      ['beef', 250],
      ['beans', 150],
      ['pepper', 100],
      ['bread', 120],
    ],
    kcal: 640,
    servings: 2,
    cuisine: 'mexican',
  }),
  recipe('salmon-potato', 'Baked salmon with potatoes', {
    mins: [10, 25],
    ings: [
      ['salmon', 300],
      ['potato', 400],
      ['zucchini', 150],
    ],
    kcal: 690,
    servings: 2,
    cuisine: 'french',
  }),
  recipe('lentil-rice', 'Lentils and rice', {
    mins: [5, 25],
    ings: [
      ['lentils', 200],
      ['rice', 150],
      ['onion', 110],
    ],
    kcal: 520,
    servings: 2,
    tags: ['budget', 'vegan'],
    cuisine: 'middle_eastern',
    left: 1,
  }),
  recipe('pasta-cheese', 'Cheesy pasta', {
    mins: [5, 12],
    ings: [
      ['pasta', 200],
      ['cheese', 80],
      ['butter', 15],
    ],
    kcal: 600,
    servings: 2,
    tags: ['quick'],
    cuisine: 'italian',
  }),
  recipe('pork-rice', 'Pork fried rice', {
    mins: [10, 15],
    ings: [
      ['pork', 250],
      ['rice', 200],
      ['egg', 110],
      ['carrot', 100],
    ],
    kcal: 640,
    servings: 2,
    cuisine: 'asian',
  }),
  recipe('chickpea-wrap', 'Chickpea wrap', {
    mins: [10, 5],
    ings: [
      ['chickpeas', 200],
      ['bread', 120],
      ['lettuce', 80],
      ['yogurt', 100],
    ],
    kcal: 500,
    servings: 2,
    tags: ['quick'],
    cuisine: 'middle_eastern',
  }),
  recipe('zucchini-fritters', 'Zucchini fritters', {
    mins: [10, 15],
    ings: [
      ['zucchini', 400],
      ['egg', 110],
      ['flour', 60],
    ],
    kcal: 380,
    servings: 2,
    cuisine: 'mediterranean',
  }),
  recipe('tofu-curry', 'Tofu coconut curry', {
    mins: [10, 20],
    ings: [
      ['tofu', 300],
      ['coconut-milk', 300],
      ['spinach', 150],
      ['rice', 150],
    ],
    kcal: 600,
    servings: 2,
    tags: ['vegan'],
    cuisine: 'asian',
  }),
  recipe('shrimp-rice', 'Shrimp fried rice', {
    mins: [10, 12],
    ings: [
      ['shrimp', 250],
      ['rice', 200],
      ['egg', 55],
      ['pepper', 100],
    ],
    kcal: 560,
    servings: 2,
    cuisine: 'asian',
  }),
  recipe('beef-stew', 'Beef and carrot stew', {
    mins: [15, 60],
    ings: [
      ['beef', 400],
      ['carrot', 300],
      ['potato', 300],
      ['onion', 110],
    ],
    kcal: 680,
    servings: 3,
    left: 2,
    tags: ['batch_friendly'],
    cuisine: 'french',
  }),
  recipe('tomato-soup', 'Roasted tomato soup', {
    mins: [10, 30],
    ings: [
      ['tomato', 600],
      ['onion', 110],
      ['garlic', 8],
      ['olive-oil', 15],
    ],
    kcal: 220,
    servings: 3,
    left: 2,
    tags: ['vegan', 'batch_friendly'],
    cuisine: 'mediterranean',
  }),
  recipe('almond-rice', 'Almond rice pilaf', {
    mins: [5, 20],
    ings: [
      ['rice', 200],
      ['almonds', 40],
      ['onion', 110],
      ['butter', 15],
    ],
    kcal: 520,
    servings: 2,
    cuisine: 'middle_eastern',
  }),
  recipe('slow-chicken', 'Slow cooker chicken and beans', {
    mins: [10, 120],
    ings: [
      ['chicken', 400],
      ['beans', 250],
      ['tomato-canned', 400],
      ['onion', 110],
    ],
    kcal: 620,
    servings: 4,
    left: 3,
    tags: ['batch_friendly'],
    cuisine: 'mexican',
  }),
  recipe('egg-fried-rice', 'Egg fried rice', {
    mins: [5, 10],
    ings: [
      ['rice', 200],
      ['egg', 110],
      ['carrot', 100],
    ],
    kcal: 520,
    servings: 2,
    tags: ['quick', 'budget'],
    cuisine: 'asian',
  }),
  recipe('spinach-pasta', 'Spinach and cheese pasta', {
    mins: [5, 15],
    ings: [
      ['pasta', 200],
      ['spinach', 150],
      ['cheese', 60],
    ],
    kcal: 580,
    servings: 2,
    tags: ['quick'],
    cuisine: 'italian',
  }),
  recipe('bean-salad', 'Three bean salad', {
    mins: [10, 0],
    ings: [
      ['beans', 200],
      ['chickpeas', 200],
      ['tomato', 240],
      ['onion', 50],
    ],
    kcal: 400,
    servings: 2,
    tags: ['no_cook', 'vegan', 'budget'],
    cuisine: 'mexican',
  }),
  recipe('chicken-wrap', 'Chicken wrap', {
    mins: [10, 10],
    ings: [
      ['chicken', 200],
      ['bread', 120],
      ['lettuce', 80],
      ['yogurt', 100],
    ],
    kcal: 560,
    servings: 2,
    cuisine: 'middle_eastern',
    fav: true,
  }),
  recipe('mushroom-pasta', 'Mushroom pasta', {
    mins: [5, 15],
    ings: [
      ['pasta', 200],
      ['mushroom', 250],
      ['garlic', 8],
      ['olive-oil', 15],
    ],
    kcal: 540,
    servings: 2,
    tags: ['vegan'],
    cuisine: 'italian',
  }),
  recipe('fish-tacos', 'Tuna tacos', {
    mins: [10, 5],
    ings: [
      ['tuna', 160],
      ['bread', 120],
      ['pepper', 100],
      ['lettuce', 60],
    ],
    kcal: 480,
    servings: 2,
    cuisine: 'mexican',
  }),
];

export function baseInput(over: Partial<PlanInput> = {}): PlanInput {
  const start = '2026-10-19'; // a Monday
  const minutes: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2026, 9, 19 + i));
    minutes[d.toISOString().slice(0, 10)] = i >= 5 ? 60 : 30;
  }
  return {
    startDate: start,
    days: 7,
    slots: ['breakfast', 'lunch', 'dinner'],
    people: 1,
    targets: { calories: 2000, protein: 100, carbs: 250, fat: 70 },
    weeklyBudget: 0,
    currency: 'EUR',
    cookMinutesByDay: minutes,
    pantry: [],
    recipes: RECIPES,
    diet: [],
    dislikes: [],
    recentMeals: [],
    seed: 1,
    prices: PRICES,
    ...over,
  };
}

/** Synthetic big catalogue (300 recipes) built by cycling the hand-written ones with varied ingredients/times. */
export function bigCatalogue(n = 300): PlanRecipe[] {
  return Array.from({ length: n }, (_, i) => {
    const src = RECIPES[i % RECIPES.length];
    return { ...src, id: `${src.id}-${i}`, name: `${src.name} ${i}`, prepMinutes: src.prepMinutes + (i % 7) };
  });
}
