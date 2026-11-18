// Tables in notes: add and delete rows and columns, delete the table, and tidy a table pasted from
// Google Sheets, Excel or a web page (no fixed sizes or styles on the cells, no empty rows above or below,
// no empty columns at the sides, and something in every cell so it can be tapped and typed in).
// Plain DOM so useRichEditor (every note editor) can use it; tests run it in a real browser.

export type TableAction = "rowAbove" | "rowBelow" | "colLeft" | "colRight" | "delRow" | "delCol" | "delTable";

export const TABLE_ACTIONS: { action: TableAction; label: string; danger?: boolean }[] = [
  { action: "rowAbove", label: "Add row above" },
  { action: "rowBelow", label: "Add row below" },
  { action: "colLeft", label: "Add column left" },
  { action: "colRight", label: "Add column right" },
  { action: "delRow", label: "Delete row", danger: true },
  { action: "delCol", label: "Delete column", danger: true },
  { action: "delTable", label: "Delete table", danger: true },
];

/** The table cell the caret is in, if it's inside `root`. */
export function cellOf(node: Node | null | undefined, root: HTMLElement | null): HTMLTableCellElement | null {
  if (!node || !root) return null;
  const el = (node.nodeType === 1 ? node : node.parentElement) as HTMLElement | null;
  const cell = el?.closest("td,th") as HTMLTableCellElement | null;
  return cell && root.contains(cell) ? cell : null;
}

const newCell = (like: Element | null | undefined, doc: Document) => {
  const c = doc.createElement(like?.tagName === "TH" ? "th" : "td");
  c.innerHTML = "<br>";
  return c;
};

/** Does the change to the cell's table. Returns the cell to put the caret in next (null when the table is gone). */
export function tableAction(cell: HTMLTableCellElement, action: TableAction): HTMLTableCellElement | null {
  const row = cell.parentElement as HTMLTableRowElement;
  const table = cell.closest("table") as HTMLTableElement;
  const doc = cell.ownerDocument;
  const col = cell.cellIndex;
  const rows = Array.from(table.rows);
  const removeTable = () => {
    const after = doc.createElement("p");
    after.innerHTML = "<br>";
    table.replaceWith(after);
    return null;
  };
  switch (action) {
    case "rowAbove":
    case "rowBelow": {
      const tr = doc.createElement("tr");
      const count = Math.max(...rows.map((r) => r.cells.length), 1);
      for (let i = 0; i < count; i++) tr.appendChild(newCell(null, doc)); // a new row is an ordinary row, even next to a heading row
      row.parentElement!.insertBefore(tr, action === "rowAbove" ? row : row.nextSibling);
      return tr.cells[Math.min(col, tr.cells.length - 1)] ?? null;
    }
    case "colLeft":
    case "colRight": {
      let made: HTMLTableCellElement | null = null;
      for (const r of rows) {
        const at = Math.min(action === "colLeft" ? col : col + 1, r.cells.length);
        const c = newCell(r.cells[Math.min(col, r.cells.length - 1)], doc);
        r.insertBefore(c, r.cells[at] ?? null);
        if (r === row) made = c as HTMLTableCellElement;
      }
      return made;
    }
    case "delRow": {
      const i = rows.indexOf(row);
      row.remove();
      const left = Array.from(table.rows);
      if (!left.length) return removeTable();
      const next = left[Math.min(i, left.length - 1)];
      return next.cells[Math.min(col, next.cells.length - 1)] ?? null;
    }
    case "delCol": {
      for (const r of rows) {
        r.cells[col]?.remove();
        if (!r.cells.length) r.remove();
      }
      if (!table.rows.length) return removeTable();
      return row.isConnected && row.cells.length ? row.cells[Math.min(col, row.cells.length - 1)] : table.rows[0].cells[0] ?? null;
    }
    case "delTable":
      return removeTable();
  }
}

/** Puts the caret at the end of a cell. */
export function placeCaret(cell: HTMLElement) {
  const sel = cell.ownerDocument.getSelection();
  if (!sel) return;
  const r = cell.ownerDocument.createRange();
  r.selectNodeContents(cell);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

const blank = (el: Element) => !(el.textContent || "").replace(/[\s ​]/g, "") && !el.querySelector("img");

/** Tidies every table inside `root` (a pasted fragment). */
export function tidyTables(root: ParentNode) {
  root.querySelectorAll("table").forEach((t) => {
    const table = t as HTMLTableElement;
    // Fixed widths, heights and cell styles from a spreadsheet make cells hard to tap and type in.
    for (const el of [table, ...Array.from(table.querySelectorAll("tr,td,th"))]) { el.removeAttribute("style"); el.removeAttribute("width"); el.removeAttribute("height"); }
    // Empty rows above and below.
    const rows = () => Array.from(table.rows);
    while (rows().length && blank(rows()[0])) rows()[0].remove();
    while (rows().length && blank(rows()[rows().length - 1])) rows()[rows().length - 1].remove();
    if (!rows().length) { table.remove(); return; }
    // Empty columns at the sides (only when every row has a plain cell there).
    const width = () => Math.max(...rows().map((r) => r.cells.length));
    const columnBlank = (i: number) => rows().every((r) => !r.cells[i] || (r.cells[i].colSpan === 1 && blank(r.cells[i])));
    while (width() > 1 && columnBlank(width() - 1)) { const i = width() - 1; rows().forEach((r) => r.cells[i]?.remove()); }
    while (width() > 1 && columnBlank(0)) rows().forEach((r) => r.cells[0]?.remove());
    // Something in every cell, so the caret can go there.
    table.querySelectorAll("td,th").forEach((c) => { if (!c.innerHTML.trim()) c.innerHTML = "<br>"; });
  });
}

/** Pasted HTML with its tables tidied. */
export function tidyPastedHtml(html: string, doc: Document = document): string {
  if (!/<table/i.test(html)) return html;
  const box = doc.createElement("div");
  box.innerHTML = html;
  tidyTables(box);
  return box.innerHTML;
}

export const NEW_TABLE_HTML = `<table><tbody>${Array.from({ length: 3 }, (_, r) => `<tr>${Array.from({ length: 3 }, () => (r ? "<td><br></td>" : "<th><br></th>")).join("")}</tr>`).join("")}</tbody></table><p><br></p>`;
