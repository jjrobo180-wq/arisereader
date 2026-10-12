// The Sheets app (App Store add-on, shared/sheetsApp.ts): a simple spreadsheet. One list of saved
// sheets, and a grid editor for the open one. Same shape as NotesKitApp (plugin-kit/NotesKitApp.tsx):
// a list screen plus a detail screen, with "makeId" used for new ids and "say" for a toast message.
import { useState } from "react";
import { Plus, Trash2, ArrowLeft, Table as TableIcon } from "lucide-react";
import { blankGrid, displayCell, saveSpreadsheet, removeSpreadsheet, DEFAULT_ROWS, DEFAULT_COLS, type Spreadsheet } from "@shared/sheetsApp";

const colLabel = (i: number) => String.fromCharCode(65 + i);

type Props = {
  name: string;
  blurb: string;
  sheets: Spreadsheet[];
  setSheets: (update: (all: Spreadsheet[]) => Spreadsheet[]) => void;
  makeId: () => string;
  say: (msg: string) => void;
};

export default function SheetsApp({ name, blurb, sheets, setSheets, makeId, say }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = sheets.find((s) => s.id === openId) ?? null;

  const newSheet = () => {
    const sheet: Spreadsheet = { id: makeId(), name: "Untitled sheet", rows: blankGrid(DEFAULT_ROWS, DEFAULT_COLS), updatedAt: new Date().toISOString() };
    setSheets((all) => saveSpreadsheet(all, sheet));
    setOpenId(sheet.id);
  };
  const del = (id: string) => { setSheets((all) => removeSpreadsheet(all, id)); if (openId === id) setOpenId(null); say("Sheet deleted."); };

  if (open) {
    return <SheetGrid sheet={open} onChange={(next) => setSheets((all) => saveSpreadsheet(all, next))} onBack={() => setOpenId(null)} />;
  }

  return <div className="space-y-4" data-testid="sheets-app-list">
    <div>
      <h2 className="text-lg font-black text-slate-900">{name}</h2>
      <p className="mt-1 text-sm text-slate-500">{blurb}</p>
    </div>
    <button type="button" onClick={newSheet} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white" data-testid="sheets-new"><Plus size={16} /> New sheet</button>
    {sheets.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No sheets yet. Make one for a budget, a packing list or anything with rows and columns.</p>
      : <ul className="space-y-2">{sheets.map((s) => <li key={s.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <button type="button" onClick={() => setOpenId(s.id)} className="flex min-h-11 flex-1 items-center gap-2.5 text-left text-sm font-bold text-slate-900"><TableIcon size={16} className="shrink-0 text-emerald-600" />{s.name}</button>
        <button type="button" onClick={() => del(s.id)} aria-label={`Delete ${s.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
      </li>)}</ul>}
  </div>;
}

function SheetGrid({ sheet, onChange, onBack }: { sheet: Spreadsheet; onChange: (s: Spreadsheet) => void; onBack: () => void }) {
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const setCell = (r: number, c: number, v: string) => {
    const rows = sheet.rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? v : cell) : row);
    onChange({ ...sheet, rows });
  };
  return <div className="space-y-3" data-testid="sheets-grid">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ArrowLeft size={16} /> Back</button>
      <input value={sheet.name} maxLength={80} onChange={(e) => onChange({ ...sheet, name: e.target.value })} aria-label="Sheet name" className="min-h-10 flex-1 rounded-lg border border-transparent px-2 text-sm font-black hover:border-slate-200 focus:border-slate-300 focus:outline-none" />
    </div>
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="border-collapse text-sm">
        <thead><tr><th className="sticky left-0 z-10 w-10 border-b border-r border-slate-200 bg-slate-50" />{sheet.rows[0]?.map((_, c) => <th key={c} className="min-w-[88px] border-b border-r border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500">{colLabel(c)}</th>)}</tr></thead>
        <tbody>{sheet.rows.map((row, r) => <tr key={r}>
          <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-bold text-slate-400">{r + 1}</td>
          {row.map((cell, c) => {
            const isEditing = editing?.r === r && editing?.c === c;
            return <td key={c} className="border-b border-r border-slate-100 p-0">
              {isEditing
                ? <input autoFocus value={cell} onChange={(e) => setCell(r, c, e.target.value)} onBlur={() => setEditing(null)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(null); }}
                    className="min-h-9 w-full min-w-[88px] border-0 px-2 py-1 text-sm outline-none" />
                : <button type="button" onClick={() => setEditing({ r, c })} className="block min-h-9 w-full min-w-[88px] px-2 py-1 text-left text-sm text-slate-800 hover:bg-slate-50" title={cell.startsWith("=") ? cell : undefined}>
                    {displayCell(sheet.rows, r, c) || " "}
                  </button>}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <p className="text-xs text-slate-500">Tap a cell to edit. Start with = for a formula, like =SUM(A1:A5) or =A1+B1.</p>
  </div>;
}
