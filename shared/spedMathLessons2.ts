// Lessons 8 to 13 of Grade 7, Unit 1 (Scale Drawings). See shared/spedMathUnit.ts for how answers are marked.
import type { Lesson } from "./spedMathUnit";

export const LESSONS_8_13: readonly Lesson[] = [
  // ───────────────────────────── Lesson 8 ─────────────────────────────
  {
    n: 8, title: "Scale Drawings and Maps", section: "B: Scale Drawings",
    targets: ["I can use a map and its scale to find a real distance.", "I can combine that with speed to find how long a trip takes."],
    bigIdea: "Measure the map, use the scale to get the real distance, then use speed = distance ÷ time (or time = distance ÷ speed).",
    primer: [
      "Speed tells how far you go in a certain amount of time, like 65 miles in 1 hour. Distance = speed × time. Speed = distance ÷ time. Time = distance ÷ speed.",
      "A trip problem on a map has two steps. First turn the drawing length into a real distance with the scale. Then use speed.",
      "Always check units. Minutes and hours are different. 8 minutes is 8/60 of an hour.",
      "Maps show curved roads as curves. Students measure straight lines or approximate curves, so answers will differ a little. That is expected. The curriculum says to report a sensible rounded answer, like 50 miles, not 51.6 miles.",
    ],
    vocab: [
      { term: "speed", kid: "How fast something goes: distance per time.", example: "65 miles per hour." },
      { term: "constant speed", kid: "A speed that does not change.", example: "A car on cruise control." },
      { term: "to scale", kid: "Drawn using the scale.", example: "A map that follows its scale." },
    ],
    materials: ["Geometry toolkits (Distance tool) (8.2)", "Printed or digital maps", "Calculators (helpful)"],
    activities: [
      {
        id: "8.1", name: "A Train and a Car", minutes: 5,
        what: "Warm-up: which is faster, a train or a car?",
        steps: ["Give 3 minutes of quiet think time. Students calculate mentally.", "Ask for different strategies: find the train's speed, or find how far the car goes in 4 hours."],
        items: [
          { id: "8.1a", q: "Two cities are 243 miles apart. A train takes 4 hours at constant speed. A car goes 65 mph. Which is faster?", a: "The car. The train goes 243 ÷ 4 = 60.75 mph, which is less than 65. In 4 hours the car goes 65 × 4 = 260 miles, more than 243.", check: "ok" },
        ],
        watch: ["Students may divide the wrong way. Ask 'miles per hour' out loud: miles ÷ hours."],
      },
      {
        id: "8.2", name: "Driving on I-90", minutes: 15, optional: true,
        what: "Students use a scale drawing (1 grid unit is 0.5 miles) to see if a driver was speeding, and compare to a helicopter.",
        steps: ["Link back to the warm-up: they found speed from distance and time.", "5 minutes alone or in pairs.", "Discuss methods: compare speeds, compare times for the same distance, or compare distances in the same time.", "If students are stuck, ask 'How long would it take to travel 110 miles?'"],
        items: [
          { id: "8.2a", q: "Driver goes from Point A to B in 8 minutes. Real distance is about 8.5 miles. Speed limit 55 mph. Did she obey it?", a: "No. 8 minutes is 8/60 = 2/15 hour. Speed = 8.5 ÷ (2/15) = 63.75 mph, over 55. Check another way: at 55 mph she would go only 55 × 8/60 = 7⅓ miles in 8 minutes, less than 8.5.", check: "ok", note: "Uses the 8.5 miles given in the teacher guide. Your students' measurement will be close but not the same." },
          { id: "8.2b", q: "A helicopter flies straight from A to B in 8 minutes. Faster or slower than the driver?", a: "If the straight line is shorter than the road distance, the helicopter went less far in the same time, so it was slower. Measure the straight line with the Distance tool and compare to 8.5 miles.", check: "figure" },
        ],
        watch: ["Dividing 55 by 8.5. They need to compare two speeds, not mix a speed with a distance."],
      },
      {
        id: "8.3", name: "Biking through Kansas", minutes: 10, optional: true,
        what: "Students estimate how long a bike trip takes using a map scale and a speed of 15 mph.",
        steps: ["Ask who has biked far. Give 4 to 5 minutes of quiet work, then partner share.", "Tell students the road bends: their best estimate is fine.", "Ask why answers differ: measurement error, curved road, estimating the last partial segment."],
        items: [
          { id: "8.3a", q: "The scale bar is 4 miles. The two cities are about 12½ bars apart. How many miles?", a: "12.5 × 4 = 50 miles. The curriculum says 'about 50 miles' is a reasonable report. 51.6 miles pretends to be more exact than the map allows.", check: "ok" },
          { id: "8.3b", q: "At 15 mph, about how long does it take?", a: "50 ÷ 15 = 3⅓ hours = 3 hours 20 minutes. Any answer close to that (about 3 to 3½ hours) is reasonable.", check: "ok" },
          { id: "8.3c", q: "Extension: A map says 'This map is not to scale.' What does it mean?", a: "The distances on the map are not in proportion to real distances, so you cannot use it to measure.", check: "ok" },
        ],
        watch: ["Students insisting on an exact answer. Reasonable estimates are the goal."],
      },
    ],
    summary: ["Measure the map distance, use the scale to find the actual distance.", "Speed = distance ÷ time; time = distance ÷ speed. Watch the units: a 130-mile trip in 2 hours is 65 mph; a 35-mile trip at 70 mph takes ½ hour."],
    supports: {
      simplified: ["Give a 'distance, rate, time' triangle: distance on top, speed and time on the bottom.", "Use whole-number bars. Count bars instead of measuring.", "Use a calculator for dividing."],
      modified: ["Provide a double number line: miles on top, hours below.", "Use pre-marked map strips, each mark = 4 miles.", "Ask the student to point to the number instead of writing it."],
      extension: ["Plan a bike trip of 4 hours at 12 mph. How far can you go?", "Compare two routes with different speeds."],
    },
    exit: { id: "8.x", q: "Our check: A map uses 1 cm to 2 km. Two towns are 7.5 cm apart. Someone rides 10 km per hour. How long does it take?", a: "7.5 × 2 = 15 km. 15 ÷ 10 = 1.5 hours (1 hour 30 minutes).", check: "ok" },
    mistakes: ["Mixing units (minutes vs hours).", "Dividing speed by distance.", "Forgetting to use the scale before using speed."],
  },

  // ───────────────────────────── Lesson 9 ─────────────────────────────
  {
    n: 9, title: "Creating Scale Drawings", section: "B: Scale Drawings",
    targets: ["I can make a scale drawing with a given scale.", "I can find a scale when I know a drawn length and the actual length."],
    bigIdea: "To draw something to scale, divide each actual length by what 1 drawing unit stands for. A bigger number in the scale makes a smaller drawing.",
    primer: [
      "This lesson goes the other way from Lesson 7: you start with real measurements and build the drawing.",
      "The scale '1 cm to 50 miles' says 1 cm of paper stands for 50 miles. A 270-mile width is 270 ÷ 50 = 5.4 cm of paper.",
      "A bigger number per cm means a SMALLER drawing: 1 cm per 75 miles shrinks more than 1 cm per 50 miles. Students often get this backwards.",
      "Write the scale the same way every time, drawing first: '4 cm to 1 m', never '1 cm to 4 m' by mistake. Always say what each number belongs to.",
    ],
    vocab: [
      { term: "floor plan", kid: "A top-view scale drawing of a room or building.", example: "Noah's bedroom plan." },
      { term: "equivalent scales", kid: "Scales that describe the same drawing size.", example: "4 cm to 1 m and 1 cm to 0.25 m." },
    ],
    materials: ["Geometry toolkits", "Centimeter grid paper", "Outline of Utah (9.3)"],
    activities: [
      {
        id: "9.1", name: "Number Talk: Which Is Greater?", minutes: 5,
        what: "Students compare three pairs of division expressions without calculating.",
        steps: ["Show one pair at a time. 1 minute of quiet think time each.", "Sticky notes or mini whiteboards help memory."],
        items: [
          { id: "9.1a", q: "11 ÷ 23 or 7 ÷ 13: which is greater?", a: "7 ÷ 13. 11/23 is just under ½ (11.5 would be half of 23) but 7/13 is just over ½ (6.5 is half of 13).", check: "ok" },
          { id: "9.1b", q: "0.63 ÷ 2 or 0.55 ÷ 3: which is greater?", a: "0.63 ÷ 2. It has a bigger number being divided and a smaller divisor. (0.315 vs about 0.183)", check: "ok" },
          { id: "9.1c", q: "15 ÷ 1/3 or 15 ÷ 1/4: which is greater?", a: "15 ÷ 1/4. Dividing by 1/4 is multiplying by 4, which gives 60. Dividing by 1/3 gives 45.", check: "ok" },
        ],
        watch: ["Students reading 15 ÷ 1/3 as 15 × 1/3. Ask: how many thirds are in 15?"],
      },
      {
        id: "9.2", name: "Bedroom Floor Plan", minutes: 10,
        what: "Students find the scale from one wall, then use it to draw other walls.",
        steps: ["Explain that a floor plan is a top view. Explain you can find a scale if you know a drawn length and its real length.", "Pairs work 4 to 5 minutes.", "Compare scales with a partner."],
        items: [
          { id: "9.2a", q: "Wall C is 4 m and is drawn as 16 cm. What is the scale?", a: "16 cm to 4 m, which is 4 cm to 1 m (or 1 cm to 0.25 m).", check: "ok" },
          { id: "9.2b", q: "Say it another way.", a: "1 cm to 0.25 m, 1 cm to 25 cm, or 4 cm to 1 m. All describe the same drawing.", check: "ok" },
          { id: "9.2c", q: "Wall A is 2.5 m. How long is it on the plan?", a: "2.5 × 4 = 10 cm.", check: "ok" },
          { id: "9.2d", q: "Wall D is 3.75 m. How long on the plan?", a: "3.75 × 4 = 15 cm.", check: "ok" },
          { id: "9.2e", q: "Wall B (digital version) is 2.75 m.", a: "2.75 × 4 = 11 cm.", check: "ok" },
        ],
        watch: ["Writing the scale backwards ('1 cm to 4 m'). Ask what each number means."],
      },
      {
        id: "9.3", name: "Two Maps of Utah", minutes: 15,
        what: "Students draw Utah's outline at two scales and compare. The outline is a rectangle with a corner missing.",
        steps: ["Show the outline. Ask 'What do you notice? What do you wonder?'", "5 to 6 minutes quiet work for both drawings.", "Compare: which is bigger, and by how much?"],
        items: [
          { id: "9.3a", q: "Rectangle is about 270 mi wide by 350 mi tall. Missing corner is about 110 mi wide by 70 mi tall. Draw it at 1 cm to 50 mi.", a: "Rectangle 5.4 cm wide by 7 cm tall (270÷50, 350÷50). Missing corner 2.2 cm wide by 1.4 cm tall.", check: "ok", note: "Careful: one sample on the publisher's page has the corner's width and height swapped. Width is 110 ÷ 50 = 2.2, height is 70 ÷ 50 = 1.4." },
          { id: "9.3b", q: "Draw it at 1 cm to 75 mi.", a: "Rectangle 3.6 cm wide by about 4.67 cm tall (270÷75, 350÷75). Missing corner about 1.47 cm wide by about 0.93 cm tall.", check: "ok" },
          { id: "9.3c", q: "Which drawing is bigger? How do they compare?", a: "The 1 cm to 50 mi drawing is bigger. Each of its lengths is 1.5 times as long as the matching length at 1 cm to 75 mi (75 ÷ 50 = 1.5). The 75 mi drawing is a scaled copy of the other with scale factor 2/3.", check: "ok" },
        ],
        watch: ["Shapes that do not close, from imprecise measuring.", "Thinking 1 cm to 50 miles gives the smaller drawing. Ask: how many cm for 75 miles in each?"],
      },
    ],
    summary: ["The size of the scale determines the size of the drawing.", "1 cm to 2 m gives a larger drawing than 1 cm to 4 m. 5 cm to 10 m is the same size as 1 cm to 2 m. Scales are often written as what 1 unit on the drawing represents."],
    supports: {
      simplified: ["Give a 3-column table: real | ÷ number | drawing.", "Pre-draw a grid where each square is 1 cm.", "Use scales that divide evenly (1 cm to 50 mi: 270 and 350 give 5.4 and 7)."],
      modified: ["Provide strips of paper marked in 1 cm steps labelled 50, 100, 150... miles so students match by measuring.", "Offer calculators.", "Let partners trade jobs: one measures, one marks."],
      extension: ["Draw Utah on the whiteboard at a scale of 1 cm to 10 mi.", "Find a scale so the whole state fits on a sheet of paper."],
    },
    exit: { id: "9.x", q: "Our check: A room is 6 m by 4.5 m. Draw it at 1 cm to 1.5 m. What are the drawing lengths?", a: "6 ÷ 1.5 = 4 cm and 4.5 ÷ 1.5 = 3 cm. A 4 cm by 3 cm rectangle.", check: "ok" },
    mistakes: ["Writing scales backwards.", "Thinking a bigger number means a bigger drawing.", "Multiplying when they should divide."],
  },

  // ───────────────────────────── Lesson 10 ─────────────────────────────
  {
    n: 10, title: "Changing Scales in Scale Drawings", section: "B: Scale Drawings",
    targets: ["I can make a new scale drawing at a different scale.", "I can say how the area on a drawing changes when the scale changes."],
    bigIdea: "Changing the scale changes lengths by a factor and areas by that factor squared. Find real lengths first, or scale the old drawing directly.",
    primer: [
      "There are two ways to redraw something at a new scale. (1) Use the old drawing and old scale to find the real lengths, then use the new scale. (2) Skip to the answer: multiply the old drawing's lengths by a factor made from the two scales.",
      "Example: old scale 1 cm to 30 m, new scale 1 cm to 20 m. A 6 cm side is 180 m for real, which is 9 cm at the new scale. Shortcut: 30 ÷ 20 = 1.5, and 6 × 1.5 = 9.",
      "Area works with squares. 1 cm² on a 1 cm to 30 m drawing stands for 30 × 30 = 900 m². At 1 cm to 20 m it stands for 400 m².",
      "Student measurements (their own foot, a ruler, a printed map) give personal answers. Check method and reasonableness, not exact numbers.",
    ],
    vocab: [
      { term: "scale", kid: "How drawing lengths match real lengths.", example: "1 cm to 30 m." },
      { term: "area", kid: "How much flat space a shape covers.", example: "A 6 by 4 rectangle has area 24 cm²." },
    ],
    materials: ["Same Plot, Different Drawings slips (blackline master) (10.2)", "Centimeter graph paper", "Geometry toolkits (10.3)"],
    activities: [
      {
        id: "10.1", name: "Appropriate Measurements", minutes: 5,
        what: "Students estimate their own foot length and decide which measurements of a foot picture are reasonable.",
        steps: ["Pairs. 1 minute quiet think time to estimate the length of their foot in cm or inches.", "Explain that the pictures of feet are drawn at different scales."],
        items: [
          { id: "10.1a", q: "Which reported length is sensible for the large foot?", a: "A length to the nearest centimeter (not 23.48 cm). A ruler is not precise enough to claim hundredths of a centimeter.", check: "figure", note: "The answer depends on the foot picture you have. The idea: report to the precision of your tool." },
        ],
        watch: ["Students reading the foot as 9 cm or 3½ in because they forgot the picture has its own scale."],
      },
      {
        id: "10.2", name: "Same Plot, Different Drawings", minutes: 15,
        what: "Groups of 5 or 6 each draw the same triangular plot at a different scale and compare lengths and areas.",
        steps: ["Display the map. Tell students the real triangle has a base of 120 m and a height of 90 m. Ask for the real area: ½ × 120 × 90.", "Give each student a different scale from the blackline master. 3 to 4 minutes alone for questions 1 to 3.", "1 to 2 minutes in the group for question 4: what patterns do you notice?"],
        items: [
          { id: "10.2a", q: "Real area of the triangle (base 120 m, height 90 m).", a: "½ × 120 × 90 = 5,400 m².", check: "ok" },
          { id: "10.2b", q: "Drawing at 1 cm to 5 m.", a: "24 cm base, 18 cm height, drawn area ½ × 24 × 18 = 216 cm². Check: 216 × 25 (since 1 cm² is 5 × 5 = 25 m²) = 5,400 m².", check: "ok" },
          { id: "10.2c", q: "Drawing at 1 cm to 15 m.", a: "8 cm base, 6 cm height, area ½ × 8 × 6 = 24 cm². Check: 24 × 225 = 5,400 m².", check: "ok" },
          { id: "10.2d", q: "Drawing at 1 cm to 50 m.", a: "2.4 cm base, 1.8 cm height, area ½ × 2.4 × 1.8 = 2.16 cm². Check: 2.16 × 2,500 = 5,400 m².", check: "ok" },
          { id: "10.2e", q: "Compare 1 cm to 5 m with 1 cm to 15 m.", a: "The 5 m drawing has lengths 3 times as long and area 9 times as large (216 ÷ 24 = 9).", check: "ok" },
          { id: "10.2f", q: "Compare 1 cm to 5 m with 1 cm to 50 m.", a: "Lengths 10 times as long, area 100 times as large (216 ÷ 2.16 = 100).", check: "ok" },
          { id: "10.2g", q: "General pattern.", a: "A bigger number of meters per cm gives a smaller drawing. Area changes by the square of the length factor.", check: "ok" },
        ],
        watch: ["Which scales you hand out comes from the blackline master. The numbers above are three examples that all give the same real area."],
      },
      {
        id: "10.3", name: "A New Drawing of the Playground", minutes: 15,
        what: "Students redraw a playground (given at 1 cm to 30 m) at 1 cm to 20 m.",
        steps: ["Ask: will the new drawing be larger or smaller?", "Groups of 3. 5 minutes of quiet work, then 3 minutes of discussion.", "Prompt students who do not know how to start: find the actual length of each side first."],
        items: [
          { id: "10.3a", q: "Will the new drawing be larger or smaller?", a: "Larger. 20 m per cm is less than 30 m per cm, so each real length takes more cm.", check: "ok" },
          { id: "10.3b", q: "By what factor are lengths and areas multiplied?", a: "Lengths: 30 ÷ 20 = 1.5 times as long. Area: 1.5 × 1.5 = 2.25 times as large.", check: "ok" },
          { id: "10.3c", q: "What real area does 1 cm² show on each map?", a: "On the 1 cm to 30 m map: 30 × 30 = 900 m². On the 1 cm to 20 m map: 20 × 20 = 400 m².", check: "ok" },
          { id: "10.3d", q: "Example: a side of 4 cm on the first drawing.", a: "Real length 4 × 30 = 120 m. New drawing 120 ÷ 20 = 6 cm. Same as 4 × 1.5.", check: "ok" },
          { id: "10.3e", q: "Draw the playground at the new scale.", a: "Use the sides from your printed drawing. Multiply each by 1.5 (or convert to meters first, then divide by 20). Keep every angle.", check: "figure" },
        ],
        watch: ["Not knowing how to start. Find the actual length of each side."],
      },
    ],
    summary: ["Two ways to redraw: use the old drawing to find real lengths and convert to the new scale, or scale the old lengths by a factor relating the two scales.", "Example: a map at 1 cm to 200 m redrawn at 1 cm to 20 m has lengths 10 times as long and area 100 times as large. One cm² stands for 400 m² on the new map and 40,000 m² on the old one."],
    supports: {
      simplified: ["Use a table with columns: scale | base | height | area.", "Allow calculators and give the area formula on a card.", "Do just two scales instead of every group member getting one."],
      modified: ["Provide pre-cut paper strips: a 1 cm strip labelled with the number of meters.", "Use graph paper with 1 cm squares so students count rather than measure.", "Pair with a partner who reads the number while the student records."],
      extension: ["What scale would make the playground exactly twice as long on the page?", "Find the real area of the playground from the drawing."],
    },
    exit: { id: "10.x", q: "Our check: A drawing at 1 cm to 10 m is redrawn at 1 cm to 5 m. A line is 3 cm long. How long is it now? How many times as large is the area?", a: "6 cm (3 × 2, since 10 ÷ 5 = 2). Area is 4 times as large (2 × 2).", check: "ok" },
    mistakes: ["Multiplying the area by the length factor (not squared).", "Reporting too many decimal places.", "Using the old scale on the new drawing."],
  },

  // ───────────────────────────── Lesson 11 ─────────────────────────────
  {
    n: 11, title: "Scales without Units", section: "B: Scale Drawings",
    targets: ["I can read a scale with no units, like 1 to 50.", "I can use it to find actual and scaled lengths."],
    bigIdea: "A scale with no units means the real thing is that many times bigger than the drawing, as long as both are measured in the same unit.",
    primer: [
      "'1 to 100' means the real thing is 100 times as long as the drawing. It does not matter what unit you use. 1 cm on the drawing is 100 cm for real. 1 inch is 100 inches.",
      "To find a real length: multiply the drawing length by the scale number. 12 cm on a 1 to 100 map is 1,200 cm, which is 12 m. To find a drawing length: divide.",
      "A scale like '1 inch to 15 feet' can be rewritten without units. 15 feet = 15 × 12 = 180 inches, so it is 1 to 180.",
      "'To scale' means 'at the same scale' or 'at the specified scale'.",
    ],
    vocab: [
      { term: "scale without units", kid: "A scale like 1 to 50 where both numbers use the same unit.", example: "1 to 50." },
      { term: "to scale", kid: "Drawn at the given scale.", example: "A model to scale." },
    ],
    materials: ["Apollo Lunar Module blackline master (11.2)", "Rulers", "Calculators"],
    activities: [
      {
        id: "11.1", name: "One to One Hundred", minutes: 5,
        what: "Students think about what a scale with no units means.",
        steps: ["Remind students they have used scales with two units. Today the scale has none.", "2 minutes quiet think time, then 1 minute with a partner."],
        items: [
          { id: "11.1a", q: "A map at 1 to 100 shows a park path as 12 cm. How long is the real path?", a: "12 × 100 = 1,200 cm = 12 m.", check: "ok" },
          { id: "11.1b", q: "Can you choose different units for the 1 and the 100?", a: "No. Both use the same unit.", check: "ok" },
        ],
        watch: ["Only address mixed units if it keeps coming up after the lesson."],
      },
      {
        id: "11.2", name: "Apollo Lunar Module", minutes: 15,
        what: "Students use a drawing at scale 1 to 50 to find the real size of the Apollo Lunar Module.",
        steps: ["Tell the story: Armstrong and Aldrin were the first people to walk on the Moon, in 1969 (Apollo 11).", "Ask students to guess how the spacecraft compares to a person.", "Pairs do the first two questions (3 to 4 minutes) before discussing.", "Explain 'to scale': at the same scale."],
        items: [
          { id: "11.2a", q: "A leg of the module is measured as 7 cm on the drawing (1 to 50). How long is it for real?", a: "7 × 50 = 350 cm, or 3.5 m.", check: "ok" },
          { id: "11.2b", q: "What factor turns real lengths into drawing lengths?", a: "1/50 (divide by 50).", check: "ok" },
          { id: "11.2c", q: "Other parts of the module (height, width).", a: "Measure your printed drawing to 0.1 cm and multiply by 50. Use cm if the real thing is in meters, inches if in feet.", check: "figure" },
        ],
        watch: ["Converting centimeters to meters without using the scale (about 0.14 m)."],
      },
      {
        id: "11.3", name: "Same Drawing, Different Scales", minutes: 15,
        what: "Students work out what happens to the same drawing at three scales.",
        steps: ["Ask: can the 1 to 50 scale be written with units? (1 inch to 50 inches, 1 cm to 50 cm)", "3 to 4 minutes for question 1, then 3 to 4 minutes of quiet work for the rest.", "Suggest working on each scale separately if students are stuck."],
        items: [
          { id: "11.3a", q: "A scale is 1 to 180. How do actual lengths compare to drawing lengths?", a: "Actual lengths are 180 times the drawing lengths.", check: "ok" },
          { id: "11.3b", q: "Write 1 inch to 15 feet without units.", a: "15 ft = 15 × 12 = 180 in, so 1 to 180.", check: "ok" },
          { id: "11.3c", q: "Write 1 inch to 20 feet without units.", a: "20 × 12 = 240 in, so 1 to 240. This is a smaller drawing than 1 to 180.", check: "ok", note: "The public page does not state this one. We computed it." },
        ],
        watch: [],
      },
      {
        id: "11.5", name: "Are You Ready for More: Solar System", minutes: 10, optional: true,
        what: "Extension: scale a model of the solar system.",
        steps: ["Distances from the Sun in millions of miles: Mercury 35, Venus 67, Earth 93, Mars 142, Jupiter 484, Saturn 887, Uranus 1,784, Neptune 2,795.", "Pick a length that fits, like 100 m for the Sun to Neptune."],
        items: [
          { id: "11.5a", q: "Sample answer: if Neptune is 100 m (10,000 cm) from the Sun, what is the scale? How big is Earth's 8,000-mile diameter?", a: "2,795 million miles to 10,000 cm is 1 cm to 279,500 miles. Earth at 8,000 miles is about 0.029 cm, or 0.29 mm. Student answers depend on the model they choose.", check: "ok", note: "The public page does not give an answer. This is our sample." },
        ],
        watch: [],
      },
    ],
    summary: ["A scale with no units means the same unit is used for both the drawing and the real thing.", "To find actual distances, multiply by the scale factor (like 500). For drawing distances, multiply by 1/500."],
    supports: {
      simplified: ["Use a calculator. Highlight the scale number in colour.", "Practise with 1 to 10 and 1 to 100 before 1 to 50.", "Give a sentence frame: 'The real thing is __ times as long as the drawing.'"],
      modified: ["Model with a toy car: if the real car is 100 times as long, show how long it would be.", "Use a number line with 0, 1, 50.", "Let students estimate with a ruler and say the number aloud."],
      extension: ["11.5 solar system.", "Write 1 to 240 as 1 foot to ___ feet. (240 ft)"],
    },
    exit: { id: "11.x", q: "Our check: A model car is built at a scale of 1 to 25. The model is 18 cm long. How long is the real car?", a: "18 × 25 = 450 cm = 4.5 m.", check: "ok" },
    mistakes: ["Mixing units on the two sides.", "Dividing instead of multiplying to get the real size.", "Forgetting 12 inches per foot."],
  },

  // ───────────────────────────── Lesson 12 ─────────────────────────────
  {
    n: 12, title: "Units in Scale Drawings", section: "B: Scale Drawings",
    targets: ["I can write a scale in different units, with or without units.", "I can find actual area from a scaled area."],
    bigIdea: "Different-looking scales can be equivalent. Actual area = scaled area × (scale factor)².",
    primer: [
      "Convert units first, or scale first. Both give the same answer. Lots of unit conversions here: 1 inch = 2.54 cm, 1 foot = 12 inches, 1 mile = 5,280 feet, 1 m = 1,000 mm.",
      "The big conversion: 1 mile = 5,280 × 12 = 63,360 inches. So 1 inch to 1 mile is 1 to 63,360.",
      "Warning about area: if 1 cm stands for 5 m, then 1 cm² stands for 5 × 5 = 25 m². Not 5 m².",
      "If you see one scale number that seems too small or huge, trust the arithmetic, not the look.",
    ],
    vocab: [
      { term: "equivalent scales", kid: "Different ways to say the same scale.", example: "1 cm to 10 m and 1 to 1,000." },
      { term: "scale factor", kid: "The no-units number that relates drawing to real.", example: "1,000." },
    ],
    materials: ["Scales Card Sort slips (12.2)", "Metric and customary unit conversion charts (12.3)", "Pondering Pools blackline master and geometry toolkits (12.4)", "Calculators"],
    activities: [
      {
        id: "12.1", name: "Centimeters in a Mile", minutes: 5,
        what: "Warm-up: which expression gives the number of centimeters in a mile?",
        steps: ["Display the five options. Students pick and explain.", "Use common sense: a centimeter is small and a mile is large, so the answer is a big number."],
        items: [
          { id: "12.1a", q: "Which expression gives centimeters in a mile? (2.54 cm per inch, 12 in per foot, 5,280 ft per mile)", a: "5,280 · 12 · 2.54 = 160,934.4 cm. 12 · 2.54 gives cm per foot; times 5,280 gives cm per mile.", check: "ok" },
          { id: "12.1b", q: "What does 1/(2.54 · 12 · 5,280) represent?", a: "It is the reciprocal: it turns centimeters into miles.", check: "ok" },
        ],
        watch: [],
      },
      {
        id: "12.2", name: "Card Sort: Scales", minutes: 15, optional: true,
        what: "Groups of 4 match equivalent scales, with and without units.",
        steps: ["Model matching with a partner. Chunk: start with a few cards.", "5 to 6 minutes to sort, 2 to 3 minutes to check another group's work.", "Frames: '__ and __ are equivalent because...', 'I noticed __, so I matched...'"],
        items: [
          { id: "12.2a", q: "Rewrite 1 inch to 1,000 inches and 1 centimeter to 10 meters. Equivalent?", a: "Yes. 10 m = 1,000 cm, so 1 cm to 10 m is 1 to 1,000. Both are 1 to 1,000.", check: "ok" },
          { id: "12.2b", q: "Write 1 mm to 1 m without units. Write ½ cm to 500 m without units.", a: "1 mm to 1 m is 1 to 1,000. ½ cm to 500 m: 500 m = 50,000 cm, and 50,000 ÷ ½ = 100,000, so 1 to 100,000.", check: "ok" },
          { id: "12.2c", q: "Which card sets match?", a: "Convert each card to a scale with no units (1 to something). Cards with the same number match. Metric and customary can be equivalent.", check: "figure", note: "The exact card sets are on your blackline master." },
        ],
        watch: ["Sorting by metric vs customary or by units vs no units.", "Believing metric and customary scales cannot be equivalent."],
      },
      {
        id: "12.3", name: "The World's Largest Flag", minutes: 15,
        what: "Students use a 1 to 2,000 scale to compare a huge flag (396 m long) with a small drawing on letter paper.",
        steps: ["Show Tunisia's record-holding flag, 396 m long. Letter paper is about 21.5 cm by 28 cm: ask what scale could work.", "Groups of 3 or 4: 4 to 5 minutes alone, then 5 minutes of discussion. Assign each group one part of question 2 to present.", "Compare methods: convert units first then scale, or scale first then convert."],
        items: [
          { id: "12.3a", q: "At 1 to 2,000, how long is the flag on paper?", a: "396 m = 39,600 cm; 39,600 ÷ 2,000 = 19.8 cm.", check: "ok" },
          { id: "12.3b", q: "The scaled flag is 13.2 cm tall. How tall is the real flag?", a: "13.2 × 2,000 = 26,400 cm = 264 m.", check: "ok" },
          { id: "12.3c", q: "Real crescent moon height is 99 m. Height on the drawing?", a: "9,900 cm ÷ 2,000 = 4.95 cm.", check: "ok" },
          { id: "12.3d", q: "Write equivalent scales for 1 to 2,000.", a: "1 cm to 20 m, 5 cm to 100 m, 1 mm to 2 m, 1 m to 2 km. All have the same factor, 2,000.", check: "ok" },
          { id: "12.3e", q: "Areas of the large and small flag and their ratio.", a: "Large: 396 × 264 = 104,544 m² (which is 1,045,440,000 cm²). Small: 19.8 × 13.2 = 261.36 cm². Ratio: 4,000,000 (2,000 × 2,000).", check: "ok", note: "The public page lists the large flag's area as 1,053,360,000 cm². That does not equal 4,000,000 × 261.36. We checked: the right value is 1,045,440,000." },
        ],
        watch: ["Mixing up multiplying and dividing by 2,000. Have students say what '1 to 2,000' means.", "For area, find each flag's dimensions first."],
      },
      {
        id: "12.4", name: "Pondering Pools", minutes: 10, optional: true,
        what: "Students find scales and real areas from a pool floor plan.",
        steps: ["Notice and wonder about the floor plan.", "Students write math questions before you show the follow-ups (1 minute alone, 3 minutes with a partner).", "Reveal the follow-up questions and compare."],
        items: [
          { id: "12.4a", q: "The square pool's real side is 15 m and it is drawn 3 cm. What is the scale with and without units?", a: "3 cm to 15 m, which is 1 cm to 5 m, and 1 to 500 without units.", check: "ok" },
          { id: "12.4b", q: "Real area of the large rectangular pool.", a: "Multiply its drawn area by 25 (5²). Or find each real side (cm × 5 m) and multiply them.", check: "figure", note: "The drawn dimensions are on your printed plan." },
          { id: "12.4c", q: "The kidney-shaped pool has a drawn area of 3.2 cm². Real area?", a: "3.2 × 25 = 80 m². (Not 3.2 × 5.)", check: "ok" },
          { id: "12.4d", q: "Extension: scale factor 2. Area 10 for a square. Volume 10 for a cube. 'Volume' 10 for a 4D hypercube.", a: "40, 80 and 160 (2², 2³, 2⁴ times 10).", check: "ok" },
        ],
        watch: ["Multiplying the scaled area by 5, not 25.", "Thinking the kidney pool question is missing information."],
      },
    ],
    summary: ["Scales can use different units or no units. 1 inch to 1 mile is 1 to 63,360.", "For area: with 1 inch to 5 miles, 1 square inch stands for 25 square miles. To find actual area, multiply the map area by 25. To find map area, multiply by 1/25."],
    supports: {
      simplified: ["Keep a conversion chart on the table (12 in = 1 ft, 5,280 ft = 1 mi, 2.54 cm = 1 in, 1,000 mm = 1 m).", "Use a calculator for big numbers.", "Do the card sort with only 6 cards."],
      modified: ["Give a ladder: inches → feet → miles on a posted chart.", "Cards with colour-coded units.", "Let students dictate their reasoning."],
      extension: ["Find your own town on a map and write the scale with and without units.", "How many cm² on a 1 cm to 5 m plan equal 1 real m²? (1/25 cm²)"],
    },
    exit: { id: "12.x", q: "Our check: A map uses 1 inch to 2 miles. Write the scale with no units. A lake covers 3 square inches on the map. What is its real area?", a: "2 miles = 2 × 63,360 = 126,720 inches, so 1 to 126,720. One square inch is 2 × 2 = 4 square miles, so 3 sq in is 12 square miles.", check: "ok" },
    mistakes: ["Scaling area by the length factor.", "Forgetting a step in a long conversion.", "Thinking 1 inch to 5 miles is 1 to 63,360 (that is 1 inch to 1 mile; 1 inch to 5 miles is 1 to 316,800)."],
  },

  // ───────────────────────────── Lesson 13 ─────────────────────────────
  {
    n: 13, title: "Draw It to Scale", section: "B: Scale Drawings",
    targets: ["I can plan, measure and draw a floor plan to scale.", "I can choose a scale that fits the paper."],
    bigIdea: "To draw a real room on paper, measure, choose a scale that fits your paper, convert every length, and draw.",
    primer: [
      "This lesson is a project. Students measure a real classroom, make a plan, and draw it to scale on paper. There is no single right answer. Different scales and papers lead to different drawings.",
      "Choosing a scale: take the longest real length and the longest side of your paper. Divide real by paper. The answer is the smallest scale number that works. Round UP to a friendly number, like 25, 40 or 50.",
      "Example (made up, not your room): a room 9 m by 7 m, on letter paper 27.9 cm by 21.6 cm with 1.5 cm margins, leaves 24.9 by 18.6 cm. 900 ÷ 24.9 is about 36.1 and 700 ÷ 18.6 is about 37.6, so you need at least 1 cm to 37.6 cm. Choose 1 cm to 40 cm. Then the room is 22.5 cm by 17.5 cm: it fits.",
      "Plan time. The curriculum gives about 50 minutes in four parts. Plan more if students measure carefully.",
    ],
    vocab: [
      { term: "floor plan", kid: "A top-view drawing of a room.", example: "Your classroom plan." },
      { term: "scale that fits", kid: "A scale that makes the drawing fit on the paper without being tiny.", example: "1 cm to 40 cm." },
    ],
    materials: ["Blank paper (13.2)", "Measuring tools: tape measures or meter sticks, rulers (13.2)", "At least three kinds of paper per group: 8½×11, 11×17, centimeter graph, ¼-inch graph, ⅕-inch graph (13.3)"],
    activities: [
      {
        id: "13.1", name: "Which Measurements Matter?", minutes: 5,
        what: "Students list what to measure to make an accurate floor plan.",
        steps: ["2 minutes of quiet thinking to make a list. 3 minutes of class discussion.", "Record answers and group them: walls, doors, windows, furniture.", "Ask which parts are needed, and whether to include height."],
        items: [
          { id: "13.1a", q: "What measurements matter for a floor plan?", a: "Lengths of every wall, door and window sizes and where they sit along the wall, sizes and positions of furniture. Distances between objects. Height is not needed for a top-view plan.", check: "ok" },
        ],
        watch: ["Encourage specific answers, like 'the length of the window along the north wall'."],
      },
      {
        id: "13.2", name: "Creating a Floor Plan (Part 1)", minutes: 15,
        what: "Groups sketch the room and measure it.",
        steps: ["Students read the task alone (1 to 2 minutes). Groups of 2 to 4.", "Sketch the room (4 to 5 minutes), share with a partner.", "Plan (4 to 5 minutes) how to measure, then measure.", "Make sure everyone gets a copy of the measurements."],
        items: [
          { id: "13.2a", q: "What problems can come up when measuring?", a: "Keeping the tape straight. Long walls measured in more than one pass. Sharing tools. Rounding. Agree on a rounding rule.", check: "ok" },
        ],
        watch: ["Mark the end of the tape with a finger or pencil before sliding it along."],
      },
      {
        id: "13.3", name: "Creating a Floor Plan (Part 2)", minutes: 15,
        what: "Groups choose a paper and a scale, convert each measurement, and draw.",
        steps: ["Give each group at least three kinds of paper.", "Each student picks a scale that fits their paper, units and room.", "Quiet drawing time. Stop and check complex layouts.", "Chunk: one wall or section at a time."],
        items: [
          { id: "13.3a", q: "How do you choose a scale for a room 9 m by 7 m on letter paper (27.9 by 21.6 cm) with 1.5 cm margins?", a: "Usable paper is 24.9 by 18.6 cm. Need at least 900 ÷ 24.9 ≈ 36.1 and 700 ÷ 18.6 ≈ 37.6, so 1 cm to at least 37.6 cm. 1 cm to 40 cm works: 22.5 cm by 17.5 cm. 1 cm to 30 cm does not: 30 cm by 23.3 cm is too big.", check: "ok" },
          { id: "13.3b", q: "Your real classroom.", a: "No single correct answer. Check that each real length was divided by the scale, the shape is closed, and the room fits on the paper.", check: "figure" },
        ],
        watch: ["Students who start drawing before thinking about how big the plan will be."],
      },
      {
        id: "13.4", name: "Creating a Floor Plan (Part 3)", minutes: 15,
        what: "Groups with the same paper compare drawings and reflect.",
        steps: ["Group students with the same paper type and size.", "8 to 10 minutes: share the drawings and explain the scale. Display guiding questions.", "4 to 5 minutes of quiet reflection, then class debrief."],
        items: [
          { id: "13.4a", q: "How did the scale affect the drawing?", a: "A larger number per cm gave a smaller drawing with less detail. A smaller number gave a bigger drawing, which may not fit.", check: "ok" },
          { id: "13.4b", q: "Would you pick the same scale for a bigger building?", a: "No. A bigger building needs more real length per cm, so a bigger scale number.", check: "ok" },
        ],
        watch: [],
      },
    ],
    summary: ["Choose a scale that fits the paper, convert each measurement, and check that the finished plan is the right size.", "The curriculum's Lesson Synthesis and cool-down for this lesson are not on its public page, so we wrote our own check below."],
    supports: {
      simplified: ["Give a ready-made sketch with blanks for measurements. Provide a pre-chosen scale such as 1 cm to 50 cm.", "Provide a table: wall | real length | ÷ scale | drawing length.", "Use graph paper where 1 square is 1 cm."],
      modified: ["Reduce to one wall, one door and one desk.", "Students draw while a partner measures and reads numbers.", "Use a pre-printed room outline."],
      extension: ["Draw the room again at a different scale. How do the areas compare?", "Draw the whole classroom wing."],
    },
    exit: { id: "13.x", q: "Our check: A room is 8 m by 6 m. Your paper is 21 cm by 28 cm. Will 1 cm to 50 cm fit? Will 1 cm to 25 cm fit?", a: "1 cm to 50 cm gives 16 cm by 12 cm: fits. 1 cm to 25 cm gives 32 cm by 24 cm: too big for the paper.", check: "ok" },
    mistakes: ["Not leaving a margin.", "Using the wrong direction: multiplying real lengths by the scale.", "Forgetting door and window positions."],
  },
];
