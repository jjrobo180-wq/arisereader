// Recording a meeting from inside a note (the Notes tab, November 2026). Start it with the mic button,
// "Record a meeting" on the Notes tab, or by typing a command in the note:
//   @ariserecord  start (or carry on after a pause)    @arisepause  pause
//   @ariseresume  carry on                               @arisestop   stop and write it up
//   @arisemark    mark this moment as important
// It's the same recording as the Record screen (an AI note: transcript, then summary, written down as it
// goes), and when it stops the summary is added to the note you're in.
import { useEffect, useRef, useState } from "react";
import { noteHtml } from "@shared/ariseNotes";
import { notesApi, type FullNote } from "../api";
import { NotesRecorder, canRecord } from "../recorder";
import { createSender, type Sender } from "../sender";
import type { AppCtx } from "../NotesApp";

export type NoteRecState = "idle" | "starting" | "recording" | "paused" | "finishing";
export type NoteCommand = "record" | "pause" | "resume" | "stop" | "mark";

/** "@ariserecord" (any case) as a whole word; the note's html is checked as you type. */
export const COMMAND_RE = /@arise(record|pause|resume|stop|mark)(?![a-z])/gi;

/** Takes the commands out of a note's html and says which ones were typed, in order. */
export function takeCommands(html: string): { html: string; commands: NoteCommand[] } {
  const commands: NoteCommand[] = [];
  const out = html.replace(COMMAND_RE, (_m, c: string) => { commands.push(c.toLowerCase() as NoteCommand); return ""; });
  return { html: out, commands };
}

export function useNoteRecording(ctx: AppCtx, onWritten: (html: string, title: string) => void, say: (m: string) => void) {
  const [state, setState] = useState<NoteRecState>("idle");
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [step, setStep] = useState("");
  const rec = useRef<NotesRecorder | null>(null);
  const note = useRef<FullNote | null>(null);
  const sender = useRef<Sender | null>(null);
  const marks = useRef<number[]>([]);
  const stateRef = useRef(state); stateRef.current = state;
  const written = useRef(onWritten); written.current = onWritten;

  // Leaving the note while recording: stop and finish in the background, so nothing is lost.
  useEffect(() => () => {
    const r = rec.current, n = note.current, s = sender.current;
    if (!r || !n || !s || r.state === "stopped") return;
    void (async () => { await r.stop(); await s.drained(); await notesApi.finish(n.id, { durationSecs: r.elapsed, highlights: marks.current }).catch(() => {}); ctx.refreshNotes(); })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (stateRef.current === "paused") return resume();
    if (stateRef.current !== "idle") return;
    if (!canRecord()) { say("Recording doesn't work in this browser. Try Chrome or Safari."); return; }
    setState("starting"); setSecs(0); marks.current = [];
    const now = new Date();
    const defaultTitle = `Meeting, ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    try {
      const { me } = ctx;
      const template = me.templates.find((t) => t.id === me.settings.template && t.allowed)?.id ?? "general";
      const created = await notesApi.create({ source: "record", defaultTitle, template, speakers: me.features.speakers });
      note.current = created.note;
      sender.current = createSender(created.note.id, {
        concurrency: 1,
        onReply: (_p, r) => { if (!r.ok && (r.code === "minutes" || r.code === "cap")) say(r.message || "You're out of recording minutes."); if (r.usage) void ctx.refreshMe(); },
        onFatal: (m) => say(m),
        onProgress: () => {},
      });
      const r = new NotesRecorder({
        onPiece: (p) => sender.current?.add(p), onLevel: setLevel, onTick: setSecs,
        onAutoStop: (why) => { say(why === "limit" ? "That's the longest recording on your plan. It's saved." : "The microphone stopped. What was recorded is saved."); void stop(); },
      }, created.limits);
      await r.start();
      rec.current = r;
      setState("recording");
      if (me.settings.consent) say("Recording. Let everyone know they're being recorded.");
    } catch (e: any) {
      if (note.current) void notesApi.remove(note.current.id).catch(() => {});
      note.current = null; sender.current = null; rec.current = null;
      setState("idle");
      say(e?.message || "Couldn't start recording.");
    }
  };
  const pause = () => { if (rec.current?.state === "recording") { rec.current.pause(); setState("paused"); } };
  const resume = () => { if (rec.current?.state === "paused") { rec.current.resume(); setState("recording"); } };
  const mark = () => { const r = rec.current; if (!r || r.state === "stopped") return; const t = Math.round(r.elapsed); if (!marks.current.includes(t)) marks.current.push(t); say("Marked this moment as important."); };
  const stop = async () => {
    const r = rec.current, n = note.current, s = sender.current;
    if (!r || !n || !s || stateRef.current === "finishing") return;
    setState("finishing"); setStep("Saving the last part…");
    await r.stop();
    await s.drained();
    try {
      setStep("Putting the transcript together…");
      const done = (await notesApi.finish(n.id, { durationSecs: r.elapsed, highlights: marks.current })).note;
      if (done.segments.length && ctx.me.services.ai) { setStep("Writing the summary…"); await notesApi.summary(n.id).catch((e) => say(e.message)); }
      const { note: full } = await notesApi.get(n.id);
      written.current(noteHtml({ title: full.title, createdAt: full.createdAt, durationSecs: full.durationSecs, template: full.template, summary: full.summary, segments: full.segments, speakers: full.speakers }, false), full.title);
      ctx.refreshNotes();
    } catch (e: any) { say(e?.message || "The recording is saved in Recordings, but it couldn't be added here."); }
    rec.current = null; note.current = null; sender.current = null;
    setState("idle"); setStep("");
  };
  const run = (c: NoteCommand) => { if (c === "record") void start(); else if (c === "pause") pause(); else if (c === "resume") resume(); else if (c === "stop") void stop(); else mark(); };
  return { state, secs, level, step, start, pause, resume, stop, mark, run };
}
