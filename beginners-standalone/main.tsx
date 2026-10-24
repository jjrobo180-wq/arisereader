import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft, ArrowRight, Award, Bookmark, BookOpen, Check, CheckCircle2,
  ChevronDown, ChevronRight, Clock3, Compass, Flame, Gift, GraduationCap,
  Headphones, LayoutGrid, LockKeyhole, LogOut, Menu, Search, Settings2,
  ShieldCheck, Sparkles, Star, Target, Trophy, UserRound, Volume2, X, Play, Grid3X3, type LucideIcon
} from "lucide-react";
import { BEGINNER_LESSONS, type BeginnerLesson } from "./lessons";
import SwipeFeed from "./SwipeFeed";
import "./styles.css";

type View = "home" | "lessons" | "swipe" | "saved" | "progress" | "leaderboard" | "rewards";
type Difficulty = 1 | 2 | 3;
type Profile = { id: string; name: string; createdAt: string };
type Attempt = { bestScore: number; lastScore: number; attempts: number; passedAt: string | null };
type LearnerProgress = {
  attempts: Record<string, Attempt>;
  saved: string[];
  theme: string;
  browseView?: "lessons" | "swipe";
};
type Outcome = {
  passed: boolean;
  score: number;
  earned: number;
  firstPass: boolean;
  review: { question: string; correctLabel: string; chosenLabel: string; hint: string; right: boolean }[];
};
const PROFILE_KEY = "arise-beginners-v2-profiles";
const ACTIVE_KEY = "arise-beginners-v2-active";
const PROGRESS_PREFIX = "arise-beginners-v2-progress-";
const DEFAULT_PROGRESS: LearnerProgress = {attempts:{},saved:[],theme:"reader",browseView:"lessons"};
const LESSONS: BeginnerLesson[] = BEGINNER_LESSONS;
const DIFFICULTY: Record<Difficulty, {label:string;points:number; color:string}> = {
  1:{label:"Easy",points:10,color:"#58d1ad"},
  2:{label:"Medium",points:20,color:"#f2bf5e"},
  3:{label:"Hard",points:30,color:"#ef8dbd"}
};
const THEMES = [
  {id:"reader",name:"Reader Classic",note:"Violet, fuchsia & cyan",swatch:["#a855f7","#e879f9","#38bdf8"]},
  {id:"midnight",name:"Midnight",note:"Blue-violet energy",swatch:["#6172fc","#737dfc","#a5b4fc"]},
  {id:"aurora",name:"Aurora",note:"Cyan & green glow",swatch:["#22d3ee","#34d399","#6ee7b7"]},
  {id:"sunset",name:"Sunset",note:"Rose & gold",swatch:["#fb7185","#fbbf24","#fdba74"]}
];
const TOPICS = ["All","Sports","Music","Creators","Gaming","Style","Culture"];
const COVER_URL = (file: string) => file ? "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + encodeURIComponent(file) + "?width=1000" : "";
const blankProgress = ():LearnerProgress=>({attempts:{},saved:[],theme:"reader",browseView:"lessons"});
function storageGet<T>(key:string,fallback:T):T {
  try { const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback; } catch {return fallback}
}
function storagePut(key:string,value:unknown) {try {localStorage.setItem(key,JSON.stringify(value));}catch{}}
function say(text:string) {
  if(!("speechSynthesis" in window))return;
  window.speechSynthesis.cancel();
  const speech=new SpeechSynthesisUtterance(text);
  speech.lang="en-US";speech.rate=.76;speech.pitch=1;window.speechSynthesis.speak(speech);
}
function stopSpeech(){if("speechSynthesis" in window)window.speechSynthesis.cancel()}
function displayName(name:string){return name.trim().replace(/\s+/g," ").slice(0,32)}
function LessonCover({lesson,children,className=""}:{lesson:BeginnerLesson;children?:React.ReactNode;className?:string}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[lesson.id]);
  return <div className={"lesson-cover "+className} style={{background:"radial-gradient(ellipse at 45% 25%,"+lesson.accent+" 0%,#322447 52%,#171323 100%)"}}>
    {!!lesson.imageFile&&!failed&&<img src={COVER_URL(lesson.imageFile)} alt={lesson.subject} loading="lazy" onError={()=>setFailed(true)}/>}
    <div className="cover-shade"/>
    {(!lesson.imageFile||failed)&&<div className="cover-fallback" aria-hidden="true"><BookOpen size={56}/></div>}
    {children}
  </div>
}
function Label({level}:{level:Difficulty}){return <span className={"difficulty difficulty-"+level}>{DIFFICULTY[level].label} · {DIFFICULTY[level].points} pts</span>}
function PanelTitle({eyebrow,title,sub,right}:{eyebrow?:string;title:string;sub?:string;right?:React.ReactNode}) {
  return <div className="panel-title"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{right}</div>
}
function App() {
  const [profiles,setProfiles]=useState<Profile[]>(()=>storageGet<Profile[]>(PROFILE_KEY,[]));
  const [activeId,setActiveId]=useState<string>(()=>{try{return localStorage.getItem(ACTIVE_KEY)||""}catch{return ""}});
  const profile=profiles.find(p=>p.id===activeId)||null;
  const [progress,setProgress]=useState<LearnerProgress>(()=>activeId?storageGet<LearnerProgress>(PROGRESS_PREFIX+activeId,blankProgress()):blankProgress());
  const [view,setView]=useState<View>("home");
  const [feedIndex,setFeedIndex]=useState(0);
  const [topic,setTopic]=useState("All");
  const [difficulty,setDifficulty]=useState("All");
  const [search,setSearch]=useState("");
  const [menuOpen,setMenuOpen]=useState(false);
  const [showProfileMenu,setShowProfileMenu]=useState(false);
  const [showTheme,setShowTheme]=useState(false);
  const [showNewProfile,setShowNewProfile]=useState(false);
  const [newName,setNewName]=useState("");
  const [entryError,setEntryError]=useState("");
  const [activeLesson,setActiveLesson]=useState<BeginnerLesson|null>(null);
  const [step,setStep]=useState(0);
  const [answers,setAnswers]=useState<number[]>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [outcome,setOutcome]=useState<Outcome|null>(null);
  const [notice,setNotice]=useState("");
  useEffect(()=>{storagePut(PROFILE_KEY,profiles)},[profiles]);
  useEffect(()=>{if(profile&&activeId){storagePut(PROGRESS_PREFIX+activeId,progress)}},[activeId,progress,profile?.id]);
  useEffect(()=>{if(!profile&&activeId){setActiveId("");try{localStorage.removeItem(ACTIVE_KEY)}catch{}}},[activeId,profile]);
  useEffect(()=>{document.body.style.overflow=activeLesson||showTheme?"hidden":"";return()=>{document.body.style.overflow=""}},[activeLesson,showTheme]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==="Escape"){if(activeLesson){closeLesson()}else if(showTheme){setShowTheme(false)}else{setMenuOpen(false);setShowProfileMenu(false)}}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)},[activeLesson,showTheme]);
  const passedIds=Object.keys(progress.attempts).filter(id=>!!progress.attempts[id]?.passedAt);
  const completed=passedIds.length;
  const points=LESSONS.reduce((sum,l)=>sum+(progress.attempts[l.id]?.passedAt?DIFFICULTY[l.level].points:0),0);
  const percent=Math.round(completed/Math.max(1,LESSONS.length)*100);
  const currentTheme=progress.theme||"reader";
  const visible=useMemo(()=>LESSONS.filter(l=>
    (topic==="All"||l.category===topic)&&
    (difficulty==="All"||DIFFICULTY[l.level].label===difficulty)&&
    (search.trim()===""||[l.title,l.skill,l.category,l.subject,l.hook].join(" ").toLowerCase().includes(search.trim().toLowerCase()))
  ),[topic,difficulty,search]);
  const recent=LESSONS.filter(l=>progress.attempts[l.id]&&!progress.attempts[l.id].passedAt).slice(0,4);
  const recommended=LESSONS.filter(l=>!progress.attempts[l.id]?.passedAt).slice(0,5);
  const saved=LESSONS.filter(l=>progress.saved.includes(l.id));
  const members=profiles.map(p=>{const data=p.id===activeId?progress:storageGet<LearnerProgress>(PROGRESS_PREFIX+p.id,blankProgress());return {...p,points:LESSONS.reduce((sum,l)=>sum+(data.attempts[l.id]?.passedAt?l.points:0),0),completed:LESSONS.filter(l=>data.attempts[l.id]?.passedAt).length}}).sort((a,b)=>b.points-a.points||b.completed-a.completed||a.name.localeCompare(b.name));
  function chooseProfile(p:Profile) {
    stopSpeech();setActiveId(p.id);
    setProgress(storageGet<LearnerProgress>(PROGRESS_PREFIX+p.id,blankProgress()));
    try{localStorage.setItem(ACTIVE_KEY,p.id)}catch{}
    setView("home");setFeedIndex(0);setShowNewProfile(false);setShowProfileMenu(false);setMenuOpen(false);setSearch("");setTopic("All");setDifficulty("All");
  }
  function addProfile(e:React.FormEvent) {
    e.preventDefault();const name=displayName(newName);
    if(name.length<2){setEntryError("Enter a nickname with at least 2 characters.");return}
    if(profiles.some(p=>p.name.toLowerCase()===name.toLowerCase())){setEntryError("That nickname already exists on this device. Choose it from the list.");return}
    const id=typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
    const p={id,name,createdAt:new Date().toISOString()};
    setProfiles(list=>[...list,p]);setProgress(blankProgress());setNewName("");setEntryError("");setShowNewProfile(false);
    setActiveId(id);try{localStorage.setItem(ACTIVE_KEY,id)}catch{}
    setView("home");
  }
  function show(v:View) {
    stopSpeech();
    setView(v);
    setMenuOpen(false);
    setShowProfileMenu(false);
    setTopic("All");
    setDifficulty("All");
    setFeedIndex(0);
    setSearch("");
    if (v === "lessons" || v === "swipe") setProgress(p=>({...p,browseView:v}));
    window.scrollTo({top:0,behavior:"smooth"});
  }
  // Switching layouts preserves category and difficulty filters and never changes
  // a lesson attempt or points. The preference belongs to this local learner profile.
  function switchBrowse(v:"lessons" | "swipe") {
    stopSpeech();
    setView(v);
    setFeedIndex(0);
    setSearch("");
    setProgress(p=>({...p,browseView:v}));
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function launch(l:BeginnerLesson){stopSpeech();setActiveLesson(l);setStep(0);setAnswers([]);setSelected(null);setOutcome(null);setNotice("")}
  function closeLesson(){stopSpeech();setActiveLesson(null);setSelected(null);setAnswers([]);setOutcome(null);setNotice("")}
  function toggleSaved(id:string){setProgress(p=>({...p,saved:p.saved.includes(id)?p.saved.filter(x=>x!==id):[...p.saved,id]}))}
  function goNext(){
    if(!activeLesson||outcome)return;
    const learnCount=activeLesson.slides.length;
    if(step<learnCount){setStep(v=>v+1);return}
    if(selected===null){setNotice("Choose an answer to continue.");return}
    const allAnswers=[...answers,selected];
    const last=allAnswers.length===activeLesson.questions.length;
    setSelected(null);setNotice("");setAnswers(allAnswers);
    if(!last){setStep(v=>v+1);return}
    const review=activeLesson.questions.map((q,i)=>({
      question:q.prompt,
      correctLabel:q.choices[q.correct],
      chosenLabel:q.choices[allAnswers[i]],
      hint:q.hint,right:q.correct===allAnswers[i]
    }));
    const correct=review.filter(r=>r.right).length;
    const score=Math.round(correct/activeLesson.questions.length*100);
    const passed=score>=80;
    const prior=progress.attempts[activeLesson.id];
    const firstPass=passed&&!prior?.passedAt;
    setProgress(p=>({...p,attempts:{
      ...p.attempts,
      [activeLesson.id]:{
        attempts:(p.attempts[activeLesson.id]?.attempts||0)+1,
        bestScore:Math.max(p.attempts[activeLesson.id]?.bestScore||0,score),
        lastScore:score,
        passedAt:p.attempts[activeLesson.id]?.passedAt||(passed?new Date().toISOString():null)
      }
    }}));
    setOutcome({passed,score,firstPass,earned:firstPass?activeLesson.points:0,review});
    setStep(learnCount+activeLesson.questions.length);
  }
  function tryAgain() {stopSpeech();setStep(0);setAnswers([]);setSelected(null);setOutcome(null);setNotice("")}
  const nav:Array<{id:View;title:string;icon:LucideIcon}>= [
    {id:"home",title:"Dashboard",icon:LayoutGrid},
    {id:"lessons",title:"Lesson Library",icon:BookOpen},
    {id:"swipe",title:"Swipe Feed",icon:Play},
    {id:"saved",title:"Saved Lessons",icon:Bookmark},
    {id:"progress",title:"My Progress",icon:Target},
    {id:"leaderboard",title:"Leaderboard",icon:Trophy},
    {id:"rewards",title:"My Rewards",icon:Gift}
  ];
  const feature=LESSONS.find(l=>!progress.attempts[l.id]?.passedAt)||LESSONS[0];
  if(!profile)return <div className="landing" data-theme="reader">
    <div className="landing-orbit orbit-one"/><div className="landing-orbit orbit-two"/>
    <div className="landing-top"><div className="brand-mark">A<span>✦</span></div><div className="brand-copy">A.R.I.S.E.<strong> BEGINNERS</strong></div></div>
    <section className="landing-panel">
      <div className="eyebrow purple">A NEW KIND OF READING PROGRAM</div>
      <h1>Start small.<br/><em>Rise big.</em></h1>
      <p>Real reading skills taught through lessons about sports, music, creators, gaming and the things students already love.</p>
      <div className="tier-row"><Label level={1}/><Label level={2}/><Label level={3}/></div>
      <div className="profile-entry">
        <h2>{profiles.length?"Choose your learner":"Create a learner profile"}</h2>
        {profiles.map(p=><button type="button" className="choose-profile" key={p.id} onClick={()=>chooseProfile(p)}><span className="avatar">{p.name.charAt(0).toUpperCase()}</span><span>{p.name}</span><ArrowRight size={18}/></button>)}
        <form onSubmit={addProfile}>
          <label htmlFor="nickname">Learner nickname</label>
          <div className="entry-row"><input id="nickname" autoComplete="off" maxLength={32} value={newName} onChange={e=>{setNewName(e.target.value);setEntryError("")}} placeholder="e.g., Star Reader" required/><button type="submit" className="primary-btn">Start Learning <ArrowRight size={18}/></button></div>
        </form>
        {entryError&&<p role="alert" className="form-error">{entryError}</p>}
        <p className="device-note"><LockKeyhole size={15}/> Separate from A.R.I.S.E. Reader. This starter version stores your nickname and progress only on this browser, not in an online account.</p>
      </div>
    </section>
  </div>;
  return <div className="app" data-theme={currentTheme}>
    <header className="site-header">
      <button type="button" className="mobile-menu icon-btn" aria-label="Open menu" onClick={()=>setMenuOpen(v=>!v)}><Menu size={22}/></button>
      <button type="button" className="brand" onClick={()=>show("home")} aria-label="Beginners dashboard"><span className="brand-mark">A<span>✦</span></span><span className="brand-copy">A.R.I.S.E. <strong>BEGINNERS</strong><small>READ · LEARN · RISE</small></span></button>
      <div className="header-links"><button className="header-link" onClick={()=>show("lessons")}>Lesson Library</button><button className="header-link" onClick={()=>show("swipe")}>Swipe Feed</button><button className="header-link" onClick={()=>show("leaderboard")}>Leaderboard</button></div>
      <div className="header-right">
        <div className="points-pill"><Star size={16} fill="currentColor"/><strong>{points}</strong><span>points</span></div>
        <button type="button" className="icon-btn" aria-label="Change theme" title="Change theme" onClick={()=>setShowTheme(true)}><Settings2 size={20}/></button>
        <div className="profile-wrap"><button type="button" className="profile-trigger" onClick={()=>setShowProfileMenu(v=>!v)} aria-expanded={showProfileMenu}><span className="avatar">{profile.name.charAt(0).toUpperCase()}</span><span className="profile-name">{profile.name}</span><ChevronDown size={15}/></button>
          {showProfileMenu&&<div className="profile-dropdown"><div className="dropdown-caption">LEARNERS ON THIS DEVICE</div>{profiles.map(p=><button key={p.id} type="button" className="profile-item" onClick={()=>chooseProfile(p)}><span className="avatar mini">{p.name.charAt(0).toUpperCase()}</span><span>{p.name}</span>{p.id===activeId&&<Check size={16}/>}</button>)}<button type="button" className="profile-item add" onClick={()=>{setShowNewProfile(true);setShowProfileMenu(false)}}><UserRound size={18}/> Add learner</button><button type="button" className="profile-item" onClick={()=>{setShowTheme(true);setShowProfileMenu(false)}}><Settings2 size={18}/> Theme settings</button></div>}
        </div>
      </div>
    </header>
    <div className="layout">
      <aside className={"sidebar "+(menuOpen?"open":"")}>
        <div className="nav-label">YOUR SPACE</div>
        {nav.map(n=><button type="button" key={n.id} onClick={()=>show(n.id)} className={"nav-item "+(view===n.id?"active":"")}><n.icon size={20}/><span>{n.title}</span>{view===n.id&&<span className="active-dot"/>}</button>)}
        <div className="sidebar-foot"><div className="sidebar-highlight"><div className="small-eyebrow">YOUR JOURNEY</div><div className="side-big">{completed}<span> / {LESSONS.length}</span></div><p>lessons completed</p><div className="progress-track"><span style={{width:percent+"%"}}/></div></div><div className="sidebar-note"><ShieldCheck size={16}/> Independent learning space. No Reader account or Reader points are connected.</div></div>
      </aside>
      <main className="main">
        {view==="home"&&<>
          <div className="greeting"><div><div className="eyebrow">WELCOME BACK</div><h1>Hey, {profile.name}! <span className="wave">✦</span></h1><p>Every new skill gets you closer to your next big reading win.</p></div><div className="greeting-badge"><Flame size={19}/> Keep growing</div></div>
          <div className="feature">
            <LessonCover lesson={feature} className="feature-art"/>
            <div className="feature-content"><div className="feature-kicker"><Sparkles size={15}/> YOUR NEXT LESSON</div><h2>{feature.title}</h2><p>{feature.hook}</p><div className="feature-meta"><Label level={feature.level}/><span><Clock3 size={15}/>{feature.duration} min</span></div><button className="primary-btn" onClick={()=>launch(feature)}><BookOpen size={18}/> Start Lesson <ArrowRight size={17}/></button></div>
          </div>
          <div className="browse-choice" aria-label="Choose your way to discover lessons"><div><div className="eyebrow">TWO WAYS TO EXPLORE</div><h2>How do you want to learn?</h2><p>Choose the classic A.R.I.S.E. lesson library or swipe through the very same lessons. Your scores and points stay together.</p></div><div className="browse-choice-actions"><button type="button" className={"browse-choice-btn "+(progress.browseView!=="swipe"?"preferred":"")} onClick={()=>show("lessons")}><Grid3X3 size={19}/><span><strong>Library View</strong><small>Explore all lesson covers</small></span><ArrowRight size={17}/></button><button type="button" className={"browse-choice-btn "+(progress.browseView==="swipe"?"preferred":"")} onClick={()=>show("swipe")}><Play size={18}/><span><strong>Swipe Feed</strong><small>Swipe to discover what’s next</small></span><ArrowRight size={17}/></button></div></div>
          <div className="stats-grid"><div className="stat"><span className="stat-icon purple-bg"><Star size={21}/></span><div><strong>{points}</strong><small>Total Points</small></div></div><div className="stat"><span className="stat-icon cyan-bg"><CheckCircle2 size={21}/></span><div><strong>{completed}</strong><small>Lessons Passed</small></div></div><div className="stat"><span className="stat-icon gold-bg"><Trophy size={21}/></span><div><strong>{Math.max(0,LESSONS.length-completed)}</strong><small>Lessons to Explore</small></div></div></div>
          {recent.length>0&&<section className="shelf"><PanelTitle eyebrow="KEEP IT GOING" title="Continue Practicing" sub="Build fluency at your own pace." right={<button className="text-link" onClick={()=>show("progress")}>My progress <ChevronRight size={17}/></button>}/><div className="shelf-row">{recent.map(l=><LessonCard key={l.id} lesson={l} done={!!progress.attempts[l.id]?.passedAt} saved={progress.saved.includes(l.id)} onOpen={()=>launch(l)} onSave={()=>toggleSaved(l.id)}/>)}</div></section>}
          <section className="shelf"><PanelTitle eyebrow="PICK YOUR VIBE" title="Lessons Made for You" sub="Real skills. Topics worth talking about." right={<button type="button" onClick={()=>show("lessons")} className="text-link">View all lessons <ChevronRight size={17}/></button>}/><div className="shelf-row">{recommended.map(l=><LessonCard key={l.id} lesson={l} done={!!progress.attempts[l.id]?.passedAt} saved={progress.saved.includes(l.id)} onOpen={()=>launch(l)} onSave={()=>toggleSaved(l.id)}/>)}</div></section>
          <section className="tiers"><div><div className="eyebrow">THE POINT SYSTEM</div><h2>Every level counts.</h2><p>Pass a lesson quiz with at least 80% to earn its points. Earn once per lesson, practice as often as you like.</p></div><div className="tier-blocks">{([1,2,3] as Difficulty[]).map(level=><button type="button" key={level} onClick={()=>{show("lessons");setDifficulty(DIFFICULTY[level].label)}} className={"tier-block tier-"+level}><span>{DIFFICULTY[level].label}</span><strong>+{DIFFICULTY[level].points}</strong><small>points</small></button>)}</div></section>
          <section className="shelf"><PanelTitle eyebrow="EXPLORE BY INTEREST" title="Choose your category" sub="Reading starts with a topic you actually care about."/><div className="categories">{TOPICS.slice(1).map((category,i)=><button key={category} type="button" onClick={()=>{show("lessons");setTopic(category)}} className={"category-tile category-"+i}><span>{["🏀","🎤","🎥","🎮","👟","🌎"][i]}</span><strong>{category}</strong><small>{LESSONS.filter(l=>l.category===category).length} lessons</small><ChevronRight size={17}/></button>)}</div></section>
        </>}
        {view==="lessons"&&<section className="browse"><PanelTitle eyebrow="A.R.I.S.E. BEGINNERS" title="Lesson Library" sub="Instead of books and book quizzes, every cover opens a reading lesson with its own five-question skill check." right={<div className="view-switcher" role="group" aria-label="Choose how to browse lessons"><button type="button" className="selected" aria-pressed={true}><Grid3X3 size={16}/> Library</button><button type="button" aria-pressed={false} onClick={()=>switchBrowse("swipe")}><Play size={15} fill="currentColor"/> Swipe Feed</button></div>}/>
          <div className="filter-bar"><div className="search-bar"><Search size={19}/><input aria-label="Search lessons" placeholder="Search athletes, artists, skills..." value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="Filter difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option>All</option><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
          <div className="topic-chips">{TOPICS.map(t=><button type="button" key={t} onClick={()=>setTopic(t)} className={"chip "+(topic===t?"selected":"")}>{t}</button>)}</div>
          <div className="result-caption">{visible.length} lessons found</div><div className="lesson-grid">{visible.map(l=><LessonCard key={l.id} lesson={l} done={!!progress.attempts[l.id]?.passedAt} saved={progress.saved.includes(l.id)} onOpen={()=>launch(l)} onSave={()=>toggleSaved(l.id)}/>)}</div>
          {!visible.length&&<div className="empty"><Search size={34}/><h3>No lessons found</h3><p>Try a different search or category.</p><button className="secondary-btn" onClick={()=>{setTopic("All");setDifficulty("All");setSearch("")}}>Clear filters</button></div>}
        </section>}
        {view==="swipe"&&<SwipeFeed
          lessons={visible}
          index={feedIndex}
          onIndexChange={setFeedIndex}
          saved={progress.saved}
          passed={passedIds}
          onOpen={launch}
          onSave={toggleSaved}
          onLibrary={()=>switchBrowse("lessons")}
          topic={topic}
          onTopic={v=>{setTopic(v);setFeedIndex(0)}}
          difficulty={difficulty}
          onDifficulty={v=>{setDifficulty(v);setFeedIndex(0)}}
          points={points}
          completed={completed}
          total={LESSONS.length}
          disabled={!!activeLesson||showTheme||showNewProfile}
          Cover={LessonCover}
        />}
        {view==="saved"&&<section><PanelTitle eyebrow="YOUR COLLECTION" title="Saved Lessons" sub="Bookmark anything that catches your eye. Your favorites stay here on this browser."/><div className="lesson-grid">{saved.map(l=><LessonCard key={l.id} lesson={l} done={!!progress.attempts[l.id]?.passedAt} saved onOpen={()=>launch(l)} onSave={()=>toggleSaved(l.id)}/>)}</div>{!saved.length&&<div className="empty"><Bookmark size={38}/><h3>Your collection is empty</h3><p>Hit the bookmark on any lesson to save it.</p><button className="primary-btn" onClick={()=>show("lessons")}>Explore Lessons <ArrowRight size={17}/></button></div>}</section>}
        {view==="progress"&&<section><PanelTitle eyebrow="KEEP LEVELING UP" title="My Reading Progress" sub="Look at your mastery by lesson, not a label or grade level."/><div className="stats-grid"><div className="stat"><span className="stat-icon purple-bg"><Star/></span><div><strong>{points}</strong><small>Points earned</small></div></div><div className="stat"><span className="stat-icon cyan-bg"><Award/></span><div><strong>{completed}</strong><small>Lesson passes</small></div></div><div className="stat"><span className="stat-icon gold-bg"><Target/></span><div><strong>{percent}%</strong><small>Catalog complete</small></div></div></div>
          <div className="progress-panel"><div className="progress-top"><strong>Your progress so far</strong><span>{completed} of {LESSONS.length} lessons</span></div><div className="progress-track big"><span style={{width:percent+"%"}}/></div><p>You'll earn each lesson's points once, the first time you pass its skill check with 80% or higher.</p></div>
          <div className="progress-list">{LESSONS.map(l=>{const attempt=progress.attempts[l.id];return <button key={l.id} type="button" onClick={()=>launch(l)} className="progress-row"><LessonCover lesson={l} className="progress-thumbnail"/><div className="progress-copy"><strong>{l.title}</strong><span>{l.skill} · {DIFFICULTY[l.level].label}</span>{attempt&&<small>{attempt.attempts} {attempt.attempts===1?"attempt":"attempts"} · best {attempt.bestScore}%</small>}</div><span className={"progress-status "+(attempt?.passedAt?"complete":"")}>{attempt?.passedAt?<><Check size={15}/> Passed</>:attempt?"Practice again":"Start"} <ChevronRight size={16}/></span></button>})}</div>
          <p className="small-disclaimer">Completing lessons does not by itself measure oral reading fluency, decoding speed or a student's reading grade level. Use regular individual reading assessments alongside the program.</p>
        </section>}
        {view==="leaderboard"&&<section><PanelTitle eyebrow="A LITTLE FRIENDLY MOTIVATION" title="Leaderboard" sub="Local leaderboard for learner profiles saved on this browser only."/>
          <div className="leaderboard-note"><ShieldCheck size={19}/> This leaderboard is not public, schoolwide, or connected to A.R.I.S.E. Reader. Students on other devices do not appear here.</div>
          <div className="rank-board">{members.map((p,i)=><div key={p.id} className={"rank-row "+(p.id===activeId?"your-rank":"")}><span className="rank-pos">{i===0?"🏆":"#"+(i+1)}</span><span className="avatar">{p.name.charAt(0).toUpperCase()}</span><div><strong>{p.name}{p.id===activeId?" · You":""}</strong><small>{p.completed} lessons passed</small></div><span className="rank-points"><Star size={16} fill="currentColor"/> {p.points} pts</span></div>)}</div>
        </section>}
        {view==="rewards"&&<section><PanelTitle eyebrow="LEARN AND EARN" title="My Rewards" sub="Track points earned from real reading work."/><div className="reward-hero"><div><div className="eyebrow">YOUR BEGINNERS BALANCE</div><strong>{points} <span>points</span></strong><p>Points here are separate from all other A.R.I.S.E. programs.</p></div><Trophy size={72}/></div><div className="reward-grid">{[{icon:"🍿",name:"Snack target",amount:50},{icon:"🍟",name:"Snack pack target",amount:100},{icon:"🎁",name:"Gift card target",amount:300}].map(r=><div className="reward-card" key={r.name}><div className="reward-icon">{r.icon}</div><h3>{r.name}</h3><p>{r.amount} points · suggested class target</p><div className="progress-track"><span style={{width:Math.min(100,Math.round(points/r.amount*100))+"%"}}/></div><small>{points>=r.amount?"Point goal reached":"Earn "+(r.amount-points)+" more points"}</small></div>)}</div><div className="leaderboard-note"><ShieldCheck size={19}/> These are example targets, not orders or actual prizes. Redemption is disabled; a teacher or guardian controls any real-world rewards. Browser points aren't verified for real rewards.</div></section>}
      </main>
    </div>
    <nav className="mobile-bottom" aria-label="Bottom menu">{[nav[0],nav[1],nav[2],nav[4],nav[3]].map(n=><button key={n.id} type="button" onClick={()=>show(n.id)} className={view===n.id?"active":""}><n.icon size={20}/><span>{n.id==="home"?"Home":n.id==="lessons"?"Library":n.id==="swipe"?"Swipe":n.id==="progress"?"Progress":"Saved"}</span></button>)}</nav>
    {showTheme&&<div className="overlay" role="dialog" aria-modal="true" aria-label="Choose a theme"><div className="theme-modal"><div className="modal-top"><div><div className="eyebrow">MAKE IT YOURS</div><h2>Choose your A.R.I.S.E. theme</h2></div><button className="icon-btn" type="button" onClick={()=>setShowTheme(false)} aria-label="Close theme settings"><X size={22}/></button></div><p className="modal-sub">Inspired by Reader's deep plum and neon accent palette. This preference stays with your local Beginners profile.</p><div className="theme-grid">{THEMES.map(t=><button key={t.id} type="button" onClick={()=>setProgress(p=>({...p,theme:t.id}))} className={"theme-tile "+(currentTheme===t.id?"chosen":"")}><span className="theme-swatches">{t.swatch.map(c=><i key={c} style={{background:c}}/>)}</span><strong>{t.name}</strong><small>{t.note}</small>{currentTheme===t.id&&<span className="theme-check"><Check size={15}/></span>}</button>)}</div><button type="button" className="primary-btn theme-done" onClick={()=>setShowTheme(false)}>Done <Check size={17}/></button></div></div>}
    {showNewProfile&&<div className="overlay" role="dialog" aria-modal="true" aria-label="Add a learner"><div className="theme-modal narrow"><div className="modal-top"><h2>Add learner on this device</h2><button className="icon-btn" onClick={()=>setShowNewProfile(false)} aria-label="Close"><X/></button></div><p className="modal-sub">This creates a separate local Beginners progress record, not an A.R.I.S.E. Reader account.</p><form onSubmit={addProfile} className="add-profile-form"><label htmlFor="another-name">Nickname</label><input id="another-name" maxLength={32} value={newName} onChange={e=>{setNewName(e.target.value);setEntryError("")}} placeholder="Learner nickname" autoFocus required/>{entryError&&<p className="form-error" role="alert">{entryError}</p>}<button type="submit" className="primary-btn">Add Learner <ArrowRight size={16}/></button></form></div></div>}
    {activeLesson&&<div className="lesson-overlay" role="dialog" aria-modal="true" aria-label={activeLesson.title}>
      <div className="lesson-frame">
        <div className="lesson-head"><button type="button" onClick={closeLesson} className="back-btn"><ArrowLeft size={18}/> Exit Lesson</button><div className="lesson-head-title"><strong>{activeLesson.title}</strong><span>{DIFFICULTY[activeLesson.level].label} · {activeLesson.points} points</span></div><button type="button" aria-label="Close" className="icon-btn" onClick={closeLesson}><X size={22}/></button></div>
        <div className="lesson-progress"><span style={{width:outcome?"100%":Math.round(step/(activeLesson.slides.length+activeLesson.questions.length)*100)+"%"}}/></div>
        <div className="lesson-body">
          {outcome?<div className="finish-screen"><div className="finish-icon">{outcome.passed?"🏆":"💪"}</div><div className="eyebrow">{outcome.passed?"LESSON PASSED":"KEEP PRACTICING"}</div><h1>{outcome.passed?"You earned that win!":"Let's build it together."}</h1><div className="score-circle">{outcome.score}<span>%</span></div><p className="finish-description">{outcome.passed?"You demonstrated these reading skills on the lesson check.": "Read through the lesson again and go for 80% or higher."}</p><div className="earn-note">{outcome.firstPass?"+"+outcome.earned+" Beginners points earned":outcome.passed?"Points for this lesson were already earned.":"You can retry for the full "+activeLesson.points+" points."}</div><div className="review"><h3>Answer review</h3>{outcome.review.map((r,i)=><div key={i} className={"review-item "+(r.right?"right":"wrong")}><span>{r.right?<CheckCircle2 size={19}/>:<Target size={19}/>}</span><div><strong>{i+1}. {r.question}</strong><p>{r.right?"You got it.":"Your answer: "+r.chosenLabel+" · Correct: "+r.correctLabel}</p>{!r.right&&<small>{r.hint}</small>}</div></div>)}</div><div className="finish-actions"><button type="button" className="secondary-btn" onClick={tryAgain}><ArrowLeft size={17}/> Practice again</button><button type="button" className="primary-btn" onClick={closeLesson}>Back to Library <ArrowRight size={17}/></button></div></div>
          :step<activeLesson.slides.length?<div className="teach-screen"><div className="lesson-step-label"><span>LEARN IT</span> · Part {step+1} of {activeLesson.slides.length}</div><h1>{activeLesson.slides[step].heading}</h1><div className="lesson-passage">{activeLesson.slides[step].text}</div><button type="button" className="speak-btn" onClick={()=>say(activeLesson.slides[step].text)}><Volume2 size={18}/> Listen to passage</button><div className="word-panel"><div className="word-panel-head"><Headphones size={18}/> LET'S PRACTICE THESE WORDS</div><div className="word-list">{activeLesson.slides[step].focus.map(word=><button key={word} type="button" onClick={()=>say(word)}>{word}<Volume2 size={13}/></button>)}</div><p>{activeLesson.slides[step].instruction}</p></div><div className="lesson-note"><Sparkles size={16}/> Real skill practice before every quiz, built around subjects students already know.</div></div>
          :<div className="test-screen"><div className="lesson-step-label"><span>SKILL CHECK</span> · Question {step-activeLesson.slides.length+1} of {activeLesson.questions.length}</div><h1>{activeLesson.questions[step-activeLesson.slides.length].prompt}</h1><button type="button" className="speak-btn" onClick={()=>say(activeLesson.questions[step-activeLesson.slides.length].prompt)}><Volume2 size={18}/> Hear the question</button><div className="options">{activeLesson.questions[step-activeLesson.slides.length].choices.map((option,i)=><button key={i} type="button" onClick={()=>{setSelected(i);setNotice("")}} className={"option "+(selected===i?"selected":"")}><span>{String.fromCharCode(65+i)}</span><strong>{option}</strong>{selected===i&&<CheckCircle2 size={18}/>}</button>)}</div>{notice&&<div role="alert" className="inline-error">{notice}</div>}</div>}
        </div>
        {!outcome&&<footer className="lesson-footer"><div className="lesson-footer-note">{step<activeLesson.slides.length?"Take your time. Practice before your check.":"Score 80% or higher to earn your lesson points."}</div><button type="button" className="primary-btn" onClick={goNext}>{step===activeLesson.slides.length+activeLesson.questions.length-1?"Finish Lesson":step===activeLesson.slides.length-1?"Start Skill Check":"Continue"} <ArrowRight size={18}/></button></footer>}
      </div>
    </div>}
  </div>
}
function LessonCard({lesson,done,saved,onOpen,onSave}:{lesson:BeginnerLesson;done:boolean;saved:boolean;onOpen:()=>void;onSave:()=>void}) {
  return <article className="lesson-card"><div className="card-cover-wrap"><button type="button" className="cover-button" onClick={onOpen} aria-label={"Start "+lesson.title}><LessonCover lesson={lesson} className="card-cover"><div className="cover-top"><span className="subject-chip">{lesson.category}</span>{done&&<span className="complete-chip"><Check size={13}/> Passed</span>}</div><div className="cover-bottom"><span className="cover-lesson-tag">A.R.I.S.E. ORIGINAL LESSON</span><strong>{lesson.title}</strong></div></LessonCover></button><button type="button" className={"save-button "+(saved?"saved":"")} onClick={onSave} title={saved?"Remove bookmark":"Save lesson"} aria-label={saved?"Remove bookmark":"Save lesson"}><Bookmark size={17} fill={saved?"currentColor":"none"}/></button></div><div className="card-bottom"><div className="skill-line">{lesson.skill}</div><div className="card-meta"><Label level={lesson.level}/><span><Clock3 size={14}/>{lesson.duration}m</span></div><button type="button" className="card-action" onClick={onOpen}>{done?"Practice Again":"Start Lesson"} <ArrowRight size={16}/></button></div></article>
}
createRoot(document.getElementById("root")!).render(<App/>);
