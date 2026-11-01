// Arise Fit's how-to videos: one real YouTube tutorial for every exercise in the catalog (shared/fit.ts),
// picked by hand from public "how to" form videos. The app plays them inside itself through
// /fit-video.html (client/public), which hosts YouTube's player on arisetodo.com: inside the iPhone app
// the page has no web address of its own, and YouTube's player refuses to start without one.

export type FitVideo = { id: string; title: string };

export const FIT_VIDEOS: Record<string, FitVideo> = {
  "bench-press": { id: "4Y2ZdHCOXok", title: "How to PROPERLY Bench Press for Growth (5 Easy Steps)" },
  "incline-bench": { id: "2jFFCy8JBU8", title: "How To Do A Barbell Incline Bench Press" },
  "db-bench": { id: "5Y3VZsLb1Ys", title: "How To Do Dumbbell Bench Press Correctly" },
  "db-incline": { id: "OC7Qs_SAO2E", title: "How To Do Incline Dumbbell Press Correctly" },
  "db-fly": { id: "UFASlayaWaE", title: "How To: Dumbbell Chest Fly" },
  "cable-fly": { id: "PLS8SpaHlnI", title: "How to Do the Cable Chest Fly" },
  "push-up": { id: "i9sTjhN4Z3M", title: "The RIGHT Way To Do Push-Ups (Perfect Form)" },
  "incline-push-up": { id: "j0q5wD9Lcg0", title: "Incline Push Up For Beginners Exercise Tutorial" },
  "dip": { id: "yN6Q1UI_xkE", title: "How To Do Dips For A Bigger Chest and Shoulders" },
  "machine-chest-press": { id: "n8TOta_pfr4", title: "How to Use a Chest Press Machine" },
  "pec-deck": { id: "-DZXcuPi4vk", title: "How To: Pec Deck Machine Fly" },
  "deadlift": { id: "XxWcirHIwVo", title: "How to PROPERLY Deadlift for Growth (5 Easy Steps)" },
  "pull-up": { id: "sIvJTfGxdFo", title: "The Official Pull-Up Checklist (Avoid Mistakes!)" },
  "chin-up": { id: "ykPUIEj4-W0", title: "How To Do Chin-Ups Properly (Step-by-Step Tutorial)" },
  "lat-pulldown": { id: "CAwf7n6Luuc", title: "How To: Lat Pulldown" },
  "barbell-row": { id: "kBWAon7ItDw", title: "How To PROPERLY Barbell Row For A Bigger Back" },
  "db-row": { id: "ZRSGpBUVcNw", title: "How To Do Single Arm Dumbbell Rows" },
  "seated-cable-row": { id: "f_r95UajQcg", title: "How to Do a Seated Cable Row" },
  "t-bar-row": { id: "AnT7jJRk1Z8", title: "How To: T-Bar Rows" },
  "inverted-row": { id: "Fl0UMfdEzsE", title: "Inverted Rows (Beginner to Advanced Progressions)" },
  "face-pull": { id: "eQaSpG7aMYQ", title: "Face Pull: Proper Form & Technique" },
  "back-extension": { id: "JzovzOGudfc", title: "How To Do Back Hyperextension Exercise Correctly" },
  "rack-pull": { id: "Y99s0dNWpUw", title: "How To Do Rack Pulls" },
  "ohp": { id: "nNMR9fRGRjQ", title: "How to Press: Proper Overhead Press Form (Step-by-Step)" },
  "db-shoulder-press": { id: "qEwKCR5JCog", title: "How To: Dumbbell Shoulder Press" },
  "arnold-press": { id: "TUHL8dXFvTg", title: "How to do an Arnold Press" },
  "lateral-raise": { id: "Y29xKcze8Ik", title: "How to Perform Dumbbell Lateral Raise" },
  "cable-lateral": { id: "Z5FA9aq3L6A", title: "How To Do Cable Lateral Raises" },
  "rear-delt-fly": { id: "Lec8GC1SiS8", title: "Rear Delt Bent Over Flies: How To" },
  "upright-row": { id: "nIJGvsdNtFE", title: "How to Do Upright Barbell Rows" },
  "pike-push-up": { id: "pHR5yG6xBps", title: "Pike Push Up Tutorial For Beginners (With Progressions)" },
  "shrug": { id: "xiLT85G_GuU", title: "Dumbbell Shrug (Proper Form)" },
  "barbell-curl": { id: "QZEqB6wUPxQ", title: "How To: Barbell Bicep Curl" },
  "db-curl": { id: "in7PaeYlhrM", title: "The ONLY Way You Should Be Doing Dumbbell Bicep Curls" },
  "hammer-curl": { id: "G7hy-AxQwcQ", title: "How To PROPERLY Hammer Curl For Bigger Biceps" },
  "preacher-curl": { id: "to3m8zws1n8", title: "Machine Bicep Preacher Curl: How To" },
  "cable-curl": { id: "16aEi1a68E0", title: "How to Do the Cable Biceps Curl With Perfect Form" },
  "incline-curl": { id: "e3zNNfjJszA", title: "Incline Dumbbell Curl Form (How-To in 90 Seconds)" },
  "triceps-pushdown": { id: "_w-HpW70nSQ", title: "How To: Cable Triceps Pushdown (3 Golden Rules)" },
  "skull-crusher": { id: "d_KZxkY_0cM", title: "How To: Skull Crushers" },
  "overhead-triceps": { id: "bVfZIlxBMqU", title: "How to Do Overhead Tricep Extensions with Dumbbells Correctly" },
  "close-grip-bench": { id: "nEF0bv2FW94", title: "How To: Close-Grip Barbell Bench Press" },
  "bench-dip": { id: "zcHaDdf4sEM", title: "How to do a triceps dip on a bench" },
  "wrist-curl": { id: "yio7CGPjQ-8", title: "How To Do Seated Dumbbell Wrist Curls" },
  "farmer-carry": { id: "VBobkldqqvk", title: "How To Do The Farmer's Walk Correctly" },
  "back-squat": { id: "QLbMsabhBqY", title: "Barbell Back Squat Tutorial for Beginners" },
  "front-squat": { id: "npVgCT7NznU", title: "Front Squat 101: Beginner's Guide" },
  "goblet-squat": { id: "JO7D6GJ98wY", title: "How To Do A Goblet Squat Correctly" },
  "bodyweight-squat": { id: "RClKKQqsvXA", title: "How to Perform the Bodyweight Squat: Exercise Tutorial" },
  "leg-press": { id: "tg-jOYwhI5w", title: "How to do a Leg Press Correctly" },
  "hack-squat": { id: "73uIfCey0ww", title: "How To Use: The Hack Squat Machine" },
  "bulgarian-split-squat": { id: "VPhhE6bBzZE", title: "How To Do Bulgarian Split Squats Correctly" },
  "lunge": { id: "qJ--a4eVsXY", title: "How To: Dumbbell Walking Lunges" },
  "step-up": { id: "9ZknEYboBOQ", title: "Dumbbell Step-up: How To" },
  "leg-extension": { id: "iW83kMs0OHw", title: "How to Do the Leg Extension Machine (Proper Form)" },
  "rdl": { id: "osbkDJFMP-w", title: "How To Do A Barbell Romanian Deadlift (Correct Form)" },
  "db-rdl": { id: "hQgFixeXdZo", title: "Dumbbell Romanian Deadlift: Technique for Beginners" },
  "leg-curl": { id: "SbSNUXPRkc8", title: "How To Do A Lying Leg Curl (Prone Leg Curl)" },
  "seated-leg-curl": { id: "Z5pRnXaCjpM", title: "Seated Leg Curl: How To" },
  "good-morning": { id: "nWyx81AfTos", title: "How To Do A Barbell Good Morning" },
  "hip-thrust": { id: "eutQE64svRE", title: "How To Barbell Hip Thrust (Step-by-Step)" },
  "glute-bridge": { id: "n6JiF2jp2Ns", title: "How to Do the Glute Bridge Properly (Beginner Guide)" },
  "cable-kickback": { id: "VSgMyiOu0uE", title: "How to Do Cable Glute Kickbacks" },
  "hip-abduction": { id: "5O_Y9l__iao", title: "Seated Hip Abduction Machine: How To" },
  "sumo-deadlift": { id: "JbY72Him34Q", title: "How To Correctly Perform A Sumo Deadlift" },
  "kb-swing": { id: "B_x0tp3HIbk", title: "How To Do a Proper Kettlebell Swing (Beginner-Friendly)" },
  "calf-raise": { id: "SorIB5_zO9A", title: "Standing Calf Raise Tutorial" },
  "seated-calf": { id: "pz66Bw6HJ4s", title: "Seated Calf Raise Machine Tutorial" },
  "single-calf": { id: "NjkqF6ZR4Ho", title: "Single Leg Calf Raise on Step" },
  "plank": { id: "ASdvN_XEl_c", title: "Planks for Beginners" },
  "side-plank": { id: "oEs8ZvVDOzI", title: "How to Do the Side Plank Properly (Beginner Guide)" },
  "crunch": { id: "2R93PU2IM-Y", title: "How To Do A Crunch (Without Neck Pain)" },
  "hanging-leg-raise": { id: "JXztA3fLp50", title: "Hanging Leg Raise (Proper Form)" },
  "cable-crunch": { id: "0KEP6A1deBE", title: "Exercise Tutorial: Kneeling Cable Crunch" },
  "ab-wheel": { id: "PK4n7qJpOhM", title: "Ab Wheel Rollouts (Beginner to Advanced Progressions)" },
  "russian-twist": { id: "DF0sPfwys_g", title: "How to Do Russian Twists Correctly" },
  "dead-bug": { id: "g_BYB0R-4Ws", title: "Core Exercise: Dead Bug" },
  "mountain-climber": { id: "re3dtmzGCOc", title: "How to Do the Mountain Climber Properly" },
  "bicycle-crunch": { id: "1we3bh9uhqY", title: "How to do a Bicycle Crunch" },
  "burpee": { id: "wGvBfVeCNko", title: "Burpees for Beginners (Step by Step Guide)" },
  "thruster": { id: "LA885CMp1yw", title: "Dumbbell Thruster Tutorial" },
  "clean-press": { id: "KCe8l86-alA", title: "How To Clean And Press" },
  "power-clean": { id: "lI35socHJ4k", title: "How To Power Clean: Step by Step Beginner's Tutorial" },
  "kb-goblet-squat": { id: "MWHIs0zxkCU", title: "How to do a Kettlebell Goblet Squat" },
  "kb-clean": { id: "ZJuFcYWgHdQ", title: "How to Do the Kettlebell Clean (Step-by-Step for Beginners)" },
  "jump-squat": { id: "8Sl9h44XNJA", title: "Squat Jump: How To (3 Steps to Proper Form)" },
  "box-jump": { id: "3INzGHuk23U", title: "How to Do a Box Jump (Proper Form & Technique)" },
  "jumping-jack": { id: "nGaXj3kkmrU", title: "How to Do Jumping Jacks Properly" },
  "high-knees": { id: "4UI6gqphvNc", title: "How To Do High Knees for Beginners" },
  "jump-rope": { id: "7GZ3uEDJqXA", title: "How To Jump Rope For Beginners: 6 Steps To Stop Tripping" },
  "run": { id: "j2UmKxUANAE", title: "Running Form for Beginners: Correct Technique" },
  "walk-incline": { id: "Ii71nAaRc_8", title: "Incline Walking On The Treadmill (Tutorial + Tips)" },
  "bike": { id: "z99qyGHnFLI", title: "How to Use a Stationary Bike" },
  "rower": { id: "4zWu1yuJ0_g", title: "Correct Rowing Machine Technique" },
  "elliptical": { id: "RakIFxUmSpA", title: "How To Properly Use The Elliptical Machine" },
  "stairs": { id: "xSB39wbMz4w", title: "How To Properly Use The Stairmaster" },
  "band-pull-apart": { id: "2fmxGGtdbog", title: "How To: Resistance Band Pull Aparts" },
  "band-row": { id: "LSkyinhmA8k", title: "How To Do A Resistance Band Row" },
  "band-squat": { id: "duP-UZsfOaQ", title: "How To Do Resistance Band Squat" },
  "superman": { id: "HPFQf4cubhE", title: "How To Do A Superman To Strengthen Your Lower Back" },
  "wall-sit": { id: "JaZNYM3zAP0", title: "How To Do a Wall Sit" },
  "hip-flexor-stretch": { id: "F55tzqJggAY", title: "Half Kneeling Hip Flexor Stretch" },
  "hamstring-stretch": { id: "T_l0AyZywjU", title: "How to do a hamstring stretch" },
  "cat-cow": { id: "CE_5RWjFA3Q", title: "How To Do Cat Cow Stretch" },
  "worlds-greatest": { id: "kk8RnOLzngc", title: "How to Do World's Greatest Stretch" },
  "childs-pose": { id: "6USdGiJ1BaA", title: "Correct Technique for Child's Pose Stretch" },
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** The how-to video for an exercise, if it has one. */
export const videoFor = (exId: string): FitVideo | undefined => {
  const v = FIT_VIDEOS[exId];
  return v && YT_ID.test(v.id) ? v : undefined;
};

/** YouTube's still for a video: "mq" is 16:9 (320×180), "hq" is larger (480×360, letterboxed). */
export const videoThumb = (id: string, size: "mq" | "hq" | "maxres" = "mq") =>
  `https://i.ytimg.com/vi/${id}/${size === "maxres" ? "maxresdefault" : `${size}default`}.jpg`;

/** The video on YouTube itself. */
export const videoWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Arise Fit's player page for a video. `origin` is where the page is served: arisetodo.com in the iPhone app. */
export const videoPlayerUrl = (id: string, origin: string, autoplay = true) =>
  YT_ID.test(id) ? `${origin.replace(/\/$/, "")}/fit-video.html?v=${id}${autoplay ? "&autoplay=1" : ""}` : "";

/** A different exercise video each day (the same one all day), for the "form tip" on Today. */
export function videoOfTheDay(ids: string[], today = new Date()): string | undefined {
  const withVideo = ids.filter((id) => videoFor(id));
  if (!withVideo.length) return undefined;
  const day = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 864e5);
  return withVideo[day % withVideo.length];
}
