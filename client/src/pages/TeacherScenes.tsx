import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Copy, Image as ImageIcon,
  Maximize2, MonitorPlay, MousePointer2, Send, Sparkles, Trash2, Users,
  WandSparkles, X, CheckCircle2, CircleHelp
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type SceneLabel = { name: string; x: number; y: number };
type SceneQuestion = { id: string; prompt: string; options: string[]; correct: "A"|"B"|"C"|"D" };
type Scene = {
  id: string; bookTitle: string; author?: string; chapterStart: number; chapterEnd: number;
  characters: string[]; sceneNotes: string; style: string; imagePath: string; imageUrl?: string|null;
  labelCharacters?: boolean; characterLabels?: SceneLabel[]; questions?: SceneQuestion[]; createdAt: string;
};
type LiveResponse = { studentId: number; studentName: string; choice: string; submittedAt: string };
type LiveQuestion = { id: string; prompt: string; options: string[]; correct?: string };
type LiveSession = {
  id: string; code: string; teacherName: string; status: "live"|"ended"; viewerCount: number; updatedAt: string;
  scene?: Scene|null; currentQuestion?: LiveQuestion|null; responses?: LiveResponse[];
};

function getTokenFromCookie(): string | null {
  try {
    for (const cookie of document.cookie.split(";")) {
      const value = cookie.trim();
      if (!value.startsWith("arise_session=")) continue;
      const data = JSON.parse(atob(value.substring("arise_session=".length)));
      return data.token || null;
    }
  } catch {}
  return null;
}

function SceneImage({ scene, className = "" }: { scene: Scene; className?: string }) {
  return (
    <div className={"relative inline-block max-w-full " + className}>
      {scene.imageUrl ? <img src={scene.imageUrl} alt={scene.bookTitle + " visual Scene"} className="block max-h-full max-w-full object-contain" /> : null}
      {(scene.characterLabels || []).map((label, index) => (
        <div key={label.name + index} className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full" style={{ left: label.x + "%", top: label.y + "%" }}>
          <div className="rounded-full border-2 border-white bg-black/85 px-3 py-1 text-xs font-black text-white shadow-xl sm:text-sm">{label.name}</div>
          <div className="mx-auto h-3 w-0.5 bg-white shadow" />
        </div>
      ))}
    </div>
  );
}

