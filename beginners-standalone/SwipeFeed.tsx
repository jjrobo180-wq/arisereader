import React, { useCallback, useEffect, useRef } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bookmark, BookOpen,
  CheckCircle2, Clock3, Grid3X3, Headphones, Play, Sparkles, Star,
  Trophy, Volume2
} from "lucide-react";
import type { BeginnerLesson } from "./lessons";
import { moveFeedIndex, wrapFeedIndex } from "./feed-navigation";

type CoverComponent = React.ComponentType<{
  lesson: BeginnerLesson;
  className?: string;
  children?: React.ReactNode;
}>;
type Props = {
  lessons: BeginnerLesson[];
  index: number;
  onIndexChange: (index: number) => void;
  saved: string[];
  passed: string[];
  onOpen: (lesson: BeginnerLesson) => void;
  onSave: (id: string) => void;
  onLibrary: () => void;
  topic: string;
  onTopic: (topic: string) => void;
  difficulty: string;
  onDifficulty: (difficulty: string) => void;
  points: number;
  completed: number;
  total: number;
  disabled?: boolean;
  Cover: CoverComponent;
};

const TOPICS = ["All", "Sports", "Music", "Creators", "Gaming", "Style", "Culture"];
const LEVELS = ["All", "Easy", "Medium", "Hard"];
const LEVEL_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };
const POINTS: Record<number, number> = { 1: 10, 2: 20, 3: 30 };

function listenTo(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.rate = 0.79;
  speech.lang = "en-US";
  window.speechSynthesis.speak(speech);
}

