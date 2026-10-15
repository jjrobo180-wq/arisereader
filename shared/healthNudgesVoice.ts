// How a Health Nudge sounds at each level. A nudge is built from three parts: a lead (an opener for
// motivation, a label like "Fun fact:" for science, tips and challenges), the line itself (written per goal
// in healthNudgesContent.ts) and a closer. Every level has its own leads and closers, so the same line is
// gentle at level 1 and blunt at level 5, and the number of different nudges is the product of the parts.
//
// The loud levels go after excuses and the clock, never the person or their body.

export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVELS: { id: Level; name: string; blurb: string; sample: string }[] = [
  { id: 1, name: "Gentle", blurb: "Soft, kind and pressure-free.", sample: "No pressure, just a thought: every small step counts. You're doing better than you think." },
  { id: 2, name: "Friendly", blurb: "An upbeat coach in your corner.", sample: "Hey you! Today is a fresh chance to do something good for yourself. You've got this." },
  { id: 3, name: "Motivating", blurb: "Firm and energetic. Gets you moving.", sample: "Let's get after it. Your future self is counting on today's choices. Make it happen." },
  { id: 4, name: "Tough", blurb: "Blunt. No excuses allowed.", sample: "Real talk: nobody is coming to do this for you. Discipline beats motivation. Get it done." },
  { id: 5, name: "Drill sergeant", blurb: "Loud and relentless. Not for the faint of heart.", sample: "LISTEN UP. Comfort is not a goal. Your excuses are not a plan. MOVE." },
];

type Parts = { open: string[]; close: string[]; tip: string[]; fact: string[]; act: string[] };

