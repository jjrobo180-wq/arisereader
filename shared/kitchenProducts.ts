// The Kitchen planner's built-in product shelf (November 2026). Every ingredient a dish uses is a "group" (ground
// beef, cookie dough), and each group has real products to buy: a brand, a package size and a price. Prices here are
// King Soopers-style estimates until the store is connected (server/kroger.ts), then they're the store's own.
// Amounts are in one unit per group: "ct" (pieces: eggs, cookies, slices), "oz" (weight) or "floz" (liquid).
export type KUnit = "ct" | "oz" | "floz";
export type KGroup = { id: string; name: string; unit: KUnit; /** What one piece/amount is called: "cookie", "slice". */ each?: string; aisle: string; /** Most kitchens already have it (oil, salt, spices). */ staple?: boolean; perishable?: boolean };
export type KProduct = { id: string; group: string; name: string; brand: string; size: number; label: string; price: number; source?: "built-in" | "store" | "you"; storeId?: string; at?: string };

const G = (id: string, name: string, unit: KUnit, aisle: string, flags = "", each?: string): KGroup => ({ id, name, unit, aisle, each, staple: flags.includes("s"), perishable: flags.includes("p") });
export const GROUPS: KGroup[] = [
  // Produce
  G("bananas", "Bananas", "ct", "Produce", "p", "banana"), G("apples", "Apples", "ct", "Produce", "p", "apple"), G("strawberries", "Strawberries", "oz", "Produce", "p"),
  G("blueberries", "Blueberries", "oz", "Produce", "p"), G("grapes", "Grapes", "oz", "Produce", "p"), G("lemons", "Lemons", "ct", "Produce", "p", "lemon"), G("limes", "Limes", "ct", "Produce", "p", "lime"),
  G("avocados", "Avocados", "ct", "Produce", "p", "avocado"), G("lettuce", "Iceberg lettuce", "ct", "Produce", "p", "head"), G("romaine", "Romaine hearts", "ct", "Produce", "p", "heart"),
  G("salad-kit", "Salad kit", "oz", "Produce", "p"), G("spinach", "Baby spinach", "oz", "Produce", "p"), G("tomatoes", "Tomatoes", "ct", "Produce", "p", "tomato"),
  G("cherry-tomatoes", "Cherry tomatoes", "oz", "Produce", "p"), G("cucumbers", "Cucumbers", "ct", "Produce", "p", "cucumber"), G("bell-peppers", "Bell peppers", "ct", "Produce", "p", "pepper"),
  G("onions", "Yellow onions", "ct", "Produce", "p", "onion"), G("garlic", "Garlic", "ct", "Produce", "s", "head"), G("potatoes", "Russet potatoes", "oz", "Produce", "p"),
  G("carrots", "Carrots", "oz", "Produce", "p"), G("baby-carrots", "Baby carrots", "oz", "Produce", "p"), G("celery", "Celery", "oz", "Produce", "p"), G("broccoli", "Broccoli florets", "oz", "Produce", "p"),
  G("green-beans", "Green beans", "oz", "Produce", "p"), G("corn-cob", "Sweet corn", "ct", "Produce", "p", "ear"), G("peaches", "Peaches", "ct", "Produce", "p", "peach"), G("melon", "Cantaloupe", "ct", "Produce", "p", "melon"),
  G("coleslaw", "Coleslaw mix", "oz", "Produce", "p"),
  // Meat & seafood
  G("ground-beef", "Ground beef 80/20", "oz", "Meat & seafood", "p"), G("ground-turkey", "Ground turkey", "oz", "Meat & seafood", "p"), G("chicken-breast", "Chicken breasts", "oz", "Meat & seafood", "p"),
  G("chicken-thighs", "Chicken thighs", "oz", "Meat & seafood", "p"), G("rotisserie", "Rotisserie chicken", "ct", "Meat & seafood", "p", "chicken"), G("salmon", "Salmon fillets", "oz", "Meat & seafood", "p"),
  G("shrimp", "Shrimp", "oz", "Meat & seafood", "p"), G("steak", "Sirloin steak", "oz", "Meat & seafood", "p"), G("pork-chops", "Pork chops", "oz", "Meat & seafood", "p"),
  G("pork-shoulder", "Pork shoulder", "oz", "Meat & seafood", "p"), G("chuck-roast", "Chuck roast", "oz", "Meat & seafood", "p"), G("bacon", "Bacon", "ct", "Meat & seafood", "p", "slice"),
  G("sausage", "Breakfast sausage roll", "oz", "Meat & seafood", "p"), G("sausage-patties", "Sausage patties", "ct", "Frozen", "p", "patty"), G("hot-dogs", "Hot dogs", "ct", "Meat & seafood", "p", "hot dog"),
  G("deli-turkey", "Deli turkey", "oz", "Deli", "p"), G("meatballs", "Frozen meatballs", "ct", "Frozen", "", "meatball"), G("tuna", "Canned tuna", "ct", "Pantry", "", "can"), G("jerky", "Beef jerky", "oz", "Snacks"),
  // Dairy & eggs
  G("eggs", "Eggs", "ct", "Dairy & eggs", "p", "egg"), G("milk", "Milk", "floz", "Dairy & eggs", "p"), G("butter", "Butter", "oz", "Dairy & eggs", "s"),
  G("shredded-cheese", "Shredded cheese", "oz", "Dairy & eggs", "p"), G("cheese-slices", "Cheese slices", "ct", "Dairy & eggs", "p", "slice"), G("cheese-sticks", "String cheese", "ct", "Dairy & eggs", "p", "stick"),
  G("mozzarella", "Mozzarella", "oz", "Dairy & eggs", "p"), G("cream-cheese", "Cream cheese", "oz", "Dairy & eggs", "p"), G("sour-cream", "Sour cream", "oz", "Dairy & eggs", "p"),
  G("yogurt", "Plain yogurt", "oz", "Dairy & eggs", "p"), G("greek-yogurt", "Greek yogurt", "oz", "Dairy & eggs", "p"), G("yogurt-cups", "Yogurt cups", "ct", "Dairy & eggs", "p", "cup"),
  G("cottage-cheese", "Cottage cheese", "oz", "Dairy & eggs", "p"), G("ricotta", "Ricotta", "oz", "Dairy & eggs", "p"), G("biscuit-dough", "Biscuit dough", "ct", "Dairy & eggs", "p", "biscuit"),
  G("cookie-dough", "Cookie dough", "ct", "Dairy & eggs", "p", "cookie"), G("hummus", "Hummus", "oz", "Deli", "p"), G("pudding-cups", "Pudding cups", "ct", "Snacks", "", "cup"),
  // Bread & bakery
  G("bread", "Sandwich bread", "ct", "Bread & bakery", "p", "slice"), G("buns", "Hamburger buns", "ct", "Bread & bakery", "p", "bun"), G("hotdog-buns", "Hot dog buns", "ct", "Bread & bakery", "p", "bun"),
  G("bagels", "Bagels", "ct", "Bread & bakery", "p", "bagel"), G("english-muffins", "English muffins", "ct", "Bread & bakery", "p", "muffin"), G("tortillas", "Flour tortillas", "ct", "Bread & bakery", "p", "tortilla"),
  G("taco-shells", "Taco shells", "ct", "Pantry", "", "shell"), G("pita", "Pita bread", "ct", "Bread & bakery", "p", "pita"), G("donuts", "Donuts", "ct", "Bread & bakery", "p", "donut"),
  // Pantry
  G("spaghetti", "Spaghetti", "oz", "Pantry"), G("fettuccine", "Fettuccine", "oz", "Pantry"), G("rotini", "Rotini", "oz", "Pantry"), G("linguine", "Linguine", "oz", "Pantry"),
  G("lasagna-noodles", "Lasagna noodles", "oz", "Pantry"), G("egg-noodles", "Egg noodles", "oz", "Pantry"), G("mac-cheese", "Boxed mac & cheese", "ct", "Pantry", "", "box"), G("ramen", "Ramen noodles", "ct", "Pantry", "", "pack"),
  G("rice", "Long grain white rice", "oz", "Pantry"), G("oats", "Old fashioned oats", "oz", "Pantry"), G("cereal", "Cereal", "oz", "Pantry"), G("granola", "Granola", "oz", "Pantry"),
  G("pancake-mix", "Pancake mix", "oz", "Pantry"), G("muffin-mix", "Muffin mix", "ct", "Pantry", "", "box"), G("brownie-mix", "Brownie mix", "ct", "Pantry", "", "box"), G("cake-mix", "Cake mix", "ct", "Pantry", "", "box"),
  G("frosting", "Frosting", "ct", "Pantry", "", "tub"), G("pasta-sauce", "Pasta sauce", "oz", "Pantry"), G("pizza-sauce", "Pizza sauce", "oz", "Pantry"), G("alfredo", "Alfredo sauce", "oz", "Pantry"),
  G("salsa", "Salsa", "oz", "Pantry"), G("enchilada-sauce", "Enchilada sauce", "oz", "Pantry"), G("tomato-soup", "Tomato soup", "ct", "Pantry", "", "can"), G("chicken-soup", "Chicken noodle soup", "ct", "Pantry", "", "can"),
  G("cream-mushroom", "Cream of mushroom soup", "ct", "Pantry", "", "can"), G("black-beans", "Black beans", "ct", "Pantry", "", "can"), G("kidney-beans", "Kidney beans", "ct", "Pantry", "", "can"),
  G("refried-beans", "Refried beans", "ct", "Pantry", "", "can"), G("chickpeas", "Chickpeas", "ct", "Pantry", "", "can"), G("diced-tomatoes", "Diced tomatoes", "ct", "Pantry", "", "can"), G("corn-can", "Canned corn", "ct", "Pantry", "", "can"),
  G("canned-peaches", "Canned peaches", "ct", "Pantry", "", "can"), G("coconut-milk", "Coconut milk", "ct", "Pantry", "", "can"), G("peanut-butter", "Peanut butter", "oz", "Pantry"), G("jelly", "Grape jelly", "oz", "Pantry"),
  G("honey", "Honey", "oz", "Pantry", "s"), G("syrup", "Pancake syrup", "floz", "Pantry"), G("mayo", "Mayonnaise", "floz", "Pantry", "s"), G("ketchup", "Ketchup", "oz", "Pantry", "s"), G("bbq-sauce", "BBQ sauce", "oz", "Pantry"),
  G("soy-sauce", "Soy sauce", "floz", "Pantry", "s"), G("italian-dressing", "Italian dressing", "floz", "Pantry"), G("caesar-dressing", "Caesar dressing", "floz", "Pantry"), G("oil", "Vegetable oil", "floz", "Pantry", "s"),
  G("flour", "All-purpose flour", "oz", "Pantry", "s"), G("sugar", "Sugar", "oz", "Pantry", "s"), G("brown-sugar", "Brown sugar", "oz", "Pantry", "s"), G("cinnamon", "Ground cinnamon", "oz", "Pantry", "s"),
  G("taco-seasoning", "Taco seasoning", "ct", "Pantry", "", "packet"), G("chili-seasoning", "Chili seasoning", "ct", "Pantry", "", "packet"), G("fajita-seasoning", "Fajita seasoning", "ct", "Pantry", "", "packet"),
  G("curry-paste", "Curry paste", "oz", "Pantry"), G("breadcrumbs", "Breadcrumbs", "oz", "Pantry", "s"), G("chia", "Chia seeds", "oz", "Pantry"), G("protein-powder", "Protein powder", "oz", "Pantry"),
  // Snacks & sweets
  G("popcorn", "Popcorn kernels", "oz", "Snacks"), G("tortilla-chips", "Tortilla chips", "oz", "Snacks"), G("pretzels", "Pretzels", "oz", "Snacks"), G("crackers", "Crackers", "oz", "Snacks"),
  G("trail-mix", "Trail mix", "oz", "Snacks"), G("granola-bars", "Granola bars", "ct", "Snacks", "", "bar"), G("fruit-snacks", "Fruit snacks", "ct", "Snacks", "", "pouch"), G("graham-crackers", "Graham crackers", "ct", "Snacks", "", "sheet"),
  G("marshmallows", "Marshmallows", "ct", "Snacks", "", "marshmallow"), G("chocolate-bars", "Milk chocolate bars", "ct", "Snacks", "", "bar"), G("dark-chocolate", "Dark chocolate", "oz", "Snacks"),
  G("vanilla-wafers", "Vanilla wafers", "oz", "Snacks"), G("instant-pudding", "Instant pudding", "ct", "Pantry", "", "box"), G("rice-cereal", "Crisp rice cereal", "oz", "Pantry"), G("pie-crust", "Pie crusts", "ct", "Dairy & eggs", "p", "crust"),
  // Frozen
  G("frozen-pizza", "Frozen pizza", "ct", "Frozen", "", "pizza"), G("frozen-waffles", "Frozen waffles", "ct", "Frozen", "", "waffle"), G("frozen-fruit", "Frozen mixed fruit", "oz", "Frozen"),
  G("frozen-veg", "Frozen mixed vegetables", "oz", "Frozen"), G("stir-fry-veg", "Stir-fry vegetables", "oz", "Frozen"), G("peas", "Frozen peas", "oz", "Frozen"), G("edamame", "Frozen edamame", "oz", "Frozen"),
  G("hash-browns", "Frozen hash browns", "oz", "Frozen"), G("fries", "Frozen fries", "oz", "Frozen"), G("ice-cream", "Ice cream", "floz", "Frozen"), G("sorbet", "Sorbet", "floz", "Frozen"), G("popsicles", "Popsicles", "ct", "Frozen", "", "popsicle"),
];

