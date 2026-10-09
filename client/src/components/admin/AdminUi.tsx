// Small building blocks shared by the admin page, so every section looks and behaves the same
// on a phone and on a laptop: long names and emails wrap instead of pushing the card wider,
// and row buttons drop below the details on small screens.
import { Fragment, type ReactNode } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Tone = "violet" | "cyan" | "amber" | "orange" | "emerald" | "red" | "blue" | "fuchsia" | "slate";

export const TONE_TILE: Record<Tone, string> = {
  violet: "bg-violet-500/15 text-violet-300",
  cyan: "bg-cyan-500/15 text-cyan-300",
  amber: "bg-amber-500/15 text-amber-300",
  orange: "bg-orange-500/15 text-orange-300",
  emerald: "bg-emerald-500/15 text-emerald-300",
  red: "bg-red-500/15 text-red-300",
  blue: "bg-blue-500/15 text-blue-300",
  fuchsia: "bg-fuchsia-500/15 text-fuchsia-300",
  slate: "bg-slate-500/15 text-slate-300",
};

export function CountBadge({ count, tone = "fuchsia", className }: { count: number; tone?: Tone; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black leading-none", tone === "fuchsia" ? "bg-fuchsia-500 text-white" : TONE_TILE[tone], className)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AdminSection({
  id, icon: Icon, tone = "violet", title, description, count, actions, children, className, bodyClassName,
}: {
  id?: string;
  icon?: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  description?: ReactNode;
  count?: number;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section id={id} data-section={id} className={cn("min-w-0 scroll-mt-32 rounded-2xl border border-card-border bg-card shadow-sm lg:scroll-mt-20", className)}>
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-border/60 px-4 py-3.5 sm:px-5">
        {Icon && <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TONE_TILE[tone])}><Icon className="h-[18px] w-[18px]" /></span>}
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-bold leading-tight sm:text-[17px]">
            <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
            {count ? <CountBadge count={count} /> : null}
          </h2>
          {description && <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-[13px]">{description}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
      </header>
      <div className={cn("min-w-0 p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon: Icon, title, hint, className }: { icon?: LucideIcon; title: string; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-border/70 px-4 py-8 text-center", className)}>
      {Icon && <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="h-5 w-5" /></span>}
      <p className="mt-2 text-sm font-semibold">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatTile({ icon: Icon, tone = "violet", label, value, hint }: { icon: LucideIcon; tone?: Tone; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-card-border bg-card p-3 shadow-sm sm:p-4">
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", TONE_TILE[tone])}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <div className="text-xl font-black leading-none tabular-nums sm:text-2xl">{value}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground" title={hint || label}>{label}</div>
      </div>
    </div>
  );
}

export function Avatar({ name, tone = "violet", size = "md" }: { name?: string | null; tone?: Tone; size?: "sm" | "md" }) {
  const letter = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-bold", TONE_TILE[tone], size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm")}>
      {letter}
    </span>
  );
}

const ROW_HIGHLIGHT: Record<Tone, string> = {
  violet: "border-violet-500/30 bg-violet-500/[.06]",
  cyan: "border-cyan-500/30 bg-cyan-500/[.06]",
  amber: "border-amber-500/30 bg-amber-500/[.06]",
  orange: "border-orange-500/30 bg-orange-500/[.06]",
  emerald: "border-emerald-500/30 bg-emerald-500/[.06]",
  red: "border-red-500/30 bg-red-500/[.06]",
  blue: "border-blue-500/30 bg-blue-500/[.06]",
  fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/[.06]",
  slate: "border-border bg-muted/30",
};

/** One person (or request) in a list: details on top, controls and buttons underneath on a phone. */
export function PersonRow({
  id, name, avatarTone, badges, meta, aside, children, actions, highlight, className,
}: {
  id?: string;
  name: ReactNode;
  avatarTone?: Tone;
  badges?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  highlight?: Tone;
  className?: string;
}) {
  const plainName = typeof name === "string" ? name : undefined;
  return (
    <div
      id={id}
      className={cn(
        "min-w-0 scroll-mt-36 rounded-xl border p-3 transition-colors sm:p-4",
        highlight ? ROW_HIGHLIGHT[highlight] : "border-border/70 bg-muted/20 hover:bg-muted/30",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={plainName} tone={avatarTone} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 font-semibold leading-tight [overflow-wrap:anywhere]">{name}</p>
            {badges}
          </div>
          {meta && <div className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{meta}</div>}
        </div>
        {aside && <div className="shrink-0 text-right">{aside}</div>}
      </div>
      {children && <div className="mt-3 min-w-0">{children}</div>}
      {actions && <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", TONE_TILE[tone])}>{children}</span>;
}

export type MenuAction = { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; separatorBefore?: boolean; testId?: string };

/** A "⋯" button with the less common actions for a row. */
export function ActionMenu({ label, items }: { label: string; items: MenuAction[] }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 w-9 px-0" aria-label={label} title={label}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {items.map((item) => (
          <Fragment key={item.label}>
            {item.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={() => item.onSelect()}
              data-testid={item.testId}
              className={cn("gap-2 py-2", item.danger && "text-red-400 focus:text-red-300")}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A row of choices that scrolls sideways on a phone instead of wrapping. */
export function SegmentedTabs<T extends string>({
  value, onChange, options, dataAttr, ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number; icon?: LucideIcon }[];
  dataAttr: string;
  ariaLabel: string;
}) {
  return (
    <>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(SELECT_CLASS, "sm:hidden")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}{option.count ? ` (${option.count})` : ""}</option>
        ))}
      </select>
    <div role="tablist" aria-label={ariaLabel} className="-mx-1 hidden min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden">
      {options.map((option) => {
        const active = option.value === value;
        const attrs = { [dataAttr]: option.value } as Record<string, string>;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            {...attrs}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
              active ? "border-primary/50 bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon && <option.icon className="h-4 w-4" />}
            {option.label}
            {option.count ? <CountBadge count={option.count} className="ml-0.5" /> : null}
          </button>
        );
      })}
    </div>
    </>
  );
}

/** A native select that never pushes its card wider than the screen. */
export const SELECT_CLASS = "h-10 w-full min-w-0 max-w-full truncate rounded-lg border border-border bg-background px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
export const INPUT_CLASS = "h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";