export const VOICE: Record<Level, Parts> = {
  1: {
    open: [
      "No pressure, just a thought:", "A gentle reminder:", "Take a breath.", "Soft nudge:", "You're doing better than you think.",
      "Be kind to yourself today.", "A little encouragement:", "Whenever you're ready:", "Slow and steady is still moving.", "Just checking in with you.",
      "One small thing:", "Remember:", "A quiet thought for today:", "Today, go easy and go on.",
    ],
    close: [
      "You're doing great.", "Be proud of every step.", "Small steps still count.", "Take it at your own pace.", "I believe in you.",
      "Progress, not perfection.", "Be patient with yourself.", "You deserve this kindness.", "Rest if you need to, then continue.", "One gentle step is enough for now.",
      "You've already started, and that matters.", "Nothing to prove, just keep going.",
    ],
    tip: ["A gentle tip:", "Something that might help:", "If it feels right, try this:", "An easy idea:", "Here's a kind little tip:", "You might like this:", "A small, doable idea:", "Perhaps try this:", "A helpful thought:", "An easy win:"],
    fact: ["A comforting fact:", "Good to know:", "Something encouraging from research:", "Here's a little science:", "Science is on your side:", "A reassuring fact:", "Something worth knowing:", "Gentle science:", "Did you know?", "A bit of research for you:"],
    act: ["If you feel up to it:", "A tiny challenge, only if you want:", "When you're ready, try this:", "Maybe just this one thing:", "A small invitation:", "One easy thing to try now:", "Optional, but lovely:", "A gentle challenge:", "Here's a small step:", "Right now, if you can:"],
  },
  2: {
    open: [
      "Hey you!", "Good news:", "Here's your boost!", "Quick pep talk:", "Friendly reminder:",
      "You've got this!", "Heads up, champ:", "Time for a little cheer:", "Let's do this together:", "Hi there, superstar!",
      "Daily dose of encouragement:", "Psst, listen up:", "Today's a good day for this:", "Smile, you're making progress:",
    ],
    close: [
      "You've got this!", "Proud of you!", "Keep it going!", "Look how far you've come.", "One step at a time, friend.",
      "Cheering for you!", "Go you!", "You're building something great.", "Keep showing up.", "Today counts, and so do you.",
      "Let's make it a good one.", "Onward!",
    ],
    tip: ["Coach's tip:", "Try this:", "Pro tip:", "Little trick:", "Here's an easy idea:", "Handy tip:", "A trick that works:", "Quick idea:", "Worth trying:", "Friendly tip:"],
    fact: ["Fun fact:", "Science says:", "Cool research:", "Here's something neat:", "Did you know?", "Nerd moment:", "Brain food:", "Interesting find:", "Good news from science:", "Here's the science:"],
    act: ["Mini challenge:", "Let's try this right now:", "Quick challenge:", "Your 60-second mission:", "Today's tiny quest:", "Ready? Do this:", "Challenge time:", "Try this right now:", "Your next move:", "Let's go, do this:"],
  },
  3: {
    open: [
      "Let's get after it.", "Time to show up.", "Make it count.", "Stay locked in.", "Focus up.",
      "This is your moment.", "No coasting today.", "Own today.", "Time to level up.", "Bring the effort.",
      "Choose the harder good thing.", "Push a little.", "Eyes on the goal.", "Commit to it.",
    ],
    close: [
      "Make it happen.", "Your future self is watching.", "Show up and finish.", "Earn today.", "Keep your word to yourself.",
      "Stay consistent.", "Do the work.", "You're stronger than the excuse.", "Go get it.", "Build the streak.",
      "Finish what you started.", "Today, not someday.",
    ],
    tip: ["Smart move:", "Do this:", "Game plan:", "Use this:", "Strategy:", "Tactical tip:", "Work smarter:", "Try this approach:", "Upgrade your day:", "Winning habit:"],
    fact: ["Know this:", "The research is clear:", "Science backs you up:", "Fact:", "Data point:", "What the studies show:", "Evidence says:", "Use this knowledge:", "Here's why it works:", "Remember the science:"],
    act: ["Challenge:", "Do this now:", "Right now, no delay:", "Your assignment:", "Rep it out:", "Take action:", "Next 5 minutes:", "Prove it:", "Go do this:", "Make this move:"],
  },
  4: {
    open: [
      "Real talk:", "Nobody is coming to do this for you.", "Stop negotiating with yourself.", "Excuses are loud. Results are louder.", "Discipline over mood.",
      "Comfort is not a plan.", "Be honest with yourself:", "No more 'tomorrow'.", "You know what to do.", "Quit stalling.",
      "Straight talk:", "The standard is the standard.", "Don't wait to feel ready.", "Cut the excuses.",
    ],
    close: [
      "Get it done.", "No excuses.", "Do it anyway.", "Stop talking, start doing.", "Discipline decides.",
      "Be consistent or be average.", "You said you wanted this. Prove it.", "Hard now, easier later.", "Earn the result.", "Act now.",
      "Mood is optional. The work isn't.", "Finish it.",
    ],
    tip: ["Do this:", "Non-negotiable:", "Simple rule:", "Fix this today:", "No-nonsense tip:", "Straight up:", "Make this a rule:", "Do it this way:", "The fix:", "Rule to live by:"],
    fact: ["Hard fact:", "Face the facts:", "The science doesn't care about excuses:", "The evidence is clear:", "Proof:", "Straight from the research:", "Facts over feelings:", "Know this:", "The data says:", "Truth:"],
    act: ["Do this right now:", "No excuses, do this:", "Drop and do:", "Your orders:", "Execute:", "Now:", "Immediate task:", "Do it before you think:", "Stop reading, do this:", "Your next five minutes:"],
  },
  5: {
    open: [
      "LISTEN UP.", "ATTENTION.", "EYES FRONT.", "ON YOUR FEET.", "NO MORE EXCUSES.",
      "DROP EVERYTHING.", "THE CLOCK IS TICKING.", "TIME TO EARN IT.", "LET'S GO. NOW.", "HEADS UP, RECRUIT.",
      "I DIDN'T HEAR A PLAN.", "COMFORT IS NOT A GOAL.", "FALL IN.", "WAKE UP.",
    ],
    close: [
      "NOW MOVE.", "NO NEGOTIATING.", "GET IT DONE.", "EARN IT.", "DISCIPLINE, NOT DRAMA.",
      "REPORT BACK WITH RESULTS.", "NO EXCUSES, JUST EFFORT.", "AGAIN.", "DON'T QUIT ON ME.", "YOU'RE STRONGER THAN THIS.",
      "FINISH STRONG.", "I BELIEVE IN YOU. NOW GO.",
    ],
    tip: ["ORDERS:", "RULE ONE:", "DO IT THIS WAY:", "FIELD TIP:", "LOCK THIS IN:", "STANDARD OPERATING PROCEDURE:", "MEMORIZE THIS:", "THE PLAN:", "NON-NEGOTIABLE:", "YOUR EDGE:"],
    fact: ["FACT:", "INTEL:", "THE SCIENCE DOES NOT CARE ABOUT YOUR EXCUSES:", "BRIEFING:", "EVIDENCE:", "KNOW THIS:", "DATA DON'T LIE:", "LEARN IT:", "PROOF:", "THE RESEARCH IS CLEAR:"],
    act: ["DROP AND DO THIS:", "YOUR MISSION, RIGHT NOW:", "GO. NOW:", "EXECUTE:", "IMMEDIATE ORDERS:", "MOVE IT:", "NO DELAY:", "THIS IS YOUR DRILL:", "ON MY COUNT:", "DO IT BEFORE YOU THINK:"],
  },
};