const P = (group: string, id: string, brand: string, name: string, size: number, label: string, price: number): KProduct => ({ id, group, brand, name, size, label, price, source: "built-in" });
export const PRODUCTS: KProduct[] = [
  P("bananas", "bananas-each", "Fresh", "Bananas", 1, "each", 0.25), P("bananas", "bananas-bunch", "Fresh", "Bananas, bunch of 6", 6, "6 ct", 1.49),
  P("apples", "apples-each", "Fresh", "Gala apple", 1, "each", 0.89), P("apples", "apples-bag", "Fresh", "Gala apples, 3 lb bag", 9, "9 ct", 4.99),
  P("strawberries", "strawberries-1lb", "Fresh", "Strawberries", 16, "1 lb", 3.99), P("strawberries", "strawberries-2lb", "Fresh", "Strawberries", 32, "2 lb", 6.49),
  P("blueberries", "blueberries-6", "Fresh", "Blueberries", 6, "6 oz", 2.99), P("blueberries", "blueberries-18", "Fresh", "Blueberries", 18, "18 oz", 5.99),
  P("grapes", "grapes-2lb", "Fresh", "Red seedless grapes", 32, "about 2 lb", 5.38), P("lemons", "lemons-each", "Fresh", "Lemon", 1, "each", 0.69), P("limes", "limes-each", "Fresh", "Lime", 1, "each", 0.33),
  P("avocados", "avocado-each", "Fresh", "Hass avocado", 1, "each", 1.25), P("avocados", "avocado-bag", "Fresh", "Hass avocados, bag", 5, "5 ct", 4.99),
  P("lettuce", "lettuce-head", "Fresh", "Iceberg lettuce", 1, "1 head", 1.79), P("romaine", "romaine-3", "Fresh", "Romaine hearts", 3, "3 ct", 3.99),
  P("salad-kit", "salad-kit-12", "Taylor Farms", "Chopped salad kit", 12, "12 oz", 4.49), P("spinach", "spinach-5", "Simple Truth Organic", "Baby spinach", 5, "5 oz", 2.99), P("spinach", "spinach-16", "Simple Truth Organic", "Baby spinach", 16, "16 oz", 5.99),
  P("tomatoes", "tomatoes-each", "Fresh", "Roma tomato", 1, "each", 0.35), P("cherry-tomatoes", "cherry-10", "Fresh", "Cherry tomatoes", 10, "10 oz", 2.99), P("cucumbers", "cucumber-each", "Fresh", "Cucumber", 1, "each", 0.79),
  P("bell-peppers", "pepper-each", "Fresh", "Green bell pepper", 1, "each", 0.89), P("bell-peppers", "pepper-3pk", "Fresh", "Tri-color peppers", 3, "3 ct", 3.99),
  P("onions", "onion-each", "Fresh", "Yellow onion", 1, "each", 0.79), P("onions", "onion-3lb", "Fresh", "Yellow onions, 3 lb bag", 8, "about 8 ct", 3.49), P("garlic", "garlic-head", "Fresh", "Garlic", 1, "1 head", 0.59),
  P("potatoes", "potatoes-5lb", "Fresh", "Russet potatoes", 80, "5 lb", 3.99), P("potatoes", "potatoes-10lb", "Fresh", "Russet potatoes", 160, "10 lb", 5.99),
  P("carrots", "carrots-2lb", "Fresh", "Carrots", 32, "2 lb", 1.99), P("baby-carrots", "baby-carrots-16", "Kroger", "Baby carrots", 16, "16 oz", 1.49), P("celery", "celery-16", "Fresh", "Celery hearts", 16, "16 oz", 2.49),
  P("broccoli", "broccoli-12", "Kroger", "Broccoli florets", 12, "12 oz", 2.99), P("green-beans", "green-beans-12", "Kroger", "Steam-in-bag green beans", 12, "12 oz", 1.99),
  P("corn-cob", "corn-each", "Fresh", "Sweet corn", 1, "1 ear", 0.5), P("peaches", "peach-each", "Fresh", "Peach", 1, "each", 0.99), P("melon", "melon-each", "Fresh", "Cantaloupe", 1, "each", 2.99),
  P("coleslaw", "coleslaw-14", "Kroger", "Classic coleslaw mix", 14, "14 oz", 1.99),
  P("ground-beef", "beef-1lb", "Kroger", "Ground beef 80/20", 16, "1 lb", 5.49), P("ground-beef", "beef-3lb", "Kroger", "Ground beef 80/20, family pack", 48, "3 lb", 14.97),
  P("ground-turkey", "turkey-1lb", "Jennie-O", "Lean ground turkey", 16, "1 lb", 5.29), P("chicken-breast", "chicken-breast-2-5", "Kroger", "Boneless chicken breasts", 40, "about 2.5 lb", 8.73),
  P("chicken-breast", "chicken-breast-5", "Kroger", "Boneless chicken breasts, value pack", 80, "about 5 lb", 14.95), P("chicken-thighs", "thighs-3lb", "Kroger", "Bone-in chicken thighs", 48, "about 3 lb", 5.97),
  P("rotisserie", "rotisserie-each", "King Soopers Deli", "Rotisserie chicken", 1, "each", 6.99), P("salmon", "salmon-1lb", "Kroger", "Atlantic salmon fillets", 16, "1 lb", 9.99),
  P("shrimp", "shrimp-1lb", "Kroger", "Raw shrimp, 31-40 ct", 16, "1 lb", 8.99), P("steak", "steak-2lb", "Kroger", "Top sirloin steaks", 32, "about 2 lb", 17.98),
  P("pork-chops", "porkchops-1-5", "Kroger", "Boneless pork chops", 24, "about 1.5 lb", 6.72), P("pork-shoulder", "pork-shoulder-4", "Kroger", "Pork shoulder roast", 64, "about 4 lb", 9.96),
  P("chuck-roast", "chuck-3lb", "Kroger", "Beef chuck roast", 48, "about 3 lb", 20.97), P("bacon", "bacon-12", "Kroger", "Hickory smoked bacon", 14, "12 oz, about 14 slices", 5.49),
  P("bacon", "bacon-oscar", "Oscar Mayer", "Naturally hardwood smoked bacon", 15, "16 oz, about 15 slices", 7.99), P("sausage", "sausage-16", "Jimmy Dean", "Pork sausage roll", 16, "16 oz", 4.99),
  P("sausage-patties", "patties-12", "Jimmy Dean", "Fully cooked sausage patties", 12, "12 ct", 6.49), P("hot-dogs", "hotdogs-8", "Ball Park", "Beef franks", 8, "8 ct", 4.99), P("hot-dogs", "hotdogs-kroger", "Kroger", "Beef franks", 8, "8 ct", 2.99),
  P("deli-turkey", "deli-turkey-9", "Hillshire Farm", "Oven roasted turkey breast", 9, "9 oz", 4.99), P("meatballs", "meatballs-32", "Kroger", "Homestyle meatballs", 32, "26 oz, about 32 ct", 6.99),
  P("tuna", "tuna-each", "StarKist", "Chunk light tuna in water", 1, "5 oz can", 1.29), P("tuna", "tuna-4pk", "StarKist", "Chunk light tuna, 4 pack", 4, "4 cans", 4.49), P("jerky", "jerky-3", "Jack Link's", "Original beef jerky", 3.25, "3.25 oz", 6.49),
  P("eggs", "eggs-12", "Kroger", "Grade A large eggs", 12, "12 ct", 3.29), P("eggs", "eggs-18", "Kroger", "Grade A large eggs", 18, "18 ct", 4.79), P("eggs", "eggs-60", "Kroger", "Grade A large eggs", 60, "60 ct", 13.99),
  P("milk", "milk-half", "Kroger", "2% reduced fat milk", 64, "half gallon", 2.49), P("milk", "milk-gallon", "Kroger", "2% reduced fat milk", 128, "1 gallon", 3.69),
  P("butter", "butter-16", "Kroger", "Salted butter sticks", 16, "1 lb, 4 sticks", 4.99), P("butter", "butter-kerrygold", "Kerrygold", "Pure Irish butter", 8, "8 oz", 4.49),
  P("shredded-cheese", "cheese-8", "Kroger", "Shredded Mexican blend", 8, "8 oz", 2.49), P("shredded-cheese", "cheese-32", "Kroger", "Shredded Mexican blend", 32, "2 lb", 8.49), P("shredded-cheese", "cheese-tillamook", "Tillamook", "Shredded medium cheddar", 8, "8 oz", 4.29),
  P("cheese-slices", "slices-16", "Kroger", "American cheese singles", 16, "16 ct", 2.99), P("cheese-slices", "slices-kraft", "Kraft", "Singles American slices", 24, "24 ct", 5.99),
  P("cheese-sticks", "sticks-12", "Kroger", "Mozzarella string cheese", 12, "12 ct", 3.99), P("cheese-sticks", "sticks-24", "Kroger", "Mozzarella string cheese", 24, "24 ct", 6.99),
  P("mozzarella", "mozz-16", "Kroger", "Shredded mozzarella", 16, "16 oz", 4.49), P("cream-cheese", "creamcheese-8", "Philadelphia", "Original cream cheese", 8, "8 oz", 3.29), P("cream-cheese", "creamcheese-kroger", "Kroger", "Cream cheese", 8, "8 oz", 1.99),
  P("sour-cream", "sourcream-16", "Daisy", "Sour cream", 16, "16 oz", 2.99), P("yogurt", "yogurt-32", "Kroger", "Plain lowfat yogurt", 32, "32 oz", 2.99),
  P("greek-yogurt", "greek-32", "Fage", "Total 0% Greek yogurt", 32, "32 oz", 6.99), P("greek-yogurt", "greek-kroger", "Kroger", "Plain nonfat Greek yogurt", 32, "32 oz", 4.49),
  P("yogurt-cups", "yogurt-cups-8", "Yoplait", "Original yogurt cups", 8, "8 ct", 5.29), P("yogurt-cups", "gogurt-16", "Go-GURT", "Low fat yogurt tubes", 16, "16 ct", 4.99),
  P("cottage-cheese", "cottage-16", "Good Culture", "Cottage cheese", 16, "16 oz", 3.99), P("ricotta", "ricotta-15", "Kroger", "Whole milk ricotta", 15, "15 oz", 2.99),
  P("biscuit-dough", "biscuits-8", "Pillsbury", "Grands! Southern homestyle biscuits", 8, "8 ct", 3.49),
  P("cookie-dough", "tollhouse-24", "Nestlé Toll House", "Chocolate chip cookie dough", 24, "16.5 oz, 24 ct", 4.99), P("cookie-dough", "pillsbury-24", "Pillsbury", "Ready to bake chocolate chip cookies", 24, "16 oz, 24 ct", 4.79),
  P("cookie-dough", "tollhouse-48", "Nestlé Toll House", "Chocolate chip cookie dough, big pack", 48, "33 oz, 48 ct", 8.99),
  P("hummus", "hummus-10", "Sabra", "Classic hummus", 10, "10 oz", 4.49), P("pudding-cups", "pudding-4", "Snack Pack", "Chocolate pudding cups", 4, "4 ct", 1.79), P("pudding-cups", "pudding-12", "Snack Pack", "Chocolate pudding cups", 12, "12 ct", 4.49),
  P("bread", "bread-kroger", "Kroger", "Classic white bread", 20, "20 oz, about 20 slices", 1.49), P("bread", "bread-daves", "Dave's Killer Bread", "21 Whole Grains and Seeds", 22, "27 oz, about 22 slices", 6.49),
  P("bread", "bread-wheat", "Nature's Own", "100% whole wheat", 20, "20 oz, about 20 slices", 3.99), P("buns", "buns-8", "Kroger", "Hamburger buns", 8, "8 ct", 1.79), P("hotdog-buns", "hotdog-buns-8", "Kroger", "Hot dog buns", 8, "8 ct", 1.79),
  P("bagels", "bagels-6", "Thomas'", "Plain bagels", 6, "6 ct", 4.49), P("english-muffins", "muffins-6", "Thomas'", "Original English muffins", 6, "6 ct", 4.29),
  P("tortillas", "tortillas-10", "Mission", "Flour tortillas, soft taco", 10, "10 ct", 2.99), P("tortillas", "tortillas-20", "Mission", "Flour tortillas, soft taco", 20, "20 ct", 4.49),
  P("taco-shells", "shells-12", "Old El Paso", "Stand 'N Stuff taco shells", 12, "12 ct", 3.29), P("pita", "pita-6", "Kontos", "Pita bread", 6, "6 ct", 3.49), P("donuts", "donuts-12", "King Soopers Bakery", "Glazed donuts", 12, "12 ct", 6.99),
  P("spaghetti", "spaghetti-16", "Barilla", "Spaghetti", 16, "16 oz", 1.89), P("spaghetti", "spaghetti-kroger", "Kroger", "Spaghetti", 16, "16 oz", 1.19), P("fettuccine", "fettuccine-16", "Barilla", "Fettuccine", 16, "16 oz", 1.89),
  P("rotini", "rotini-16", "Barilla", "Rotini", 16, "16 oz", 1.89), P("linguine", "linguine-16", "Barilla", "Linguine", 16, "16 oz", 1.89), P("lasagna-noodles", "lasagna-16", "Barilla", "Lasagne", 16, "16 oz", 2.49),
  P("egg-noodles", "eggnoodles-12", "Kroger", "Wide egg noodles", 12, "12 oz", 1.79), P("mac-cheese", "kraft-mac-1", "Kraft", "Mac & cheese dinner", 1, "7.25 oz box", 1.25), P("mac-cheese", "kraft-mac-5", "Kraft", "Mac & cheese dinner, 5 pack", 5, "5 boxes", 5.49),
  P("ramen", "ramen-12", "Maruchan", "Ramen noodle soup, chicken", 12, "12 ct", 3.99), P("rice", "rice-2lb", "Kroger", "Long grain white rice", 32, "2 lb", 2.29), P("rice", "rice-10lb", "Kroger", "Long grain white rice", 160, "10 lb", 8.99),
  P("oats", "oats-42", "Quaker", "Old fashioned oats", 42, "42 oz", 5.99), P("oats", "oats-kroger", "Kroger", "Old fashioned oats", 42, "42 oz", 3.99),
  P("cereal", "cheerios-12", "General Mills", "Cheerios", 12, "12 oz", 4.99), P("cereal", "cereal-kroger", "Kroger", "Toasted oats cereal", 12, "12 oz", 2.29), P("cereal", "cheerios-family", "General Mills", "Cheerios, family size", 18, "18 oz", 6.49),
  P("granola", "granola-12", "Nature Valley", "Protein granola", 11, "11 oz", 4.99), P("pancake-mix", "pancake-32", "Krusteaz", "Buttermilk pancake mix", 32, "32 oz", 4.29),
  P("muffin-mix", "muffin-mix", "Betty Crocker", "Blueberry muffin mix", 1, "1 box, 12 muffins", 3.29), P("brownie-mix", "brownie-mix", "Ghirardelli", "Double chocolate brownie mix", 1, "1 box, 16 brownies", 3.99),
  P("cake-mix", "cake-mix", "Betty Crocker", "Super moist yellow cake mix", 1, "1 box, 24 cupcakes", 2.29), P("frosting", "frosting", "Betty Crocker", "Rich & creamy chocolate frosting", 1, "16 oz tub", 2.49),
  P("pasta-sauce", "rao-24", "Rao's", "Marinara sauce", 24, "24 oz", 8.99), P("pasta-sauce", "prego-24", "Prego", "Traditional pasta sauce", 24, "24 oz", 2.99), P("pasta-sauce", "kroger-sauce", "Kroger", "Traditional pasta sauce", 24, "24 oz", 1.79),
  P("pizza-sauce", "pizza-sauce-14", "Ragú", "Pizza sauce", 14, "14 oz", 2.49), P("alfredo", "alfredo-15", "Bertolli", "Alfredo sauce", 15, "15 oz", 3.99), P("salsa", "salsa-16", "Pace", "Chunky salsa, medium", 16, "16 oz", 3.29),
  P("enchilada-sauce", "enchilada-10", "Old El Paso", "Red enchilada sauce", 10, "10 oz", 2.29), P("tomato-soup", "tomato-soup", "Campbell's", "Condensed tomato soup", 1, "10.75 oz can", 1.29),
  P("chicken-soup", "chicken-soup", "Campbell's", "Chicken noodle soup", 1, "10.75 oz can", 1.49), P("cream-mushroom", "cream-mushroom", "Campbell's", "Cream of mushroom soup", 1, "10.5 oz can", 1.49),
  P("black-beans", "blackbeans", "Bush's", "Black beans", 1, "15 oz can", 1.29), P("kidney-beans", "kidneybeans", "Bush's", "Dark red kidney beans", 1, "16 oz can", 1.29), P("refried-beans", "refried", "Old El Paso", "Traditional refried beans", 1, "16 oz can", 1.79),
  P("chickpeas", "chickpeas", "Bush's", "Garbanzo beans", 1, "15.5 oz can", 1.29), P("diced-tomatoes", "diced-tomatoes", "Hunt's", "Diced tomatoes", 1, "14.5 oz can", 1.29), P("corn-can", "corn-can", "Del Monte", "Whole kernel corn", 1, "15.25 oz can", 1.19),
  P("canned-peaches", "peaches-can", "Del Monte", "Sliced peaches", 1, "15.25 oz can", 1.99), P("coconut-milk", "coconut-milk", "Thai Kitchen", "Coconut milk", 1, "13.66 oz can", 2.99),
  P("peanut-butter", "jif-16", "Jif", "Creamy peanut butter", 16, "16 oz", 3.49), P("peanut-butter", "jif-40", "Jif", "Creamy peanut butter", 40, "40 oz", 6.99), P("jelly", "jelly-18", "Smucker's", "Concord grape jelly", 18, "18 oz", 3.49),
  P("honey", "honey-12", "Kroger", "Clover honey", 12, "12 oz", 4.29), P("syrup", "syrup-24", "Mrs. Butterworth's", "Original syrup", 24, "24 fl oz", 3.99), P("mayo", "mayo-30", "Hellmann's", "Real mayonnaise", 30, "30 fl oz", 5.99),
  P("ketchup", "ketchup-20", "Heinz", "Tomato ketchup", 20, "20 oz", 2.99), P("bbq-sauce", "bbq-18", "Sweet Baby Ray's", "Original barbecue sauce", 18, "18 oz", 2.79), P("soy-sauce", "soy-10", "Kikkoman", "Soy sauce", 10, "10 fl oz", 3.29),
  P("italian-dressing", "italian-16", "Wish-Bone", "Italian dressing", 16, "16 fl oz", 2.99), P("caesar-dressing", "caesar-12", "Ken's", "Caesar dressing", 16, "16 fl oz", 3.79), P("oil", "oil-48", "Kroger", "Vegetable oil", 48, "48 fl oz", 4.49),
  P("flour", "flour-5lb", "Gold Medal", "All-purpose flour", 80, "5 lb", 3.79), P("sugar", "sugar-4lb", "C&H", "Pure cane sugar", 64, "4 lb", 3.99), P("brown-sugar", "brownsugar-2lb", "C&H", "Light brown sugar", 32, "2 lb", 3.29),
  P("cinnamon", "cinnamon", "McCormick", "Ground cinnamon", 2.37, "2.37 oz", 4.49), P("taco-seasoning", "taco-seasoning", "Old El Paso", "Taco seasoning mix", 1, "1 oz packet", 1.19),
  P("chili-seasoning", "chili-seasoning", "McCormick", "Chili seasoning mix", 1, "1.25 oz packet", 1.49), P("fajita-seasoning", "fajita-seasoning", "McCormick", "Fajita seasoning mix", 1, "1.12 oz packet", 1.49),
  P("curry-paste", "curry-paste", "Thai Kitchen", "Red curry paste", 4, "4 oz", 3.99), P("breadcrumbs", "breadcrumbs", "Progresso", "Italian style bread crumbs", 15, "15 oz", 2.99),
  P("chia", "chia-12", "Simple Truth", "Organic chia seeds", 12, "12 oz", 5.99), P("protein-powder", "protein-2lb", "Premier Protein", "Chocolate whey protein", 24, "24 oz", 24.99),
  P("popcorn", "popcorn-30", "Orville Redenbacher's", "Popcorn kernels", 30, "30 oz", 4.49), P("tortilla-chips", "chips-13", "Tostitos", "Restaurant style tortilla chips", 13, "13 oz", 4.99),
  P("tortilla-chips", "chips-kroger", "Kroger", "Restaurant style tortilla chips", 13, "13 oz", 2.49), P("pretzels", "pretzels-16", "Snyder's", "Mini pretzels", 16, "16 oz", 3.99), P("crackers", "ritz-13", "Ritz", "Original crackers", 13.7, "13.7 oz", 4.49),
  P("trail-mix", "trailmix-26", "Kroger", "Mountain trail mix", 26, "26 oz", 7.99), P("granola-bars", "granolabars-12", "Nature Valley", "Oats 'n honey bars", 12, "12 ct", 4.49), P("fruit-snacks", "fruitsnacks-10", "Welch's", "Mixed fruit snacks", 10, "10 ct", 3.49),
  P("graham-crackers", "graham", "Honey Maid", "Graham crackers", 27, "14.4 oz, about 27 sheets", 4.29), P("marshmallows", "marshmallows", "Jet-Puffed", "Marshmallows", 40, "10 oz, about 40 ct", 2.29),
  P("chocolate-bars", "hershey-6", "Hershey's", "Milk chocolate bars", 6, "6 ct", 5.99), P("dark-chocolate", "dark-choc", "Lindt", "70% dark chocolate", 3.5, "3.5 oz", 3.49), P("vanilla-wafers", "wafers", "Nilla", "Vanilla wafers", 11, "11 oz", 4.29),
  P("instant-pudding", "jello-pudding", "Jell-O", "Instant vanilla pudding", 1, "3.4 oz box", 1.49), P("rice-cereal", "ricekrispies", "Kellogg's", "Rice Krispies", 12, "12 oz", 4.99), P("pie-crust", "piecrust", "Pillsbury", "Refrigerated pie crusts", 2, "2 ct", 3.99),
  P("frozen-pizza", "pizza-totinos", "Tombstone", "Original pepperoni pizza", 1, "19.3 oz pizza", 5.49), P("frozen-pizza", "pizza-digiorno", "DiGiorno", "Rising crust pepperoni pizza", 1, "27.5 oz pizza", 7.99),
  P("frozen-waffles", "eggo-10", "Eggo", "Homestyle waffles", 10, "10 ct", 3.49), P("frozen-waffles", "eggo-24", "Eggo", "Homestyle waffles, family pack", 24, "24 ct", 6.49),
  P("frozen-fruit", "frozenfruit-48", "Kroger", "Mixed fruit", 48, "48 oz", 9.99), P("frozen-fruit", "frozenfruit-16", "Kroger", "Mixed fruit", 16, "16 oz", 3.99), P("frozen-veg", "frozenveg-12", "Birds Eye", "Steamfresh mixed vegetables", 10.8, "10.8 oz", 2.29),
  P("stir-fry-veg", "stirfry-16", "Kroger", "Stir fry vegetables", 16, "16 oz", 2.49), P("peas", "peas-12", "Kroger", "Sweet peas", 12, "12 oz", 1.29), P("edamame", "edamame-12", "Kroger", "Shelled edamame", 12, "12 oz", 2.79),
  P("hash-browns", "hashbrowns-30", "Ore-Ida", "Shredded hash browns", 30, "30 oz", 4.49), P("fries", "fries-32", "Ore-Ida", "Golden crinkles", 32, "32 oz", 4.99), P("fries", "fries-kroger", "Kroger", "Crinkle cut fries", 32, "32 oz", 2.99),
  P("ice-cream", "icecream-48", "Tillamook", "Vanilla bean ice cream", 48, "1.5 qt", 6.99), P("ice-cream", "icecream-kroger", "Kroger", "Vanilla ice cream", 48, "1.5 qt", 3.49),
  P("sorbet", "sorbet-14", "Häagen-Dazs", "Raspberry sorbet", 14, "14 fl oz", 5.49), P("popsicles", "popsicles-12", "Popsicle", "Firecracker ice pops", 12, "12 ct", 4.49),
];

