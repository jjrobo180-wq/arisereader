// Lessons 1 to 7 of Grade 7, Unit 1 (Scale Drawings). See shared/spedMathUnit.ts for how answers are marked.
import type { Lesson } from "./spedMathUnit";

export const LESSONS_1_7: readonly Lesson[] = [
  // ───────────────────────────── Lesson 1 ─────────────────────────────
  {
    n: 1, title: "What Are Scaled Copies?", section: "A: Scaled Copies",
    targets: ["I can tell whether a picture is a scaled copy of another picture.", "I can say in my own words what 'scaled copy' means."],
    bigIdea: "A scaled copy is a bigger or smaller version of a picture that keeps the same shape. Every length changes by the same number of times.",
    primer: [
      "You do not need math training for this lesson. It is about looking carefully and then using numbers to back up what you see.",
      "Think of a photo on your phone. Pinch to zoom: the picture gets bigger but looks the same. That is a scaled copy. Now drag one edge so the picture gets tall and thin. That is NOT a scaled copy, because it changed shape.",
      "The math rule behind it: if one side of the copy is 2 times as long as the matching side of the original, then every side must be 2 times as long. If even one side uses a different number, it is not a scaled copy.",
      "Students will 'eyeball' it at first. That is fine. Your job is to keep asking, 'How do you know? What did you measure or count?'",
    ],
    vocab: [
      { term: "scaled copy", kid: "A bigger or smaller copy with the same shape.", example: "A photo and its wallet-size print." },
      { term: "original", kid: "The picture you start from.", example: "The first F." },
      { term: "horizontal / vertical", kid: "Across (side to side) / up and down.", example: "The top of the F is horizontal. The stem is vertical." },
    ],
    materials: ["Printed portraits (1.1) and F drawings (1.2), or the digital version", "Pairs of Scaled Polygons cards, 10 per pair (1.3)", "Grid paper", "Sticky notes or mini whiteboards"],
    activities: [
      {
        id: "1.1", name: "Printing Portraits", minutes: 10,
        what: "Students compare five portraits to the original and decide which are scaled copies.",
        steps: [
          "Put students in pairs. Give 2 to 3 minutes of quiet think time, then 1 minute to share with a partner.",
          "Ask: 'How is each portrait the same as the original? How is it different?'",
          "Ask which ones are scaled copies and why. Write their reasons on the board in their words.",
          "Ask for a working definition of 'scaled copy'. Rough wording is expected today. Do not correct it yet.",
        ],
        items: [
          { id: "1.1a", q: "Which portraits are scaled copies of the original?", a: "Portraits C and D: each is a larger or smaller version with the same overall shape. A, B and E were changed another way (stretched or squeezed).", check: "figure", note: "The teacher guide describes C and D this way. Look at your printed sheet to confirm which letters are the evenly resized ones." },
          { id: "1.1b", q: "What does 'scaled copy' mean?", a: "A bigger or smaller version of a picture with the same shape. Any wording that says 'same shape, different size' is acceptable.", check: "ok" },
        ],
        watch: ["Students saying 'it looks stretched' are on the right track. Ask what part got longer."],
      },
      {
        id: "1.2", name: "Scaling F", minutes: 10,
        what: "Students decide which of several drawings of the letter F are scaled copies, then draw their own.",
        steps: [
          "Keep the same pairs. Give 3 to 4 minutes of quiet work, then 1 to 2 minutes to compare with a partner.",
          "Use your hands to teach 'horizontal' (across) and 'vertical' (up and down). Have the group agree on names for the parts of the F (stem, top bar, middle bar).",
          "Show the sentence frame: 'Drawing __ is a scaled copy because __.'",
          "Display all seven drawings. Vote on each. Have one or two students explain the ones people disagree about.",
          "Clarify wording: 'twice as long' and 'two times as long' mean the same. Always say 'times as long'.",
        ],
        items: [
          { id: "1.2a", q: "Original F: stem 4, top bar 2, bottom bar 1. Drawing 1: stem 6, top 3, bottom 1½. Scaled copy?", a: "Yes. Every length is 1½ times as long (6÷4 = 1½, 3÷2 = 1½, 1½÷1 = 1½). The 1½ ends between grid lines, and that is allowed.", check: "ok" },
          { id: "1.2b", q: "Drawing 2: stem 8, top 4, bottom 2. Scaled copy?", a: "Yes. Every length is 2 times as long (scale factor 2).", check: "ok" },
          { id: "1.2c", q: "Drawing 3: stem 4, top 4, bottom 3. Scaled copy?", a: "No. The stem stayed the same (×1) but the top is 2 times as long and the bottom is 3 times as long. Different numbers.", check: "ok" },
          { id: "1.2d", q: "Drawing 5: stem 6, top 3, bottom 2. Scaled copy?", a: "No. Stem and top are 1½ times as long, but the bottom is 2 times as long.", check: "ok" },
          { id: "1.2e", q: "Drawing 7: stem 12, top 6, bottom 3. Scaled copy?", a: "Yes. Every length is 3 times as long (scale factor 3).", check: "ok" },
          { id: "1.2f", q: "Drawings 4 and 6 (slanted stem; and a small F).", a: "Drawing 4 has a slanted stem, so its angles changed: not a scaled copy. Drawing 6 as listed (stem 2, top 1, bottom 1): the stem and top are half as long but the bottom is the same, so not a scaled copy.", check: "figure", note: "These come from the public teacher page. The print version uses different drawings, so measure your own sheet using the same test: is every length multiplied by the same number?" },
          { id: "1.2g", q: "Draw a different scaled copy of the original F.", a: "Any F where all three lengths use the same factor, such as 8 / 4 / 2 (×2), 12 / 6 / 3 (×3) or 2 / 1 / ½ (×½). Angles stay square corners.", check: "ok" },
        ],
        watch: ["Some students think corners must land on grid crossings. A copy with a 1½ bar is fine. Show Drawing 1.", "Students who only check the stem. Ask them to check every part."],
      },
      {
        id: "1.3", name: "Pairs of Scaled Polygons", minutes: 15,
        what: "Partners match 10 polygon cards into pairs that are scaled copies, and explain each match.",
        steps: [
          "Show how with a student. Spread the cards face up. Each polygon has exactly one match.",
          "Model a match AND a non-match, and show how to agree or disagree politely: 'I agree because…', 'I disagree because…'.",
          "Partners take turns. Each pair explains the match out loud before moving on.",
          "When all matches are made, they check against the answer key from the blackline master, then fix mistakes.",
          "Each pair draws one matched pair on grid paper and shows how one is a scaled copy of the other.",
        ],
        items: [
          { id: "1.3a", q: "Which polygons pair up?", a: "Use the answer key that comes with the Pairs of Scaled Polygons blackline master. Method for any pair: count the length of each side of both polygons; every side in the second must be the same number of times as long as its partner in the first.", check: "figure", note: "The pairings are not on the public page." },
          { id: "1.3b", q: "How many sides must you check?", a: "To say NOT a copy, two sides with different factors are enough. To say YES, check every side.", check: "ok" },
          { id: "1.3c", q: "Extension: can one polygon be a scaled copy of both A and B?", a: "Only if A and B are scaled copies of each other. If they are not, it is impossible. If A and B are copies of each other, then any copy of A at a matching size works.", check: "ok" },
        ],
        watch: ["Students think a polygon might have two matches. Remind them each has exactly one.", "Angles can be skipped here because every side follows grid lines."],
      },
    ],
    summary: [
      "A scaled copy keeps the shape. If one segment in the copy is half as long, every other segment must be half as long.",
      "To decide, compare lengths with a number: 'all the sides are 2 times as long' or 'all are one third as long'.",
    ],
    supports: {
      simplified: ["Start with only 4 of the 10 polygon cards and add more later.", "Give a checklist: 1) Pick a side. 2) How many times as long is its match? 3) Does the next side use the same number?", "Use a ruler or count grid squares aloud. Let students point instead of writing."],
      modified: ["Use physical cut-out shapes. Place a copy on top to show 'twice as long' with a string or strip of paper.", "Offer yes / no cards and a partner who writes the reason as the student says it.", "Reduce to two portraits and two F drawings with large print."],
      extension: ["Do the 'are you ready for more' polygon question (1.3c).", "Ask students to draw an F where every length is 2½ times as long."],
    },
    exit: { id: "1.x", q: "Our check: Rectangle 2 by 3. Rectangle 4 by 9. Is the second a scaled copy of the first?", a: "No. 4 is 2 times 2, but 9 is 3 times 3. The two lengths use different numbers (2 and 3).", check: "ok" },
    mistakes: ["Judging by looks only. Ask for a number.", "Thinking the corners must be on grid points.", "Checking just one side and declaring a match."],
  },

  // ───────────────────────────── Lesson 2 ─────────────────────────────
  {
    n: 2, title: "Corresponding Parts and Scale Factors", section: "A: Scaled Copies",
    targets: ["I can find the matching parts in a figure and its copy.", "I can find the scale factor that takes the original to its copy."],
    bigIdea: "Matching parts are called corresponding parts. Corresponding angles in a scaled copy are equal. Corresponding lengths are all multiplied by one number: the scale factor.",
    primer: [
      "Corresponding means 'in the same spot'. If a drawing has a top-left corner, the copy has a top-left corner. Those two corners correspond.",
      "The scale factor is the one number you multiply every original length by to get the copy's length. Original 3, copy 6: scale factor 2. Original 4, copy 2: scale factor ½.",
      "To find a scale factor, divide: copy length ÷ original length. Both ways round: original × scale factor = copy.",
      "Angles are different. They do not get bigger when a picture is zoomed. A square corner stays a square corner. Tracing paper lets students see this: trace the angle and lay it over the matching angle.",
    ],
    vocab: [
      { term: "corresponding", kid: "Matching: in the same place in both pictures.", example: "The top vertex of triangle ABC and of triangle DEF." },
      { term: "scale factor", kid: "The number you multiply by to get the copy.", example: "3 → 6 means scale factor 2." },
      { term: "angle", kid: "The corner where two sides meet, measured in degrees.", example: "A square corner is 90°." },
    ],
    materials: ["Geometry toolkit with tracing paper", "Sticky notes or mini whiteboards", "Printed signs (2.2) and triangles A to H (2.3)"],
    activities: [
      {
        id: "2.1", name: "Number Talk: Multiplying by a Unit Fraction", minutes: 5,
        what: "Students find three products in their heads.",
        steps: ["Show one problem at a time. Give about 1 minute of quiet think time.", "Students show a quiet thumbs-up when they have an answer and a way to explain it.", "Ask 2 or 3 students how they did it. Write the methods down."],
        items: [
          { id: "2.1a", q: "¼ · 32", a: "8 (one fourth of 32 is 32 ÷ 4)", check: "ok" },
          { id: "2.1b", q: "7.2 · 1/9", a: "0.8 (7.2 ÷ 9)", check: "ok" },
          { id: "2.1c", q: "¼ · 5.6", a: "1.4 (5.6 ÷ 4)", check: "ok" },
        ],
        watch: ["The key idea: taking a fraction like ¼ of a number is the same as dividing by 4."],
      },
      {
        id: "2.2", name: "Corresponding Parts", minutes: 15,
        what: "Students compare an original sign with two copies, name corresponding parts, and test whether angles stay the same.",
        steps: [
          "Show the designs. Ask 'What do you notice? What do you wonder?'",
          "Point to a pair of matching points, segments and angles so everyone hears the word 'corresponding'.",
          "Pairs work 2 to 3 minutes on the first two questions, then talk for 2 minutes.",
          "Students then work alone with tracing paper: trace an angle, slide it over the matching angle in each copy.",
        ],
        items: [
          { id: "2.2a", q: "Original sign is 18 in tall and 18 in wide. Copy 1 is 14 by 14. Is it a scaled copy?", a: "Yes. 14 ÷ 18 = 7/9 for both height and width, so the scale factor is 7/9 (about 0.78).", check: "ok" },
          { id: "2.2b", q: "Copy 2 is 17 tall and 26 wide. Scaled copy?", a: "No. 17 ÷ 18 is about 0.94 for the height but 26 ÷ 18 is about 1.44 for the width. Different numbers.", check: "ok" },
          { id: "2.2c", q: "What do you notice about the corresponding angles?", a: "In the scaled copy (Copy 1) corresponding angles have the same measure. In the one that is not a copy (Copy 2) at least some corresponding angles differ, for example angle UVW is not the same as angle KLM.", check: "ok" },
          { id: "2.2d", q: "Fill in the table of corresponding parts (point P, segment LM, segment EF, point W, angles).", a: "Read the matching letters off your own sheet: the part in the same position in each figure. Teach it by tracing a finger from the original to the copy.", check: "figure" },
        ],
        watch: ["Students match parts by letter name instead of position. Ask 'Where is it on the picture?'"],
      },
      {
        id: "2.3", name: "Scaled Triangles", minutes: 15,
        what: "Groups decide which triangles are scaled copies of Triangle O (sides 3, 4, 5) and name each scale factor.",
        steps: [
          "Groups of 4. Give each student two of the triangles to test.",
          "Quiet thinking (2 minutes), then the group shares and agrees which are scaled copies (2 to 3 minutes).",
          "Complete the table: for each scaled copy, the sides that match 3, 4 and 5, and how it was scaled.",
          "Introduce 'scale factor' using the students' words, e.g. 'you multiplied by 2'.",
        ],
        items: [
          { id: "2.3a", q: "Sides (6, 8, 10) vs O (3, 4, 5)?", a: "Scaled copy, scale factor 2. (6÷3 = 8÷4 = 10÷5 = 2)", check: "ok" },
          { id: "2.3b", q: "Sides (1½, 2, 2½)?", a: "Scaled copy, scale factor ½. (1.5÷3 = 2÷4 = 2.5÷5 = ½)", check: "ok" },
          { id: "2.3c", q: "Sides (3, 4, 5) in another position?", a: "Scaled copy, scale factor 1 (same size).", check: "ok" },
          { id: "2.3d", q: "Sides (2, 8/3, 10/3)?", a: "Scaled copy, scale factor 2/3. (2÷3 = (8/3)÷4 = (10/3)÷5 = 2/3)", check: "ok" },
          { id: "2.3e", q: "Sides (6, 7, 8)?", a: "Not a scaled copy. 6÷3 = 2 but 7÷4 = 1.75 and 8÷5 = 1.6. Whole-number sides do not make it a copy.", check: "ok" },
          { id: "2.3f", q: "Sides (2, 5, 5.39) and (2, 2, 2.38)?", a: "Neither is a scaled copy. The ratios to 3, 4, 5 are not the same: 2÷3 = 0.67 but 5÷4 = 1.25; and 2÷3 = 0.67 but 2÷4 = 0.5.", check: "ok" },
          { id: "2.3g", q: "Which letters are the copies?", a: "Use the side lengths above, not the letter. Our reading of the public page: A, C, G and H are scaled copies (A = half, C = 6, 8, 10, G = same size, H = 2/3). B has a side near 6.08 and 6.32, which is not a copy.", check: "figure", note: "The public page lists the side lengths for C and F in a different order than its own discussion, so confirm letters on your printed sheet. The numbers themselves are right: sides in the ratio 3 : 4 : 5 are copies. We could not see B's full set of sides." },
          { id: "2.3h", q: "Extension: pick a triangle that is not a copy and make one by changing sides, keeping at least one side the same.", a: "Example: (6, 7, 8) becomes (6, 8, 10) by changing 7 to 8 and 8 to 10 and keeping the 6. That is Triangle O scaled by 2.", check: "ok" },
        ],
        watch: ["Students who think 6, 7, 8 is a copy because the numbers are whole. Show that corresponding angles are not equal."],
      },
    ],
    summary: ["Corresponding parts are parts in the same position in both figures: points, sides and angles.", "The scale factor is the number that turns each original length into the copy's length. Example: triangle ABC to triangle DEF with scale factor 3/2 (1.5)."],
    supports: {
      simplified: ["Use only whole-number scale factors first (2 and 3).", "Give a two-column table: 'original length' | 'copy length' | 'copy ÷ original'.", "Colour the corresponding sides the same colour on both figures."],
      modified: ["Pair each triangle with a colour-coded strip of paper cut to the original's lengths so students can lay strips side by side.", "Offer a multiplication chart and calculator.", "Ask yes / no: 'Is each side 2 times as long?' instead of 'find the scale factor'."],
      extension: ["Find the scale factor going backwards (copy to original). It is the reciprocal.", "Do the 2.3h extension and explain what must stay equal."],
    },
    exit: { id: "2.x", q: "Our check: Triangle with sides 4, 6, 8. Another with sides 6, 9, 12. Scaled copy? What scale factor?", a: "Yes. 6÷4 = 9÷6 = 12÷8 = 1.5. The scale factor is 1½ (or 3/2).", check: "ok" },
    mistakes: ["Matching by letter instead of position.", "Saying two figures with whole-number sides must be copies.", "Dividing in the wrong direction. Say 'copy over original'."],
  },

  // ───────────────────────────── Lesson 3 ─────────────────────────────
  {
    n: 3, title: "Making Scaled Copies", section: "A: Scaled Copies",
    targets: ["I can draw a scaled copy of a figure using a scale factor.", "I can explain why adding to every side does not make a scaled copy."],
    bigIdea: "Scaling is multiplying (or dividing). Adding or subtracting the same number to every side does NOT make a scaled copy.",
    primer: [
      "This is the lesson where students (and adults) discover a common trap. To make a figure twice as big, you multiply the lengths by 2. If you add 2 to every length, the shape changes.",
      "Quick proof you can show a class: a 2 by 4 rectangle plus 2 on each side is 4 by 6. 4÷2 = 2, but 6÷4 = 1.5. Not the same number, so not a scaled copy.",
      "How to draw a scaled copy by hand: pick a scale factor, multiply every length by it, then draw. Keep every angle the same. An index card or strip of paper can be a ruler by marking one unit on it.",
    ],
    vocab: [
      { term: "scale factor", kid: "The number you multiply every length by.", example: "Factor 3: a 2 becomes 6." },
      { term: "multiplicative", kid: "Uses multiplying (or dividing).", example: "×3, ÷2." },
      { term: "additive", kid: "Uses adding (or subtracting).", example: "+4 to every side: does not work." },
    ],
    materials: ["Geometry toolkits", "Index cards or paper strips (3.4)", "Grid paper"],
    activities: [
      {
        id: "3.1", name: "More or Less?", minutes: 5,
        what: "Students decide, without calculating, whether each product is more or less than a number.",
        steps: ["Display the problems. Give 2 minutes of quiet thinking.", "Ask what about the numbers helped. Do not let them calculate exactly."],
        items: [
          { id: "3.1a", q: "Is 25 × 8.5 more or less than 205?", a: "More. 25 × 8 = 200 and there is still 25 × 0.5 to add, so it is above 205. Exactly 212.5.", check: "ok" },
          { id: "3.1b", q: "Is 9.93 × 0.984 more or less than 10?", a: "Less. 9.93 is below 10 and multiplying by less than 1 makes it smaller. About 9.77.", check: "ok" },
          { id: "3.1c", q: "Is 0.24 × 0.67 more or less than 0.2?", a: "Less. 0.24 times something less than 1 is below 0.24, and 0.24 × 0.67 is about 0.16.", check: "ok" },
        ],
        watch: ["Link to the lesson: multiplying by a number less than 1 shrinks, more than 1 grows."],
      },
      {
        id: "3.2", name: "Drawing Scaled Copies", minutes: 10,
        what: "Students draw a scaled copy using a given scale factor (3, or ½).",
        steps: ["Give 3 minutes of quiet drawing with geometry toolkits.", "Partners compare for 3 minutes, check, and revise.", "Ask: how did you choose the side lengths and angles? How could you tell if you made a mistake?"],
        items: [
          { id: "3.2a", q: "Figure A (sides 2, 3, 3 and a slanted side that goes up 3 and over 1), scale factor 3.", a: "Sides 6, 9, 9, and the slanted side goes up 9 and over 3. Angles do not change.", check: "figure", note: "Based on the numbers on the public page. Check them against your sheet and multiply each by 3." },
          { id: "3.2b", q: "Same task with scale factor ½ on a figure with whole-number sides.", a: "Divide each length by 2. A side of 3 becomes 1½. That is allowed even though 1½ falls between grid lines.", check: "ok" },
          { id: "3.2c", q: "How can all correct answers differ?", a: "Correct copies are the same size and shape but may be placed in different spots or turned.", check: "ok" },
        ],
        watch: ["Students who think a ½ copy is impossible because some corners will not land on grid points. Tell them it is fine."],
      },
      {
        id: "3.3", name: "Which Operations? (Part 1)", minutes: 10,
        what: "Students work out what Diego and Jada did to the same original figure, and who made a scaled copy.",
        steps: ["Diego and Jada both want the 15-unit side of the original to be 5 units. Give 2 to 3 minutes of quiet thinking, then share with a partner.", "Optional: act as Diego, state a mistaken claim, and have partners critique and fix it (the curriculum calls this Critique a Flawed Explanation)."],
        items: [
          { id: "3.3a", q: "What did Diego do? (Original sides 36, 18, 15, 12, 21, 30 became 26, 8, 5, 2, 11, 20.)", a: "He subtracted 10 from every side.", check: "ok" },
          { id: "3.3b", q: "What did Jada do? (Her sides are 12, 6, 5, 4, 7, 10.)", a: "She divided every side by 3 (multiplied by ⅓).", check: "ok" },
          { id: "3.3c", q: "Did each make a scaled copy?", a: "Only Jada. Her scale factor is ⅓. Diego's lengths do not all use one multiplier, and his sides do not even close into a shape. Angles in Jada's copy match the original.", check: "ok" },
        ],
        watch: ["Students think subtracting is okay because the 15 became 5. Show the other sides."],
      },
      {
        id: "3.4", name: "Which Operations? (Part 2)", minutes: 10,
        what: "Students answer Andre's question and make the copy he wants, using an index card as a ruler.",
        steps: ["Make sure everyone knows the 4-unit side must become 8. Give out index cards but do not say how to use them.", "5 to 6 minutes quiet work, then 2 minutes to share.", "Ask what scale factor they used and why."],
        items: [
          { id: "3.4a", q: "Andre asks if he should add 4 to every side. What do you say?", a: "No. Adding 4 turns the 4 into 8 but also turns 12 into 16 (not 24) and 6 into 10 (not 12). A scaled copy multiplies. Here the scale factor is 8 ÷ 4 = 2.", check: "ok" },
          { id: "3.4b", q: "Make the copy. Jada's sides are 12, 6, 5, 4, 7, 10.", a: "Multiply by 2: 24, 12, 10, 8, 14, 20, with the same angles.", check: "ok" },
          { id: "3.4c", q: "Extension: Triangle B has each side 5 more than Triangle A. Can B be a scaled copy of A?", a: "Only if A has three equal sides (for example 4, 4, 4 becomes 9, 9, 9). If A's sides are different, adding 5 breaks the ratios, so it is not a copy.", check: "ok" },
        ],
        watch: ["If students believe adding works, ask them to measure. Use the 4-unit length as the unit."],
      },
    ],
    summary: ["To draw a scaled copy, multiply all lengths by the scale factor. Adding or subtracting the same number to every length does not make a scaled copy."],
    supports: {
      simplified: ["Give scale factor 2 only.", "Pre-label every side with its length so students only multiply.", "Use a strip of paper marked in units to measure and mark each new length."],
      modified: ["Provide a template with the starting points already drawn. Students only add endpoints.", "Use a table: side | × 2 | new side.", "Let a partner or aide hold the ruler while the student directs."],
      extension: ["Do the 3.4c extension.", "Ask: what happens if Jada scales by ⅓ and then by 3? (Back to the original.)"],
    },
    exit: { id: "3.x", q: "Our check: A 4 by 6 rectangle is scaled by 3. What are the new sides? If you instead add 2 to each side, is it a scaled copy?", a: "Scaled by 3: 12 by 18. Adding 2 gives 6 by 8. 6÷4 = 1.5 but 8÷6 is about 1.33, so it is not a scaled copy.", check: "ok" },
    mistakes: ["Adding the difference to every side.", "Scaling only one side.", "Changing angles."],
  },

  // ───────────────────────────── Lesson 4 ─────────────────────────────
  {
    n: 4, title: "Scaled Relationships", section: "A: Scaled Copies",
    targets: ["I can tell that corresponding angles in a scaled copy are equal.", "I can see that distances between ANY two points are scaled by the same factor, even if no segment joins them."],
    bigIdea: "In a scaled copy, all corresponding angles are equal AND all corresponding distances use the same scale factor, even distances that are not sides.",
    primer: [
      "Two checks decide if a figure is a scaled copy: (1) matching angles are equal, (2) matching distances all use one scale factor. Looking alike is not enough.",
      "The new idea: distances inside the figure count too. In a shape like a quadrilateral, the line from one corner to the opposite corner (a diagonal) is scaled by the same factor as the sides.",
      "A protractor measures angles. Place the centre on the corner, line one side up with 0, then read the number where the other side crosses. Students often read the wrong row of numbers: say 'start at the zero that your side is on'.",
      "Warning from the curriculum: a figure can have all matching angles equal and still not be a copy. A rhombus and a square can both have 4 sides of the same length, but different angles. Both checks are needed.",
    ],
    vocab: [
      { term: "protractor", kid: "A tool that measures angles.", example: "A half circle with numbers 0 to 180." },
      { term: "diagonal", kid: "A line from one corner to the opposite corner.", example: "AC in rectangle ABCD." },
      { term: "congruent angles", kid: "Angles with the same measure.", example: "Two 60° angles." },
    ],
    materials: ["Protractors (clear, no holes)", "Rulers", "Geometry toolkits", "Printed quadrilaterals and polygons"],
    activities: [
      {
        id: "4.1", name: "Three Quadrilaterals (Part 1)", minutes: 5,
        what: "Students find corresponding angles in scaled quadrilaterals and measure them with a protractor.",
        steps: ["Ask: 'What do you notice? What do you wonder?'", "Ask students to name two pairs of corresponding angles and predict their sizes.", "Check by measuring one pair to the nearest 5°. If the sides are too short, extend them with a ruler."],
        items: [
          { id: "4.1a", q: "What do you notice about corresponding angles in the scaled quadrilaterals?", a: "They are equal. Every pair of corresponding angles has the same measure.", check: "ok" },
          { id: "4.1b", q: "To what accuracy should students measure?", a: "To the nearest 5°. That is accurate enough.", check: "ok" },
        ],
        watch: ["Reading the wrong scale (counting down from 180 instead of up from 0).", "Measuring outside the angle's two lines."],
      },
      {
        id: "4.2", name: "Three Quadrilaterals (Part 2)", minutes: 10,
        what: "Students compare diagonal distances (like DB and AC) across the three quadrilaterals, then use scale factors on two W-shaped figures.",
        steps: ["Groups of 2. Ask whether you can tell GF or DC without a ruler.", "Students complete a table of corresponding distances (2 to 3 minutes quiet work), then talk.", "Discuss whether the vertical and horizontal distances use the same scale factor."],
        items: [
          { id: "4.2a", q: "For ABCD the table starts with DB = 4 and AC = 6. What do you expect for the matching distances in the other polygons?", a: "Both distances in a copy are multiplied by the same scale factor. If one is 2 times as long, so is the other. Fill in with your own measurements.", check: "figure" },
          { id: "4.2b", q: "The small W has AB = 6; the big W has HI = 15. What is the scale factor?", a: "15 ÷ 6 = 2.5.", check: "ok" },
          { id: "4.2c", q: "If AE = 4 in the small W, how long is the matching distance in the big W?", a: "4 × 2.5 = 10.", check: "ok" },
          { id: "4.2d", q: "If IK = 5 in the big W, how long is the matching distance in the small W?", a: "5 ÷ 2.5 = 2.", check: "ok" },
        ],
        watch: ["Writing the corresponding point in the wrong order (KI instead of IK). Ask which vertices match D and B."],
      },
      {
        id: "4.3", name: "Scaled or Not Scaled?", minutes: 10,
        what: "Students argue whether two polygons are scaled copies, using distances and angles as evidence.",
        steps: ["Keep the same groups. 6 to 7 minutes of quiet work. Present one question at a time if needed.", "Role play with four students as Mai, Noah, Kiran and Lin. Poll the class after each pair."],
        items: [
          { id: "4.3a", q: "ABCD (top 2, bottom 6, two sides 4, angles 60, 60, 120, 120) and EFGH (top 1, bottom 4, two sides 3, same angles). Is EFGH a scaled copy? (Kiran vs Lin)", a: "No, Lin is right. The ratios are 1÷2 = 0.5, 4÷6 = 0.67 and 3÷4 = 0.75. They are not equal. Equal angles are not enough.", check: "ok" },
          { id: "4.3b", q: "Polygons XJYN and ZSCH (Mai and Noah)", a: "Decide with both checks. Fill the table of horizontal and vertical distances, measure at least 3 matching angles, then see if all distances share one factor and the angles match. The answer comes from your measurements.", check: "figure", note: "The measurements are on the printed polygons." },
          { id: "4.3c", q: "Extension: MNOP has all sides 2 and QRST has all sides 3. Must MNOP be a scaled copy of QRST?", a: "No. Both could be rhombuses with different angles (or one a square, one a rhombus). Equal sides alone do not fix the angles.", check: "ok" },
        ],
        watch: ["Students who rely on how the figures look. Make them measure."],
      },
      {
        id: "4.4", name: "Comparing Pictures of Birds", minutes: 10, optional: true,
        what: "Students gather evidence that a tall, thin bird picture is not a scaled copy of the original.",
        steps: ["Groups of 3 or 4. Give 2 minutes of quiet work, then 1 to 2 minutes of group talk.", "Suggest picking an easy point (like a wing tip) and finding its match in the other picture."],
        items: [
          { id: "4.4a", q: "What is enough evidence that a picture is NOT a scaled copy?", a: "One pair of corresponding angles that differ, OR two pairs of corresponding distances with different scale factors.", check: "ok" },
        ],
        watch: ["Students choose points that do not correspond, or draw segments that do not share a point."],
      },
    ],
    summary: ["Distances between any two points in a scaled copy, even points not joined by a segment, use the same scale factor.", "Corresponding angles are equal. If all angles match and all distances share one factor, it is a scaled copy."],
    supports: {
      simplified: ["Highlight each pair of corresponding segments in the same colour.", "Provide a sample protractor reading to copy before they measure.", "Give a table with the labels already filled in."],
      modified: ["Provide a large clear protractor and let students trace the angle on tracing paper, then compare angles by laying paper on top.", "Reduce to two measurements and use paper-strip comparison for lengths.", "Use calculators for dividing."],
      extension: ["4.3c: explain why a rhombus and a square break the rule.", "Find a scale factor between two W shapes if only one distance is known."],
    },
    exit: { id: "4.x", q: "Our check: A scaled copy has scale factor 3. A segment is 5 cm and an angle is 70°. What are the matching segment and angle in the copy?", a: "Segment: 5 × 3 = 15 cm. Angle: still 70°. Angles do not change.", check: "ok" },
    mistakes: ["Thinking angles scale too.", "Measuring with the wrong protractor scale.", "Matching points in the wrong order."],
  },

  // ───────────────────────────── Lesson 5 ─────────────────────────────
  {
    n: 5, title: "The Size of the Scale Factor", section: "A: Scaled Copies",
    targets: ["I can say whether a scale factor makes a copy bigger, smaller or the same size.", "I can undo a scaling by using the reciprocal scale factor."],
    bigIdea: "Scale factor greater than 1: bigger. Less than 1: smaller. Exactly 1: same size. To go backwards, use the reciprocal.",
    primer: [
      "A reciprocal is what you multiply by to get 1. The reciprocal of 2 is ½. The reciprocal of ¾ is 4/3. Flip the fraction.",
      "Why it matters: if you scale a picture by 4 and then by ¼, you are back where you started. So if B is a scaled copy of A, then A is a scaled copy of B, with the reciprocal factor.",
      "The number talk (5.1) is where students practise 'what times this equals that?', which is exactly how you find a scale factor.",
    ],
    vocab: [
      { term: "reciprocal", kid: "A number you multiply by to get 1. Flip the fraction.", example: "Reciprocal of 5 is 1/5." },
      { term: "enlarge / reduce", kid: "Make bigger / make smaller.", example: "Factor 2 enlarges. Factor ½ reduces." },
    ],
    materials: ["Scaled Copies Card Sort blackline master (5.2)", "Geometry toolkits, puzzle squares and blank squares (5.3)", "Sticky notes or mini whiteboards"],
    activities: [
      {
        id: "5.1", name: "Number Talk: Missing Factor", minutes: 10,
        what: "Students solve five 'what times this equals that?' problems mentally.",
        steps: ["Ask what operation a number next to a letter means (multiplication).", "Show one problem at a time with 1 minute of quiet thinking each.", "Highlight that multiplying by a fraction less than 1 gives a smaller number, and that two numbers whose product is 1 are reciprocals."],
        items: [
          { id: "5.1a", q: "16x = 176", a: "x = 11 (176 ÷ 16)", check: "ok" },
          { id: "5.1b", q: "16x = 8", a: "x = ½ (8 ÷ 16)", check: "ok" },
          { id: "5.1c", q: "16x = 1", a: "x = 1/16", check: "ok" },
          { id: "5.1d", q: "(1/5)x = 1", a: "x = 5", check: "ok" },
          { id: "5.1e", q: "(2/5)x = 1", a: "x = 5/2 (or 2½)", check: "ok" },
        ],
        watch: ["Students think a product cannot be less than a factor. Use 'What times 10 is 5?'"],
      },
      {
        id: "5.2", name: "Card Sort: Scaled Copies", minutes: 15,
        what: "Groups sort cards showing an original and a copy by scale factor.",
        steps: ["Groups of 3 or 4 with one set of slips. Demonstrate with Card 1 and leave the worked calculation on display.", "7 to 8 minutes of sorting; groups explain their reasoning.", "Whole-class: factors greater than 1, equal to 1 and less than 1; and reversibility."],
        items: [
          { id: "5.2a", q: "How should the cards be sorted?", a: "Into groups by scale factor: greater than 1 (bigger copy), exactly 1 (same size), less than 1 (smaller copy). Use the card key from the blackline master for exact factors.", check: "figure" },
          { id: "5.2b", q: "If B is a scaled copy of A with scale factor 3, what is the scale factor from B to A?", a: "1/3. They are reciprocals.", check: "ok" },
          { id: "5.2c", q: "Extension: B = A × ½. C = B × ½. How many times as long are the sides of C compared with A?", a: "¼ as long (½ × ½). For N, scaled n times by ½, the sides are (½)ⁿ times as long as A.", check: "ok" },
        ],
        watch: ["Sorting by type of figure, not by how it was scaled.", "Describing size changes using adding or subtracting."],
      },
      {
        id: "5.3", name: "Scaling a Puzzle", minutes: 15, optional: true,
        what: "Groups of 3 each scale two puzzle pieces by ½, then fit all six scaled pieces back together.",
        steps: ["Give each student two pre-cut puzzle squares and ask: larger or smaller if scaled by ½?", "Hand each student two blank squares whose sides are half as long, and geometry tools.", "Students scale their pieces, then the group assembles 2 rows by 3 columns for both the originals and copies and compares.", "Ask how they checked and what to fix. 'If one piece got lost, how could you recreate it from the scaled copy?'"],
        items: [
          { id: "5.3a", q: "Larger or smaller with scale factor ½?", a: "Smaller. Every length is half as long.", check: "ok" },
          { id: "5.3b", q: "How can you rebuild a lost original from its copy?", a: "Scale the copy by the reciprocal, 2.", check: "ok" },
          { id: "5.3c", q: "How do you copy a piece with several lines crossing?", a: "Measure distances where lines meet the border and halve them, or measure angles. Do not forget distances between points that are not joined by a segment.", check: "figure" },
        ],
        watch: ["Students scale the segments but not the spaces between points.", "Students do not check that angles stay the same."],
      },
      {
        id: "5.4", name: "Missing Figure, Factor, or Copy", minutes: 10, optional: true,
        what: "Students find a missing scale factor, original or copy.",
        steps: ["Pairs with geometry toolkits. 3 to 4 minutes quiet work, 2 minutes of group talk.", "Ask which question was hardest, and why measuring angles matters for the last one."],
        items: [
          { id: "5.4a", q: "Original triangle sides 5 and 5 become a copy with sides 1 and 1. Scale factor?", a: "1/5 (1 ÷ 5).", check: "ok" },
          { id: "5.4b", q: "A copy has height 6 and the scale factor from the original is 3/2. Original height?", a: "6 ÷ 3/2 = 6 × 2/3 = 4.", check: "ok" },
          { id: "5.4c", q: "To undo a scaling of 3/2, what scale factor do you use?", a: "2/3.", check: "ok" },
          { id: "5.4d", q: "Draw the trapezoid copy with scale factor 2, the original for 3/2, and the 4 with factor 3.", a: "Multiply (or divide) every length using the numbers on your sheet. Keep every angle.", check: "figure" },
        ],
        watch: [],
      },
    ],
    summary: ["Greater than 1 makes a larger copy. Less than 1 makes a smaller copy. Exactly 1 makes the same size.", "To undo: scale by the reciprocal. A to B with factor 4, then B to A with factor 1/4."],
    supports: {
      simplified: ["Number line posted: 0, ½, 1, 2: 'smaller' on the left of 1, 'bigger' on the right.", "Work with factors 2, ½, 3 and ⅓ only.", "Give a sort mat with three labelled columns."],
      modified: ["Use physical cards and a three-column mat, and let students point instead of writing.", "Use fraction strips to show ½ and 2 are partners.", "Calculator for division."],
      extension: ["5.2c: general N.", "Ask: if a scale factor is 0.8, what factor undoes it? (1.25)"],
    },
    exit: { id: "5.x", q: "Our check: A rectangle 8 by 12 is scaled by 3/4. New size? Bigger or smaller? What scale factor undoes it?", a: "6 by 9 (8 × 3/4 = 6, 12 × 3/4 = 9). Smaller (factor less than 1). To undo, 4/3.", check: "ok" },
    mistakes: ["Thinking a scale factor of ½ makes things bigger.", "Subtracting to 'shrink'.", "Using the same factor to go backwards instead of the reciprocal."],
  },

  // ───────────────────────────── Lesson 6 ─────────────────────────────
  {
    n: 6, title: "Scaling and Area", section: "A: Scaled Copies",
    targets: ["I can say how area changes when a shape is scaled.", "I know area is multiplied by the scale factor squared."],
    bigIdea: "If lengths are multiplied by a scale factor s, the area is multiplied by s × s. A scale factor of 3 makes the area 9 times as big.",
    primer: [
      "Area is how much flat space a shape covers, measured in squares. If you make a square twice as long and twice as wide, you don't get 2 squares: you get a 2 by 2 block, which is 4 squares.",
      "Rule: area factor = scale factor × scale factor. Factor 2 → 4. Factor 3 → 9. Factor 10 → 100. Factor ½ → ¼.",
      "Pattern blocks make this concrete. Build a big triangle from small triangles: 2 on a side takes 4 triangles, 3 on a side takes 9.",
      "This is the most common mistake in the whole unit: doubling the lengths and doubling the area.",
    ],
    vocab: [
      { term: "area", kid: "How much flat space inside a shape.", example: "A 3 by 4 rectangle has area 12 square units." },
      { term: "square units", kid: "Unit squares used to measure area.", example: "cm², in²." },
      { term: "squared", kid: "A number times itself.", example: "5 squared is 25." },
    ],
    materials: ["Pattern blocks: up to 16 each of green triangle, blue rhombus and red trapezoid per group (6.1)", "Geometry toolkits (6.3)", "Parallelogram and triangle slips (6.3)"],
    activities: [
      {
        id: "6.1", name: "Scaling a Pattern Block", minutes: 10,
        what: "Groups build bigger copies of a single pattern block and count how many blocks it takes.",
        steps: ["Groups of 3 or 4 with the blocks. Make sure 'twice as long' means 2 times as long.", "6 to 7 minutes to build. Use one block as a ruler to check every side is scaled.", "Make a table of scale factor and number of blocks. Ask them to predict for 5 and 6."],
        items: [
          { id: "6.1a", q: "Blue rhombus: blocks for a copy with each side 2, 3, 4 times as long.", a: "4, 9, 16 blocks.", check: "ok" },
          { id: "6.1b", q: "Green triangle: scale factors 2, 3, 4.", a: "4, 9, 16 blocks.", check: "ok" },
          { id: "6.1c", q: "Red trapezoid: scale factors 2, 3, 4.", a: "4, 9, 16 blocks. (Built from trapezoids, a 2 times copy takes 4. Students must also scale the short side and the angled sides.)", check: "ok" },
          { id: "6.1d", q: "Predict scale factors 5 and 6.", a: "25 and 36 blocks. The count is the scale factor times itself.", check: "ok" },
        ],
        watch: ["Students use 2 blocks for the first question. Show which side was not doubled with a block as a ruler.", "Tripling the trapezoid's height but not its length."],
      },
      {
        id: "6.2", name: "Scaling More Pattern Blocks", minutes: 10, optional: true,
        what: "Groups scale shapes made of several blocks (3 rhombuses, 2 trapezoids or 4 triangles).",
        steps: ["Each group gets one shape. Build a copy with scale factor 2, then start a copy with scale factor 3 and stop once you know the count.", "Ask: 'Does every scaled copy take 4 blocks?' (No: it depends on how many blocks the original has.)", "Compare with the single-block pattern."],
        items: [
          { id: "6.2a", q: "Scale factor 2: 3 rhombuses, 2 trapezoids, 4 triangles.", a: "12 rhombuses, 8 trapezoids, 16 triangles (4 × the original count).", check: "ok" },
          { id: "6.2b", q: "Scale factor 3.", a: "27, 18 and 36 blocks (9 × the original count).", check: "ok" },
          { id: "6.2c", q: "Scale factors 4, 5, 6.", a: "Rhombuses: 48, 75, 108. Trapezoids: 32, 50, 72. Triangles: 64, 100, 144. (the original count × scale factor².)", check: "ok" },
          { id: "6.2d", q: "A classmate says every copy with factor 2 takes 4 blocks. Agree?", a: "No. 4 is only right if the original is one block. The count is 4 times the number of blocks in the original.", check: "ok" },
          { id: "6.2e", q: "Extension: yellow hexagon, copies with each side 2 and 3 times as long.", a: "The area is 4 and 9 times as big. Built from green triangles that is 24 and 54 triangles (the hexagon is 6 triangles).", check: "ok" },
        ],
        watch: ["Forgetting to check every side."],
      },
      {
        id: "6.3", name: "Area of Scaled Parallelograms and Triangles", minutes: 15, optional: true,
        what: "Partners scale a parallelogram (base 5 cm, height 2 cm) or triangle (base 4 cm, height 5 cm), and find the new areas.",
        steps: ["Half the groups get the parallelogram, half the triangle. Confirm the original area is 10 square cm.", "Complete a table for scale factors 1, 2, 3, ½, ⅓ by drawing.", "Compare tables with a group that had the other shape.", "Find areas for scale factors 5 and 3/5 without drawing."],
        items: [
          { id: "6.3a", q: "Original areas: parallelogram base 5, height 2. Triangle base 4, height 5.", a: "Parallelogram: 5 × 2 = 10. Triangle: ½ × 4 × 5 = 10.", check: "ok" },
          { id: "6.3b", q: "Scaled areas for factors 1, 2, 3, ½, ⅓.", a: "10, 40, 90, 2.5, and 10/9 (about 1.11). Same for both shapes.", check: "ok" },
          { id: "6.3c", q: "Parallelogram: base and height for factors 2, 3, ½, ⅓.", a: "Base × height: 10 × 4, 15 × 6, 2.5 × 1, 5/3 × 2/3.", check: "ok" },
          { id: "6.3d", q: "Triangle: base and height for factors 2, 3, ½, ⅓.", a: "8 × 10, 12 × 15, 2 × 2.5, 4/3 × 5/3.", check: "ok" },
          { id: "6.3e", q: "Areas for factors 5 and 3/5.", a: "10 × 25 = 250 and 10 × 9/25 = 3.6.", check: "ok" },
        ],
        watch: ["Forgetting the formulas. Confirm the original area first.", "Measuring other sides. Only the base and height need scaling."],
      },
    ],
    summary: ["If all dimensions are 2 times as long, the area is NOT 2 times as large. It is 4 times as large.", "A scale factor of 5 makes the area 25 times as large."],
    supports: {
      simplified: ["Always use real blocks or cut-out unit squares to show 4 and 9.", "Provide a two-column table: factor | factor × factor.", "Work only with factors 2 and 3."],
      modified: ["Draw squares on graph paper and have students colour the unit squares.", "Use a multiplication chart for 5 × 5 and 6 × 6.", "Students point to the block count rather than writing."],
      extension: ["Do the hexagon extension.", "Ask: what scale factor makes the area 100 times as large? (10) Or 1/4 as large? (½)"],
    },
    exit: { id: "6.x", q: "Our check: A square has side 3. It is scaled by a factor of 4. New side? New area? How many times as large is the area?", a: "Side 12. Area 144 (12 × 12). Original area 9, and 144 ÷ 9 = 16, which is 4 × 4.", check: "ok" },
    mistakes: ["Doubling the area when the lengths are doubled.", "Forgetting to scale every side.", "Mixing up length units and square units."],
  },

  // ───────────────────────────── Lesson 7 ─────────────────────────────
  {
    n: 7, title: "Scale Drawings", section: "B: Scale Drawings",
    targets: ["I can say what a scale drawing is.", "I can use a scale like '1 cm represents 2 m' to find actual lengths."],
    bigIdea: "A scale drawing is a scaled copy of something real. The scale tells you how a length on paper matches a length in real life.",
    primer: [
      "A map is a scale drawing. So is a floor plan. The scale is written on it, like '1 cm represents 2 m'. It means every 1 cm on the paper is 2 m in real life.",
      "To find a real length: measure on the drawing, then multiply. 5 cm on this drawing is 5 × 2 = 10 m. To go the other way, divide: a 9 m bench is 9 ÷ 2 = 4.5 cm on paper.",
      "Careful: 14 cm on the drawing is NOT 0.14 m. That changes the unit but ignores the scale. Students make this mistake often.",
      "A scale can also be a drawn bar (like 0 to 100 m). Measure the bar, then use it as your ruler.",
    ],
    vocab: [
      { term: "scale drawing", kid: "A drawing that matches a real thing, with a scale.", example: "A map or floor plan." },
      { term: "scale", kid: "Tells how drawing lengths match real lengths.", example: "1 cm represents 2 m." },
      { term: "actual distance", kid: "The real-life length.", example: "The real basketball court length." },
    ],
    materials: ["Sizing Up a Basketball Court blackline master (7.2)", "Rulers (7.2)", "Geometry toolkits", "Index cards or paper for measuring (7.3)"],
    activities: [
      {
        id: "7.1", name: "What Is a Scale Drawing?", minutes: 5,
        what: "Students look at examples (school bus, quarter, subway map) and non-examples, and talk about what makes a scale drawing.",
        steps: ["Ask who has seen scale drawings and where.", "2 minutes in pairs to compare examples and non-examples.", "Ask: what do the scale drawings have that the others do not?"],
        items: [
          { id: "7.1a", q: "What is a scale drawing?", a: "A drawing of a real thing where every length is scaled by the same factor, with a scale that tells you how drawing lengths match real lengths.", check: "ok" },
        ],
        watch: ["Notice the two quarter drawings: one is not circular."],
      },
      {
        id: "7.2", name: "Sizing Up a Basketball Court", minutes: 15,
        what: "Students measure a basketball court drawing (scale: 1 cm represents 2 m) and find actual lengths.",
        steps: ["Ask who has seen a court and whether they could throw a ball across it.", "6 to 7 minutes of quiet work on questions 1 to 3, then share with a partner.", "Display the scaled distances for quick checking.", "Discuss whether 'every 1 cm is 2 m' means the actual distance is twice the drawing distance. What parts of the court does it apply to?"],
        items: [
          { id: "7.2a", q: "What does '1 cm represents 2 m' mean?", a: "Every centimeter on the drawing stands for 2 meters in real life.", check: "ok" },
          { id: "7.2b", q: "Find the actual length of each measurement a to d.", a: "Measure each in cm (to 0.1 cm) and multiply by 2 to get meters.", check: "figure", note: "The numbers come from your printed court. Check against the measurements shown on the display." },
          { id: "7.2c", q: "The bench area is 9 m long. How long is it on the drawing?", a: "9 ÷ 2 = 4.5 cm.", check: "ok" },
          { id: "7.2d", q: "Distance d (3-point line to sideline) is 0.9 m in real life. How long is it on the drawing?", a: "0.9 ÷ 2 = 0.45 cm.", check: "ok", note: "The teacher guide gives 0.9 m as the official real measurement for d." },
        ],
        watch: ["Converting 14 cm to 0.14 m instead of using the scale.", "Measuring on a slant or from the wrong end of the ruler."],
      },
      {
        id: "7.3", name: "Tall Structures", minutes: 15,
        what: "Students use a drawn scale bar (0 m to 100 m) to estimate the heights of tall buildings and structures.",
        steps: ["Display the drawing. Ask what the '0 m' and '100 m' segment means.", "4 to 5 minutes of work. Partners check the first answer.", "Compare methods: counting how many scale segments tall, or measuring in cm and converting."],
        items: [
          { id: "7.3a", q: "How do you find the height of a building from the drawing?", a: "Measure the building straight up from the ground line. Measure the scale bar. Divide the building's height by the bar length, then multiply by 100 m.", check: "figure", note: "The numbers depend on your drawing. For reference only, the Burj Khalifa is 828 m tall, which makes it the tallest structure shown." },
          { id: "7.3b", q: "How much taller is the Burj Khalifa than the Eiffel Tower?", a: "Find the two heights from the drawing and subtract. Or subtract the drawn heights first, then convert. Both methods give the same answer.", check: "figure" },
          { id: "7.3c", q: "Extension: Denali is about 6,190 m. How tall on the drawing?", a: "6,190 ÷ 100 = 61.9 scale bars. Measure the bar in cm and multiply by 61.9. That is likely much taller than the page, which is the point of the question.", check: "ok" },
        ],
        watch: ["Measuring heights at an angle. Use the edge of a card to keep it level."],
      },
    ],
    summary: ["A scale drawing is a scaled representation. The scale relates drawing lengths to actual lengths. Example: 5 cm on the court drawing means 5 × 2 = 10 m.", "Scale drawings show only 2 dimensions: the court drawing does not show how high the hoop is."],
    supports: {
      simplified: ["Write 'real = drawing × 2' on the board.", "Use a table: drawing (cm) | actual (m).", "Give the actual numbers for two examples so students copy the pattern."],
      modified: ["Provide a ruler with the scale already printed (1 cm = 2 m).", "Use an index card marked in 1 cm steps labelled 2 m, 4 m, 6 m...", "Students tell you the measurement and you write it down."],
      extension: ["Find where on a real map their school sits. Ask what scale it uses.", "Make a scale drawing of the classroom."],
    },
    exit: { id: "7.x", q: "Our check: A map uses 1 cm to 5 m. A path is 6 cm on the map. How long is it for real? A real wall is 45 m. How long on the map?", a: "6 × 5 = 30 m. 45 ÷ 5 = 9 cm.", check: "ok" },
    mistakes: ["Converting units but ignoring the scale (14 cm to 0.14 m).", "Measuring from the 1 cm mark instead of 0.", "Multiplying when you should divide."],
  },
];
