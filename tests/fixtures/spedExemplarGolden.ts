// What a correct AI reply looks like for Grade 7 Unit 4 Lesson 8 (percent increase and decrease), in the exact
// JSON shape shared/spedExemplar.ts asks for. Every number here is re-derived independently in
// tests/sped-exemplar.test.ts, so this fixture can't quietly be wrong.
type P = [id: string, title: string, story: string, hints: string[], steps: string[], why: string, check: string, answer: string, finalAnswer: string, accept: string[], say: string];
const prob = ([id, title, story, hints, steps, why, check, answer, finalAnswer, accept, say]: P) => ({ id, title, story, hints, steps, why, check, answer, finalAnswer, accept, say, picture: null });

export const SAVINGS_50 = prob(["8.2b", "Savings: start with $50", "A savings account grows about 6% in a year. You put in $50. How much is in the account after one year?",
  ["What is the starting amount? What percent is it?", "Find 1% of the starting amount first.", "The account grows by 6%. Find 6%, then add it to the start."],
  ["The start is $50. That is 100%.", "It goes **UP** 6%.", "Find 1% of $50: `50 ÷ 100 = 0.50`.", "Find 6%: `6 × 0.50 = 3`.", "Add it to the start: `50 + 3 = 53`."],
  "Adding 6% of the start to the start is the same as multiplying by 1.06.", "`1.06 × 50 = 53` ✓", "**$53**", "53", ["$53", "53 dollars", "53.00"], "Six out of every hundred cents get added."]);
export const CAR_1000 = prob(["8.2f", "Car: starts at $1,000", "A new car loses about 15% of its value in the first year. It started at $1,000. What is it worth after one year?",
  ["Did the value go up or down?", "It went down 15%. What percent is left?", "100% − 15% = ?"],
  ["The start is $1,000. That is 100%.", "It goes **DOWN** 15%. The percent now is 100% − 15% = **85%**.", "85% as a decimal is **0.85**.", "Equation: `0.85 × 1,000 = new value`.", "Multiply: `1,000 × 0.85 = 850`."],
  "Taking away 15% is the same as keeping 85%, so you can also multiply by 0.85.", "`1,000 − 150 = 850` ✓", "**$850**", "850", ["$850", "850 dollars", "850.00"], "Down 15% means 85 out of every 100 are left."]);
export const RESERVOIR = prob(["8.3a", "The reservoir", "The water level in a reservoir is now 52 meters. This was a 23% **increase**. What was the starting depth?",
  ["Did it go up or down?", "The start is 100%. Add the 23%.", "100% + 23% = ?"],
  ["The start is the mystery number **x** (100%).", "It went **UP** 23%, so the percent now is 100% + 23% = **123%** = **1.23**.", "The 52 meters is the **end** amount.", "Equation: `1.23 × x = 52`.", "We know the END, so **divide**: `x = 52 ÷ 1.23`. A calculator gives 42.28, so about **42.3 meters**."],
  "0.23x would be only the 23% extra, not the whole water level.", "`1.23 × 42.3 = 52.03`, very close to 52 ✓ (we rounded)", "Equation **1.23x = 52**. Starting depth is about **42.3 meters**.", "42.3", ["42.28", "about 42.3", "42.3 meters"], "We know where it ended up, so we work backward: divide."]);
export const SNOW = prob(["8.3b", "The snow", "The snow is now 52 inches deep. This was a 77% **decrease**. What was the starting depth?",
  ["Did it go up or down?", "It went down 77%. How much is LEFT out of 100?", "100% − 77% = ?"],
  ["The start is the mystery number **x** (100%).", "It went **DOWN** 77%, so the percent now is 100% − 77% = **23%** = **0.23**.", "The 52 inches is the **end** amount.", "Equation: `0.23 × x = 52`.", "We know the END, so **divide**: `x = 52 ÷ 0.23`. A calculator gives 226.09, so about **226.1 inches**."],
  "0.77x would mean 77% is left. That is a 23% decrease. A 77% decrease leaves only 23%.", "`0.23 × 226.1 = 52.0` ✓", "Equation **0.23x = 52**. Starting depth is about **226.1 inches**.", "226.1", ["226.09", "about 226.1", "226.1 inches"], "A 77% decrease leaves only 23% of the start."]);
export const TSHIRT = prob(["8.4c", "The T-shirt", "After a 25% discount, a T-shirt costs $12. What was the price **before** the discount? Write the equation.",
  ["Do we know the price BEFORE or AFTER the discount?", "The discount is 25% off. How much is left?", "100% − 25% = 75%."],
  ["The start (the price before) is the mystery number **t** = 100%.", "It went **DOWN** 25%: 100% − 25% = **75%** = **0.75**.", "The $12 is the **end** amount.", "Equation: `0.75 × t = 12`.", "We know the END, so **divide**: `t = 12 ÷ 0.75`.", "Easy way: 0.75 is 3/4. `12 ÷ 3/4 = 12 × 4 ÷ 3 = 48 ÷ 3 = 16`."],
  "We can't take 25% off $12 to get the start. The 25% came off the **old** price.", "`0.75 × 16 = 12` ✓ (3/4 of 16 is 12)", "Equation **0.75t = 12**. The old price was **$16**.", "16", ["$16", "16 dollars", "16.00"], "A discount takes some off the old price. The $12 is what is left, so we divide."]);
