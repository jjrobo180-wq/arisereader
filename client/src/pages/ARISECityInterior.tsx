import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Building2, DoorOpen, Sparkles } from "lucide-react";

export type CityInteriorAction =
  | "interview"
  | "work"
  | "store"
  | "dealer"
  | "home"
  | "library"
  | "bank"
  | "tour";

type Place = {
  id: string;
  label: string;
  type: string;
  color: string;
  accent: string;
};

type AvatarStyle = {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
};

type Hotspot = {
  x: number;
  y: number;
  label: string;
  action: CityInteriorAction;
  icon: string;
};

function roomInfo(place: Place, careerWorkplace: string, hired: boolean): {
  subtitle: string;
  floor: string;
  wall: string;
  hotspot: Hotspot;
  decor: Array<{ x: number; y: number; kind: string; label?: string }>;
} {
  const primary: Record<string, Omit<ReturnType<typeof roomInfo>, "hotspot"> & { hotspot: Hotspot }> = {
    career: {
      subtitle: "Career coaching, interview practice, and job placement",
      floor: "#d8d4c6",
      wall: "#e9e7df",
      hotspot: { x: 50, y: 33, label: "Interview Desk", action: "interview", icon: "💼" },
      decor: [
        { x: 18, y: 24, kind: "sofa" },
        { x: 78, y: 24, kind: "plant" },
        { x: 49, y: 20, kind: "desk", label: "CAREER COACH" },
        { x: 14, y: 66, kind: "poster", label: "YOUR FUTURE STARTS HERE" },
        { x: 83, y: 66, kind: "bookshelf" },
      ],
    },
    school: {
      subtitle: "Classrooms, planning spaces, and student support",
      floor: "#c9b89a",
      wall: "#e7edf5",
      hotspot: { x: 52, y: 33, label: careerWorkplace === "school" ? (hired ? "Start Teaching Shift" : "Teacher Office") : "Visit Classroom", action: careerWorkplace === "school" ? "work" : "tour", icon: "📚" },
      decor: [
        { x: 18, y: 25, kind: "whiteboard", label: "TODAY'S GOAL" },
        { x: 46, y: 30, kind: "teacherdesk" },
        { x: 73, y: 28, kind: "bookshelf" },
        { x: 28, y: 61, kind: "studentdesk" },
        { x: 50, y: 61, kind: "studentdesk" },
        { x: 72, y: 61, kind: "studentdesk" },
      ],
    },
    hospital: {
      subtitle: "Patient rooms, nurses station, and care team",
      floor: "#dbeafe",
      wall: "#f8fafc",
      hotspot: { x: 50, y: 31, label: careerWorkplace === "hospital" ? "Begin Care Shift" : "Front Desk", action: careerWorkplace === "hospital" ? "work" : "tour", icon: "🩺" },
      decor: [
        { x: 17, y: 25, kind: "hospitalbed" },
        { x: 50, y: 22, kind: "reception", label: "CARE TEAM" },
        { x: 82, y: 28, kind: "medicalcart" },
        { x: 20, y: 66, kind: "chair" },
        { x: 80, y: 65, kind: "plant" },
      ],
    },
    tech: {
      subtitle: "Prototype lab, computers, and engineering projects",
      floor: "#ced4da",
      wall: "#1e293b",
      hotspot: { x: 52, y: 31, label: careerWorkplace === "tech" ? "Start Engineering Shift" : "Explore Lab", action: careerWorkplace === "tech" ? "work" : "tour", icon: "🛠️" },
      decor: [
        { x: 17, y: 26, kind: "server" },
        { x: 50, y: 23, kind: "computerdesk", label: "PROTOTYPE LAB" },
        { x: 82, y: 25, kind: "server" },
        { x: 25, y: 64, kind: "workbench" },
        { x: 75, y: 64, kind: "workbench" },
      ],
    },
    restaurant: {
      subtitle: "Dining room, service counter, and professional kitchen",
      floor: "#b7794c",
      wall: "#fff7ed",
      hotspot: { x: 52, y: 31, label: careerWorkplace === "restaurant" ? "Start Kitchen Shift" : "Visit Kitchen", action: careerWorkplace === "restaurant" ? "work" : "tour", icon: "👨‍🍳" },
      decor: [
        { x: 18, y: 24, kind: "table" },
        { x: 50, y: 20, kind: "counter", label: "KITCHEN" },
        { x: 82, y: 24, kind: "table" },
        { x: 27, y: 62, kind: "table" },
        { x: 73, y: 62, kind: "table" },
      ],
    },
    studio: {
      subtitle: "Design boards, creative workstations, and client projects",
      floor: "#eee7df",
      wall: "#fdf2f8",
      hotspot: { x: 50, y: 31, label: careerWorkplace === "studio" ? "Start Design Shift" : "Explore Studio", action: careerWorkplace === "studio" ? "work" : "tour", icon: "🎨" },
      decor: [
        { x: 18, y: 25, kind: "easel" },
        { x: 50, y: 22, kind: "computerdesk", label: "DESIGN STUDIO" },
        { x: 82, y: 25, kind: "moodboard" },
        { x: 24, y: 64, kind: "sofa" },
        { x: 77, y: 64, kind: "plant" },
      ],
    },
    business: {
      subtitle: "Startup offices, meeting rooms, and business planning",
      floor: "#d1d5db",
      wall: "#ecfdf5",
      hotspot: { x: 50, y: 31, label: careerWorkplace === "business" ? "Start Business Shift" : "Visit Office", action: careerWorkplace === "business" ? "work" : "tour", icon: "📈" },
      decor: [
        { x: 17, y: 25, kind: "computerdesk" },
        { x: 50, y: 24, kind: "conference", label: "LAUNCHPAD" },
        { x: 83, y: 25, kind: "computerdesk" },
        { x: 23, y: 65, kind: "plant" },
        { x: 78, y: 65, kind: "sofa" },
      ],
    },
    store: {
      subtitle: "Clothing, electronics, gear, and city essentials",
      floor: "#ddd6ce",
      wall: "#fff7ed",
      hotspot: { x: 50, y: 31, label: "Shop at Checkout", action: "store", icon: "🛍️" },
      decor: [
        { x: 16, y: 25, kind: "display", label: "STYLE" },
        { x: 49, y: 22, kind: "counter", label: "CHECKOUT" },
        { x: 82, y: 25, kind: "display", label: "TECH" },
        { x: 25, y: 62, kind: "rack" },
        { x: 75, y: 62, kind: "rack" },
      ],
    },
    dealer: {
      subtitle: "Showroom, sales desk, and new vehicles",
      floor: "#cbd5e1",
      wall: "#f8fafc",
      hotspot: { x: 50, y: 31, label: "Talk to Sales", action: "dealer", icon: "🚙" },
      decor: [
        { x: 20, y: 30, kind: "showcar" },
        { x: 51, y: 21, kind: "desk", label: "METRO MOTORS" },
        { x: 80, y: 30, kind: "showcar" },
        { x: 19, y: 65, kind: "plant" },
        { x: 82, y: 65, kind: "chair" },
      ],
    },
    apartments: {
      subtitle: "Leasing office and model apartment",
      floor: "#c9aa85",
      wall: "#ecfeff",
      hotspot: { x: 50, y: 31, label: "Housing Office", action: "home", icon: "🏢" },
      decor: [
        { x: 18, y: 25, kind: "sofa" },
        { x: 50, y: 21, kind: "desk", label: "LEASING" },
        { x: 82, y: 25, kind: "plant" },
        { x: 27, y: 64, kind: "bed" },
        { x: 73, y: 64, kind: "table" },
      ],
    },
    houses: {
      subtitle: "Real estate office and model home",
      floor: "#cfa977",
      wall: "#f0fdf4",
      hotspot: { x: 50, y: 31, label: "Talk to Realtor", action: "home", icon: "🏡" },
      decor: [
        { x: 18, y: 25, kind: "sofa" },
        { x: 50, y: 21, kind: "desk", label: "MAPLE HOMES" },
        { x: 82, y: 25, kind: "plant" },
        { x: 25, y: 65, kind: "table" },
        { x: 75, y: 65, kind: "chair" },
      ],
    },
    library: {
      subtitle: "Reading lounge, study tables, and comprehension challenges",
      floor: "#9a765a",
      wall: "#faf5ff",
      hotspot: { x: 50, y: 31, label: "Reading Challenge", action: "library", icon: "📖" },
      decor: [
        { x: 15, y: 25, kind: "bookshelf" },
        { x: 50, y: 23, kind: "readingdesk", label: "READ & THINK" },
        { x: 85, y: 25, kind: "bookshelf" },
        { x: 26, y: 64, kind: "table" },
        { x: 74, y: 64, kind: "table" },
      ],
    },
    bank: {
      subtitle: "Accounts, money planning, and financial progress",
      floor: "#d6c7a9",
      wall: "#ecfdf5",
      hotspot: { x: 50, y: 31, label: "Talk to Teller", action: "bank", icon: "🏦" },
      decor: [
        { x: 18, y: 25, kind: "atm" },
        { x: 50, y: 21, kind: "counter", label: "TELLER" },
        { x: 82, y: 25, kind: "atm" },
        { x: 25, y: 64, kind: "chair" },
        { x: 75, y: 64, kind: "chair" },
      ],
    },
  };

  return primary[place.type] || {
    subtitle: "Community building",
    floor: "#d6d3d1",
    wall: "#f8fafc",
    hotspot: { x: 50, y: 31, label: "Explore", action: "tour", icon: "✨" },
    decor: [{ x: 50, y: 23, kind: "desk", label: place.label }],
  };
}

