// The parent invitation dressed for an email: the site's logo on top, three small pictures of how the
// program works, and the words laid out with headings, lists and links.
//
// The rich version is made from the plain words in the "copy" box, so anything the teacher changed
// there is in it. The same logo and pictures go on top of the emails the site sends itself.

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** The three pictures: how the program works, at a glance. They are drawn with characters, so they show even when an email app blocks images. */
export const INVITE_PICTURES = [
  { picture: "📖", label: "Read a book" },
  { picture: "✅", label: "Pass the quiz" },
  { picture: "⭐", label: "Earn points" },
] as const;

/** The three pictures as one line of plain words, so a message pasted as words only still has them. */
export const PICTURE_LINE = INVITE_PICTURES.map((p) => `${p.picture} ${p.label}`).join("   ");

/** Where the logo lives on the site. Email apps load it from there. */
export const logoUrl = (siteUrl: string) => `${siteUrl.replace(/\/+$/, "")}/icon-192.png`;

type Look = "light" | "dark";
const LOOKS: Record<Look, { name: string; tagline: string; tile: string; tileText: string }> = {
  light: { name: "#6d28d9", tagline: "#6b7280", tile: "#f5f3ff", tileText: "#1f2937" },
  dark: { name: "#c4b5fd", tagline: "#94a3b8", tile: "#1a1730", tileText: "#e2e8f0" },
};

/** The top of an invitation: the logo beside the site's name, then the three pictures. Tables, because email apps lay those out reliably. */
export function inviteBrandHtml(siteUrl: string, look: Look = "light"): string {
  const c = LOOKS[look];
  const tiles = INVITE_PICTURES.map((t) => `<td width="33%" align="center" valign="top" style="padding:0 4px;"><div style="background-color:${c.tile};border-radius:12px;padding:12px 6px;"><div style="font-size:28px;line-height:1.2;">${t.picture}</div><div style="margin-top:4px;font-size:13px;font-weight:bold;color:${c.tileText};">${escapeHtml(t.label)}</div></div></td>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
<td valign="middle" style="padding:0 12px 0 0;"><img src="${escapeHtml(logoUrl(siteUrl))}" width="48" height="48" alt="A.R.I.S.E. Reader logo" style="display:block;width:48px;height:48px;border-radius:12px;border:0;"></td>
<td valign="middle"><div style="font-size:24px;font-weight:bold;line-height:1.2;color:${c.name};">A.R.I.S.E. Reader</div><div style="font-size:14px;color:${c.tagline};">Read a book. Take a quiz. Earn points.</div></td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:18px 0 6px;"><tr>${tiles}</tr></table>`;
}

const LINK = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/g;
/** One line of words made safe for a page, with its web addresses turned into links. */
export function inviteInlineHtml(line: string, linkColor = "#6d28d9"): string {
  return line.split(LINK).map((part, i) => {
    if (i % 2 === 0) return escapeHtml(part);
    // A full stop or comma after an address is the sentence's, not the address's.
    const tail = /[.,;:!?)]+$/.exec(part)?.[0] || "";
    const address = tail ? part.slice(0, -tail.length) : part;
    const href = /^https?:\/\//i.test(address) ? address : `https://${address}`;
    return `<a href="${escapeHtml(href)}" style="color:${linkColor};">${escapeHtml(address)}</a>${escapeHtml(tail)}`;
  }).join("");
}
const inline = (line: string) => inviteInlineHtml(line);

/** "WHAT IT IS" is a heading: a short line with letters and no small ones. */
const isHeading = (line: string) => line.length <= 60 && /[A-Z]{3}/.test(line) && !/[a-z]/.test(line) && !/^(- |\d+\. )/.test(line) && !/https?:\/\/|www\./i.test(line);
/** "🏆 PRIZES AND COMPETITIONS" to "🏆 Prizes and competitions": small letters, with the first letter kept big. */
const headingWords = (line: string) => line.toLowerCase().replace(/[a-z]/, (c) => c.toUpperCase());

/** The words laid out: capital-letter lines as headings, "- " lines as a list, "1." lines as numbered steps, the rest as paragraphs. */
export function inviteWordsHtml(text: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let items: string[] = [];
  let para: string[] = [];
  const P = "margin:0 0 12px;";
  const closeList = () => { if (list) { out.push(`<${list} style="margin:0 0 12px;padding-left:24px;">${items.map((x) => `<li style="margin:0 0 6px;">${x}</li>`).join("")}</${list}>`); list = null; items = []; } };
  const closePara = () => { if (para.length) { out.push(`<p style="${P}">${para.join("<br>")}</p>`); para = []; } };
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { closeList(); closePara(); continue; }
    // The row of pictures is already drawn on top, so its line of words is not repeated.
    if (line === PICTURE_LINE) continue;
    const bullet = /^- (.*)$/.exec(line), step = /^\d+\. (.*)$/.exec(line);
    if (bullet || step) {
      const kind = bullet ? "ul" : "ol";
      closePara();
      if (list !== kind) closeList();
      list = kind;
      items.push(inline((bullet || step)![1]));
    } else if (list && /^\s{2,}\S/.test(raw) && items.length) {
      // An indented line under a step belongs to that step (the link to open, or what to choose there).
      items[items.length - 1] += `<br>${inline(line)}`;
    } else if (isHeading(line)) {
      closeList(); closePara();
      out.push(`<h3 style="margin:22px 0 8px;font-size:17px;color:#111827;">${escapeHtml(headingWords(line))}</h3>`);
    } else {
      closeList();
      para.push(inline(line));
    }
  }
  closeList(); closePara();
  return out.join("\n");
}

/** The whole invitation to paste into an email: logo, pictures, then the words. Light, so it sits well in any email app's own background. */
export function richInviteHtml(text: string, siteUrl: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;font-size:16px;line-height:1.6;color:#1f2937;">
${inviteBrandHtml(siteUrl, "light")}
<div style="margin-top:14px;">
${inviteWordsHtml(text)}
</div>
</div>`;
}