export default function SwipeFeed({
  lessons, index, onIndexChange, saved, passed, onOpen, onSave, onLibrary,
  topic, onTopic, difficulty, onDifficulty, points, completed, total,
  disabled = false, Cover
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const fingerStart = useRef<{ y: number; x: number } | null>(null);
  const lastNavigation = useRef(0);
  const currentIndex = wrapFeedIndex(index, lessons.length);
  const current = lessons[currentIndex];
  const nextLessons = lessons.length > 1 ? Array.from(
    { length: Math.min(3, lessons.length - 1) },
    (_, i) => lessons[moveFeedIndex(currentIndex, i + 1, lessons.length)]
  ) : [];
  const advance = useCallback((direction: number) => {
    if (disabled || lessons.length < 2) return;
    const now = Date.now();
    if (now - lastNavigation.current < 460) return;
    lastNavigation.current = now;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    onIndexChange(moveFeedIndex(currentIndex, direction, lessons.length));
  }, [currentIndex, disabled, lessons.length, onIndexChange]);

  // Keep the feed's scroll gestures inside the lesson frame instead of scrolling
  // the surrounding Reader-style dashboard. All other parts of the page scroll normally.
  useEffect(() => {
    const node = surfaceRef.current;
    if (!node || disabled) return;
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 12) return;
      event.preventDefault();
      advance(event.deltaY > 0 ? 1 : -1);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [advance, disabled, current?.id]);

  useEffect(() => {
    if (disabled) return;
    const keys = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey ||
        ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName) ||
        (event.target as HTMLElement)?.isContentEditable) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        advance(event.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [advance, disabled]);

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (touch) fingerStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function onTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const start = fingerStart.current;
    fingerStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const vertical = start.y - touch.clientY;
    const horizontal = start.x - touch.clientX;
    if (Math.abs(vertical) > 65 && Math.abs(vertical) > Math.abs(horizontal) * 1.25) {
      advance(vertical > 0 ? 1 : -1);
    }
  }

  return <section className="swipe-page" aria-label="Swipe through reading lessons">
    <div className="swipe-intro">
      <div>
        <div className="eyebrow"><Sparkles size={13} /> DISCOVER YOUR NEXT LESSON</div>
        <h1>Swipe to Learn <span className="swipe-sparkle">✦</span></h1>
        <p>Swipe through the same lessons in a new way. One story, one reading skill, one quiz at a time.</p>
      </div>
      <div className="view-switcher" role="group" aria-label="Choose how to browse lessons">
        <button type="button" aria-pressed={false} onClick={onLibrary}>
          <Grid3X3 size={16} /> Library
        </button>
        <button type="button" className="selected" aria-pressed={true}>
          <Play size={15} fill="currentColor" /> Swipe Feed
        </button>
      </div>
    </div>
    <div className="swipe-filters" aria-label="Filter swipe lessons by topic">
      {TOPICS.map(t => <button type="button" key={t} onClick={() => onTopic(t)}
        aria-pressed={topic === t}
        className={"chip " + (topic === t ? "selected" : "")}>{t}</button>)}
    </div>
    <div className="swipe-levels" role="group" aria-label="Filter swipe lessons by difficulty">
      <span>Difficulty</span>
      {LEVELS.map(level => <button type="button" key={level}
        className={"swipe-level " + (difficulty === level ? "active" : "")}
        aria-pressed={difficulty === level}
        onClick={() => onDifficulty(level)}>{level}{level !== "All" && <small> · {POINTS[LEVELS.indexOf(level)]} pts</small>}</button>)}
    </div>

    {current ? <div className="swipe-display">
      <div className="swipe-stage-wrap">
        <div className="swipe-counter"><span>FOR YOU</span><span>{currentIndex + 1} / {lessons.length} LESSONS</span></div>
        <div className="swipe-stage" ref={surfaceRef}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          aria-label={current.title + ". Swipe up or down to browse."}>
          <Cover key={current.id} lesson={current} className="swipe-poster">
            <div className="swipe-card-top">
              <span className="swipe-original"><Sparkles size={13} /> A.R.I.S.E. ORIGINAL</span>
              <span className="swipe-lesson-time"><Clock3 size={14} /> {current.duration} MIN</span>
            </div>
            <div className="swipe-card-content">
              <div className="swipe-badges">
                <span className="swipe-category">{current.category}</span>
                <span className={"difficulty difficulty-" + current.level}>
                  {LEVEL_LABEL[current.level]} · {POINTS[current.level]} pts
                </span>
                {passed.includes(current.id) && <span className="swipe-passed"><CheckCircle2 size={13} /> Passed</span>}
              </div>
              <h2>{current.title}</h2>
              <div className="swipe-subject">{current.subject} · {current.skill}</div>
              <p>{current.hook}</p>
              <button type="button" className="swipe-start" onClick={() => onOpen(current)}>
                <Play size={18} fill="currentColor" /> {passed.includes(current.id) ? "Practice Again" : "Start Lesson"} <ArrowRight size={18} />
              </button>
            </div>
            <div className="swipe-action-rail">
              <button type="button" title={saved.includes(current.id) ? "Remove saved lesson" : "Save this lesson"}
                aria-label={saved.includes(current.id) ? "Remove saved lesson" : "Save this lesson"}
                aria-pressed={saved.includes(current.id)} onClick={() => onSave(current.id)}>
                <Bookmark size={21} fill={saved.includes(current.id) ? "currentColor" : "none"} />
                <small>{saved.includes(current.id) ? "Saved" : "Save"}</small>
              </button>
              <button type="button" title="Listen to lesson introduction" aria-label="Listen to lesson introduction"
                onClick={() => listenTo(current.title + ". " + current.hook)}>
                <Volume2 size={21} /><small>Listen</small>
              </button>
              <button type="button" aria-label="Previous lesson" title="Previous lesson" onClick={() => advance(-1)}>
                <ArrowUp size={23} /><small>Prev</small>
              </button>
              <button type="button" aria-label="Next lesson" title="Next lesson" onClick={() => advance(1)}>
                <ArrowDown size={23} /><small>Next</small>
              </button>
            </div>
          </Cover>
        </div>
        <p className="swipe-hint">Swipe up or down · Scroll on desktop · Use ↑ ↓ arrow keys</p>
      </div>

      <aside className="swipe-companion" aria-label="Reading journey and next lessons">
        <div className="swipe-side-card">
          <div className="swipe-side-eyebrow"><Trophy size={16} /> YOUR READING JOURNEY</div>
          <div className="swipe-side-points"><Star size={23} fill="currentColor"/> {points} <span>points</span></div>
          <div className="swipe-progress-head"><span>Lessons passed</span><strong>{completed} / {total}</strong></div>
          <div className="progress-track"><span style={{width:Math.round(completed / Math.max(total, 1) * 100) + "%"}} /></div>
          <p>Same scores and progress as Library View. No extra points for swiping.</p>
        </div>
        <div className="swipe-side-card">
          <div className="swipe-side-eyebrow"><BookOpen size={17}/> UP NEXT</div>
          <div className="swipe-next-list">{nextLessons.map((l,i) => <button key={l.id} type="button"
            onClick={() => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); onIndexChange(moveFeedIndex(currentIndex,i+1,lessons.length)) }}
            className="swipe-next">
            <span className="swipe-next-thumbnail" style={{background:"linear-gradient(125deg,"+l.accent+",#1a152b)"}}>{i+1}</span>
            <span><strong>{l.title}</strong><small>{l.category} · {LEVEL_LABEL[l.level]} · {POINTS[l.level]} pts</small></span>
            <ArrowRight size={16}/>
          </button>)}</div>
          {lessons.length === 1 && <p>You're viewing the only lesson in this filter.</p>}
        </div>
        <div className="swipe-safety"><Headphones size={17}/> A swipe discovers the next topic. Points come only from passing the real reading quiz.</div>
      </aside>
    </div> : <div className="empty swipe-empty">
      <BookOpen size={40}/>
      <h3>No lessons match this combination</h3>
      <p>Try a different topic or difficulty to keep exploring.</p>
      <button type="button" className="secondary-btn" onClick={() => { onTopic("All"); onDifficulty("All"); }}>Show All Lessons <ArrowLeft size={16}/></button>
    </div>}
  </section>;
}