function Furniture({ kind, label }: { kind: string; label?: string }) {
  if (kind === "plant") return <div className="furniture plant"><span>🌿</span></div>;
  if (kind === "bookshelf") return <div className="furniture bookshelf">{Array.from({ length: 18 }).map((_, i) => <i key={i} />)}</div>;
  if (kind === "whiteboard") return <div className="furniture whiteboard"><b>{label}</b><span>Read • Think • Grow</span></div>;
  if (kind === "hospitalbed") return <div className="furniture hospital-bed"><div /><span>🩺</span></div>;
  if (kind === "server") return <div className="furniture server-rack">{Array.from({ length: 5 }).map((_, i) => <i key={i} />)}</div>;
  if (kind === "showcar") return <div className="furniture show-car"><div className="car-window" /><i /><i /></div>;
  if (kind === "easel") return <div className="furniture easel"><div>CREATE</div></div>;
  if (kind === "moodboard") return <div className="furniture moodboard"><i /><i /><i /><i /></div>;
  if (kind === "atm") return <div className="furniture atm"><div>ATM</div><i /></div>;
  if (kind === "bed") return <div className="furniture model-bed"><div /><span /></div>;
  if (kind === "rack") return <div className="furniture clothing-rack"><i>👕</i><i>🧥</i><i>👚</i></div>;
  if (kind === "display") return <div className="furniture display-case"><b>{label}</b><div>✨</div></div>;
  if (kind === "medicalcart") return <div className="furniture medical-cart"><b>+</b><i /><i /></div>;
  if (kind === "workbench") return <div className="furniture workbench"><span>⚙️</span><span>🔧</span></div>;
  if (kind === "studentdesk") return <div className="furniture student-desk"><span /></div>;
  if (kind === "teacherdesk") return <div className="furniture teacher-desk"><div>📚</div></div>;
  if (kind === "computerdesk") return <div className="furniture computer-desk"><div className="monitor">◫</div><span /></div>;
  if (kind === "conference") return <div className="furniture conference-table"><b>{label}</b><i /><i /><i /><i /></div>;
  if (kind === "readingdesk") return <div className="furniture reading-desk"><b>{label}</b><span>📖</span></div>;
  if (kind === "reception") return <div className="furniture reception"><b>{label}</b><span>+</span></div>;
  if (kind === "counter") return <div className="furniture counter"><b>{label}</b></div>;
  if (kind === "table") return <div className="furniture round-table"><span /><span /><span /></div>;
  if (kind === "chair") return <div className="furniture chair">▰</div>;
  if (kind === "sofa") return <div className="furniture sofa"><i /><i /></div>;
  if (kind === "desk") return <div className="furniture main-desk"><b>{label}</b><div /></div>;
  return <div className="furniture main-desk"><b>{label}</b></div>;
}

