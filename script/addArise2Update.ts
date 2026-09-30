import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function edit(path: string, fn: (s: string) => string) {
  const p = resolve(process.cwd(), path); const old = readFileSync(p, "utf8"); const next = fn(old); if (next === old) console.log(`[arise2] no change ${path}`); else { writeFileSync(p, next); console.log(`[arise2] updated ${path}`); }
}

edit("client/src/pages/Library.tsx", s => {
  if (s.includes('Arise2HomeAnnouncement')) return s;
  s = s.replace('import { EngagementHub } from "@/components/EngagementHub";', 'import { EngagementHub } from "@/components/EngagementHub";\nimport { Arise2HomeAnnouncement, Arise2UpdateButton } from "@/components/Arise2Update";');
  s = s.replace('<div className="px-2 pb-2 pt-1">\n                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quick menu</p>\n                      </div>', '<div className="px-2 pb-2 pt-1">\n                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quick menu</p>\n                      </div>\n                      <div className="mb-2"><Arise2UpdateButton compact /></div>');
  s = s.replace('<div className="space-y-1">\n                      {user?.isAdmin', '<div className="space-y-1">\n                      <div className="mb-2"><Arise2UpdateButton compact /></div>\n                      {user?.isAdmin');
  s = s.replace('<main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">', '<main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">\n        <Arise2HomeAnnouncement />');
  return s;
});

const dashboardFiles = ["client/src/pages/TeacherDashboard.tsx", "client/src/pages/ParentDashboard.tsx", "client/src/pages/EyeGazeHome.tsx", "client/src/pages/Admin.tsx"];
for (const file of dashboardFiles) edit(file, s => {
  if (s.includes('Arise2HomeAnnouncement')) return s;
  const imports = s.match(/^import .*$/gm) || []; if (!imports.length) return s;
  const last = imports[imports.length - 1]; s = s.replace(last, last + '\nimport { Arise2HomeAnnouncement } from "@/components/Arise2Update";');
  const main = s.indexOf('<main'); if (main >= 0) { const close = s.indexOf('>', main); if (close >= 0) return s.slice(0, close + 1) + '\n        <Arise2HomeAnnouncement />' + s.slice(close + 1); }
  const ret = s.indexOf('return ('); if (ret >= 0) { const div = s.indexOf('<div', ret); if (div >= 0) { const close = s.indexOf('>', div); if (close >= 0) return s.slice(0, close + 1) + '\n      <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6"><Arise2HomeAnnouncement /></div>' + s.slice(close + 1); } }
  return s;
});
