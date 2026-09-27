// Official channel IDs: selections are enforced by ID, never by an editable title.
export const YOUTUBE_CHANNEL_OPTIONS = [
  { id: 'UCLsooMJoIpl_7ux2jvdPB-Q', name: 'Super Simple Songs', emoji: '🎵', ageRanges: ['2-4','5-7','8-10','11-13'], topics: ['music','animals','letters','numbers','feelings','speech','daily-life','colors-shapes','social'] },
  { id: 'UCPlwvN0w4qFSP1FllALB92w', name: 'Numberblocks', emoji: '🔢', ageRanges: ['2-4','5-7','8-10'], topics: ['numbers'] },
  { id: 'UC_qs3c0ehDvZkbiEbOj6Drg', name: 'Alphablocks', emoji: '🔤', ageRanges: ['2-4','5-7'], topics: ['letters','reading'] },
  { id: 'UCrNnkOwFBnCS1awGjq_iJGQ', name: 'PBS KIDS', emoji: '📺', ageRanges: ['2-4','5-7','8-10'], topics: ['feelings','animals','science','social','safety','reading','daily-life'] },
  { id: 'UCoookXUzPciGrEZEXmh4Jjg', name: 'Sesame Street', emoji: '🧸', ageRanges: ['2-4','5-7'], topics: ['music','feelings','letters','numbers','social','daily-life'] },
  { id: 'UCRFIPG2u1DxKLNuE3y2SjHA', name: 'SciShow Kids', emoji: '🔬', ageRanges: ['5-7','8-10','11-13'], topics: ['science','animals'] },
];
export function normalizeYoutubeChannels(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && YOUTUBE_CHANNEL_OPTIONS.some(c => c.id === id))))
    : YOUTUBE_CHANNEL_OPTIONS.map(c => c.id);
}
export function youtubeChannelAllowed(channelId: string, selected: string[]) {
  return selected.includes(channelId) && YOUTUBE_CHANNEL_OPTIONS.some(c => c.id === channelId);
}
