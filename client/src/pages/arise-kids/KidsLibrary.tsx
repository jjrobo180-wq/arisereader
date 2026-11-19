// /eye-gaze-quizzes and /eye-gaze-books: Quizzes and Books as their own apps on the Apps page, drawn in the
// Apps page's look (deep purple, bright tiles, big Lexend words). A quiz opens the same quiz page as before.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { isPictureFile } from "@/lib/eyeGazeLesson";
import { LESSON_POINTS, picturePath } from "@shared/eyegaze/lessonSteps";
import { Icon, KIDS_TAB_PATHS, KidsTabBar, css } from "./kidsUi";

const FONT = "Lexend, system-ui, sans-serif";
// --sat-in: the clock's space when the app draws edge to edge (index.css); on the web, and in an older app build, the browser's own.
const TOP = (px: number) => `max(${px}px, var(--sat-in, env(safe-area-inset-top)))`;
const BACK = "M15 18l-6-6 6-6";
const CHECK = "m5 12 5 5 9-10";
const STAR = "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";
const TINTS = ["#ffd34d", "#9de0f5", "#c7f09a", "#ffc9de", "#d9cfff", "#ffb3a1", "#b8ecd8", "#ffe3a1"];

type Item = { key: string; title: string; note: string; pic: string | null; done: boolean; open: string };

function Pic({ src, size }: { src: string | null; size: number }) {
  if (!src) return <Icon d={STAR} size={size * 0.6} stroke="#14102a" />;
  if (!isPictureFile(src)) return <span aria-hidden="true" style={{ fontSize: size * 0.7, lineHeight: 1 }}>{src}</span>;
  return <img src={src} alt="" draggable={false} style={{ width: size, height: size, objectFit: "contain" }} />;
}

export default function KidsLibrary({ mode }: { mode: "quizzes" | "books" }) {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let live = true;
    const get = (path: string) => fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    if (mode === "quizzes") {
      void Promise.all([get("/api/eye-gaze/quizzes"), get("/api/custom-quizzes")]).then(([q, c]) => {
        if (!live) return;
        const lessons: Item[] = (Array.isArray(q) ? q : []).map((l: any) => ({ key: `q${l.id}`, title: String(l.title || "Quiz"), note: l.hasCompleted ? (l.total ? `Done · ${l.score ?? 0} of ${l.total}` : "Done") : `${LESSON_POINTS} points`, pic: l.cover_visual || picturePath("puzzle"), done: !!l.hasCompleted, open: `/eye-gaze-quiz/${l.id}` }));
        const mine: Item[] = (Array.isArray(c) ? c : []).filter((x: any) => x.quiz_type !== "regular").map((x: any) => ({ key: `c${x.id}`, title: String(x.title || "Quiz"), note: x.hasCompleted ? "Done" : "From my teacher", pic: (x.questions || []).map((qq: any) => qq.question_image).find(isPictureFile) || picturePath("teacher"), done: !!x.hasCompleted, open: `/custom-quiz/${x.id}` }));
        setItems([...lessons.filter((i) => !i.done), ...mine, ...lessons.filter((i) => i.done)]);
      });
    } else {
      void get("/api/books").then((b) => {
        if (!live) return;
        setItems((Array.isArray(b) ? b : []).map((x: any) => ({ key: `b${x.id}`, title: String(x.title || "Book"), note: x.author ? String(x.author) : `${x.pointsValue || 10} points`, pic: x.coverUrl || null, done: false, open: `/quiz/${x.id}` })));
      });
    }
    return () => { live = false; };
  }, [mode, token]);

  const title = mode === "quizzes" ? "Quizzes" : "Books";
  return (
    <div data-arise-kids style={css("position: fixed; inset: 0; overflow: hidden; font-family: " + FONT + "; background: #14102a; color: #ffffff; -webkit-tap-highlight-color: transparent")}>
      <style>{`[data-arise-kids] *::-webkit-scrollbar{display:none}[data-arise-kids] button{cursor:pointer}`}</style>
      <div style={css("position: absolute; inset: 0 0 92px 0; overflow-y: auto; scrollbar-width: none")} data-screen={mode}>
        <div style={{ ...css("display: flex; align-items: center; gap: 12px; padding: 0 18px 14px"), paddingTop: TOP(54) }}>
          <button type="button" onClick={() => navigate(KIDS_TAB_PATHS.apps)} aria-label="Back to Apps" style={css("min-height: 48px; padding: 0 16px 0 10px; border-radius: 24px; border: 0; background: #ffd34d; color: #14102a; font-family: inherit; font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 4px")}><Icon d={BACK} size={22} width={3} />Apps</button>
          <span style={css("font-size: 28px; font-weight: 800")}>{title}</span>
        </div>
        {items === null ? (
          <div role="status" style={css("padding: 30px 18px; font-size: 20px; font-weight: 800")}>Loading {title.toLowerCase()}…</div>
        ) : items.length === 0 ? (
          <div style={css("margin: 0 18px; border-radius: 24px; background: #241d47; padding: 24px; font-size: 20px; font-weight: 600")}>{mode === "quizzes" ? "No quizzes yet. They are on their way!" : "No books yet."}</div>
        ) : (
          <div style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 0 18px 24px")}>
            {items.map((it, i) => (
              <button key={it.key} type="button" onClick={() => navigate(it.open)} style={css("min-height: 190px; border: 0; border-radius: 22px; background: " + TINTS[i % TINTS.length] + "; color: #14102a; padding: 14px; box-sizing: border-box; font-family: inherit; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 8px; text-align: left; position: relative")}>
                {it.done && <span aria-label="Done" style={css("position: absolute; right: 10px; top: 10px; width: 34px; height: 34px; border-radius: 17px; background: #14102a; color: #ffffff; display: flex; align-items: center; justify-content: center")}><Icon d={CHECK} size={20} width={3} /></span>}
                <span style={css("width: 84px; height: 84px; border-radius: 18px; background: rgba(255,255,255,.6); display: flex; align-items: center; justify-content: center; overflow: hidden")}><Pic src={it.pic} size={72} /></span>
                <span style={css("font-size: 18px; font-weight: 800; line-height: 1.2")}>{it.title}</span>
                <span style={css("font-size: 14px; font-weight: 600")}>{it.note}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <KidsTabBar tab={null} />
    </div>
  );
}