export const BOOM = prob(["8.4d", "Boom Town", "Compared to last year, Boom Town's population increased 25%. It is now 6,600. What was it last year? Write the equation.",
  ["Before or after: which do we know?", "100% + 25% = ?", "1.25 is the same as 5/4."],
  ["Last year's population is the mystery number **p** = 100%.", "It went **UP** 25%: 100% + 25% = **125%** = **1.25**.", "The 6,600 is the **end** amount.", "Equation: `1.25 × p = 6,600`.", "We know the END, so **divide**: `p = 6,600 ÷ 1.25`.", "Easy way: 1.25 is 5/4. `6,600 × 4 ÷ 5 = 26,400 ÷ 5 = 5,280`."],
  "Dividing by 1.25 undoes the 25% growth.", "`1.25 × 5,280 = 5,280 + 1,320 = 6,600` ✓", "Equation **1.25p = 6,600**. Last year it was **5,280** people.", "5280", ["5,280", "5280 people", "5,280 people"], "Backward means divide."]);
export const TYLER = prob(["8.5", "Tyler's savings bond", "Tyler's mom bought a savings bond. Its value goes up 4% each year. One year after she bought it, it was worth $156. Find the value when she bought it.",
  ["Do we know the price when she bought it (before) or after one year?", "100% + 4% = ?", "Careful: the 4% is 4% of what she paid, not 4% of $156."],
  ["The start (what she paid) is the mystery number **x** = 100%.", "It went **UP** 4%: 100% + 4% = **104%** = **1.04**.", "The $156 is the **end** amount.", "Equation: `1.04 × x = 156`.", "We know the END, so **divide**: `x = 156 ÷ 1.04`.", "Slide the dots: `15,600 ÷ 104 = 150`."],
  "The bond grew from what she paid. Dividing by 1.04 undoes the growth.", "4% of $150 is $6, and `150 + 6 = 156` ✓", "Equation **1.04x = 156**. She paid **$150**.", "150", ["$150", "150 dollars", "150.00"], "The 4% was added to the first price, not to $156. So we divide."]);
export const P1 = prob(["P1", "Designer sneakers", "Sneakers were bought for $120. The price has gone up 15%. What is the new price?",
  ["Do we know the start or the end?", "15% = 10% + 5%."],
  ["The start is $120 = 100%.", "**UP** 15%: 100% + 15% = **115%** = **1.15**.", "Equation: `1.15 × 120 = new price`.", "Find 15%: 10% of 120 = 12, 5% = 6, so 15% = 18.", "`120 + 18 = 138`."],
  "Adding 15% of the start to the start is multiplying by 1.15.", "`1.15 × 120 = 138` ✓", "**$138**", "138", ["$138", "138 dollars", "138.00"], "Up 15% means 115 out of every 100."]);
export const P2 = prob(["P2", "Elena's savings bond", "A $150 savings bond earns 105% interest by the time Elena is 20. How much will it be worth then?",
  ["100% is the $150 she started with.", "The bond EARNS 105% more. 100% + 105% = ?"],
  ["The start is $150 = 100%.", "**UP** 105%: 100% + 105% = **205%** = **2.05**.", "Equation: `2.05 × 150 = new value`.", "`2 × 150 = 300` and `0.05 × 150 = 7.50`.", "`300 + 7.50 = 307.50`."],
  "205% is a little more than 2 times the start, so the answer is a little more than $300.", "$300 is about right, and $307.50 is a little more ✓", "**$307.50**", "307.50", ["$307.50", "307.5", "$307.5"], "More than double."]);

const item = (id: string, q: string, steps: string[], answer: string, finalAnswer: string, accept: string[]) => ({ id, q, steps, answer, finalAnswer, accept });

