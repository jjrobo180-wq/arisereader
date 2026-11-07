// The Kitchen planner's dish library (November 2026): tap the dishes you want, match them to days, get one
// shopping list with a price. Prices are everyday US estimates for a household of 4; the AI price check
// (server/mealCost.ts) can sharpen them, and every ingredient can be renamed, branded or re-priced.
export type DishSlot = "breakfast" | "lunch" | "dinner" | "snack" | "dessert";
export type Dish = { id: string; slot: DishSlot; name: string; kcal: number; minutes: number; tags: string[]; pop: number; items: [name: string, qty: string, price: number][] };
export const SLOTS: { id: DishSlot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" }, { id: "lunch", label: "Lunch" }, { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snacks" }, { id: "dessert", label: "Desserts" },
];
const D = (slot: DishSlot, id: string, name: string, kcal: number, minutes: number, tags: string, pop: number, items: [string, string, number][]): Dish => ({ id, slot, name, kcal, minutes, tags: tags.split(" ").filter(Boolean), pop, items });

export const DISHES: Dish[] = [
  D("breakfast", "b-oats", "Oatmeal with fruit", 320, 10, "healthy lowcal quick veg", 7, [["Rolled oats", "1 canister", 1.2], ["Bananas", "1 bunch", 1.1], ["Honey", "1 squeeze", 0.4]]),
  D("breakfast", "b-eggs", "Scrambled eggs & toast", 380, 10, "quick popular veg", 9, [["Eggs", "1 dozen", 3.2], ["Bread", "1 loaf", 0.9], ["Butter", "1 stick", 0.6]]),
  D("breakfast", "b-yogurt", "Yogurt parfait", 290, 5, "healthy lowcal quick veg", 8, [["Plain yogurt", "32 oz", 3.5], ["Granola", "1 bag", 1.2], ["Berries", "1 pint", 2.5]]),
  D("breakfast", "b-pancake", "Pancakes", 450, 20, "popular veg", 9, [["Pancake mix", "1 box", 2.5], ["Eggs", "2", 0.6], ["Syrup", "1 bottle", 1.0]]),
  D("breakfast", "b-burrito", "Breakfast burritos", 480, 20, "popular", 8, [["Tortillas", "1 pack", 2.5], ["Eggs", "6", 1.6], ["Sausage", "1 roll", 3.0], ["Shredded cheese", "1 bag", 1.2]]),
  D("breakfast", "b-avotoast", "Avocado toast", 340, 10, "healthy quick veg", 7, [["Avocados", "3", 3.0], ["Bread", "1 loaf", 0.9], ["Lemon", "1", 0.5]]),
  D("breakfast", "b-cereal", "Cereal & milk", 260, 3, "quick lowcal budget veg", 8, [["Cereal", "1 box", 3.0], ["Milk", "1 gallon", 1.5]]),
  D("breakfast", "b-smoothie", "Fruit smoothie", 240, 5, "healthy lowcal quick veg", 7, [["Frozen fruit", "1 bag", 3.5], ["Bananas", "1 bunch", 1.1], ["Milk", "1/2 gallon", 1.0]]),
  D("lunch", "l-pbj", "PB&J sandwiches", 420, 5, "quick budget veg popular", 8, [["Peanut butter", "1 jar", 2.2], ["Jelly", "1 jar", 1.8], ["Bread", "1 loaf", 0.9]]),
  D("lunch", "l-grilled", "Grilled cheese & tomato soup", 520, 15, "quick popular veg", 9, [["Bread", "1 loaf", 0.9], ["Cheese slices", "1 pack", 2.5], ["Tomato soup", "2 cans", 2.0]]),
  D("lunch", "l-wrap", "Chicken salad wraps", 410, 15, "healthy quick", 7, [["Chicken breast", "1 lb", 3.5], ["Tortillas", "1 pack", 2.5], ["Lettuce", "1 head", 1.5], ["Mayo", "1 jar", 0.8]]),
  D("lunch", "l-quesa", "Quesadillas", 460, 15, "quick popular veg", 8, [["Tortillas", "1 pack", 2.5], ["Shredded cheese", "1 bag", 2.4], ["Salsa", "1 jar", 2.0]]),
  D("lunch", "l-pasta", "Pasta salad", 380, 20, "budget veg", 6, [["Rotini pasta", "1 box", 1.3], ["Italian dressing", "1 bottle", 1.8], ["Cucumber", "1", 0.8], ["Cherry tomatoes", "1 pint", 2.5]]),
  D("lunch", "l-tuna", "Tuna sandwiches", 400, 10, "quick budget healthy", 6, [["Canned tuna", "3 cans", 3.0], ["Bread", "1 loaf", 0.9], ["Mayo", "1 jar", 0.8]]),
  D("lunch", "l-bowl", "Rice & bean bowls", 430, 20, "healthy budget veg", 7, [["Rice", "1 bag", 1.5], ["Black beans", "2 cans", 1.6], ["Salsa", "1 jar", 2.0], ["Corn", "1 can", 0.8]]),
  D("lunch", "l-hotdog", "Hot dogs & fruit", 440, 10, "quick budget popular", 7, [["Hot dogs", "1 pack", 2.8], ["Buns", "1 pack", 1.8], ["Apples", "4", 2.0]]),
  D("dinner", "d-tacos", "Tacos", 560, 25, "popular", 10, [["Ground beef", "1 lb", 5.5], ["Taco shells", "1 box", 2.2], ["Taco seasoning", "1 packet", 0.8], ["Shredded cheese", "1 bag", 2.4], ["Lettuce", "1 head", 1.5]]),
  D("dinner", "d-spag", "Spaghetti & meat sauce", 640, 30, "popular", 10, [["Spaghetti", "1 box", 1.4], ["Ground beef", "1 lb", 5.5], ["Pasta sauce", "1 jar", 2.4]]),
  D("dinner", "d-chickrice", "Chicken, rice & broccoli", 520, 30, "healthy popular", 9, [["Chicken breast", "1.5 lb", 5.2], ["Rice", "1 bag", 1.5], ["Broccoli", "1 bag", 2.2]]),
  D("dinner", "d-stirfry", "Veggie stir-fry", 380, 20, "healthy lowcal quick veg", 7, [["Stir-fry vegetables", "2 bags", 5.0], ["Rice", "1 bag", 1.5], ["Soy sauce", "1 bottle", 1.5]]),
  D("dinner", "d-salmon", "Salmon, rice & green beans", 560, 25, "healthy", 7, [["Salmon fillets", "1.5 lb", 11.0], ["Rice", "1 bag", 1.5], ["Green beans", "1 bag", 2.0]]),
  D("dinner", "d-pizza", "Pizza night", 620, 20, "quick popular budget", 10, [["Frozen pizzas", "2", 9.0], ["Salad kit", "1 bag", 3.0]]),
  D("dinner", "d-chili", "Turkey chili", 430, 35, "healthy budget", 6, [["Ground turkey", "1 lb", 4.5], ["Kidney beans", "2 cans", 1.8], ["Diced tomatoes", "2 cans", 2.0], ["Chili seasoning", "1 packet", 0.8]]),
  D("dinner", "d-burger", "Burgers & fries", 720, 25, "popular", 9, [["Ground beef", "1.5 lb", 8.0], ["Buns", "1 pack", 1.8], ["Frozen fries", "1 bag", 2.8], ["Cheese slices", "1 pack", 2.5]]),
  D("snack", "s-apple", "Apples & peanut butter", 200, 3, "healthy lowcal quick veg", 8, [["Apples", "6", 3.0], ["Peanut butter", "1 jar", 2.2]]),
  D("snack", "s-veggie", "Veggies & hummus", 150, 5, "healthy lowcal quick veg", 7, [["Baby carrots", "1 bag", 1.8], ["Hummus", "1 tub", 3.0], ["Cucumber", "1", 0.8]]),
  D("snack", "s-popcorn", "Popcorn", 160, 5, "lowcal budget quick veg", 8, [["Popcorn kernels", "1 bag", 2.5]]),
  D("snack", "s-cheese", "Cheese & crackers", 230, 3, "quick popular veg", 8, [["Cheese sticks", "1 bag", 3.5], ["Crackers", "1 box", 2.5]]),
  D("snack", "s-yog", "Yogurt cups", 120, 1, "healthy lowcal quick veg", 7, [["Yogurt cups", "1 pack", 4.0]]),
  D("snack", "s-trail", "Trail mix", 280, 1, "healthy quick veg", 6, [["Trail mix", "1 bag", 5.0]]),
  D("snack", "s-banana", "Bananas", 105, 1, "healthy lowcal budget quick veg", 8, [["Bananas", "1 bunch", 1.1]]),
  D("snack", "s-chips", "Chips & salsa", 250, 2, "popular quick budget veg", 8, [["Tortilla chips", "1 bag", 3.0], ["Salsa", "1 jar", 2.0]]),
  D("dessert", "x-cookies", "Chocolate chip cookies", 210, 30, "popular veg", 10, [["Cookie dough or mix", "1 pack", 3.0], ["Eggs", "2", 0.6], ["Butter", "1 stick", 0.6]]),
  D("dessert", "x-icecream", "Ice cream", 270, 1, "popular quick veg", 10, [["Ice cream", "1 tub", 4.5]]),
  D("dessert", "x-fruit", "Fruit salad", 90, 10, "healthy lowcal veg", 6, [["Berries", "1 pint", 2.5], ["Grapes", "1 bag", 3.0], ["Melon", "1", 3.0]]),
  D("dessert", "x-brownie", "Brownies", 240, 35, "popular veg", 9, [["Brownie mix", "1 box", 2.5], ["Eggs", "2", 0.6], ["Oil", "1 bottle", 0.8]]),
  D("dessert", "x-pudding", "Pudding cups", 150, 1, "quick budget veg", 6, [["Pudding cups", "1 pack", 3.0]]),
  D("dessert", "x-yogfrozen", "Frozen yogurt bark", 130, 10, "healthy lowcal veg", 5, [["Greek yogurt", "1 tub", 4.0], ["Berries", "1 pint", 2.5], ["Dark chocolate", "1 bar", 2.0]]),
  D("dessert", "x-apple", "Baked cinnamon apples", 140, 30, "healthy lowcal veg", 5, [["Apples", "4", 2.0], ["Cinnamon", "1 jar", 0.5], ["Brown sugar", "1 bag", 0.8]]),
  D("dessert", "x-popsicle", "Popsicles", 60, 1, "lowcal budget quick veg", 7, [["Popsicles", "1 box", 3.5]]),
  D("breakfast", "b-frenchtoast", "French toast", 420, 20, "popular veg", 8, [["Bread", "1 loaf", 0.9], ["Eggs", "6", 1.6], ["Milk", "1 cup", 0.3], ["Syrup", "1 bottle", 2.0]]),
  D("breakfast", "b-bagel", "Bagels & cream cheese", 360, 5, "quick veg", 7, [["Bagels", "1 pack", 3.5], ["Cream cheese", "1 tub", 2.5]]),
  D("breakfast", "b-eggmuff", "Egg & cheese muffins", 390, 10, "quick popular", 8, [["English muffins", "1 pack", 2.5], ["Eggs", "6", 1.6], ["Cheese slices", "1 pack", 2.5]]),
  D("breakfast", "b-hashbrown", "Hash browns & eggs", 410, 20, "popular veg", 7, [["Frozen hash browns", "1 bag", 3.0], ["Eggs", "6", 1.6]]),
  D("breakfast", "b-waffle", "Waffles", 400, 10, "quick popular veg", 8, [["Frozen waffles", "1 box", 3.2], ["Syrup", "1 bottle", 2.0], ["Berries", "1 pint", 2.5]]),
  D("breakfast", "b-chia", "Overnight oats with chia", 310, 5, "healthy lowcal veg", 5, [["Rolled oats", "1 canister", 1.2], ["Chia seeds", "1 bag", 4.0], ["Milk", "1/2 gallon", 1.0], ["Berries", "1 pint", 2.5]]),
  D("breakfast", "b-biscuit", "Biscuits & gravy", 520, 30, "popular", 6, [["Biscuit dough", "1 can", 2.5], ["Sausage", "1 roll", 3.0], ["Flour", "1 bag", 0.5], ["Milk", "1 cup", 0.3]]),
  D("breakfast", "b-cottage", "Cottage cheese & fruit", 230, 3, "healthy lowcal quick veg", 5, [["Cottage cheese", "1 tub", 3.0], ["Peaches", "4", 3.0]]),
  D("breakfast", "b-shake", "Protein shake", 240, 3, "healthy quick veg", 5, [["Protein powder", "1 tub", 6.0], ["Milk", "1/2 gallon", 1.0], ["Bananas", "1 bunch", 1.1]]),
  D("breakfast", "b-sausagebiscuit", "Sausage egg sandwiches", 520, 15, "quick popular", 7, [["Sausage patties", "1 box", 4.0], ["Eggs", "6", 1.6], ["Biscuits", "1 can", 2.5]]),
  D("breakfast", "b-omelet", "Veggie omelet", 330, 15, "healthy veg", 6, [["Eggs", "1 dozen", 3.2], ["Bell peppers", "2", 2.5], ["Spinach", "1 bag", 2.5], ["Shredded cheese", "1 bag", 2.4]]),
  D("breakfast", "b-muffin", "Blueberry muffins", 380, 30, "popular veg", 6, [["Muffin mix", "1 box", 3.0], ["Eggs", "2", 0.6], ["Blueberries", "1 pint", 3.0]]),
  D("lunch", "l-turkeysub", "Turkey sandwiches", 430, 10, "quick popular", 8, [["Deli turkey", "1 lb", 8.0], ["Bread", "1 loaf", 0.9], ["Cheese slices", "1 pack", 2.5], ["Lettuce", "1 head", 1.5]]),
  D("lunch", "l-blt", "BLT sandwiches", 470, 15, "popular", 6, [["Bacon", "1 pack", 6.0], ["Bread", "1 loaf", 0.9], ["Tomatoes", "3", 2.5], ["Lettuce", "1 head", 1.5]]),
  D("lunch", "l-soupsalad", "Soup & side salad", 340, 15, "healthy lowcal", 6, [["Chicken noodle soup", "2 cans", 3.0], ["Salad kit", "1 bag", 3.0]]),
  D("lunch", "l-ramen", "Ramen with egg & veggies", 450, 15, "quick budget", 7, [["Ramen packs", "1 pack of 5", 3.0], ["Eggs", "4", 1.0], ["Frozen vegetables", "1 bag", 2.0]]),
  D("lunch", "l-nachos", "Loaded nachos", 560, 15, "popular", 8, [["Tortilla chips", "1 bag", 3.0], ["Shredded cheese", "1 bag", 2.4], ["Black beans", "1 can", 0.8], ["Salsa", "1 jar", 2.0]]),
  D("lunch", "l-mac", "Mac & cheese", 480, 15, "quick budget popular veg", 9, [["Boxed mac & cheese", "3 boxes", 3.0], ["Peas", "1 bag", 1.8]]),
  D("lunch", "l-chickenwrap", "Chicken Caesar wraps", 450, 15, "popular", 6, [["Chicken breast", "1 lb", 3.5], ["Tortillas", "1 pack", 2.5], ["Caesar dressing", "1 bottle", 2.5], ["Romaine", "1 head", 2.0]]),
  D("lunch", "l-pizzabagel", "Pizza bagels", 410, 15, "quick budget veg", 6, [["Bagels", "1 pack", 3.5], ["Pizza sauce", "1 jar", 1.5], ["Shredded cheese", "1 bag", 2.4]]),
  D("lunch", "l-eggsalad", "Egg salad sandwiches", 400, 20, "budget veg", 5, [["Eggs", "1 dozen", 3.2], ["Mayo", "1 jar", 0.8], ["Bread", "1 loaf", 0.9]]),
  D("lunch", "l-hummus", "Hummus & pita plates", 380, 10, "healthy quick veg", 5, [["Hummus", "1 tub", 3.0], ["Pita bread", "1 pack", 2.5], ["Cucumber", "1", 0.8], ["Cherry tomatoes", "1 pint", 2.5]]),
  D("lunch", "l-leftover", "Leftovers", 450, 5, "quick budget", 8, [["Leftovers from dinner", "as needed", 0.0]]),
  D("lunch", "l-burrito", "Bean & cheese burritos", 440, 15, "budget veg", 7, [["Tortillas", "1 pack", 2.5], ["Refried beans", "1 can", 1.2], ["Shredded cheese", "1 bag", 2.4], ["Rice", "1 bag", 1.5]]),
  D("dinner", "d-meatloaf", "Meatloaf & mashed potatoes", 640, 60, "popular", 7, [["Ground beef", "2 lb", 11.0], ["Breadcrumbs", "1 can", 2.0], ["Ketchup", "1 bottle", 2.0], ["Potatoes", "1 bag", 3.5]]),
  D("dinner", "d-fajitas", "Chicken fajitas", 520, 25, "popular", 8, [["Chicken breast", "1.5 lb", 5.2], ["Bell peppers", "3", 3.5], ["Onions", "1 bag", 2.0], ["Tortillas", "1 pack", 2.5], ["Fajita seasoning", "1 packet", 0.8]]),
  D("dinner", "d-alfredo", "Chicken alfredo", 700, 30, "popular", 8, [["Fettuccine", "1 box", 1.6], ["Chicken breast", "1 lb", 3.5], ["Alfredo sauce", "1 jar", 3.0]]),
  D("dinner", "d-pot", "Pot roast", 560, 180, "popular", 5, [["Chuck roast", "3 lb", 16.0], ["Carrots", "2 lb", 2.0], ["Potatoes", "1 bag", 3.5], ["Onions", "1 bag", 2.0]]),
  D("dinner", "d-bbqchicken", "BBQ chicken & corn", 560, 40, "popular", 7, [["Chicken thighs", "3 lb", 7.0], ["BBQ sauce", "1 bottle", 2.5], ["Corn on the cob", "6", 4.0]]),
  D("dinner", "d-lasagna", "Lasagna", 680, 75, "popular", 7, [["Lasagna noodles", "1 box", 2.5], ["Ground beef", "1 lb", 5.5], ["Ricotta", "1 tub", 3.5], ["Mozzarella", "1 bag", 3.5], ["Pasta sauce", "1 jar", 2.4]]),
  D("dinner", "d-souptaco", "Taco soup", 430, 30, "healthy budget", 5, [["Ground turkey", "1 lb", 4.5], ["Black beans", "2 cans", 1.6], ["Corn", "1 can", 0.8], ["Diced tomatoes", "2 cans", 2.0], ["Taco seasoning", "1 packet", 0.8]]),
  D("dinner", "d-porkchops", "Pork chops & green beans", 520, 30, "budget", 6, [["Pork chops", "4", 7.0], ["Green beans", "1 bag", 2.0], ["Rice", "1 bag", 1.5]]),
  D("dinner", "d-shrimp", "Shrimp scampi", 520, 20, "quick healthy", 6, [["Shrimp", "1 lb", 9.0], ["Linguine", "1 box", 1.6], ["Garlic", "1 head", 0.6], ["Butter", "1 stick", 0.6], ["Lemon", "1", 0.5]]),
  D("dinner", "d-curry", "Chickpea curry", 480, 30, "healthy budget veg", 5, [["Chickpeas", "2 cans", 1.8], ["Coconut milk", "1 can", 2.0], ["Curry paste", "1 jar", 3.0], ["Rice", "1 bag", 1.5]]),
  D("dinner", "d-enchilada", "Chicken enchiladas", 600, 45, "popular", 7, [["Chicken breast", "1 lb", 3.5], ["Tortillas", "1 pack", 2.5], ["Enchilada sauce", "2 cans", 4.0], ["Shredded cheese", "1 bag", 2.4]]),
  D("dinner", "d-hotdogsdinner", "Hot dogs & mac", 640, 20, "quick budget popular", 7, [["Hot dogs", "1 pack", 2.8], ["Buns", "1 pack", 1.8], ["Boxed mac & cheese", "3 boxes", 3.0]]),
  D("dinner", "d-steak", "Steak, potatoes & salad", 720, 30, "popular", 6, [["Steaks", "4", 24.0], ["Potatoes", "1 bag", 3.5], ["Salad kit", "1 bag", 3.0]]),
  D("dinner", "d-friedrice", "Egg fried rice", 480, 20, "quick budget", 7, [["Rice", "1 bag", 1.5], ["Eggs", "4", 1.0], ["Frozen vegetables", "1 bag", 2.0], ["Soy sauce", "1 bottle", 1.5]]),
  D("dinner", "d-slowpulled", "Slow cooker pulled pork", 590, 360, "popular budget", 6, [["Pork shoulder", "3 lb", 10.0], ["BBQ sauce", "1 bottle", 2.5], ["Buns", "1 pack", 1.8], ["Coleslaw mix", "1 bag", 2.0]]),
  D("dinner", "d-bakedpotato", "Loaded baked potatoes", 520, 60, "budget veg", 6, [["Potatoes", "1 bag", 3.5], ["Shredded cheese", "1 bag", 2.4], ["Sour cream", "1 tub", 2.0], ["Broccoli", "1 bag", 2.2]]),
  D("dinner", "d-meatballs", "Spaghetti & meatballs", 680, 35, "popular", 8, [["Spaghetti", "1 box", 1.4], ["Frozen meatballs", "1 bag", 7.0], ["Pasta sauce", "1 jar", 2.4]]),
  D("dinner", "d-tuna", "Tuna casserole", 520, 40, "budget", 4, [["Egg noodles", "1 bag", 2.0], ["Canned tuna", "2 cans", 2.0], ["Cream of mushroom soup", "1 can", 1.5], ["Peas", "1 bag", 1.8]]),
  D("snack", "s-pretzel", "Pretzels", 110, 1, "quick budget veg", 6, [["Pretzels", "1 bag", 2.5]]),
  D("snack", "s-grapes", "Grapes", 100, 1, "healthy lowcal quick veg", 7, [["Grapes", "1 bag", 3.0]]),
  D("snack", "s-edamame", "Edamame", 120, 5, "healthy lowcal quick veg", 4, [["Frozen edamame", "1 bag", 2.5]]),
  D("snack", "s-granola", "Granola bars", 190, 1, "quick budget veg", 7, [["Granola bars", "1 box", 4.0]]),
  D("snack", "s-guac", "Guacamole & chips", 260, 10, "popular quick veg", 7, [["Avocados", "3", 3.0], ["Tortilla chips", "1 bag", 3.0], ["Lime", "1", 0.5]]),
  D("snack", "s-celery", "Celery & peanut butter", 140, 3, "healthy lowcal quick veg", 5, [["Celery", "1 bunch", 1.8], ["Peanut butter", "1 jar", 2.2]]),
  D("snack", "s-jerky", "Beef jerky", 130, 1, "healthy quick", 5, [["Beef jerky", "1 bag", 7.0]]),
  D("snack", "s-fruitsnack", "Fruit snacks", 80, 1, "quick budget veg", 6, [["Fruit snacks", "1 box", 3.5]]),
  D("snack", "s-eggs", "Hard-boiled eggs", 70, 15, "healthy lowcal budget veg", 6, [["Eggs", "1 dozen", 3.2]]),
  D("snack", "s-smoothie", "Smoothie packs", 180, 3, "healthy quick veg", 5, [["Frozen smoothie packs", "1 box", 6.0]]),
  D("dessert", "x-cake", "Birthday cake", 340, 60, "popular veg", 7, [["Cake mix", "1 box", 2.0], ["Frosting", "1 tub", 2.5], ["Eggs", "3", 0.9], ["Oil", "1 bottle", 0.8]]),
  D("dessert", "x-pie", "Apple pie", 320, 90, "popular veg", 7, [["Apples", "6", 4.0], ["Pie crusts", "1 box", 3.5], ["Cinnamon", "1 jar", 0.5], ["Sugar", "1 bag", 0.8]]),
  D("dessert", "x-smores", "S'mores", 230, 10, "popular veg", 8, [["Graham crackers", "1 box", 3.0], ["Marshmallows", "1 bag", 2.5], ["Chocolate bars", "1 pack", 3.5]]),
  D("dessert", "x-cupcakes", "Cupcakes", 260, 40, "popular veg", 7, [["Cupcake mix", "1 box", 2.5], ["Frosting", "1 tub", 2.5], ["Eggs", "2", 0.6]]),
  D("dessert", "x-banana", "Banana pudding", 280, 20, "popular veg", 5, [["Vanilla wafers", "1 box", 3.0], ["Bananas", "1 bunch", 1.1], ["Instant pudding", "1 box", 1.5], ["Milk", "2 cups", 0.5]]),
  D("dessert", "x-cobbler", "Peach cobbler", 330, 60, "popular veg", 5, [["Canned peaches", "2 cans", 3.5], ["Cake mix", "1 box", 2.0], ["Butter", "1 stick", 0.6]]),
  D("dessert", "x-rice", "Rice crispy treats", 160, 15, "quick budget veg", 7, [["Rice cereal", "1 box", 3.5], ["Marshmallows", "1 bag", 2.5], ["Butter", "1 stick", 0.6]]),
  D("dessert", "x-sorbet", "Sorbet", 120, 1, "lowcal quick veg", 4, [["Sorbet", "1 tub", 4.5]]),
  D("dessert", "x-donuts", "Donuts", 290, 1, "popular quick veg", 8, [["Donuts", "1 dozen", 6.0]]),
  D("dessert", "x-cheesecake", "Cheesecake", 400, 80, "popular veg", 6, [["Cream cheese", "3 tubs", 7.5], ["Graham crackers", "1 box", 3.0], ["Sugar", "1 bag", 0.8], ["Eggs", "3", 0.9]]),
];

