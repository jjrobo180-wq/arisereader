// Teacher Hub: the big "Your teacher workspace" box on Home, with a Style button to change its color,
// add a picture, and make it smaller or larger.
import { useState, type Dispatch, type SetStateAction } from "react";
import { Check, ImagePlus, Loader2, Paintbrush, Trash2 } from "lucide-react";
import { BANNER_COLORS, BANNER_SIZES, DEFAULT_BANNER, MAX_BANNER_IMAGE, bannerMinHeight, cleanBanner, type Banner } from "@shared/hubBanner";
import { textOn } from "@shared/hubPins";
import type { Workspace } from "@shared/teacherHub";
import { HubModal } from "./HubModal";
import { GhostButton, PrimaryButton } from "./ui";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;

/** A photo shrunk to a small JPEG that fits in the Hub. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That picture could not be read.")); i.src = url; });
    for (const [width, quality] of [[1400, 0.78], [1100, 0.7], [800, 0.62], [600, 0.55]] as const) {
      const scale = Math.min(1, width / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= MAX_BANNER_IMAGE) return data;
    }
    throw new Error("That picture is too detailed. Try a smaller one.");
  } finally { URL.revokeObjectURL(url); }
}

export default function WorkspaceBanner({ workspace, setWorkspace, firstName, stats }: { workspace: Workspace; setWorkspace: SetWorkspace; firstName: string; stats: { label: string; value: number }[] }) {
  const banner = cleanBanner(workspace.profile.banner ?? DEFAULT_BANNER);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (patch: Partial<Banner>) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, banner: cleanBanner({ ...cleanBanner(p.profile.banner ?? DEFAULT_BANNER), ...patch }) } }));

  // Over a picture the words are always white on a dark wash; on a plain color they match the color.
  const ink = banner.image ? "#ffffff" : textOn(banner.color);
  const soft = ink === "#ffffff" ? "rgba(255,255,255,0.78)" : "rgba(15,23,42,0.72)";
  const tile = ink === "#ffffff" ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.08)";
  const small = banner.size === "compact";

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      if (!/^image\//.test(file.type)) throw new Error("Choose a picture file.");
      change({ image: await shrink(file) });
    } catch (e: any) { setError(e?.message || "That picture could not be used."); } finally { setBusy(false); }
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl md:rounded-[2rem] ${small ? "p-4 sm:p-5" : "p-5 sm:p-6 md:p-8"}`} data-testid="workspace-banner"
      style={{ backgroundColor: banner.color, color: ink, minHeight: bannerMinHeight(banner.size), ...(banner.image ? { backgroundImage: `linear-gradient(rgba(2,6,23,0.35), rgba(2,6,23,0.65)), url(${banner.image})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
      <button type="button" onClick={() => setOpen(true)} aria-label="Change how this box looks" data-testid="banner-style"
        className="absolute right-3 top-3 inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold" style={{ backgroundColor: tile, color: ink }}><Paintbrush className="h-4 w-4" /> <span className="hidden sm:inline">Style</span></button>
      <div className={`flex h-full flex-col gap-6 lg:flex-row lg:items-end lg:justify-between ${banner.size === "tall" ? "min-h-[14rem] justify-end" : ""}`}>
        <div className="pr-14">
          <p className="text-sm font-semibold" style={{ color: soft }}>Welcome back, {firstName}</p>
          <h1 className={`mt-2 font-bold tracking-tight ${small ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl md:text-4xl"}`}>Your teacher workspace</h1>
          {!small && <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: soft }}>Everything here saves to your account automatically.</p>}
        </div>
        <div className="grid w-full grid-cols-3 gap-2 text-center lg:w-auto">
          {stats.map((s) => <div key={s.label} className="rounded-2xl px-2 py-3 sm:px-4" style={{ backgroundColor: tile }}><div className={`${small ? "text-xl" : "text-2xl"} font-bold`}>{s.value}</div><div className="text-[11px]" style={{ color: soft }}>{s.label}</div></div>)}
        </div>
      </div>

      {open && (
        <HubModal title="Style this box" onClose={() => setOpen(false)} closeOnBackdrop footer={<PrimaryButton onClick={() => setOpen(false)}><Check className="h-4 w-4" /> Done</PrimaryButton>}>
          <div className="space-y-5 text-slate-900" data-testid="banner-editor">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Color</h3>
              <div role="radiogroup" aria-label="Box color" className="flex flex-wrap items-center gap-2">
                {BANNER_COLORS.map((c) => (
                  <button key={c.hex} type="button" role="radio" aria-checked={banner.color === c.hex} aria-label={c.name} onClick={() => change({ color: c.hex })}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 ${banner.color === c.hex ? "border-slate-900" : "border-white shadow ring-1 ring-slate-300"}`} style={{ backgroundColor: c.hex }}>
                    {banner.color === c.hex && <Check className="h-4 w-4" style={{ color: textOn(c.hex) }} />}
                  </button>
                ))}
                <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">Any color
                  <input type="color" value={banner.color} onChange={(e) => change({ color: e.target.value })} aria-label="Pick any color" className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                </label>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Picture</h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {banner.image ? "Change picture" : "Add a picture"}
                  <input type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} data-testid="banner-file" />
                </label>
                {banner.image && <GhostButton onClick={() => change({ image: "" })}><Trash2 className="h-4 w-4" /> Remove picture</GhostButton>}
              </div>
              <p className="mt-2 text-xs text-slate-500">The picture is shrunk to fit and saved with your Hub. A dark layer keeps the words easy to read.</p>
              {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Size</h3>
              <div role="radiogroup" aria-label="Box size" className="grid grid-cols-3 gap-2">
                {BANNER_SIZES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={banner.size === s.id} onClick={() => change({ size: s.id })}
                    className={`min-h-11 rounded-xl border text-sm font-semibold ${banner.size === s.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{s.label}</button>
                ))}
              </div>
            </section>

            <GhostButton onClick={() => setWorkspace((p) => { const { banner: _drop, ...profile } = p.profile; return { ...p, profile }; })}>Put it back the way it was</GhostButton>
          </div>
        </HubModal>
      )}
    </div>
  );
}
