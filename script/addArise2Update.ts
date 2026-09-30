import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Keep A.R.I.S.E. 2.0 available from the Library Quick Menu only.
// Do not add homepage announcement cards or a global floating launcher.
const libraryPath = resolve(process.cwd(), "client/src/pages/Library.tsx");
let library = readFileSync(libraryPath, "utf8");
let changed = false;

if (!library.includes('Arise2UpdateButton } from "@/components/Arise2Update"')) {
  const marker = 'import { EngagementHub } from "@/components/EngagementHub";';
  if (library.includes(marker)) {
    library = library.replace(
      marker,
      marker + '\nimport { Arise2UpdateButton } from "@/components/Arise2Update";'
    );
    changed = true;
  }
}

if (!library.includes("<Arise2UpdateButton compact")) {
  const quickMenuMarker = '<div className="px-2 pb-2 pt-1">\n                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quick menu</p>\n                      </div>';
  if (library.includes(quickMenuMarker)) {
    library = library.replace(
      quickMenuMarker,
      quickMenuMarker + '\n                      <div className="mb-2"><Arise2UpdateButton compact /></div>'
    );
    changed = true;
  }
}

if (changed) {
  writeFileSync(libraryPath, library);
  console.log("[arise2] kept A.R.I.S.E. 2.0 in Quick Menu only");
} else {
  console.log("[arise2] Quick Menu entry already present; no homepage promo added");
}