export const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id, g]));
export const groupOf = (id: string) => GROUP_BY_ID.get(id);

/** "24 ct", "16 oz", "1 lb", "1/2 gal", "12 fl oz", "3 lb bag" → an amount in the group's unit, or null. Used for the store's sizes. */
export function parseSize(label: string, unit: KUnit): number | null {
  const s = label.toLowerCase().replace(/,/g, " ");
  const m = s.match(/(\d+(?:\.\d+)?|\d+\/\d+)\s*(fl\.?\s*oz|oz|lb|lbs|g|kg|gal|gallon|qt|quart|pt|pint|ml|l|liter|ct|count|pk|pack|each|ea)\b/);
  if (!m) return null;
  const n = m[1].includes("/") ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1]) : Number(m[1]);
  const u = m[2].replace(/\s|\./g, "");
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "ct") return ["ct", "count", "pk", "pack", "each", "ea"].includes(u) ? n : null;
  const oz = u === "oz" ? n : u === "lb" || u === "lbs" ? n * 16 : u === "g" ? n / 28.35 : u === "kg" ? n * 35.274 : null;
  const floz = u === "floz" ? n : u === "gal" || u === "gallon" ? n * 128 : u === "qt" || u === "quart" ? n * 32 : u === "pt" || u === "pint" ? n * 16 : u === "ml" ? n / 29.574 : u === "l" || u === "liter" ? n * 33.814 : null;
  if (unit === "oz") return oz ?? (u === "floz" ? n : null);
  return floz ?? (u === "oz" ? n : null);
}