export type SortKey = "popular" | "healthy" | "calories" | "quick" | "cheap";
export const SORTS: { id: SortKey; label: string }[] = [
  { id: "popular", label: "Popular" }, { id: "healthy", label: "Healthiest" }, { id: "calories", label: "Fewest calories" }, { id: "quick", label: "20 minutes or less" }, { id: "cheap", label: "Cheapest" },
];

/** What one dish costs at the catalog's prices. */
export const dishCost = (d: Dish) => round2(d.items.reduce((a, [, , p]) => a + p, 0));
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const dishById = (id: string, extra: Dish[] = []) => DISHES.find((d) => d.id === id) ?? extra.find((d) => d.id === id);

export function dishesFor(slot: DishSlot, sort: SortKey, search = ""): Dish[] {
  const q = search.trim().toLowerCase();
  let list = DISHES.filter((d) => d.slot === slot && (!q || d.name.toLowerCase().includes(q)));
  if (sort === "quick") list = list.filter((d) => d.minutes <= 20);
  const score = (d: Dish) => sort === "healthy" ? (d.tags.includes("healthy") ? 0 : 1) * 10000 + d.kcal : sort === "calories" ? d.kcal : sort === "cheap" ? dishCost(d) : sort === "quick" ? d.minutes : -d.pop;
  return list.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

/** The week: a dish for a day and a meal. Keys look like "mon:dinner". */
export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DAY_NAME: Record<(typeof WEEK_DAYS)[number], string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
export type Week = Record<string, string>;
export const cellKey = (day: string, slot: DishSlot) => `${day}:${slot}`;

/** Lay the chosen dishes on the week: a dish chosen for 3 days takes 3 days of its meal, in order. Days left over stay empty. */
export function autoFill(counts: Record<string, number>): Week {
  const week: Week = {};
  for (const s of SLOTS) {
    const seq = DISHES.filter((d) => d.slot === s.id && (counts[d.id] ?? 0) > 0).flatMap((d) => Array<string>(Math.min(7, counts[d.id])).fill(d.id)).slice(0, 7);
    seq.forEach((id, i) => { week[cellKey(WEEK_DAYS[i], s.id)] = id; });
  }
  return week;
}
/** How many days each dish is on in a week. */
export const countsOf = (week: Week): Record<string, number> => { const c: Record<string, number> = {}; for (const id of Object.values(week)) c[id] = (c[id] ?? 0) + 1; return c; };

export type ShopLine = { key: string; name: string; qty: string; price: number; meals: number; brand: string };
/** A person's changes to one dish: their own ingredient list (add, take away, swap, brand), or takeout from a place instead of cooking. */
export type DishEdit = { items?: [name: string, qty: string, price: number, brand?: string][]; takeout?: { place: string; price: number } };
export type Custom = Record<string, DishEdit>;
export type PlanCtx = { custom?: Custom; extra?: Dish[] };
export const TAKEOUT_PLACES = ["Chipotle", "McDonald's", "Chick-fil-A", "Subway", "Domino's", "Panda Express", "Taco Bell", "Wendy's", "Pizza Hut", "Olive Garden", "A local place"];
/** A typical takeout price for a household meal, per person by meal. */
export const takeoutGuess = (slot: DishSlot, people: number) => round2(Math.max(1, people) * ({ breakfast: 7, lunch: 11, dinner: 14, snack: 5, dessert: 6 }[slot]));
/** The ingredients a dish really uses: the person's own list if they changed it, otherwise the standard one. */
export const itemsOf = (dish: Dish, edit?: DishEdit): [string, string, number, string?][] => edit?.items ?? dish.items;

/** One shopping list from the week. Same ingredient in two meals is one line (bought once, but sized up). Takeout meals aren't groceries. */
export function shoppingFrom(week: Week, people: number, ctx: PlanCtx = {}): ShopLine[] {
  const scale = Math.max(0.5, people / 4);
  const by = new Map<string, ShopLine>();
  for (const id of Object.values(week)) {
    const dish = dishById(id, ctx.extra); if (!dish) continue;
    const edit = ctx.custom?.[id];
    if (edit?.takeout) continue;
    for (const [name, qty, price, brand] of itemsOf(dish, edit)) {
      const key = name.trim().toLowerCase(); if (!key) continue;
      const own = edit?.items ? 1 : scale; // a changed list is already the person's own amounts
      const cur = by.get(key);
      if (cur) { cur.meals += 1; cur.price = round2(cur.price + price * own * 0.85); }
      else by.set(key, { key, name, qty, price: round2(price * own), meals: 1, brand: brand ?? "" });
    }
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export type TakeoutLine = { dishId: string; dish: string; place: string; price: number; meals: number };
/** The takeout meals of the week, one line per dish. */
export function takeoutFrom(week: Week, ctx: PlanCtx = {}): TakeoutLine[] {
  const by = new Map<string, TakeoutLine>();
  for (const id of Object.values(week)) {
    const t = ctx.custom?.[id]?.takeout; if (!t) continue;
    const cur = by.get(id);
    if (cur) cur.meals += 1; else by.set(id, { dishId: id, dish: dishById(id, ctx.extra)?.name ?? "Meal", place: t.place, price: t.price, meals: 1 });
  }
  return [...by.values()];
}
export const takeoutTotal = (lines: TakeoutLine[]) => round2(lines.reduce((a, l) => a + (Number.isFinite(l.price) ? l.price * l.meals : 0), 0));
export const totalOf = (lines: ShopLine[]) => round2(lines.reduce((a, l) => a + (Number.isFinite(l.price) ? l.price : 0), 0));

/** Work backwards from a weekly budget: start every chosen meal on its cheapest dish, then upgrade to better-liked dishes while the total fits. */
export function planForBudget(budget: number, slots: DishSlot[], people: number, sort: SortKey = "popular"): Week {
  const week: Week = {};
  const pool = (s: DishSlot) => dishesFor(s, "cheap");
  for (const s of slots) { const cheapest = pool(s); WEEK_DAYS.forEach((d, i) => { week[cellKey(d, s)] = cheapest[i % Math.min(3, cheapest.length)].id; }); }
  const cost = () => totalOf(shoppingFrom(week, people));
  if (cost() > budget) return week; // can't fit: the cheapest week is the answer, and the screen says so
  const rank = (slot: DishSlot) => { const r = dishesFor(slot, sort === "cheap" ? "popular" : sort).map((d) => d.id); return (id: string) => { const at = r.indexOf(id); return at < 0 ? 999 : at; }; };
  const uses = (id: string) => Object.values(week).filter((x) => x === id).length;
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const k of Object.keys(week)) {
      const slot = k.split(":")[1] as DishSlot, rk = rank(slot), cur = week[k];
      const better = dishesFor(slot, sort === "cheap" ? "popular" : sort).find((d) => rk(d.id) < rk(cur) && uses(d.id) < 2);
      if (!better) continue;
      week[k] = better.id;
      if (cost() <= budget) changed = true; else week[k] = cur;
    }
    if (!changed) break;
  }
  return week;
}
