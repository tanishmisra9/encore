// Curated starter shelves for caregivers who do not know artist names. Each name is checked against Qloo by test/shelves.check.mjs.
export const SHELVES: Record<string, { label: string; born: [number, number]; artists: string[] }> = {
  us: { label: 'United States', born: [1938, 1952], artists: ['Frank Sinatra', 'Elvis Presley', 'Nat King Cole', 'Ella Fitzgerald'] },
  uk: { label: 'United Kingdom', born: [1938, 1952], artists: ['The Beatles', 'Dusty Springfield', 'Cliff Richard', 'Vera Lynn'] },
  mexico: { label: 'Mexico', born: [1938, 1955], artists: ['Vicente Fernández', 'José José', 'Pedro Infante', 'Javier Solís'] },
  greece: { label: 'Greece', born: [1938, 1955], artists: ['Nana Mouskouri', 'Mikis Theodorakis', 'George Dalaras', 'Manos Hadjidakis'] },
  india: { label: 'India', born: [1938, 1955], artists: ['Lata Mangeshkar', 'Kishore Kumar', 'Mohammed Rafi', 'Asha Bhosle'] },
  brazil: { label: 'Brazil', born: [1938, 1955], artists: ['Tom Jobim', 'Elis Regina', 'Caetano Veloso', 'Gilberto Gil'] },
  jamaica: { label: 'Jamaica', born: [1940, 1958], artists: ['Bob Marley', 'Jimmy Cliff', 'Toots and the Maytals', 'Desmond Dekker'] },
  italy: { label: 'Italy', born: [1938, 1955], artists: ['Domenico Modugno', 'Mina', 'Adriano Celentano', 'Gigliola Cinquetti'] },
  france: { label: 'France', born: [1938, 1955], artists: ['Édith Piaf', 'Charles Aznavour', 'Françoise Hardy', 'Jacques Brel'] },
  korea: { label: 'South Korea', born: [1945, 1962], artists: ['Na Hoon-a', 'Cho Yong-pil', 'Patti Kim', 'Lee Mi-ja'] },
  nigeria: { label: 'Nigeria', born: [1940, 1958], artists: ['Fela Kuti', 'King Sunny Adé', 'Victor Olaiya', 'Rex Lawson'] },
  philippines: { label: 'Philippines', born: [1940, 1958], artists: ['Nora Aunor', 'Pilita Corrales', 'Sharon Cuneta', 'Freddie Aguilar'] },
};
