// The SPED Exemplar Maker and the Kha ELA Worksheet Maker, opened from the Work Hub Lessons tab (next to "Worksheet maker").
// They are the same tools that live in the Math Lessons app (pages/SpedExemplarMaker.tsx, pages/KhaElaMaker.tsx), shown full screen here.
import { Suspense, lazy } from "react";
import { HubModal } from "./HubModal";
import "@/pages/mathLessons.css";

const Sped = lazy(() => import("@/pages/SpedExemplarMaker"));
const Kha = lazy(() => import("@/pages/KhaElaMaker"));

export type ExemplarTool = "sped" | "kha";

export default function HubExemplarModal({ which, onClose }: { which: ExemplarTool; onClose: () => void }) {
  return (
    <HubModal title={which === "sped" ? "SPED Exemplar Maker" : "Kha ELA Worksheet Maker"} size="full" onClose={onClose}>
      <div className="ml-root" style={{ minHeight: 0 }} data-testid={`exemplar-${which}`}>
        <main className="ml-main" style={{ padding: "0 0 24px" }}>
          <Suspense fallback={<p role="status">Loading…</p>}>{which === "sped" ? <Sped /> : <Kha />}</Suspense>
        </main>
      </div>
    </HubModal>
  );
}
