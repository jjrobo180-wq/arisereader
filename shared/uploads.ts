// Files a teacher can add to the Exemplar Makers (SPED Exemplar Maker, Kha ELA): what is accepted, and how much.
export const UPLOAD_LIMITS = { files: 3, fileBytes: 6_000_000 } as const;
/** For <input type="file" accept>. Older Word/Excel/PowerPoint files (.doc .xls .ppt) are not read: save as .docx/.xlsx/.pptx. */
export const UPLOAD_ACCEPT = ".pdf,.docx,.xlsx,.pptx,.csv,.tsv,.txt,.md,.html,.htm,.png,.jpg,.jpeg,.webp";
export type UploadedFile = { name: string; data: string };
