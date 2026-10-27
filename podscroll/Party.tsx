// Listen together: a group hears the same episode at the same moment, chats, and up to six people
// can hop on the mic. Anyone can play, pause, skip or put on a different episode. Joined by link
// (/app/#/party/<id>). The server (server/podcastParty.ts) keeps the group's state and chat and
// introduces mic users; the episode plays here straight from the podcast's host, and voices go
// browser to browser (WebRTC). While someone talks, the episode gets quieter.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ICE_SERVERS } from "@shared/earshotCreators";
import { hiRes, type PodEpisode } from "@shared/earshot";
import { Check, Copy, Loader2, LogOut, Mic, MicOff, Pause, Play, RotateCcw, RotateCw, Search, Send, Users, X } from "lucide-react";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type PartyEp = { id: string; showId: string; title: string; show: string; art: string; audio: string; secs: number };
type PartyState = { ep: PartyEp | null; pos: number; playing: boolean; at: number; by: string };
type Member = { id: string; name: string; mic: boolean };
type Msg = { id: string; at: number; who: string; name: string; text: string; kind: "chat" | "note" };

const fmt = (s: number) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
const posNow = (s: PartyState, serverNow: number) => Math.max(0, s.playing ? s.pos + (serverNow - s.at) / 1000 : s.pos);
const toPartyEp = (e: PodEpisode): PartyEp => ({ id: e.id, showId: e.showId, title: e.title, show: e.show, art: e.art, audio: e.audio, secs: e.secs });

/** A tenth of a second of silence: played inside the Join tap so the episode can start later without another tap (iPhone rule). */
function silence(): string {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
  let s = ""; b.forEach((x) => { s += String.fromCharCode(x); });
  return "data:audio/wav;base64," + btoa(s);
}

