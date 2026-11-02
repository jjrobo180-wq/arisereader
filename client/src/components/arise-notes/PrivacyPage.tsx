// Student data privacy for Arise Notes, written so a school or district can review it for a data
// privacy agreement (FERPA and COPPA). Shown inside the app and to anyone before signing in.
import { ChevronLeft, Shield } from "lucide-react";

const SECTIONS: [string, string[]][] = [
  ["What Arise Notes collects", [
    "The recordings you make or upload, while they are written down. By default the audio is deleted as soon as the transcript is made; only the text is kept. A person can choose to keep audio for 30 days or longer.",
    "The transcript, the AI summary and anything made from it (to-dos, emails, study tools), the note's name, folder and tags.",
    "Minutes used each month and which speech-to-text service handled each recording, for billing and to stop abuse.",
    "The account's name, username and email address, which are the same as the person's A.R.I.S.E. account.",
  ]],
  ["What it is used for", [
    "Only to give the person their notes. Recordings and notes are never sold, never used for advertising, and never used to train AI models.",
    "Speech to text and summaries are done by AI services under agreements that don't let them keep the data or train on it. Each service only receives what it needs for that one job.",
  ]],
  ["Who can see a note", [
    "Only the account that made it. Every request is checked on the server, so one account can never open another's notes.",
    "A note is shared only when its owner turns that on: with the people on their Family plan, or with a view-only link they can turn off at any time. Audio is never shared.",
    "A.R.I.S.E. staff do not read notes. Support only looks at an account's data when the account holder asks for help and agrees.",
  ]],
  ["Security", [
    "All data is encrypted in transit (HTTPS) and at rest. Audio is kept in private storage and only reached through short-lived signed links.",
    "Access to the systems that hold the data is limited to the people who run the service, with their own accounts.",
  ]],
  ["Students and children", [
    "Students under 13 can only use Arise Notes through an account a teacher or parent set up or approved (COPPA). Students can't sign up for Arise Notes on their own.",
    "When a school uses Arise Notes, A.R.I.S.E. acts as a \"school official\" under FERPA: student information in notes is used only for the school's purposes, stays under the school's control, and isn't shared with anyone else.",
    "IEP and parent-meeting summaries are drafts for the teacher to review. Nothing is sent to anyone automatically.",
  ]],
  ["Recording other people", [
    "Arise Notes reminds the person recording to tell everyone they are being recorded before each recording. Many places require everyone's consent; schools should follow their own recording policies.",
  ]],
  ["Keeping and deleting", [
    "A person can delete any note, or everything in Arise Notes at once from Settings → Privacy, which removes notes, transcripts, summaries, audio and usage records. Deleting an A.R.I.S.E. account deletes all of it too.",
    "A school or district can ask for its students' data to be returned or deleted at the end of an agreement.",
  ]],
  ["For districts", [
    "We sign data privacy agreements (including state student-privacy agreements) on request. Write to support at arisetodo.com with your district's agreement and we'll review and return it.",
  ]],
];

export default function PrivacyPage({ onBack }: { onBack?: () => void }) {
  return <main className="mx-auto max-w-3xl px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
    {onBack && <button type="button" onClick={onBack} className="an-btn an-ghost -ml-2 mb-2"><ChevronLeft className="h-5 w-5" />Back</button>}
    <div className="an-card p-6 sm:p-8">
      <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--an-violet-soft)] text-[var(--an-violet)]"><Shield className="h-6 w-6" aria-hidden /></span><div><h1 className="text-[24px] font-extrabold tracking-tight">Student data privacy</h1><p className="text-[14px] text-[var(--an-muted)]">Arise Notes · FERPA and COPPA</p></div></div>
      <p className="an-read mt-5 text-[15px] leading-relaxed">Arise Notes is built for classrooms, special education teams and families. This page explains, plainly, how it handles student and family information, so a school or district can review it.</p>
      {SECTIONS.map(([h, items]) => <section key={h} className="mt-6"><h2 className="text-[17px] font-bold">{h}</h2><ul className="an-read mt-2 space-y-2">{items.map((x, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed"><span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--an-violet)]" />{x}</li>)}</ul></section>)}
      <p className="mt-8 text-[13px] text-[var(--an-faint)]">Last updated November 2026. The full A.R.I.S.E. privacy policy is at <a className="underline" href="/privacy/">/privacy</a>.</p>
    </div>
  </main>;
}
