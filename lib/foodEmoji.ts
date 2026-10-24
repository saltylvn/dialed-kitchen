// An emoji for a food's name (docs/decisions/0023): 🍗 chicken thighs, 🍚 rice, 🥚 eggs.
// Worked out from the name every time it's shown, so it covers everything however it was
// added (typed, imported from a site or photo, from the meal plan, In stock) with no AI, no
// storage and no waiting. Unknown foods get no emoji rather than a wrong one.
//
// How it reads a name: only the part before a comma or bracket ("flour, sifted" → flour),
// singular words (tomatoes → tomato), and the LAST food word wins, because English puts
// the main thing last: "chicken broth" is broth 🍲, "chicken thighs" is chicken 🍗. Two-word
// foods are checked first so "peanut butter" isn't butter.

const PHRASES: Record<string, string> = {
  "peanut butter": "🥜",
  "almond butter": "🥜",
  "ice cream": "🍦",
  "olive oil": "🫒",
  "sweet potato": "🍠",
  "bell pepper": "🫑",
  "red pepper": "🫑",
  "green pepper": "🫑",
  "pepper flake": "🌶️",
  "chili powder": "🌶️",
  "chili pepper": "🌶️",
  "green onion": "🧅",
  "hot dog": "🌭",
  "chocolate chip": "🍫",
  "black pepper": "🧂",
  "green bean": "🫘",
  "cream cheese": "🧀",
  "sour cream": "🥛",
  "protein powder": "🥤",
  "orange juice": "🧃",
  "apple juice": "🧃",
};

const GROUPS: [string, string[]][] = [
  ["🍗", ["chicken", "thigh", "drumstick", "wing", "turkey"]],
  ["🥩", ["beef", "steak", "roast", "brisket", "pork", "lamb", "sirloin", "veal"]],
  ["🥓", ["bacon"]],
  ["🌭", ["sausage", "hotdog", "bratwurst", "kielbasa", "pepperoni"]],
  ["🍖", ["ham", "rib", "meatball"]],
  ["🐟", ["fish", "salmon", "tuna", "cod", "tilapia", "halibut"]],
  ["🦐", ["shrimp", "prawn"]],
  ["🦀", ["crab"]],
  ["🥚", ["egg"]],
  ["🥛", ["milk", "buttermilk", "cream", "creamer"]],
  ["🧈", ["butter", "margarine"]],
  ["🧀", ["cheese", "cheddar", "mozzarella", "parmesan", "feta", "ricotta", "swiss", "provolone"]],
  ["🥣", ["yogurt", "oat", "oatmeal", "cereal", "granola"]],
  ["🍞", ["bread", "bun", "roll", "toast", "baguette", "breadcrumb", "crouton"]],
  ["🫓", ["tortilla", "pita", "naan", "flatbread"]],
  ["🥯", ["bagel"]],
  ["🥞", ["pancake", "waffle"]],
  ["🍝", ["pasta", "spaghetti", "noodle", "macaroni", "penne", "lasagna", "fettuccine", "gnocchi"]],
  ["🍚", ["rice"]],
  ["🌾", ["flour", "wheat", "quinoa", "barley"]],
  ["🌽", ["corn", "cornmeal", "cornstarch"]],
  ["🥔", ["potato"]],
  ["🥕", ["carrot"]],
  ["🧅", ["onion", "shallot", "scallion", "leek"]],
  ["🧄", ["garlic"]],
  ["🍅", ["tomato", "marinara"]],
  ["🥒", ["cucumber", "pickle", "zucchini"]],
  ["🥬", ["lettuce", "spinach", "kale", "cabbage", "chard", "arugula", "greens", "celery"]],
  ["🥦", ["broccoli", "cauliflower"]],
  ["🌶️", ["jalapeno", "jalapeño", "chili", "chipotle", "cayenne", "sriracha"]],
  ["🍄", ["mushroom"]],
  ["🫘", ["bean", "lentil", "chickpea", "hummus"]],
  ["🥜", ["peanut", "almond", "walnut", "pecan", "cashew", "pistachio", "nut"]],
  ["🥑", ["avocado", "guacamole"]],
  ["🍋", ["lemon", "lime"]],
  ["🍎", ["apple", "applesauce"]],
  ["🍐", ["pear"]],
  ["🍊", ["orange", "clementine", "mandarin", "tangerine"]],
  ["🍌", ["banana"]],
  ["🍇", ["grape", "raisin"]],
  ["🍓", ["strawberry", "raspberry", "blackberry", "berry"]],
  ["🫐", ["blueberry"]],
  ["🍒", ["cherry"]],
  ["🍑", ["peach", "nectarine", "apricot"]],
  ["🥭", ["mango"]],
  ["🍍", ["pineapple"]],
  ["🥥", ["coconut"]],
  ["🍉", ["watermelon", "melon", "cantaloupe"]],
  ["🥝", ["kiwi"]],
  [
    "🌿",
    [
      "basil",
      "parsley",
      "cilantro",
      "rosemary",
      "thyme",
      "oregano",
      "mint",
      "dill",
      "herb",
      "sage",
      "ginger",
    ],
  ],
  [
    "🧂",
    [
      "salt",
      "pepper",
      "seasoning",
      "spice",
      "cumin",
      "paprika",
      "cinnamon",
      "nutmeg",
      "clove",
      "turmeric",
    ],
  ],
  ["🫒", ["olive"]],
  ["🫗", ["oil", "vinegar"]],
  ["🍯", ["honey", "syrup", "molasses"]],
  ["🍬", ["sugar", "candy", "marshmallow"]],
  ["🍫", ["chocolate", "cocoa"]],
  ["🍪", ["cookie", "cracker"]],
  ["🎂", ["cake"]],
  ["☕", ["coffee", "espresso"]],
  ["🍵", ["tea", "matcha"]],
  ["🧃", ["juice"]],
  ["🥤", ["soda", "smoothie", "shake"]],
  ["🍲", ["broth", "stock", "soup", "stew", "bouillon"]],
  ["🥫", ["sauce", "ketchup", "mustard", "mayonnaise", "mayo", "salsa", "dressing"]],
  ["🍕", ["pizza"]],
  ["🌮", ["taco"]],
  ["🌯", ["burrito", "wrap"]],
  ["🍿", ["popcorn"]],
  ["🥨", ["pretzel"]],
  ["💧", ["water"]],
  ["🧊", ["ice"]],
];

const WORDS = new Map<string, string>(
  GROUPS.flatMap(([emoji, words]) => words.map((w) => [w, emoji] as const)),
);

// tomatoes → tomato, berries → berry, peaches → peach, eggs → egg (but not "swiss").
export function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -2);
  if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function foodEmoji(name: string): string | null {
  // Someone already put an emoji in the name ("Roma Tomato 🍅", "Tacos 🌮"): keep theirs.
  if (/\p{Extended_Pictographic}/u.test(name)) return null;
  const words = (name.split(/[,(]/)[0] ?? "")
    .toLowerCase()
    .replace(/[^a-zñé\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(singular);
  for (let i = words.length - 1; i >= 0; i--) {
    if (i > 0) {
      const phrase = PHRASES[`${words[i - 1]} ${words[i]}`];
      if (phrase) return phrase;
    }
    const emoji = WORDS.get(words[i]!);
    if (emoji) return emoji;
  }
  return null;
}
