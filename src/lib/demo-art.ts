/**
 * Images du contenu d'exemple.
 *
 * Le mode démo n'embarque aucune photo : à la place, on synthétise des dégradés
 * pastel déterministes, dans la palette du site. Ils occupent la place d'une vraie
 * photo sans prétendre en être une, et disparaissent dès le premier vrai upload.
 */

const DUOS: [string, string, string][] = [
  ["#f2b8ba", "#f6d7c4", "#b8c9ee"],
  ["#a8d8c8", "#d9ecd2", "#f0cf9a"],
  ["#b8c9ee", "#cfd9f4", "#ccb8e8"],
  ["#f0cf9a", "#f7e3c0", "#f2b8ba"],
  ["#ccb8e8", "#e3d6f2", "#a8d8c8"],
  ["#9fc6d8", "#cfe3ea", "#f2c9b8"],
];

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s{2,}/g, " ").trim())}`;
}

/** Chaque graine donne toujours la même image, pour que rien ne bouge d'un rendu à l'autre. */
export function demoPhoto(seed: number, width = 1200, height = 900): string {
  const [a, b, c] = DUOS[seed % DUOS.length];
  const angle = (seed * 47) % 360;
  const x1 = 20 + ((seed * 29) % 60);
  const y1 = 18 + ((seed * 53) % 55);
  const x2 = 25 + ((seed * 71) % 60);
  const y2 = 30 + ((seed * 37) % 55);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
          <stop offset="0%" stop-color="${a}"/>
          <stop offset="100%" stop-color="${b}"/>
        </linearGradient>
        <radialGradient id="h" cx="${x1}%" cy="${y1}%" r="62%">
          <stop offset="0%" stop-color="${c}" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="i" cx="${x2}%" cy="${y2}%" r="48%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      <rect width="${width}" height="${height}" fill="url(#h)"/>
      <rect width="${width}" height="${height}" fill="url(#i)"/>
    </svg>`;

  return svgToDataUrl(svg);
}

/** Portrait d'exemple pour « Qui est-ce ? » : initiale sur aplat pastel. */
export function demoPortrait(name: string, seed: number): string {
  const [a, b] = DUOS[seed % DUOS.length];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${a}"/>
          <stop offset="100%" stop-color="${b}"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#p)"/>
      <circle cx="200" cy="164" r="62" fill="#ffffff" opacity="0.55"/>
      <path d="M200 244c-62 0-112 40-112 92v64h224v-64c0-52-50-92-112-92z" fill="#ffffff" opacity="0.55"/>
      <text x="200" y="188" font-family="Georgia, serif" font-size="86" font-weight="600"
            fill="#2c2830" opacity="0.62" text-anchor="middle">${initials}</text>
    </svg>`;

  return svgToDataUrl(svg);
}

/** Pochette d'exemple pour un morceau sans jaquette. */
export function demoArtwork(seed: number): string {
  const [a, b, c] = DUOS[(seed + 2) % DUOS.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <defs>
        <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${a}"/>
          <stop offset="100%" stop-color="${b}"/>
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#a)"/>
      <circle cx="150" cy="150" r="86" fill="none" stroke="${c}" stroke-width="18" opacity="0.7"/>
      <circle cx="150" cy="150" r="26" fill="#ffffff" opacity="0.7"/>
      <circle cx="150" cy="150" r="7" fill="${c}"/>
    </svg>`;

  return svgToDataUrl(svg);
}