export const GOLDEN_EXEMPLAR = {
  title: "Percent Increase and Decrease", kicker: "Grade 7 · Unit 4 · Lesson 8", grade: "7",
  source: "Illustrative Mathematics Grade 7, Unit 4, Lesson 8 (Kendall Hunt), CC BY 4.0. Not endorsed by the publisher.",
  oneSentence: "The starting amount is always **100%**. A percent increase adds to 100% and a percent decrease takes away from 100%. Turn that into a decimal and **multiply**. If you are working backward from the end amount, **divide**.",
  howToUse: ["Read Part 1 yourself first. It takes about 10 minutes.", "Teach one box at a time. Do the example together, then let the student do the next one.", "Use the recipe card for every problem.", "Give hints one at a time, then the steps last."],
  ideas: [
    { title: "Idea 1. Percent means “out of 100”", text: ["The word **percent** means **per hundred**, or **out of 100**. The sign is %.", "**6%** means 6 out of every 100."], tryIt: "Put 100 pennies on the table. 6% of them is 6 pennies.", say: "Percent just means out of 100.", picture: { kind: "grid100", label: "6% = 6 squares out of 100", shaded: 6 } },
    { title: "Idea 2. The starting amount is always 100%", text: ["Whatever you start with is the **whole thing**. The whole thing is **100%**."], tryIt: "Hold up a $100 bill. The bank adds $6. We have 100% and 6% more: 106%.", say: "Start is 100%.", picture: { kind: "tape", label: "Start = 100%", pieces: 10, filled: 10, extra: 1, note: "+ 6% more" } },
    { title: "Idea 3. Turn a percent into a decimal", text: ["Move the dot 2 places left. **106%** becomes **1.06**. **85%** becomes **0.85**."], tryIt: "", say: "", picture: null },
  ],
  recipe: { name: "The PERCENT recipe", steps: [{ head: "START", text: "Find the starting amount. It is 100%." }, { head: "UP or DOWN", text: "Did it increase or decrease?" }, { head: "PERCENT NOW", text: "Up: 100% + the percent. Down: 100% − the percent. Make it a decimal." }, { head: "EQUATION", text: "decimal × START = END" }, { head: "SOLVE and CHECK", text: "Know the START: multiply. Know the END: divide. Then check." }], examples: [{ label: "UP 6%", value: "100% + 6% = 106% = 1.06" }, { label: "DOWN 15%", value: "100% − 15% = 85% = 0.85" }] },
  sections: [
    { title: "8.2 Interest and depreciation", intro: "Interest is extra money a bank gives you. Depreciation is when something loses value.", problems: [SAVINGS_50, CAR_1000] },
    { title: "8.3 Matching equations", intro: "The end amount is known, so the start is the mystery number.", problems: [RESERVOIR, SNOW] },
    { title: "8.4 Representing percent change with equations", intro: "", problems: [TSHIRT, BOOM] },
    { title: "8.5 Cool-down", intro: "", problems: [TYLER] },
  ],
  mistakes: [{ wrong: "A student takes 4% of 156 and subtracts: 156 − 6.24 = 149.76.", fix: "Ask: “What was the 4% a percent OF?” (The starting price.) Then show the check: 4% of $150 is $6." }],
  supports: {
    simplified: ["Use easy percents first: 10%, 50%, 25%.", "Give the percent → decimal table.", "Do one step per line."],
    modified: ["Allow a calculator.", "Let the student point to the pieces of a tape diagram instead of writing."],
    extension: ["Ask the student to write their own percent story.", "Try a two-step change: up 10%, then down 10%."],
  },
};

export const GOLDEN_PRACTICE = {
  sheetTitle: "Practice sheet", instructions: "Use the recipe card. Show your steps.",
  sheet: [
    item("1", "A $40 backpack goes up 10%. What is the new price?", ["UP 10%: 100% + 10% = 110% = 1.10.", "`1.10 × 40 = 44`."], "**$44**", "44", ["$44"]),
    item("2", "A game is on sale for $45 after a 10% discount. What was the price before?", ["DOWN 10%: 100% − 10% = 90% = 0.90.", "`0.90 × x = 45`. Know the END, so divide: `45 ÷ 0.90 = 450 ÷ 9 = 50`."], "**$50**", "50", ["$50"]),
    item("3", "A pet hamster weighs 80 grams and grows 25%. How much does it weigh now?", ["UP 25%: 1.25 × 80.", "25% of 80 = 20. `80 + 20 = 100`."], "**100 grams**", "100", ["100 grams"]),
    item("4", "A bike costs $60 after a 25% discount. What was the price before?", ["DOWN 25%: 75% = 0.75.", "`0.75 × x = 60`. Divide: `60 ÷ 0.75 = 60 × 4 ÷ 3 = 240 ÷ 3 = 80`."], "**$80**", "80", ["$80"]),
  ],
  book: [{ title: "The lesson's practice problems", intro: "", problems: [P1, P2] }],
  quickRef: [{ label: "8.2", text: "$53 · $850" }, { label: "8.3", text: "1.23x = 52 (about 42.3 m) · 0.23x = 52 (about 226.1 in)" }, { label: "8.4", text: "0.75t = 12, $16 · 1.25p = 6,600, 5,280" }, { label: "8.5", text: "1.04x = 156, $150" }],
};

/** What an independent solver gets for each problem (computed here with arithmetic, not copied from the fixture). */
export const INDEPENDENT_ANSWERS: Record<string, string> = {
  "e:8.2b": String(50 * 1.06),
  "e:8.2f": String(1000 * 0.85),
  "e:8.3a": (52 / 1.23).toFixed(2),
  "e:8.3b": (52 / 0.23).toFixed(2),
  "e:8.4c": String(12 / 0.75),
  "e:8.4d": String(6600 / 1.25),
  "e:8.5": String(156 / 1.04),
  "b:P1": String(120 * 1.15),
  "b:P2": (150 * 2.05).toFixed(2),
  "s:1": String(40 * 1.1),
  "s:2": String(45 / 0.9),
  "s:3": String(80 * 1.25),
  "s:4": String(60 / 0.75),
};
