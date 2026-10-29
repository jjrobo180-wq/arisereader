-- Private storage for AI voice audio made once and reused (server/blobStore.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-cache', 'voice-cache', false, 52428800, array['audio/wav', 'audio/mpeg'])
on conflict (id) do nothing;
