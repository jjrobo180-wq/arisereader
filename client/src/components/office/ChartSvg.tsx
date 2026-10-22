// Charts drawn as SVG: column, bar, line, area, pie, doughnut and scatter. Used by Sheets and Slides.
export const CHART_COLORS = ["#4285f4", "#ea4335", "#fbbc04", "#34a853", "#ff6d01", "#46bdc6", "#7baaf7", "#f07b72", "#fcd04f", "#71c287", "#9e69af", "#c2185b"];
export type ChartKindName = "column" | "bar" | "line" | "area" | "pie" | "doughnut" | "scatter";

const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};
const short = (n: number) => (Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e4 ? `${+(n / 1e3).toFixed(1)}K` : `${+n.toFixed(2)}`);

export function ChartSvg({ kind, labels, series, title, legend = true, stacked, width, height, colors = CHART_COLORS, dark }: {
  kind: ChartKindName; labels: string[]; series: { name: string; values: number[] }[]; title?: string; legend?: boolean; stacked?: boolean; width: number; height: number; colors?: string[]; dark?: boolean;
}) {
  const ink = dark ? "#e2e8f0" : "#334155", faint = dark ? "#475569" : "#e2e8f0", sub = dark ? "#94a3b8" : "#64748b";
  const top = title ? 34 : 12;
  const showLegend = legend && (series.length > 1 || kind === "pie" || kind === "doughnut");
  const legendH = showLegend ? 26 : 0;
  const empty = !series.length || !labels.length;
  if (empty) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><rect width={width} height={height} fill={dark ? "#0f172a" : "#fff"} /><text x={width / 2} y={height / 2} textAnchor="middle" fontSize="13" fill={sub}>Pick a range with numbers to chart</text></svg>;

  const legendItems = kind === "pie" || kind === "doughnut" ? labels.map((l, i) => ({ name: l, color: colors[i % colors.length] })) : series.map((s, i) => ({ name: s.name, color: colors[i % colors.length] }));
  const legendEl = showLegend && <g transform={`translate(0 ${height - 18})`}>{(() => {
    let x = 12; const out: JSX.Element[] = [];
    legendItems.slice(0, 12).forEach((it, i) => { const w = Math.min(140, 22 + it.name.length * 6.5); if (x + w > width) return; out.push(<g key={i} transform={`translate(${x} 0)`}><rect width="10" height="10" rx="2" fill={it.color} /><text x="15" y="9" fontSize="11" fill={ink}>{it.name.slice(0, 18)}</text></g>); x += w; });
    return out;
  })()}</g>;

  let body: JSX.Element;
  if (kind === "pie" || kind === "doughnut") {
    const vals = series[0].values.map((v) => Math.max(0, v));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = width / 2, cy = top + (height - top - legendH) / 2, r = Math.max(10, Math.min(width, height - top - legendH) / 2 - 10);
    let a0 = -Math.PI / 2;
    body = <g>{vals.map((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a: number, rr: number) => `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`;
      const ri = kind === "doughnut" ? r * 0.55 : 0;
      const d = v / total >= 0.9999 ? (ri ? `M ${p(0, r)} A ${r} ${r} 0 1 1 ${p(Math.PI, r)} A ${r} ${r} 0 1 1 ${p(0, r)} M ${p(0, ri)} A ${ri} ${ri} 0 1 0 ${p(Math.PI, ri)} A ${ri} ${ri} 0 1 0 ${p(0, ri)}` : `M ${p(0, r)} A ${r} ${r} 0 1 1 ${p(Math.PI, r)} A ${r} ${r} 0 1 1 ${p(0, r)}`)
        : ri ? `M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${p(a1, ri)} A ${ri} ${ri} 0 ${large} 0 ${p(a0, ri)} Z` : `M ${cx} ${cy} L ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} Z`;
      const mid = (a0 + a1) / 2;
      const lab = v / total >= 0.05 ? <text x={cx + (ri ? (r + ri) / 2 : r * 0.62) * Math.cos(mid)} y={cy + (ri ? (r + ri) / 2 : r * 0.62) * Math.sin(mid) + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{Math.round((v / total) * 100)}%</text> : null;
      a0 = a1;
      return <g key={i}><path d={d} fill={colors[i % colors.length]} stroke={dark ? "#0f172a" : "#fff"} strokeWidth="1.5" fillRule="evenodd"><title>{`${labels[i]}: ${v}`}</title></path>{lab}</g>;
    })}</g>;
  } else {
    const horizontal = kind === "bar";
    const left = 48, right = 14, bottom = 30 + legendH;
    const pw = width - left - right, ph = height - top - bottom;
    const n = labels.length;
    const sums = labels.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
    const all = series.flatMap((s) => s.values);
    const maxV = stacked && (kind === "column" || kind === "bar" || kind === "area") ? Math.max(0, ...sums) : Math.max(0, ...all);
    const minV = Math.min(0, ...all);
    const hi = nice(maxV), lo = minV < 0 ? -nice(-minV) : 0;
    const ticks = 5;
    const scale = (v: number) => ((v - lo) / (hi - lo || 1));
    const grid: JSX.Element[] = [];
    for (let t = 0; t <= ticks; t++) {
      const v = lo + ((hi - lo) * t) / ticks;
      if (horizontal) { const x = left + scale(v) * pw; grid.push(<g key={t}><line x1={x} x2={x} y1={top} y2={top + ph} stroke={faint} /><text x={x} y={top + ph + 14} textAnchor="middle" fontSize="10" fill={sub}>{short(v)}</text></g>); }
      else { const y = top + ph - scale(v) * ph; grid.push(<g key={t}><line x1={left} x2={left + pw} y1={y} y2={y} stroke={faint} /><text x={left - 6} y={y + 3} textAnchor="end" fontSize="10" fill={sub}>{short(v)}</text></g>); }
    }
    const step = (horizontal ? ph : pw) / Math.max(1, n);
    const everyLabel = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((horizontal ? ph : pw) / 46))));
    const catLabels = labels.map((l, i) => i % everyLabel ? null : horizontal
      ? <text key={i} x={left - 6} y={top + step * i + step / 2 + 3} textAnchor="end" fontSize="10" fill={sub}>{l.slice(0, 8)}</text>
      : <text key={i} x={left + step * i + step / 2} y={top + ph + 14} textAnchor="middle" fontSize="10" fill={sub}>{l.slice(0, 10)}</text>);
    let marks: JSX.Element[] = [];
    if (kind === "column" || kind === "bar") {
      const groupW = step * 0.72, bw = stacked ? groupW : groupW / series.length;
      const base = scale(0);
      marks = labels.flatMap((_, i) => {
        let acc = 0;
        return series.map((s, si) => {
          const v = s.values[i] || 0;
          const from = stacked ? acc : 0; const to = from + v; if (stacked) acc += Math.max(0, v);
          const a = scale(Math.min(from, to)), b = scale(Math.max(from, to));
          const off = (step - groupW) / 2 + (stacked ? 0 : bw * si);
          const c = colors[si % colors.length];
          return horizontal
            ? <rect key={`${i}-${si}`} x={left + a * pw} y={top + step * i + off} width={Math.max(0.5, (b - a) * pw)} height={Math.max(1, bw - 1)} fill={c} rx="1.5"><title>{`${s.name} · ${labels[i]}: ${v}`}</title></rect>
            : <rect key={`${i}-${si}`} x={left + step * i + off} y={top + ph - b * ph} width={Math.max(1, bw - 1)} height={Math.max(0.5, (b - a) * ph)} fill={c} rx="1.5"><title>{`${s.name} · ${labels[i]}: ${v}`}</title></rect>;
        });
      });
      void base;
    } else if (kind === "line" || kind === "area") {
      const acc = labels.map(() => 0);
      marks = series.map((s, si) => {
        const pts = s.values.map((v, i) => { const val = stacked && kind === "area" ? (acc[i] += v) : v; return [left + step * i + step / 2, top + ph - scale(val) * ph] as const; });
        const c = colors[si % colors.length];
        const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
        return <g key={si}>
          {kind === "area" && <path d={`${line} L ${pts[pts.length - 1][0]} ${top + ph - scale(0) * ph} L ${pts[0][0]} ${top + ph - scale(0) * ph} Z`} fill={c} opacity="0.25" />}
          <path d={line} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.length <= 40 && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={c}><title>{`${s.name} · ${labels[i]}: ${s.values[i]}`}</title></circle>)}
        </g>;
      });
    } else {
      // Scatter: the labels are x values when they are numbers, otherwise positions.
      const xs = labels.map((l, i) => (Number.isFinite(Number(l)) && l !== "" ? Number(l) : i + 1));
      const xMin = Math.min(...xs), xMax = Math.max(...xs);
      marks = series.map((s, si) => <g key={si}>{s.values.map((v, i) => <circle key={i} cx={left + ((xs[i] - xMin) / (xMax - xMin || 1)) * pw} cy={top + ph - scale(v) * ph} r="4" fill={colors[si % colors.length]} opacity="0.85"><title>{`(${xs[i]}, ${v})`}</title></circle>)}</g>);
    }
    body = <g>{grid}<line x1={left} x2={left + (horizontal ? 0 : pw)} y1={top + ph} y2={top + (horizontal ? 0 : ph)} stroke={sub} />{marks}{kind !== "scatter" && catLabels}</g>;
  }
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fontFamily="Inter, Arial, sans-serif">
    <rect width={width} height={height} fill={dark ? "#0f172a" : "#fff"} />
    {title && <text x={width / 2} y={22} textAnchor="middle" fontSize="15" fontWeight="700" fill={ink}>{title}</text>}
    {body}
    {legendEl}
  </svg>;
}