export function PartyRoom({ room: wanted, api, wsBase, device, nickname, setNickname, say, pickFrom, ex, onRoom, onLeave }: {
  room: string; api: Api; wsBase: string; device: string; nickname: string; setNickname: (n: string) => void; say: (m: string) => void;
  pickFrom: PodEpisode[]; ex: string; onRoom: (id: string) => void; onLeave: () => void;
}) {
  const [name, setName] = useState(nickname);
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "gone" | "error">("idle");
  const [error, setError] = useState("");
  const [roomId, setRoomId] = useState(wanted === "new" ? "" : wanted);
  const [me, setMe] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [chat, setChat] = useState<Msg[]>([]);
  const [state, setState] = useState<PartyState>({ ep: null, pos: 0, playing: false, at: 0, by: "" });
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [t, setT] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [copied, setCopied] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const offset = useRef(0); // server clock minus ours
  const stateRef = useRef(state); stateRef.current = state;
  const meRef = useRef(me); meRef.current = me;
  const membersRef = useRef(members); membersRef.current = members;
  const stream = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const voices = useRef(new Map<string, HTMLAudioElement>());
  const leaving = useRef(false);
  const tries = useRef(0);
  const roomIdRef = useRef(roomId); roomIdRef.current = roomId;

  const send = useCallback((m: unknown) => { const s = ws.current; if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(m)); }, []);

  // ---- the episode: follow the group's state ----
  const follow = useCallback(() => {
    const a = audio.current, s = stateRef.current;
    if (!a || !s.ep) return;
    if (a.dataset.ep !== s.ep.id) { a.dataset.ep = s.ep.id; a.src = s.ep.audio; }
    const target = posNow(s, Date.now() + offset.current);
    if (Math.abs((a.currentTime || 0) - target) > 2 && (a.readyState >= 1 || !s.playing)) { try { a.currentTime = target; } catch { /* not seekable yet */ } }
    if (s.playing && a.paused) a.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    if (!s.playing && !a.paused) a.pause();
  }, []);
  useEffect(() => { follow(); }, [state, follow]);
  useEffect(() => { const i = setInterval(follow, 5000); return () => clearInterval(i); }, [follow]);

  // ---- voices (WebRTC): a mic user sends to every other member, one connection each way ----
  const closePc = useCallback((key: string) => {
    const pc = pcs.current.get(key); if (pc) { try { pc.close(); } catch { /* closed */ } pcs.current.delete(key); }
    const v = voices.current.get(key); if (v) { v.pause(); v.srcObject = null; voices.current.delete(key); }
  }, []);
  const sendTo = useCallback(async (to: string) => {
    const mine = meRef.current, key = `${mine}>${to}`;
    if (!stream.current || pcs.current.has(key)) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcs.current.set(key, pc);
    stream.current.getTracks().forEach((tr) => pc.addTrack(tr, stream.current!));
    pc.onicecandidate = (e) => { if (e.candidate) send({ t: "signal", to, key, data: { ice: e.candidate.toJSON() } }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") closePc(key); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ t: "signal", to, key, data: { sdp: pc.localDescription } });
  }, [send, closePc]);
  const onSignal = useCallback(async (from: string, key: string, data: any) => {
    const mine = meRef.current;
    try {
      if (data?.sdp?.type === "offer" && key === `${from}>${mine}`) {
        closePc(key);
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcs.current.set(key, pc);
        pc.onicecandidate = (e) => { if (e.candidate) send({ t: "signal", to: from, key, data: { ice: e.candidate.toJSON() } }); };
        pc.ontrack = (e) => {
          let v = voices.current.get(key);
          if (!v) { v = new Audio(); v.autoplay = true; voices.current.set(key, v); }
          v.srcObject = e.streams[0] || new MediaStream([e.track]);
          v.play().catch(() => setBlocked(true));
        };
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ t: "signal", to: from, key, data: { sdp: pc.localDescription } });
      } else if (data?.sdp?.type === "answer") {
        await pcs.current.get(key)?.setRemoteDescription(data.sdp);
      } else if (data?.ice) {
        await pcs.current.get(key)?.addIceCandidate(data.ice).catch(() => {});
      }
    } catch { /* a failed introduction just means no voice from that person */ }
  }, [send, closePc]);

  const stopMic = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop()); stream.current = null;
    Array.from(pcs.current.keys()).filter((k) => k.startsWith(`${meRef.current}>`)).forEach(closePc);
    setMicOn(false);
  }, [closePc]);

  // Keep voice connections matched to who's here and who's talking.
  useEffect(() => {
    const ids = new Set(members.map((m) => m.id));
    const talking = new Set(members.filter((m) => m.mic).map((m) => m.id));
    pcs.current.forEach((_, key) => {
      const [from, to] = key.split(">");
      if (from === me) { if (!ids.has(to)) closePc(key); }
      else if (!talking.has(from)) closePc(key);
    });
    if (micOn) members.forEach((m) => { if (m.id !== me) void sendTo(m.id); });
  }, [members, me, micOn, sendTo, closePc]);

  // Quieter episode while anyone talks.
  const someoneTalking = members.some((m) => m.mic);
  useEffect(() => { if (audio.current) audio.current.volume = someoneTalking ? 0.3 : 1; }, [someoneTalking]);

  // ---- the connection ----
  const connect = useCallback((id: string) => {
    setStatus("connecting"); setError("");
    const url = `${wsBase}/api/party/ws?room=${encodeURIComponent(id || "new")}&name=${encodeURIComponent(name.trim() || "Listener")}&device=${encodeURIComponent(device)}`;
    let s: WebSocket;
    try { s = new WebSocket(url); } catch { setStatus("error"); setError("Couldn't connect. Try again."); return; }
    ws.current = s;
    s.onmessage = (ev) => {
      let m: any; try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (typeof m.now === "number") offset.current = m.now - Date.now();
      if (m.t === "hello") {
        tries.current = 0;
        setStatus("open"); setMe(m.you); setMembers(m.members || []); setChat(m.chat || []); setState(m.state);
        setRoomId(m.room); onRoom(m.room);
      } else if (m.t === "state") setState(m.state);
      else if (m.t === "members") setMembers(m.members || []);
      else if (m.t === "chat") setChat((c) => [...c.slice(-79), m.msg]);
      else if (m.t === "mic") { setMicBusy(false); if (!m.ok) { stopMic(); say(m.reason || "Couldn't get on the mic."); } else if (!m.on) stopMic(); }
      else if (m.t === "signal") void onSignal(m.from, m.key, m.data);
      else if (m.t === "error" && m.text) say(m.text);
    };
    s.onclose = (ev) => {
      if (ws.current !== s) return;
      ws.current = null;
      stopMic();
      pcs.current.forEach((_, k) => closePc(k));
      if (leaving.current) return;
      if (ev.code === 4000) { setStatus("gone"); setError("This group has closed."); return; }
      if (ev.code === 4001) { setStatus("gone"); setError("You opened this group in another tab."); return; }
      const roomNow = roomIdRef.current;
      if (!roomNow) { setStatus("error"); setError("Couldn't start a group right now. Try again in a moment."); return; }
      if (tries.current++ < 5) { setStatus("connecting"); setTimeout(() => { if (!leaving.current) connect(roomNow); }, 1500 * tries.current); }
      else { setStatus("error"); setError("Lost the connection. Check your internet and rejoin."); }
    };
  }, [wsBase, name, device, onRoom, say, onSignal, stopMic, closePc]);

  useEffect(() => () => { leaving.current = true; try { ws.current?.close(); } catch { /* closed */ } stream.current?.getTracks().forEach((tr) => tr.stop()); pcs.current.forEach((pc) => { try { pc.close(); } catch { /* closed */ } }); voices.current.forEach((v) => v.pause()); }, []);

  const join = () => {
    const n = name.replace(/\s+/g, " ").trim().slice(0, 24) || "Listener";
    setName(n); setNickname(n); setJoined(true);
    const a = audio.current;
    if (a) { a.src = silence(); a.play().catch(() => {}); delete a.dataset.ep; }
    connect(roomId);
  };
  const leave = () => { leaving.current = true; try { ws.current?.close(); } catch { /* closed */ } stopMic(); audio.current?.pause(); onLeave(); };

  const toggleMic = async () => {
    if (micOn) { stopMic(); send({ t: "mic", on: false }); return; }
    if (members.filter((m) => m.mic).length >= 6) { say("6 people are already on the mic."); return; }
    setMicBusy(true);
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { setMicBusy(false); say("Allow the microphone in your browser to talk."); return; }
    setMicOn(true);
    send({ t: "mic", on: true });
  };

  const invite = async () => {
    const link = `${location.origin}/app/#/party/${roomId}`;
    try { if (navigator.share) { await navigator.share({ title: "Listen with me on Pod+", text: state.ep ? `Listen to “${state.ep.title}” with me` : "Listen with me on Pod+", url: link }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { say(link); }
  };

  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end" }); }, [chat]);

  const ep = state.ep;
  const total = ep?.secs || audio.current?.duration || 0;
  const pos = ep ? (Number.isFinite(t) ? t : 0) : 0;
  const talking = members.filter((m) => m.mic);

  const audioEl = <audio ref={audio} preload="auto" onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
    onEnded={() => { if (stateRef.current.playing) send({ t: "pause" }); }}
    onError={() => { if (stateRef.current.ep && audio.current?.dataset.ep) say("This episode's audio didn't load. Try another one."); }} />;

  if (!joined) {
    return <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {audioEl}
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1e8] text-[#c2410c]"><Users size={26} /></span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{wanted === "new" ? "Listen together" : "You're invited to listen"}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#606060]">Same episode, same second, wherever everyone is. Chat as it plays, and hop on the mic to talk. Anyone can press play, pause or skip.</p>
      <form onSubmit={(e) => { e.preventDefault(); join(); }} className="mt-6 flex w-full flex-col gap-3">
        <label className="text-left text-sm font-semibold" htmlFor="ps-party-name">Your name</label>
        <input id="ps-party-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="What should the group call you?" className="h-11 rounded-xl border border-[#d3d3d3] px-4 text-base outline-none focus:border-[#1c62b9]" />
        <button type="submit" className="h-11 rounded-full bg-[#0f0f0f] text-[15px] font-semibold text-white hover:bg-[#272727]">{wanted === "new" ? "Start a group" : "Join"}</button>
      </form>
      <button onClick={onLeave} className="mt-3 text-sm text-[#606060] underline">Not now</button>
    </div>;
  }

  return <div className="mx-auto flex max-w-[1400px] flex-wrap items-start gap-6 px-4 pb-16 pt-4 sm:px-6">
    {audioEl}
    <section aria-label="Now playing together" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight"><Users size={22} />Listen together</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={invite} disabled={!roomId} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white disabled:opacity-40">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Link copied" : "Invite"}</button>
          <button onClick={leave} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#f2f2f2] px-4 text-sm font-medium hover:bg-[#e5e5e5]"><LogOut size={16} />Leave</button>
        </div>
      </div>

      {status !== "open" && <div role="status" className={`rounded-xl px-4 py-3 text-sm ${status === "connecting" ? "bg-[#f2f2f2] text-[#606060]" : "bg-[#fff1e8] text-[#9a3412]"}`}>
        {status === "connecting" ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Connecting…</span> : <span className="flex flex-wrap items-center gap-3">{error}{status === "error" && <button onClick={() => { tries.current = 0; connect(roomId); }} className="font-semibold underline">Try again</button>}</span>}
      </div>}

      <div className="ps-keep relative overflow-hidden rounded-2xl bg-[#0f0f0f] text-white">
        {ep?.art && <img src={hiRes(ep.art, 600)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-3xl" />}
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          {ep ? <img src={hiRes(ep.art, 400)} alt="" className="h-36 w-36 shrink-0 rounded-xl object-cover shadow-[0_12px_40px_rgba(0,0,0,.45)] sm:h-44 sm:w-44" />
            : <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:h-44 sm:w-44"><Play size={36} /></div>}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {ep ? <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-white/70">{ep.show}</p>
                <p className="mt-1 line-clamp-2 text-xl font-bold leading-snug">{ep.title}</p>
              </div>
              <div>
                <label htmlFor="ps-party-seek" className="sr-only">Position</label>
                <input id="ps-party-seek" type="range" min={0} max={Math.max(1, Math.floor(total))} value={Math.floor(pos)} onChange={(e) => send({ t: "seek", pos: Number(e.target.value) })}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full accent-[#ff6a1f]" style={{ background: `linear-gradient(to right, #ff6a1f ${total ? (pos / total) * 100 : 0}%, rgba(255,255,255,.3) 0)` }} />
                <div className="mt-1 flex justify-between text-xs tabular-nums text-white/75"><span>{fmt(pos)}</span><span>{fmt(total)}</span></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => send({ t: "seek", pos: pos - 15 })} aria-label="Back 15 seconds" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"><RotateCcw size={20} /></button>
                <button onClick={() => send({ t: state.playing ? "pause" : "play" })} aria-label={state.playing ? "Pause for everyone" : "Play for everyone"} className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#0f0f0f]">{state.playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}</button>
                <button onClick={() => send({ t: "seek", pos: pos + 30 })} aria-label="Forward 30 seconds" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"><RotateCw size={20} /></button>
                <span className="flex-1" />
                <button onClick={() => setPicking(true)} className="h-9 rounded-full bg-white/15 px-4 text-sm font-semibold hover:bg-white/25">Change episode</button>
              </div>
              {blocked && <button onClick={() => { setBlocked(false); follow(); voices.current.forEach((v) => v.play().catch(() => {})); }} className="self-start rounded-full bg-[#ff6a1f] px-4 py-2 text-sm font-semibold">Tap to hear it</button>}
            </> : <div>
              <p className="text-lg font-bold">Nothing playing yet</p>
              <p className="mt-1 text-sm text-white/75">Pick an episode and it starts for everyone in the group.</p>
              <button onClick={() => setPicking(true)} className="mt-4 h-10 rounded-full bg-white px-5 text-sm font-semibold text-[#0f0f0f]">Pick an episode</button>
            </div>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e5e5e5] p-4">
        <button onClick={toggleMic} disabled={micBusy || status !== "open"} aria-pressed={micOn} className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-50 ${micOn ? "bg-[#ff3b30] text-white" : "bg-[#0f0f0f] text-white hover:bg-[#272727]"}`}>
          {micBusy ? <Loader2 size={18} className="animate-spin" /> : micOn ? <MicOff size={18} /> : <Mic size={18} />}{micOn ? "Hop off the mic" : "Hop on the mic"}
        </button>
        <p className="min-w-0 flex-1 text-sm text-[#606060]">{talking.length ? `On the mic: ${talking.map((m) => m.id === me ? "you" : m.name).join(", ")}` : "No one's talking. Up to 6 people can be on the mic at once."}</p>
      </div>
    </section>

    <aside aria-label="Group chat" className="flex min-w-0 max-w-full flex-[1_1_340px] flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] lg:max-w-[420px]">
      <div className="border-b border-[#e5e5e5] px-4 py-3">
        <p className="text-sm font-semibold">{members.length} listening</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {members.map((m) => <span key={m.id} className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium ${m.mic ? "bg-[#fff1e8] text-[#9a3412]" : "bg-[#f2f2f2]"}`}>{m.mic && <Mic size={12} />}{m.id === me ? `${m.name} (you)` : m.name}</span>)}
        </div>
      </div>
      <div className="flex h-[360px] flex-col gap-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {chat.length === 0 && <p className="text-sm text-[#767676]">Say hi. Everyone in the group sees it.</p>}
        {chat.map((c) => c.kind === "note"
          ? <p key={c.id} className="text-xs text-[#767676]">{c.text}</p>
          : <p key={c.id} className="text-sm leading-snug"><b className={c.who === me ? "text-[#c2410c]" : ""}>{c.who === me ? "You" : c.name}</b> {c.text}</p>)}
        <div ref={chatEnd} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const v = text.trim(); if (!v) return; send({ t: "chat", text: v }); setText(""); }} className="flex items-center gap-2 border-t border-[#e5e5e5] p-3">
        <label htmlFor="ps-party-chat" className="sr-only">Message the group</label>
        <input id="ps-party-chat" value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Message the group" className="h-10 min-w-0 flex-1 rounded-full bg-[#f2f2f2] px-4 text-sm outline-none focus:ring-2 focus:ring-[#1c62b9]" />
        <button type="submit" aria-label="Send" disabled={!text.trim() || status !== "open"} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0f0f0f] text-white disabled:opacity-40"><Send size={16} /></button>
      </form>
    </aside>

    {picking && <Picker api={api} ex={ex} pickFrom={pickFrom} onClose={() => setPicking(false)} onPick={(e) => { if (!/^https:\/\//i.test(e.audio || "")) { say("That episode can't be played here. Try another one."); return; } send({ t: "pick", ep: toPartyEp(e) }); setPicking(false); }} />}
  </div>;
}

function Picker({ api, ex, pickFrom, onPick, onClose }: { api: Api; ex: string; pickFrom: PodEpisode[]; onPick: (e: PodEpisode) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<PodEpisode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const find = () => { const v = q.trim(); if (v.length < 2) return; setBusy(true); api(`/api/earshot/search?q=${encodeURIComponent(v)}${ex}`).then((b) => setRes(b.episodes || [])).catch(() => setRes([])).finally(() => setBusy(false)); };
  const list = useMemo(() => (res ?? pickFrom).filter((e) => /^https:\/\//i.test(e.audio || "")).slice(0, 40), [res, pickFrom]);
  return <div role="dialog" aria-modal="true" aria-labelledby="ps-pick-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 px-3 pb-3 sm:items-center">
    <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-[#0f0f0f] shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-4 py-3">
        <h2 id="ps-pick-title" className="text-base font-semibold">Pick an episode for the group</h2>
        <button onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><X size={20} /></button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); find(); }} className="flex items-center gap-2 px-4 py-3">
        <label htmlFor="ps-pick-q" className="sr-only">Search episodes</label>
        <input id="ps-pick-q" autoFocus value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setRes(null); }} placeholder="Search any podcast or topic" className="h-10 min-w-0 flex-1 rounded-full border border-[#d3d3d3] px-4 text-sm outline-none focus:border-[#1c62b9]" />
        <button type="submit" aria-label="Search" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f2f2]">{busy ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}</button>
      </form>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {list.length === 0 && <p className="px-3 py-8 text-center text-sm text-[#606060]">{res ? "Nothing found. Try other words." : "Search for something to play."}</p>}
        {list.map((e) => <button key={e.id} onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-[#f2f2f2]">
          <img src={hiRes(e.art, 120)} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-[#f2f2f2] object-cover" />
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{e.title}</span>
            <span className="truncate text-xs text-[#606060]">{e.show}{e.secs ? ` · ${Math.round(e.secs / 60)} min` : ""}</span>
          </span>
        </button>)}
      </div>
    </div>
  </div>;
}
