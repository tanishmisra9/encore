export type Member = { id: string; name: string; tastes: string[] };
export type Place = { id: string; name: string; lat: number; lon: number; category: string; price?: number; hours?: string; url?: string; tags: string[] };
export type Option = Place & { reason: string; distanceKm: number; score: number };
export type Session = {
  id: string; artist: string; venue: string; venueLat: number; venueLon: number;
  members: Member[]; note: string; budget?: number; radiusKm: number;
  options: Option[]; votes: Record<string, string>; source: 'fixture' | 'provisional' | 'qloo';
  createdAt: number; version: number;
  discord?: { channelId: string; contextRead: number; statements: number };
};

export const VENUES = [
  { name: 'Brooklyn Steel', lat: 40.7285, lon: -73.9386 },
  { name: 'The Fillmore Philadelphia', lat: 39.9656, lon: -75.1357 },
  { name: 'The Salt Shed', lat: 41.8975, lon: -87.6522 },
];

export const DEMO_PLACES: Place[] = [
  { id: 'demo-1', name: 'Night Owl Café', lat: 40.7279, lon: -73.9371, category: 'café', price: 18, hours: 'Unconfirmed', tags: ['quiet', 'coffee', 'conversation'] },
  { id: 'demo-2', name: 'Static Room', lat: 40.7311, lon: -73.9362, category: 'bar', price: 28, hours: 'Unconfirmed', tags: ['lively', 'music', 'cocktails'] },
  { id: 'demo-3', name: 'Northside Bites', lat: 40.7252, lon: -73.9401, category: 'restaurant', price: 24, hours: 'Unconfirmed', tags: ['food', 'casual', 'group'] },
  { id: 'demo-4', name: 'After Hours Diner', lat: 40.7292, lon: -73.944, category: 'restaurant', price: 19, hours: 'Unconfirmed', tags: ['late-night', 'food', 'conversation'] },
];

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function filterPlaces(session: Session, places: Place[]): (Place & { distanceKm: number })[] {
  return places.map(place => ({ ...place, distanceKm: distanceKm({ lat: session.venueLat, lon: session.venueLon }, place) }))
    .filter(place => place.distanceKm <= session.radiusKm && (session.budget === undefined || (place.price !== undefined && place.price <= session.budget)));
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
