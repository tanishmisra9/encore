// Deterministic core: nothing here calls a model or a network. Qloo finds candidates; these rules decide what is safe to play.
export type Artist = { id: string; name: string; start?: number; end?: number; obscurity?: number; complexity?: number; themes: string[]; songs: string[]; genres: string[]; image?: string; via?: string; known?: { title: string; year: number; previewUrl: string }[] };
export type Media = { id: string; title: string; year: number; kind: 'film' | 'show'; image?: string; popularity?: number };
export type Reaction = 'smiled' | 'neutral' | 'upset';
export type Item = { id: string; kind: 'song' | 'film' | 'show'; code: string; title: string; by?: string; artistId?: string; genres: string[]; year: number; age: number; ages?: [number, number]; image?: string; previewUrl?: string | null; via?: string; found: boolean; notes: string[]; reaction?: Reaction };
export type Profile = { born: number; name?: string; anchors: { id: string; name: string }[]; weights: Record<string, number>; banned: string[] };
export type Pool = { artists: Artist[]; media: Media[] };

export const MIN_BORN = 1920, MAX_BORN = 1975, MAX_OBSCURITY = 3, MAX_COMPLEXITY = 6, SONGS = 6, MEDIA = 2;
// Themes that can distress; matched as whole words in Qloo's lyrical_themes.
const UPSETTING = /\b(death|dying|grief|loss|heartbreak|heartache|drinking|alcohol|violence|war|despair|suicide|sorrow|loneliness)\b/i;
const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// "Bob Marley" and "Bob Marley & The Wailers" are one act, and a re-spelled title is the same song.
const sameAct = (a: string, b: string) => { const x = key(a), y = key(b); return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '); };
const clamp = (value: number) => Math.min(2, Math.max(0.25, value));

export const eraWindow = (born: number): [number, number] => [born + 10, born + 30];

// Active at any point in the person's formative years. Unknown start year is excluded: an unknown era is not safe to assume.
export function inWindow(artist: Pick<Artist, 'start' | 'end'>, born: number): boolean {
  const [from, to] = eraWindow(born);
  return artist.start !== undefined && artist.start <= to && (artist.end ?? Infinity) >= from;
}
export function safety(artist: Artist): { safe: boolean; notes: string[] } {
  const notes: string[] = [];
  if (!artist.songs.length) return { safe: false, notes: ['no named songs'] };
  if (artist.obscurity !== undefined && artist.obscurity > MAX_OBSCURITY) return { safe: false, notes: [`too obscure (${artist.obscurity})`] };
  if (artist.complexity !== undefined && artist.complexity > MAX_COMPLEXITY) return { safe: false, notes: [`too complex (${artist.complexity})`] };
  const hit = artist.themes.find(theme => UPSETTING.test(theme));
  if (hit) return { safe: false, notes: [`theme: ${hit}`] };
  if (!artist.themes.length) notes.push('themes unknown');
  if (artist.obscurity === undefined) notes.push('familiarity unrated');
  return { safe: true, notes };
}

export function validate(input: unknown): { born: number; name?: string; anchors: string[] } {
  const body = (input ?? {}) as Record<string, unknown>;
  const born = Number(body.born);
  if (!Number.isInteger(born) || born < MIN_BORN || born > MAX_BORN) throw new Error(`Birth year must be a whole year from ${MIN_BORN} to ${MAX_BORN}.`);
  const anchors = (Array.isArray(body.anchors) ? body.anchors : []).filter((a): a is string => typeof a === 'string').map(a => a.trim().slice(0, 80)).filter(Boolean);
  const unique = [...new Set(anchors)];
  if (unique.length < 1 || unique.length > 3) throw new Error('Name one to three artists they loved.');
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
  return { born, name: name || undefined, anchors: unique };
}

// The headline promises "when they were 19", so artists active around ages 15 to 25 outrank ones that only touch the edges of the window.
const core = (artist: Artist, born: number) => artist.known?.length ? 1.15 : artist.start !== undefined && artist.start <= born + 25 && (artist.end ?? Infinity) >= born + 15 ? 1.15 : 1;
const weight = (profile: Profile, artist: Artist) => artist.genres.length ? Math.max(...artist.genres.map(g => profile.weights[g] ?? 1)) : 1;
// Qloo order is the base ranking; learned genre weights bend it.
const ranked = (pool: Artist[], profile: Profile) => pool.map((artist, order) => ({ artist, score: weight(profile, artist) * core(artist, profile.born) * (1 - order / (pool.length + 10)) }))
  .sort((a, b) => b.score - a.score).map(entry => entry.artist);

export function eligible(pool: Pool, profile: Profile): Artist[] {
  return ranked(pool.artists.filter(a => inWindow(a, profile.born) && safety(a).safe && !profile.banned.includes(a.id)), profile);
}

function songItem(artist: Artist, profile: Profile, code: string, used: Set<string>): Item {
  // Artists the caregiver named come with songs dated by iTunes, so their year and age are exact.
  const nearest = [...(artist.known ?? [])].sort((a, b) => Math.abs(a.year - profile.born - 19) - Math.abs(b.year - profile.born - 19));
  const dated = nearest.find(song => !used.has(key(song.title))) ?? nearest[0];
  if (dated) return { id: `${artist.id}:${dated.title}`, kind: 'song', code, title: dated.title, by: artist.name, artistId: artist.id, genres: artist.genres, year: dated.year, age: dated.year - profile.born, ages: [dated.year - profile.born, dated.year - profile.born], image: artist.image, previewUrl: dated.previewUrl, found: false, notes: [`released ${dated.year}`] };
  const title = artist.songs.find(song => !used.has(key(song))) ?? artist.songs[0];
  // Qloo gives the artist's active years, not each song's release year, so show the ages they were active within the window.
  const from = Math.max(artist.start ?? 0, profile.born + 10), to = Math.min(artist.end ?? Infinity, profile.born + 30);
  return { id: `${artist.id}:${title}`, kind: 'song', code, title, by: artist.name, artistId: artist.id, genres: artist.genres, year: from, age: from - profile.born, ages: [from - profile.born, to - profile.born], image: artist.image, via: artist.via, found: !profile.anchors.some(a => a.id === artist.id),
    notes: [`active ${artist.start}${artist.end ? `-${artist.end}` : ' on'}`, ...safety(artist).notes] };
}
const mediaItem = (media: Media, profile: Profile, code: string): Item => ({ id: media.id, kind: media.kind, code, title: media.title, genres: [], year: media.year, age: media.year - profile.born, image: media.image, found: true, notes: [`released ${media.year}`] });

// Songs the artist is known for, other than the ones already picked, in Qloo's order.
export const alternates = (pool: Pool, item: Item): string[] => pool.artists.find(a => a.id === item.artistId)?.songs.filter(song => song !== item.title) ?? [];

export function buildPlan(pool: Pool, profile: Profile): Item[] {
  const used = new Set<string>(), items: Item[] = [];
  const seen = new Set<string>();
  for (const artist of eligible(pool, profile)) {
    if (items.length >= SONGS) break;
    if ([...seen].some(name => sameAct(name, artist.name))) continue;
    const item = songItem(artist, profile, `A${items.length + 1}`, used);
    if (used.has(key(item.title))) continue;
    seen.add(artist.name); used.add(key(item.title)); items.push(item);
  }
  const media = pool.media.filter(m => m.year >= profile.born + 10 && m.year <= profile.born + 30).slice(0, MEDIA);
  media.forEach((m, i) => items.push(mediaItem(m, profile, `B${i + 1}`)));
  return items;
}

export function prompts(items: Item[], profile: Profile): string[] {
  const songs = items.filter(i => i.kind === 'song'), media = items.find(i => i.kind !== 'song');
  const out: string[] = [];
  if (songs[0]) out.push(`Do you remember "${songs[0].title}"? Where did you hear it?`);
  out.push(`What was your life like in ${profile.born + 18}?`);
  if (media) out.push(`Did you ever see "${media.title}"?`);
  else if (songs[1]) out.push(`Did you ever dance to "${songs[1].title}"?`);
  return out;
}

// Reactions are scoped to this profile only. Upset bans the artist and cools its genres; smiled warms them.
export function applyReaction(profile: Profile, item: Item, reaction: Reaction): Profile {
  const next: Profile = { ...profile, weights: { ...profile.weights }, banned: [...profile.banned] };
  if (reaction === 'upset' && item.artistId && !next.banned.includes(item.artistId)) next.banned.push(item.artistId);
  if (reaction === 'neutral') return next;
  for (const genre of item.genres) next.weights[genre] = clamp((next.weights[genre] ?? 1) * (reaction === 'upset' ? 0.5 : reaction === 'smiled' ? 1.25 : 1));
  return next;
}

// Replace upset or newly banned songs with the next eligible artist; reacted-and-kept items never move.
export function refill(plan: Item[], pool: Pool, profile: Profile): Item[] {
  const keep = (item: Item) => item.kind !== 'song' || (item.reaction !== 'upset' && !(item.artistId && profile.banned.includes(item.artistId)));
  const used = new Set(plan.filter(keep).map(i => key(i.title))), names = plan.filter(keep).map(i => i.by).filter((n): n is string => !!n);
  const spare = eligible(pool, profile).filter(a => !names.some(n => sameAct(n, a.name)) && !plan.some(i => i.artistId === a.id));
  return plan.map(item => {
    if (keep(item)) return item;
    const artist = spare.shift();
    if (!artist) return { ...item, reaction: 'upset' as const, title: 'No further song fits', by: undefined, artistId: undefined, previewUrl: null, image: undefined, genres: [], notes: ['no safe in-era artist left'] };
    const next = songItem(artist, profile, item.code, used); used.add(key(next.title)); names.push(artist.name); return next;
  });
}
