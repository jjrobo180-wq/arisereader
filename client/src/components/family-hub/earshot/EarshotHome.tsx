// A.R.I.S.E Pod+ Home: Connect. Explore. Create.
// Styled like the A.R.I.S.E family hub apps with clean, minimal design.
import { useState } from "react";
import { Headphones, Radio, Users, Sparkles, Plus, Play, Clock, TrendingUp, Mic2 } from "lucide-react";
import { PageHead, Avatar, primary, soft, plain } from "./ui";

interface PodShow {
  id: string;
  name: string;
  cover: string;
  description: string;
  category: string;
  status?: "listening" | "paused" | "completed";
  timeLeft?: string;
}

interface RecentEpisode {
  id: string;
  showName: string;
  title: string;
  duration: string;
  progress: number;
  lastListened: string;
}

const FEATURED_SHOWS: PodShow[] = [
  { id: "1", name: "The Daily", cover: "🎙️", description: "Dive deep into one story each day.", category: "News & Politics", status: "listening", timeLeft: "12 min left" },
  { id: "2", name: "Stuff You Should Know", cover: "🧠", description: "Learn about the stuff that makes up our world.", category: "Education", status: "listening", timeLeft: "24 min left" },
  { id: "3", name: "Serial", cover: "🔍", description: "Stories that are also mysteries.", category: "True Crime", status: "paused", timeLeft: "8 min left" },
];

const RECENT_EPISODES: RecentEpisode[] = [
  { id: "1", showName: "The Daily", title: "The Secret World of Bank Runs", duration: "23 min", progress: 0.65, lastListened: "2 days ago" },
  { id: "2", showName: "Stuff You Should Know", title: "How Lightbulbs Work", duration: "45 min", progress: 0.42, lastListened: "Today" },
  { id: "3", showName: "99% Invisible", title: "The Perfect Loaf", duration: "19 min", progress: 1, lastListened: "Today" },
];

const POD_MODES = [
  { icon: "🌙", label: "Sleep", description: "Fade to silence" },
  { icon: "🚗", label: "Drive", description: "Hands-free mode" },
  { icon: "💪", label: "Workout", description: "Keep the beat" },
  { icon: "🎧", label: "Focus", description: "Deep dive" },
];

export default function EarshotHome() {
  const [showAddFeed, setShowAddFeed] = useState(false);

  const recentCard = (ep: RecentEpisode) => (
    <button key={ep.id} className="group flex w-full items-start gap-4 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 transition-all hover:border-violet-300 hover:bg-violet-50">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white">
        🎙️
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{ep.showName}</p>
        <h4 className="mt-0.5 font-semibold text-slate-900 group-hover:text-violet-600">{ep.title}</h4>
        <p className="mt-1 text-xs text-slate-500">{ep.duration} · Listened {ep.lastListened}</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
            style={{ width: `${ep.progress * 100}%` }}
          />
        </div>
      </div>
      <button className="flex shrink-0 items-center justify-center rounded-lg bg-white p-2 text-slate-300 transition-all hover:bg-violet-600 hover:text-white">
        <Play size={16} fill="currentColor" />
      </button>
    </button>
  );

  const featuredCard = (show: PodShow) => {
    const statusColor =
      show.status === "listening"
        ? "bg-emerald-500"
        : show.status === "paused"
          ? "bg-amber-500"
          : "bg-slate-300";
    return (
      <div
        key={show.id}
        className="flex flex-col rounded-[1.5rem] border border-[#e7e8f0] bg-gradient-to-br from-white to-slate-50 p-5 shadow-[0_8px_28px_#17152b08]"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-3xl">
            {show.cover}
          </div>
          {show.status && (
            <span
              className={`h-3 w-3 rounded-full ${statusColor}`}
              aria-label={`Status: ${show.status}`}
            />
          )}
        </div>
        <h3 className="mt-3 font-bold text-slate-900">{show.name}</h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{show.category}</p>
        <p className="mt-2 text-sm text-slate-600">{show.description}</p>
        {show.timeLeft && <p className="mt-3 text-xs font-semibold text-violet-600">{show.timeLeft}</p>}
        <button className={primary + " mt-4 w-full min-h-9 text-sm"}>
          <Play size={15} /> Continue
        </button>
      </div>
    );
  };

  const podModeCard = (mode: (typeof POD_MODES)[0]) => (
    <button
      key={mode.label}
      className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-[#e7e8f0] bg-white p-4 transition-all hover:border-violet-300 hover:bg-violet-50"
    >
      <span className="text-3xl">{mode.icon}</span>
      <p className="text-xs font-bold text-slate-900">{mode.label}</p>
      <p className="text-[10px] text-slate-500">{mode.description}</p>
    </button>
  );

  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="Connect. Explore. Create"
        title="Pod+"
        blurb="Your social podcast home. Discover shows, listen together, and share your voice."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowAddFeed(!showAddFeed)} className={soft + " min-h-11"}>
              <Plus size={18} /> Add show
            </button>
            <button className={primary + " min-h-11 px-5"}>
              <Sparkles size={18} /> Find with AI
            </button>
          </div>
        }
      />

      {/* Currently Listening */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
            <Headphones size={18} className="text-violet-600" />
          </div>
          <h2 className="font-bold text-slate-900">Continue listening</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FEATURED_SHOWS.map(featuredCard)}
        </div>
      </div>

      {/* Pod Modes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
            <Radio size={18} className="text-blue-600" />
          </div>
          <h2 className="font-bold text-slate-900">Pod Modes</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {POD_MODES.map(podModeCard)}
        </div>
      </div>

      {/* Recent Episodes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
            <Clock size={18} className="text-emerald-600" />
          </div>
          <h2 className="font-bold text-slate-900">Recent episodes</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {RECENT_EPISODES.map(recentCard)}
        </div>
      </div>

      {/* Social Section */}
      <div className="space-y-4 rounded-[1.5rem] border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white">
            <Users size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">Listen together</h3>
            <p className="mt-1 text-sm text-slate-600">
              Share episodes with friends, sync playback, and chat while you listen.
            </p>
          </div>
        </div>
        <button className={primary + " w-full"}>
          <Users size={16} /> Start a session
        </button>
      </div>

      {/* Create Section */}
      <div className="space-y-4 rounded-[1.5rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white">
            <Mic2 size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">Share your voice</h3>
            <p className="mt-1 text-sm text-slate-600">
              Host your own show, upload episodes, and build your audience.
            </p>
          </div>
        </div>
        <button className={soft + " w-full text-amber-600 hover:text-amber-700"}>
          <Mic2 size={16} /> Start hosting
        </button>
      </div>

      {/* Trending */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100">
            <TrendingUp size={18} className="text-pink-600" />
          </div>
          <h2 className="font-bold text-slate-900">Trending this week</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {["Crime Junkie", "The Joe Rogan Experience", "Levar Burton Reads", "Radiolab"].map((show) => (
            <button
              key={show}
              className="flex items-center gap-3 rounded-xl border border-[#e7e8f0] bg-white p-3 text-left transition-all hover:border-pink-300 hover:bg-pink-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-100 to-rose-100 text-lg">
                📻
              </span>
              <span className="text-sm font-semibold text-slate-900">{show}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