function InteriorAvatar({ avatar, moving }: { avatar: AvatarStyle; moving: boolean }) {
  return (
    <div className={`interior-avatar ${moving ? "walking" : ""}`}>
      <div className="avatar-shadow" />
      <div className="avatar-leg left" style={{ background: avatar.pants }} />
      <div className="avatar-leg right" style={{ background: avatar.pants }} />
      <div className="avatar-body" style={{ background: avatar.shirt }} />
      <div className="avatar-arm left" style={{ background: avatar.skin }} />
      <div className="avatar-arm right" style={{ background: avatar.skin }} />
      <div className="avatar-head" style={{ background: avatar.skin }}>
        <div className="avatar-hair" style={{ background: avatar.hair }} />
        <i className="eye left" /><i className="eye right" />
      </div>
    </div>
  );
}

export default function ARISECityInterior({
  place,
  avatar,
  careerWorkplace,
  hired,
  disabled,
  onAction,
  onExit,
}: {
  place: Place;
  avatar: AvatarStyle;
  careerWorkplace: string;
  hired: boolean;
  disabled?: boolean;
  onAction: (action: CityInteriorAction) => void;
  onExit: () => void;
}) {
  const keys = useRef<Record<string, boolean>>({});
  const frame = useRef<number | null>(null);
  const [position, setPosition] = useState({ x: 50, y: 82 });
  const positionRef = useRef(position);
  const [moving, setMoving] = useState(false);
  const [nearPrimary, setNearPrimary] = useState(false);
  const info = roomInfo(place, careerWorkplace, hired);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (disabled) {
      keys.current = {};
      setMoving(false);
      return;
    }

    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        keys.current[key] = true;
        event.preventDefault();
      }
      if (key === "e" && nearPrimary) {
        event.preventDefault();
        onAction(info.hotspot.action);
      }
    };
    const up = (event: KeyboardEvent) => {
      keys.current[event.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    let last = performance.now();
    const tick = (time: number) => {
      const dt = Math.min(.04, (time - last) / 1000);
      last = time;
      const k = keys.current;
      let dx = 0;
      let dy = 0;
      if (k.w || k.arrowup) dy -= 1;
      if (k.s || k.arrowdown) dy += 1;
      if (k.a || k.arrowleft) dx -= 1;
      if (k.d || k.arrowright) dx += 1;
      const walking = dx !== 0 || dy !== 0;
      setMoving(walking);
      if (walking) {
        const mag = Math.hypot(dx, dy) || 1;
        const next = {
          x: Math.max(8, Math.min(92, positionRef.current.x + (dx / mag) * 31 * dt)),
          y: Math.max(18, Math.min(90, positionRef.current.y + (dy / mag) * 31 * dt)),
        };
        positionRef.current = next;
        setPosition(next);
      }
      const d = Math.hypot(positionRef.current.x - info.hotspot.x, positionRef.current.y - info.hotspot.y);
      setNearPrimary(d < 14);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [disabled, nearPrimary, info.hotspot.action]);

  const setTouch = (key: string, value: boolean) => {
    keys.current[key] = value;
  };

  return (
    <div className="absolute inset-0 overflow-hidden text-slate-900" style={{ background: info.wall }}>
      <style>{interiorStyles}</style>

      <div className="absolute inset-x-0 top-0 h-[18%] interior-wall" style={{ background: `linear-gradient(180deg,${place.accent},${info.wall})` }}>
        <div className="absolute inset-x-0 bottom-0 h-3 bg-slate-300/70" />
        <div className="absolute top-5 left-1/2 -translate-x-1/2 rounded-2xl bg-white/90 border border-white px-5 py-2 shadow-lg text-center">
          <div className="text-[10px] uppercase tracking-[.2em] font-black" style={{ color: place.color }}>{place.label}</div>
          <div className="text-xs sm:text-sm font-bold text-slate-500">{info.subtitle}</div>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 top-[18%] interior-floor"
        style={{ backgroundColor: info.floor }}
      >
        <div className="floor-lines absolute inset-0 pointer-events-none" />

        {info.decor.map((item, index) => (
          <div
            key={`${item.kind}-${index}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <Furniture kind={item.kind} label={item.label} />
          </div>
        ))}

        <button
          type="button"
          onClick={() => onAction(info.hotspot.action)}
          className={`absolute -translate-x-1/2 -translate-y-1/2 hotspot-zone ${nearPrimary ? "near" : ""}`}
          style={{ left: `${info.hotspot.x}%`, top: `${info.hotspot.y}%` }}
        >
          <span className="text-3xl">{info.hotspot.icon}</span>
          <b>{info.hotspot.label}</b>
          <small>{nearPrimary ? "Press E or tap" : "Walk closer"}</small>
        </button>

        <button
          type="button"
          onClick={onExit}
          className="absolute left-1/2 bottom-2 -translate-x-1/2 exit-door"
        >
          <DoorOpen className="w-6 h-6" />
          <span>Exit to Street</span>
        </button>

        <div
          className="absolute -translate-x-1/2 -translate-y-[85%] z-40 pointer-events-none"
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
        >
          <InteriorAvatar avatar={avatar} moving={moving} />
        </div>
      </div>

      <div className="absolute top-3 left-3 z-50">
        <button type="button" onClick={onExit} className="min-h-[46px] rounded-2xl bg-slate-950/80 text-white border border-white/20 px-4 font-black flex items-center gap-2 shadow-xl">
          <ArrowLeft className="w-5 h-5" /> Street
        </button>
      </div>

      <div className="hidden sm:flex absolute bottom-3 right-3 z-50 rounded-2xl bg-slate-950/75 text-white border border-white/10 px-4 py-3 text-xs font-bold gap-2 items-center">
        <Building2 className="w-4 h-4" /> Move: WASD / Arrows · Interact: E
      </div>

      <div className="sm:hidden absolute bottom-3 left-3 z-50 grid grid-cols-3 gap-2">
        <div />
        <button className="interior-touch" onPointerDown={() => setTouch("w", true)} onPointerUp={() => setTouch("w", false)} onPointerCancel={() => setTouch("w", false)}>▲</button>
        <div />
        <button className="interior-touch" onPointerDown={() => setTouch("a", true)} onPointerUp={() => setTouch("a", false)} onPointerCancel={() => setTouch("a", false)}>◀</button>
        <button className="interior-touch" onPointerDown={() => setTouch("s", true)} onPointerUp={() => setTouch("s", false)} onPointerCancel={() => setTouch("s", false)}>▼</button>
        <button className="interior-touch" onPointerDown={() => setTouch("d", true)} onPointerUp={() => setTouch("d", false)} onPointerCancel={() => setTouch("d", false)}>▶</button>
      </div>
    </div>
  );
}

const interiorStyles = `
  .interior-wall {
    box-shadow:inset 0 -15px 35px rgba(15,23,42,.08);
  }
  .interior-floor {
    background-image:
      linear-gradient(30deg,rgba(255,255,255,.13) 12%,transparent 12.5%,transparent 87%,rgba(255,255,255,.13) 87.5%),
      linear-gradient(150deg,rgba(255,255,255,.13) 12%,transparent 12.5%,transparent 87%,rgba(255,255,255,.13) 87.5%);
    background-size:48px 82px;
    perspective:900px;
  }
  .floor-lines {
    background-image:
      linear-gradient(rgba(15,23,42,.06) 1px,transparent 1px),
      linear-gradient(90deg,rgba(15,23,42,.06) 1px,transparent 1px);
    background-size:70px 70px;
    transform:perspective(700px) rotateX(58deg) scale(1.35);
    transform-origin:bottom;
    opacity:.7;
  }
  .furniture {
    position:relative;
    filter:drop-shadow(0 13px 9px rgba(15,23,42,.18));
  }
  .main-desk,.reception,.counter,.reading-desk,.computer-desk,.teacher-desk {
    width:150px;height:70px;border-radius:10px;background:linear-gradient(145deg,#c79a6a,#8b5e34);border-top:8px solid #e8c697;
    display:flex;align-items:center;justify-content:center;color:#352315;font-size:12px;font-weight:1000;
  }
  .main-desk div,.teacher-desk div{font-size:28px}
  .reception{background:linear-gradient(145deg,#f8fafc,#cbd5e1);border-top-color:#fff}
  .reception span{position:absolute;right:16px;color:#dc2626;font-size:30px}
  .counter{background:linear-gradient(145deg,#b45309,#78350f);color:white}
  .reading-desk{background:linear-gradient(145deg,#7c3aed,#4c1d95);color:white}
  .reading-desk span{font-size:30px;margin-left:12px}
  .computer-desk{background:linear-gradient(145deg,#475569,#1e293b)}
  .monitor{width:62px;height:38px;border-radius:5px;background:#0f172a;border:4px solid #94a3b8;color:#22d3ee;font-size:24px;text-align:center}
  .teacher-desk{background:linear-gradient(145deg,#d6b47d,#8b6939)}
  .sofa{width:150px;height:70px;border-radius:22px 22px 14px 14px;background:#64748b;border-bottom:12px solid #475569;display:flex;gap:8px;padding:10px}
  .sofa i{flex:1;border-radius:12px;background:#94a3b8}
  .plant span{font-size:70px}
  .bookshelf{width:115px;height:120px;border-radius:7px;background:#713f12;border:8px solid #92400e;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:8px}
  .bookshelf i{background:#7c3aed;border-radius:2px}
  .bookshelf i:nth-child(3n){background:#0ea5e9}.bookshelf i:nth-child(4n){background:#f59e0b}.bookshelf i:nth-child(5n){background:#16a34a}
  .whiteboard{width:170px;height:90px;border:8px solid #94a3b8;background:white;border-radius:8px;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .whiteboard span{font-size:10px;color:#475569;margin-top:7px}
  .student-desk{width:82px;height:55px;background:#c08457;border-radius:5px;border-bottom:10px solid #6b4423}.student-desk span{display:block;width:55px;height:6px;background:#334155;margin:8px auto}
  .hospital-bed{width:150px;height:70px;border-radius:14px;background:#f8fafc;border:7px solid #94a3b8;position:relative}.hospital-bed div{position:absolute;left:10px;top:8px;width:48px;height:32px;border-radius:10px;background:#bfdbfe}.hospital-bed span{position:absolute;right:14px;top:15px;font-size:30px}
  .server-rack{width:85px;height:125px;border-radius:8px;background:#111827;border:6px solid #334155;padding:10px}.server-rack i{display:block;height:13px;margin:5px 0;background:#1e293b;border-left:9px solid #22d3ee;border-radius:3px}
  .workbench{width:125px;height:65px;border-radius:7px;background:#64748b;border-top:8px solid #cbd5e1;display:flex;justify-content:space-around;align-items:center;font-size:26px}
  .show-car{width:150px;height:68px;border-radius:25px 35px 14px 14px;background:linear-gradient(145deg,#2563eb,#1d4ed8);position:relative}.show-car .car-window{position:absolute;left:40px;top:8px;width:70px;height:25px;border-radius:13px;background:#bae6fd}.show-car i{position:absolute;bottom:-10px;width:28px;height:28px;border-radius:50%;background:#0f172a;border:6px solid #475569}.show-car i:nth-of-type(1){left:20px}.show-car i:nth-of-type(2){right:20px}
  .easel{width:95px;height:115px;border:9px solid #8b5e34;background:#fff;border-radius:4px;transform:rotate(-2deg);display:flex;align-items:center;justify-content:center;color:#db2777;font-weight:1000}
  .moodboard{width:150px;height:90px;border:7px solid #a16207;background:#fef3c7;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.moodboard i{background:#f9a8d4;transform:rotate(3deg)}.moodboard i:nth-child(2){background:#93c5fd}.moodboard i:nth-child(3){background:#86efac}.moodboard i:nth-child(4){background:#fde68a}
  .conference-table{width:180px;height:85px;border-radius:50%;background:#9a6b45;position:relative;display:flex;align-items:center;justify-content:center}.conference-table b{font-size:11px}.conference-table i{position:absolute;width:32px;height:24px;border-radius:9px;background:#475569}.conference-table i:nth-of-type(1){top:-22px;left:25px}.conference-table i:nth-of-type(2){top:-22px;right:25px}.conference-table i:nth-of-type(3){bottom:-22px;left:25px}.conference-table i:nth-of-type(4){bottom:-22px;right:25px}
  .round-table{width:90px;height:90px;border-radius:50%;background:#92400e;position:relative}.round-table span{position:absolute;width:28px;height:23px;border-radius:8px;background:#475569}.round-table span:nth-child(1){top:-17px;left:31px}.round-table span:nth-child(2){bottom:-17px;left:31px}.round-table span:nth-child(3){top:31px;right:-22px}
  .chair{font-size:65px;color:#475569}
  .display-case{width:110px;height:100px;border-radius:10px;background:linear-gradient(145deg,#fff,#dbeafe);border:5px solid #94a3b8;display:flex;flex-direction:column;align-items:center;justify-content:center}.display-case div{font-size:30px}.display-case b{font-size:11px}
  .clothing-rack{width:140px;height:85px;border-top:7px solid #475569;border-left:7px solid #475569;border-right:7px solid #475569;display:flex;justify-content:space-around;padding-top:8px;font-size:31px}
  .medical-cart{width:90px;height:85px;border-radius:8px;background:#e2e8f0;border:5px solid #94a3b8;display:flex;align-items:center;justify-content:center;position:relative}.medical-cart b{font-size:38px;color:#dc2626}.medical-cart i{position:absolute;bottom:-8px;width:15px;height:15px;border-radius:50%;background:#334155}.medical-cart i:nth-of-type(1){left:12px}.medical-cart i:nth-of-type(2){right:12px}
  .atm{width:90px;height:120px;border-radius:10px;background:#1e3a8a;border:7px solid #1e40af;color:white;text-align:center;padding-top:15px;font-weight:1000}.atm i{display:block;width:55px;height:30px;margin:15px auto;background:#0f172a;border:4px solid #60a5fa}
  .model-bed{width:150px;height:85px;border-radius:9px;background:white;border:8px solid #94a3b8;position:relative}.model-bed div{position:absolute;left:8px;top:8px;width:50px;height:40px;border-radius:8px;background:#e0f2fe}.model-bed span{position:absolute;right:7px;bottom:7px;width:72px;height:55px;background:#7dd3fc;border-radius:5px}
  .hotspot-zone{width:180px;min-height:90px;border-radius:24px;background:rgba(255,255,255,.82);border:3px solid rgba(255,255,255,.9);box-shadow:0 12px 28px rgba(15,23,42,.17);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;transition:.2s}
  .hotspot-zone b{font-size:13px}.hotspot-zone small{font-size:10px;color:#64748b;font-weight:800;margin-top:2px}.hotspot-zone.near{transform:translate(-50%,-50%) scale(1.08);border-color:#7c3aed;box-shadow:0 0 0 8px rgba(124,58,237,.14),0 15px 32px rgba(15,23,42,.22)}
  .exit-door{min-width:150px;min-height:56px;border-radius:18px;background:#0f172a;color:white;border:3px solid #475569;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:1000;box-shadow:0 12px 20px rgba(15,23,42,.25)}
  .interior-avatar{position:relative;width:64px;height:105px;filter:drop-shadow(0 10px 7px rgba(15,23,42,.22))}
  .avatar-shadow{position:absolute;left:9px;bottom:0;width:47px;height:13px;border-radius:50%;background:rgba(15,23,42,.2)}
  .avatar-leg{position:absolute;top:65px;width:13px;height:35px;border-radius:7px;transform-origin:top}.avatar-leg.left{left:17px}.avatar-leg.right{right:17px}
  .avatar-body{position:absolute;left:13px;top:35px;width:38px;height:40px;border-radius:14px 14px 10px 10px}
  .avatar-arm{position:absolute;top:40px;width:10px;height:34px;border-radius:7px;transform-origin:top}.avatar-arm.left{left:7px}.avatar-arm.right{right:7px}
  .avatar-head{position:absolute;left:17px;top:3px;width:31px;height:34px;border-radius:50%}.avatar-hair{position:absolute;left:0;right:0;top:0;height:14px;border-radius:16px 16px 7px 7px}.eye{position:absolute;top:18px;width:3px;height:3px;border-radius:50%;background:#111827}.eye.left{left:8px}.eye.right{right:8px}
  .interior-avatar.walking .avatar-leg.left{animation:legWalk .32s ease-in-out infinite alternate}.interior-avatar.walking .avatar-leg.right{animation:legWalk .32s ease-in-out infinite alternate-reverse}.interior-avatar.walking .avatar-arm.left{animation:armWalk .32s ease-in-out infinite alternate}.interior-avatar.walking .avatar-arm.right{animation:armWalk .32s ease-in-out infinite alternate-reverse}.interior-avatar.walking{animation:bodyBob .2s ease-in-out infinite alternate}
  .interior-touch{width:54px;height:54px;border-radius:18px;background:rgba(2,6,23,.78);border:1px solid rgba(255,255,255,.18);color:white;font-size:20px;font-weight:900;touch-action:none}
  @keyframes legWalk{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}@keyframes armWalk{from{transform:rotate(24deg)}to{transform:rotate(-24deg)}}@keyframes bodyBob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
`;
