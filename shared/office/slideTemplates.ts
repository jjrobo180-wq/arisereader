// Ready-made presentations to start from.
import { deckFromOutline, makeSlide, themeOf, type Deck } from "./slidesModel";

export type SlideTemplate = { id: string; name: string; blurb: string; emoji: string; color: string; make: () => Deck };
const deck = (theme: string, title: string, slides: { title: string; bullets: string[]; notes?: string }[]) => deckFromOutline(theme, title, slides);

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  { id: "lesson", name: "Lesson (I do, we do, you do)", emoji: "🍎", color: "#f59e0b", blurb: "Objective, warm-up, model, practice, exit ticket.",
    make: () => { const d = deck("classroom", "Today's lesson", [
      { title: "[Lesson title]", bullets: ["[Subject] · [Date]"], notes: "Welcome students and share the goal." },
      { title: "Learning goal", bullets: ["I can …", "I will know I've got it when …"] },
      { title: "Warm-up", bullets: ["[Quick question or problem]", "Think · Pair · Share"] },
      { title: "Key vocabulary", bullets: ["[Word] — [meaning]", "[Word] — [meaning]", "[Word] — [meaning]"] },
      { title: "I do", bullets: ["Watch how I …", "Step 1", "Step 2", "Step 3"] },
      { title: "We do", bullets: ["Let's try one together", "[Problem]"] },
      { title: "You do", bullets: ["Try these on your own", "1. …", "2. …", "3. …"] },
      { title: "Exit ticket", bullets: ["[Question]", "Show me what you learned today"] },
    ]); d.slides.splice(5, 0, makeSlide("number", themeOf("classroom"), { title: "3", sub: "steps to remember" })); return d; } },
  { id: "back-to-school", name: "Back to school night", emoji: "🏫", color: "#0d9488", blurb: "Meet the teacher, schedule, expectations and how to reach me.",
    make: () => deck("forest", "Welcome", [
      { title: "Welcome to [Room / Class]!", bullets: ["[Teacher name] · [School year]"] },
      { title: "About me", bullets: ["[Background]", "[Why I love teaching]", "[A fun fact]"] },
      { title: "A day in our class", bullets: ["[Time] — Morning meeting", "[Time] — Reading", "[Time] — Math", "[Time] — Specials"] },
      { title: "What we'll learn this year", bullets: ["Reading: …", "Math: …", "Science: …"] },
      { title: "Homework and grading", bullets: ["…"] },
      { title: "How to reach me", bullets: ["Email: …", "Best time: …", "Newsletter every Friday"] },
    ]) },
  { id: "book-report", name: "Book report", emoji: "📚", color: "#db2777", blurb: "Characters, setting, plot, favourite part and rating.",
    make: () => deck("coral", "Book report", [
      { title: "[Book title]", bullets: ["by [Author] · Report by [Name]"] },
      { title: "Main characters", bullets: ["[Name] — …", "[Name] — …"] }, { title: "Setting", bullets: ["Where: …", "When: …"] },
      { title: "Beginning, middle, end", bullets: ["Beginning: …", "Middle: …", "End: …"] }, { title: "My favourite part", bullets: ["…"] }, { title: "My rating", bullets: ["★★★★☆", "Because …"] },
    ]) },
  { id: "science", name: "Science project", emoji: "🔬", color: "#0891b2", blurb: "Question, hypothesis, materials, procedure, results, conclusion.",
    make: () => deck("ocean", "Science project", [
      { title: "[Project title]", bullets: ["[Name] · [Grade]"] }, { title: "Question", bullets: ["What happens when …?"] }, { title: "Hypothesis", bullets: ["If … then … because …"] },
      { title: "Materials", bullets: ["…", "…"] }, { title: "Procedure", bullets: ["1. …", "2. …", "3. …"] }, { title: "Results", bullets: ["[Add a chart or photo]"] }, { title: "Conclusion", bullets: ["My hypothesis was …", "Next time I would …"] },
    ]) },
  { id: "team-update", name: "Team update", emoji: "📈", color: "#4f46e5", blurb: "Wins, numbers, what's next and where you need help.",
    make: () => { const d = deck("midnight", "Team update", [
      { title: "[Team] update", bullets: ["[Month, year]"] }, { title: "Highlights", bullets: ["…", "…", "…"] },
      { title: "What's next", bullets: ["…", "…"] }, { title: "Where we need help", bullets: ["…"] }, { title: "Questions?", bullets: [] },
    ]); d.slides.splice(2, 0, makeSlide("number", themeOf("midnight"), { title: "94%", sub: "[what this number means]" })); return d; } },
  { id: "pitch", name: "Pitch deck", emoji: "🚀", color: "#111827", blurb: "Problem, solution, how it works, market, ask.",
    make: () => deck("bold", "Pitch", [
      { title: "[Name]", bullets: ["[One line about what you do]"] }, { title: "The problem", bullets: ["…"] }, { title: "Our solution", bullets: ["…"] },
      { title: "How it works", bullets: ["1. …", "2. …", "3. …"] }, { title: "Who it's for", bullets: ["…"] }, { title: "The ask", bullets: ["…"] },
    ]) },
  { id: "family", name: "Family story", emoji: "📸", color: "#ea580c", blurb: "A photo story for a trip, a birthday or a year in review.",
    make: () => { const t = themeOf("sunrise"); return { v: 1, theme: t.id, slides: [makeSlide("title", t, { title: "[Our trip / Our year]", sub: "[Dates]" }), makeSlide("image", t, { title: "[Moment]", bullets: ["[What happened]"] }), makeSlide("image", t, { title: "[Moment]", bullets: ["[What happened]"] }), makeSlide("quote", t, { title: "[A favourite thing someone said]", sub: "[Who]" }), makeSlide("section", t, { title: "Thanks for watching!" })] }; } },
];
