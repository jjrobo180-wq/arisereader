// "Add a file" for the Exemplar Makers (SPED Exemplar Maker, Kha ELA): PDF, Word, Excel, PowerPoint, CSV or text. The files are sent
// to the server as they are (base64) and read there (server/uploadText.ts); nothing is read in the browser except the bytes.
import { UPLOAD_ACCEPT, UPLOAD_LIMITS, type UploadedFile } from "@shared/uploads";

const toBase64 = (file: File): Promise<string> => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ""));
  r.onerror = () => no(new Error("read failed"));
  r.readAsDataURL(file);
});

export default function UploadPicker({ files, setFiles, onError, testId }: { files: UploadedFile[]; setFiles: (f: UploadedFile[]) => void; onError: (message: string) => void; testId?: string }) {
  const add = async (picked: FileList | null) => {
    if (!picked?.length) return;
    onError("");
    const next = [...files];
    for (const f of [...picked]) {
      if (next.length >= UPLOAD_LIMITS.files) { onError(`Up to ${UPLOAD_LIMITS.files} files at a time.`); break; }
      if (f.size > UPLOAD_LIMITS.fileBytes) { onError(`“${f.name}” is too big. The most for one file is ${Math.round(UPLOAD_LIMITS.fileBytes / 1_000_000)} MB.`); continue; }
      try { next.push({ name: f.name, data: await toBase64(f) }); } catch { onError(`“${f.name}” couldn’t be read. Try adding it again.`); }
    }
    setFiles(next);
  };
  return (
    <div className="ml-mk-photos">
      <label className="ml-mk-photo">Add a file: PDF, Word, Excel, PowerPoint, CSV or text (up to {UPLOAD_LIMITS.files})
        <input type="file" accept={UPLOAD_ACCEPT} multiple data-testid={testId} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      </label>
      {files.length > 0 && <ul className="ml-mk-files">{files.map((f, i) => <li key={`${f.name}-${i}`}><span>{f.name}</span><button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></li>)}</ul>}
    </div>
  );
}
