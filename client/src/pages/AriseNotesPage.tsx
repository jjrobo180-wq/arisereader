// Arise Notes inside Arise To Duo (#/arise-notes?hub=life|work): the same app as /notes/, opened from
// the App Store or the menu of either hub, or a side of the split screen. Back goes to the hub.
import { useLocation } from "wouter";
import NotesApp from "@/components/arise-notes/NotesApp";

export default function AriseNotesPage() {
  const [, navigate] = useLocation();
  const q = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const hub = q.get("hub") === "work" ? "work" : "life";
  const note = q.get("note") || undefined;
  return <NotesApp mode="embedded" hub={hub} startNote={note} onExit={() => navigate(hub === "work" ? "/workhub" : "/lifehub")} />;
}
