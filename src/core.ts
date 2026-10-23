export type Member = { id: string; name: string; tastes: string[] };
export type Signal = { memberId: string; name: string; value: string; kind: 'taste' | 'constraint' };
export type Location = { label: string; lat: number; lon: number };
export type Place = { id: string; name: string; lat: number; lon: number; category: string; price?: number; hours?: string; url?: string; tags: string[] };
export type Option = Place & { reason: string; appealsTo: string[]; distanceKm: number; score: number };
export type Session = {
  id: string; request: string; location: Location; members: Member[]; signals: Signal[];
  note: string; budget?: number; radiusKm: number; options: Option[]; votes: Record<string, string>;
  source: 'fixture' | 'qloo'; createdAt: number; version: number;
  discord?: { channelId: string; contextRead: number; statements: number };
};

export const DEMO_LOCATION: Location = { label: 'Williamsburg, Brooklyn', lat: 40.7178, lon: -73.9632 };
export const DEMO_MEMBERS: Member[] = [
  { id: 'alex', name: 'Alex', tastes: ['quiet jazz', 'conversation'] },
  { id: 'sam', name: 'Sam', tastes: ['late-night food'] },
  { id: 'jo', name: 'Jo', tastes: ['a place that feels like a night out'] },
];
export const DEMO_PLACES: Place[] = [
  { id: 'demo-1', name: 'Night Owl Café', lat: 40.7169, lon: -73.9618, category: 'café', price: 18, hours: 'Unconfirmed', tags: ['quiet', 'coffee', 'conversation'] },
  { id: 'demo-2', name: 'Static Room', lat: 40.7192, lon: -73.9625, category: 'bar', price: 28, hours: 'Unconfirmed', tags: ['lively', 'music', 'cocktails'] },
  { id: 'demo-3', name: 'Northside Bites', lat: 40.7157, lon: -73.9646, category: 'restaurant', price: 24, hours: 'Unconfirmed', tags: ['food', 'casual', 'group'] },
  { id: 'demo-4', name: 'After Hours Diner', lat: 40.7201, lon: -73.9662, category: 'restaurant', price: 19, hours: 'Unconfirmed', tags: ['late-night', 'food', 'conversation'] },
];

export function resolveLocation(request: string): Location | null {
  return /\b(?:williamsburg|brooklyn)\b/i.test(request) ? DEMO_LOCATION : null;
}

export function signalsFor(members: Member[], note = ''): Signal[] {
  const tastes = members.flatMap(member => member.tastes.map(value => ({ memberId: member.id, name: member.name, value, kind: 'taste' as const })));
  return note.trim() ? [...tastes, { memberId: 'plan', name: 'Plan update', value: note.trim(), kind: 'constraint' }] : tastes;
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function filterPlaces(session: Session, places: Place[]): (Place & { distanceKm: number })[] {
  return places.map(place => ({ ...place, distanceKm: distanceKm(session.location, place) }))
    .filter(place => place.distanceKm <= session.radiusKm && (session.budget === undefined || place.price === undefined || place.price <= session.budget));
}

export function vote(session: Session, memberId: string, optionId: string): Session {
  if (!session.members.some(member => member.id === memberId)) throw new Error('Member not in plan');
  if (!session.options.some(option => option.id === optionId)) throw new Error('Option not in plan');
  return { ...session, votes: { ...session.votes, [memberId]: optionId }, version: session.version + 1 };
}

export function winner(session: Session): Option | undefined {
  const counts = new Map<string, number>();
  for (const id of Object.values(session.votes)) counts.set(id, (counts.get(id) || 0) + 1);
  return session.options.find(option => counts.get(option.id) === Math.max(0, ...counts.values()));
}

export function sanitizeSession(session: Session): Session {
  return { ...session, votes: Object.fromEntries(Object.entries(session.votes).filter(([memberId, optionId]) =>
    session.members.some(member => member.id === memberId) && session.options.some(option => option.id === optionId))) };
}