export default function TeacherScenes() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [scenes,setScenes]=useState<Scene[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [bookTitle,setBookTitle]=useState(""); const [author,setAuthor]=useState("");
  const [chapterStart,setChapterStart]=useState(1); const [chapterEnd,setChapterEnd]=useState(3);
  const [characters,setCharacters]=useState(""); const [sceneNotes,setSceneNotes]=useState("");
  const [style,setStyle]=useState("cinematic illustrated"); const [labelCharacters,setLabelCharacters]=useState(true);
  const [makeQuestions,setMakeQuestions]=useState(false); const [questionCount,setQuestionCount]=useState(1);
  const [loading,setLoading]=useState(true); const [generating,setGenerating]=useState(false);
  const [questionBusy,setQuestionBusy]=useState(false); const [presenterOpen,setPresenterOpen]=useState(false);
  const [liveSession,setLiveSession]=useState<LiveSession|null>(null); const [liveBusy,setLiveBusy]=useState(false);
  const [sendBusy,setSendBusy]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("");
  const [labelEditorOpen,setLabelEditorOpen]=useState(false); const [labelDraft,setLabelDraft]=useState<SceneLabel[]>([]);
  const [labelName,setLabelName]=useState("");

  const authorized=!!user&&(user.role==="teacher"||user.isAdmin);
  const selected=useMemo(()=>scenes.find(s=>s.id===selectedId)||scenes[0]||null,[scenes,selectedId]);
  const selectedIndex=useMemo(()=>selected?scenes.findIndex(s=>s.id===selected.id):-1,[scenes,selected]);

  const request=async(path:string,options:RequestInit={})=>{
    const token=getTokenFromCookie();
    const response=await fetch(`${API_BASE}${path}`,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}),...options.headers},cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message||"Something went wrong.");
    return data;
  };

  const loadScenes=async()=>{
    setLoading(true); setError("");
    try{
      const data=await request("/api/teacher/scenes");
      const items=Array.isArray(data?.scenes)?data.scenes:[];
      setScenes(items); setSelectedId(current=>current||items[0]?.id||null);
    }catch(err){setError(err instanceof Error?err.message:"Could not load Scenes.");}
    finally{setLoading(false);}
  };

  useEffect(()=>{if(!user)return;if(!authorized){navigate("/library");return;}void loadScenes();},[user?.id,authorized]);
  useEffect(()=>{if(!presenterOpen&&!labelEditorOpen)return;const old=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=old;};},[presenterOpen,labelEditorOpen]);
  useEffect(()=>{
    if(!liveSession?.code||liveSession.status!=="live")return;
    const refresh=async()=>{try{setLiveSession(await request(`/api/scenes/live/${liveSession.code}`));}catch{}};
    const timer=window.setInterval(refresh,1100); return()=>window.clearInterval(timer);
  },[liveSession?.code,liveSession?.status]);

  const mergeScene=(scene:Scene)=>setScenes(current=>[scene,...current.filter(item=>item.id!==scene.id)]);

  const generateQuestions=async(scene:Scene,count=questionCount)=>{
    setQuestionBusy(true);
    try{
      const data=await request(`/api/teacher/scenes/${scene.id}/questions/generate`,{method:"POST",body:JSON.stringify({count})});
      mergeScene(data.scene); setSelectedId(data.scene.id);
      setMessage(`${data.questions?.length||count} interactive question${(data.questions?.length||count)===1?"":"s"} added to this Scene.`);
      return data.scene as Scene;
    }catch(err){setError(err instanceof Error?err.message:"Could not generate questions.");return scene;}
    finally{setQuestionBusy(false);}
  };

  const openLabelEditor=(scene:Scene)=>{
    setSelectedId(scene.id); setLabelDraft(scene.characterLabels||[]); setLabelName(scene.characters?.[0]||""); setLabelEditorOpen(true);
  };

  const saveLabels=async()=>{
    if(!selected)return;
    try{
      const data=await request(`/api/teacher/scenes/${selected.id}/labels`,{method:"POST",body:JSON.stringify({labels:labelDraft})});
      mergeScene(data.scene); setSelectedId(data.scene.id); setLabelEditorOpen(false);
      setMessage("Character labels saved. They will appear in Present mode and on student screens.");
    }catch(err){setError(err instanceof Error?err.message:"Could not save labels.");}
  };

  const placeLabel=(event:React.MouseEvent<HTMLDivElement>)=>{
    if(!labelName)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const x=((event.clientX-rect.left)/rect.width)*100;
    const y=((event.clientY-rect.top)/rect.height)*100;
    setLabelDraft(current=>[...current.filter(l=>l.name!==labelName),{name:labelName,x,y}]);
  };

  const generate=async(event:React.FormEvent)=>{
    event.preventDefault(); setError(""); setMessage("");
    const start=Math.max(1,Math.floor(Number(chapterStart)||1)); const end=Math.max(start,Math.floor(Number(chapterEnd)||start));
    if(!bookTitle.trim())return setError("Add the book title.");
    if(end-start>2)return setError("One panorama can cover up to 3 chapters.");
    if(sceneNotes.trim().length<20)return setError("Add a short description of what students should see.");
    setGenerating(true);
    try{
      const data=await request("/api/teacher/scenes/generate",{method:"POST",body:JSON.stringify({
        bookTitle:bookTitle.trim(),author:author.trim(),chapterStart:start,chapterEnd:end,
        characters:characters.split(",").map(n=>n.trim()).filter(Boolean).slice(0,12),
        sceneNotes:sceneNotes.trim(),style,labelCharacters
      })});
      let scene=data.scene as Scene; mergeScene(scene); setSelectedId(scene.id);
      if(makeQuestions) scene=await generateQuestions(scene,questionCount);
      if(labelCharacters&&scene.characters?.length) {
        setLabelDraft(scene.characterLabels||[]); setLabelName(scene.characters[0]); setLabelEditorOpen(true);
        setMessage("Scene ready. Tap each character in the picture to place their name label.");
      } else {
        setMessage(data.reused?"That exact Scene already existed, so A.R.I.S.E. reused it.":"Scene generated once and saved.");
      }
    }catch(err){setError(err instanceof Error?err.message:"Could not generate this Scene.");}
    finally{setGenerating(false);}
  };

  const removeScene=async(scene:Scene)=>{
    if(!window.confirm(`Delete ${scene.bookTitle}, Chapters ${scene.chapterStart}-${scene.chapterEnd}?`))return;
    try{await request(`/api/teacher/scenes/${scene.id}`,{method:"DELETE"});setScenes(c=>c.filter(i=>i.id!==scene.id));if(selectedId===scene.id)setSelectedId(null);}
    catch(err){setError(err instanceof Error?err.message:"Could not delete this Scene.");}
  };

  const changePresentedScene=async(scene:Scene)=>{
    setSelectedId(scene.id);
    if(!liveSession?.code||liveSession.status!=="live")return;
    try{setLiveSession(await request(`/api/teacher/scenes/live/${liveSession.code}/select`,{method:"POST",body:JSON.stringify({sceneId:scene.id})}));}
    catch(err){setError(err instanceof Error?err.message:"Students could not follow that Scene change.");}
  };
  const previousScene=()=>{if(scenes.length&&selectedIndex>=0)void changePresentedScene(scenes[(selectedIndex-1+scenes.length)%scenes.length]);};
  const nextScene=()=>{if(scenes.length&&selectedIndex>=0)void changePresentedScene(scenes[(selectedIndex+1)%scenes.length]);};

  const startLive=async()=>{
    if(!selected)return; setLiveBusy(true); setError("");
    try{setLiveSession(await request("/api/teacher/scenes/live/start",{method:"POST",body:JSON.stringify({sceneId:selected.id})}));setMessage("Live Scene started.");}
    catch(err){setError(err instanceof Error?err.message:"Could not start the live Scene.");}finally{setLiveBusy(false);}
  };
  const endLive=async()=>{if(!liveSession?.code)return;setLiveBusy(true);try{await request(`/api/teacher/scenes/live/${liveSession.code}/end`,{method:"POST"});setLiveSession(c=>c?{...c,status:"ended"}:c);}catch(err){setError(err instanceof Error?err.message:"Could not end live.");}finally{setLiveBusy(false);}};
  const copyStudentLink=async()=>{if(!liveSession?.code)return;try{await navigator.clipboard.writeText(`${window.location.origin}/#/scene-live?code=${liveSession.code}`);setMessage("Student join link copied.");}catch{setError("Could not copy link.");}};
  const sendToClass=async()=>{if(!liveSession?.code)return;setSendBusy(true);try{const d=await request(`/api/teacher/scenes/live/${liveSession.code}/send`,{method:"POST",body:"{}"});setMessage(`Sent to ${d.sent||0} students.`);}catch(err){setError(err instanceof Error?err.message:"Could not send.");}finally{setSendBusy(false);}};

  const launchQuestion=async(questionId:string|null)=>{
    if(!liveSession?.code)return setError("Start live for students first.");
    try{setLiveSession(await request(`/api/teacher/scenes/live/${liveSession.code}/question`,{method:"POST",body:JSON.stringify({questionId})}));}
    catch(err){setError(err instanceof Error?err.message:"Could not launch question.");}
  };

  const goFullscreen=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();}catch{}};

  if(!user||!authorized)return null;

  const currentQuestions=selected?.questions||[];
  const activeQ=liveSession?.currentQuestion;
  const responses=liveSession?.responses||[];

  return <main className="min-h-screen bg-[#090914] text-white">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
        <button onClick={()=>navigate("/teacher-dashboard")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 font-bold"><ArrowLeft size={18}/>Teacher Dashboard</button>
        <div className="text-center"><div className="text-xs font-black uppercase tracking-[.24em] text-cyan-300">Teacher only</div><h1 className="m-0 text-3xl font-black sm:text-4xl">A.R.I.S.E. Scenes</h1><p className="mt-1 text-sm text-slate-400">Visualize the story, label characters, and check understanding live.</p></div>
        <div className="hidden w-[178px] lg:block"/>
      </header>

      {error&&<div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 font-semibold text-red-200">{error}</div>}
      {message&&<div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-200">{message}</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        <form onSubmit={generate} className="rounded-3xl border border-white/10 bg-white/[.045] p-5">
          <div className="mb-5 flex items-center gap-2"><WandSparkles className="text-fuchsia-300" size={20}/><h2 className="m-0 text-xl font-black">Create a Scene</h2></div>
          <label className="mb-4 block"><span className="mb-1.5 block text-sm font-bold text-slate-300">Book title *</span><input value={bookTitle} onChange={e=>setBookTitle(e.target.value)} maxLength={120} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3"/></label>
          <label className="mb-4 block"><span className="mb-1.5 block text-sm font-bold text-slate-300">Author</span><input value={author} onChange={e=>setAuthor(e.target.value)} maxLength={100} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3"/></label>
          <div className="mb-4 grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-sm font-bold text-slate-300">From chapter</span><input type="number" min={1} value={chapterStart} onChange={e=>setChapterStart(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3"/></label><label><span className="mb-1.5 block text-sm font-bold text-slate-300">To chapter</span><input type="number" min={1} value={chapterEnd} onChange={e=>setChapterEnd(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3"/></label></div>
          <label className="mb-4 block"><span className="mb-1.5 block text-sm font-bold text-slate-300">Characters</span><input value={characters} onChange={e=>setCharacters(e.target.value)} placeholder="Sierra, Robbie, Grandpa Lázaro" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3"/><span className="mt-1 block text-xs text-slate-500">Separate names with commas.</span></label>
          <label className="mb-4 block"><span className="mb-1.5 block text-sm font-bold text-slate-300">What should students see? *</span><textarea value={sceneNotes} onChange={e=>setSceneNotes(e.target.value)} maxLength={2200} rows={7} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3"/></label>
          <label className="mb-4 block"><span className="mb-1.5 block text-sm font-bold text-slate-300">Look</span><select value={style} onChange={e=>setStyle(e.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#151526] px-3"><option value="cinematic illustrated">Cinematic illustrated</option><option value="graphic novel">Graphic novel</option><option value="warm storybook">Warm storybook</option><option value="semi-realistic classroom visual">Semi-realistic</option></select></label>

          <label className="mb-3 flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3"><input type="checkbox" checked={labelCharacters} onChange={e=>setLabelCharacters(e.target.checked)} className="h-5 w-5 accent-cyan-300"/><span className="text-sm font-bold">Put character name labels on the people</span></label>

          <div className="mb-5 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
            <div className="mb-2 flex items-center gap-2"><CircleHelp size={18} className="text-violet-300"/><span className="font-black">Make this Scene interactive?</span></div>
            <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={makeQuestions} onChange={e=>setMakeQuestions(e.target.checked)} className="h-5 w-5 accent-violet-400"/>Generate live comprehension question(s)</label>
            {makeQuestions&&<label className="mt-3 block text-sm"><span className="mb-1 block font-bold text-slate-300">How many?</span><select value={questionCount} onChange={e=>setQuestionCount(Number(e.target.value))} className="min-h-10 w-full rounded-xl border border-white/10 bg-[#151526] px-3">{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} question{n===1?"":"s"}</option>)}</select></label>}
          </div>

          <button disabled={generating||questionBusy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-4 font-black disabled:opacity-60"><ImageIcon size={20}/>{generating?"Creating panorama...":questionBusy?"Creating questions...":"Generate & save panorama"}</button>
        </form>

        <section className="min-w-0">
          <div className="flex items-end justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.22em] text-violet-300">Saved library</div><h2 className="m-0 mt-1 text-2xl font-black">Your Scenes</h2></div><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold">{scenes.length} saved</span></div>
          {loading?<div className="mt-5 rounded-3xl border border-white/10 bg-white/[.04] p-10 text-center text-slate-400">Loading Scenes...</div>:scenes.length===0?<div className="mt-5 rounded-3xl border border-dashed border-white/15 p-10 text-center"><BookOpen className="mx-auto text-cyan-300"/><h3 className="mt-4 text-xl font-black">No scenes yet</h3></div>:<>
            {selected&&<div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div><h3 className="m-0 text-lg font-black">{selected.bookTitle}</h3><p className="m-0 mt-1 text-sm text-slate-400">Ch. {selected.chapterStart}{selected.chapterEnd!==selected.chapterStart?`–${selected.chapterEnd}`:""} • {(selected.questions||[]).length} live question{(selected.questions||[]).length===1?"":"s"}</p></div>
                <div className="flex flex-wrap gap-2">
                  {!!selected.characters?.length&&<button onClick={()=>openLabelEditor(selected)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 font-black"><MousePointer2 size={17}/>Label people</button>}
                  <button disabled={questionBusy} onClick={()=>void generateQuestions(selected,1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 font-black text-violet-200"><CircleHelp size={17}/>Add question</button>
                  <button onClick={()=>setPresenterOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 font-black text-slate-950"><MonitorPlay size={18}/>Present</button>
                  <button onClick={()=>void removeScene(selected)} className="grid h-11 w-11 place-items-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-200"><Trash2 size={18}/></button>
                </div>
              </div>
              <div className="flex justify-center overflow-auto bg-black/50 p-2"><SceneImage scene={selected}/></div>
            </div>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{scenes.map(scene=><button key={scene.id} onClick={()=>setSelectedId(scene.id)} className={`overflow-hidden rounded-2xl border text-left ${selected?.id===scene.id?"border-cyan-300/60 bg-cyan-300/10":"border-white/10 bg-white/[.04]"}`}>{scene.imageUrl&&<img src={scene.imageUrl} alt="" className="aspect-[2/1] w-full object-cover"/>}<div className="p-3"><div className="font-black">{scene.bookTitle}</div><div className="mt-1 text-sm text-slate-400">Ch. {scene.chapterStart}{scene.chapterEnd!==scene.chapterStart?`–${scene.chapterEnd}`:""} • {(scene.questions||[]).length} Q</div></div></button>)}</div>
          </>}
        </section>
      </div>
    </div>

    {labelEditorOpen&&selected&&<div className="fixed inset-0 z-[380] flex flex-col bg-[#05050a] p-3 text-white sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#10101a]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div><div className="text-xs font-black uppercase tracking-widest text-cyan-300">Character labels</div><h2 className="m-0 text-xl font-black">Choose a name, then tap that person</h2></div><button onClick={()=>setLabelEditorOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/5"><X/></button></div>
        <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">{selected.characters.map(name=><button key={name} onClick={()=>setLabelName(name)} className={`rounded-full px-4 py-2 text-sm font-black ${labelName===name?"bg-cyan-300 text-slate-950":"bg-white/10"}`}>{name}{labelDraft.some(l=>l.name===name)?" ✓":""}</button>)}<button onClick={()=>setLabelDraft([])} className="rounded-full border border-red-400/30 px-4 py-2 text-sm font-black text-red-200">Clear all</button></div>
        <div className="min-h-0 flex-1 overflow-auto bg-black p-3">
          {selected.imageUrl&&<div onClick={placeLabel} className="relative mx-auto inline-block cursor-crosshair"><img src={selected.imageUrl} alt="" className="block max-h-[68vh] max-w-full"/>{labelDraft.map((label,i)=><div key={label.name+i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{left:label.x+"%",top:label.y+"%"}}><div className="rounded-full border-2 border-white bg-black/90 px-3 py-1 text-sm font-black">{label.name}</div><div className="mx-auto h-3 w-0.5 bg-white"/></div>)}</div>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4"><span className="text-sm text-slate-400">{labelDraft.length} of {selected.characters.length} characters placed</span><button onClick={()=>void saveLabels()} className="min-h-11 rounded-xl bg-cyan-300 px-5 font-black text-slate-950">Save labels</button></div>
      </div>
    </div>}

    {presenterOpen&&selected&&<div className="fixed inset-0 z-[350] flex flex-col bg-[#05050a] text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-3"><div><div className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">A.R.I.S.E. Scene Presenter</div><div className="text-xl font-black">{selected.bookTitle}</div><div className="text-xs text-slate-400">Ch. {selected.chapterStart}{selected.chapterEnd!==selected.chapterStart?`–${selected.chapterEnd}`:""}</div></div>
        <div className="flex flex-wrap items-center gap-2">{liveSession?.status==="live"?<><div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-center"><div className="text-[9px] font-black uppercase text-emerald-300">Student code</div><div className="text-xl font-black tracking-[.2em]">{liveSession.code}</div></div><div className="rounded-xl bg-white/5 px-3 py-2 text-sm font-black"><Users className="mr-1 inline" size={17}/>{liveSession.viewerCount||0}</div><button onClick={()=>void copyStudentLink()} className="h-11 rounded-xl bg-white/5 px-3 font-black"><Copy className="mr-1 inline" size={17}/>Copy</button><button disabled={sendBusy} onClick={()=>void sendToClass()} className="h-11 rounded-xl bg-violet-500 px-3 font-black"><Send className="mr-1 inline" size={17}/>Send to class</button><button onClick={()=>void endLive()} className="h-11 rounded-xl border border-red-400/30 px-3 font-black text-red-200">End live</button></>:<button disabled={liveBusy} onClick={()=>void startLive()} className="h-11 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-4 font-black"><Users className="mr-1 inline" size={17}/>Start live for students</button>}<button onClick={()=>void goFullscreen()} className="grid h-11 w-11 place-items-center rounded-xl bg-white/5"><Maximize2 size={18}/></button><button onClick={()=>setPresenterOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/5"><X/></button></div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative flex min-h-0 items-center justify-center overflow-auto bg-black p-3">
          {scenes.length>1&&<button onClick={previousScene} className="absolute left-3 z-20 grid h-14 w-14 place-items-center rounded-full bg-black/60"><ChevronLeft size={30}/></button>}
          <SceneImage scene={selected} className="max-h-full"/>
          {scenes.length>1&&<button onClick={nextScene} className="absolute right-3 z-20 grid h-14 w-14 place-items-center rounded-full bg-black/60"><ChevronRight size={30}/></button>}
        </div>
        <aside className="overflow-y-auto border-l border-white/10 bg-[#0d0d17] p-4">
          <div className="flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-widest text-violet-300">Interactive</div><h3 className="m-0 text-xl font-black">Questions</h3></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black">{currentQuestions.length}</span></div>
          {!currentQuestions.length?<div className="mt-4 rounded-2xl border border-dashed border-white/15 p-4 text-center"><p className="text-sm text-slate-400">No questions yet.</p><button disabled={questionBusy} onClick={()=>void generateQuestions(selected,1)} className="mt-2 rounded-xl bg-violet-500 px-4 py-2 font-black">Generate 1 question</button></div>:<div className="mt-4 space-y-3">{currentQuestions.map((q,index)=><div key={q.id} className={`rounded-2xl border p-3 ${activeQ?.id===q.id?"border-cyan-300/60 bg-cyan-300/10":"border-white/10 bg-white/[.03]"}`}><div className="text-xs font-black text-slate-400">QUESTION {index+1}</div><div className="mt-1 font-black">{q.prompt}</div><div className="mt-2 grid gap-1">{q.options.map((opt,i)=><div key={opt} className="rounded-lg bg-black/25 px-2 py-1 text-xs"><b>{["A","B","C","D"][i]}.</b> {opt}</div>)}</div><button disabled={!liveSession||liveSession.status!=="live"} onClick={()=>void launchQuestion(q.id)} className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-slate-950 disabled:opacity-40">{activeQ?.id===q.id?"Live now":"Ask students"}</button></div>)}</div>}
          {activeQ&&<div className="mt-5 border-t border-white/10 pt-4"><div className="flex items-center justify-between"><h4 className="m-0 font-black">Live responses</h4><button onClick={()=>void launchQuestion(null)} className="text-xs font-black text-slate-400">Close question</button></div><div className="mt-2 text-xs text-slate-400">{responses.length} of {liveSession?.viewerCount||0} answered • Correct: {activeQ.correct}</div><div className="mt-3 space-y-2">{responses.length?responses.map(r=><div key={r.studentId} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span className="truncate text-sm font-bold">{r.studentName}</span><span className={`grid h-8 w-8 place-items-center rounded-full font-black ${r.choice===activeQ.correct?"bg-emerald-400 text-slate-950":"bg-red-500/20 text-red-200"}`}>{r.choice}</span></div>):<div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">Waiting for answers…</div>}</div></div>}
        </aside>
      </div>
    </div>}
  </main>;
}
