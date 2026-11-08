// Meetings recorded on the Apple Watch (native/notes-watch), waiting to be written down. The watch sends
// the audio to the iPhone; NotesApp queues it here and opens Upload, which takes the first one, starts on
// it by itself, and deletes the phone's copy of the file once it has read it.
import { removeWatchFile } from "@/lib/watch";

export type WatchRecording = { file: File; title: string; path: string };
const waiting: WatchRecording[] = [];

export function queueWatchRecording(r: WatchRecording): void {
  if (!waiting.some((w) => w.path === r.path)) waiting.push(r);
}
/** The next recording from the watch, if there is one (taken off the list). */
export function takeWatchRecording(): WatchRecording | null {
  return waiting.shift() ?? null;
}
export const watchRecordingsWaiting = () => waiting.length;
/** The phone's copy of the watch's file isn't needed once it's been read. */
export function doneWithWatchRecording(r: WatchRecording): void { removeWatchFile(r.path); }
