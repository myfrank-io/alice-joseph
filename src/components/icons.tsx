import type { SVGProps } from "react";

/**
 * Jeu d'icônes maison : trait de 1,6 px, extrémités arrondies, angles adoucis.
 * Aucune bibliothèque — c'est le seul moyen de garder exactement le même degré
 * de rondeur que la typographie et les cartes.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconNous = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.4 4.6c-2.3 0-3.9 1.8-3.9 4 0 3.7 4.4 6.9 7.5 8.9 3.1-2 7.5-5.2 7.5-8.9 0-2.2-1.6-4-3.9-4-1.6 0-2.9.9-3.6 2.2-.7-1.3-2-2.2-3.6-2.2Z" />
    <path d="M12 17.5V20" />
  </Svg>
);

export const IconFil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h7A2.5 2.5 0 0 1 16 7.5v3A2.5 2.5 0 0 1 13.5 13H9l-3.4 2.6a.4.4 0 0 1-.6-.3V13a1 1 0 0 1-1-1Z" />
    <path d="M18 9.2a2.5 2.5 0 0 1 2 2.4v3.9a1 1 0 0 1-1 1v2.3a.4.4 0 0 1-.6.3L15 16.6h-3" />
  </Svg>
);

export const IconPhotos = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3.5" />
    <circle cx="8.6" cy="10" r="1.5" />
    <path d="M3.6 16.8 8 12.9c.7-.6 1.7-.6 2.4 0l2.2 2 1.7-1.4c.7-.6 1.7-.6 2.4 0l3.7 3.3" />
  </Svg>
);

export const IconMusique = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18V7.2a1 1 0 0 1 .8-1l8-1.6a1 1 0 0 1 1.2 1V15" />
    <circle cx="6.6" cy="18" r="2.4" />
    <circle cx="16.6" cy="15.6" r="2.4" />
  </Svg>
);

export const IconCarte = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M3.6 9.8h16.8M3.6 14.2h16.8" />
    <path d="M12 3.4c-2.2 2.3-3.3 5.2-3.3 8.6s1.1 6.3 3.3 8.6c2.2-2.3 3.3-5.2 3.3-8.6S14.2 5.7 12 3.4Z" />
  </Svg>
);

export const IconJeux = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4" />
    <circle cx="8.4" cy="8.4" r="1.5" />
    <circle cx="15.6" cy="8.4" r="1.5" />
    <circle cx="8.4" cy="15.6" r="1.5" />
    <circle cx="15.6" cy="15.6" r="1.5" />
  </Svg>
);

export const IconReglages = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2.2" />
    <circle cx="9" cy="17" r="2.2" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Svg>
);

export const IconCoeur = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20s-7.6-4.6-7.6-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.6 2.8C19.6 15.4 12 20 12 20Z" />
  </Svg>
);

export const IconFermer = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Svg>
);

export const IconChevronGauche = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
);

export const IconChevronDroite = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Svg>
);

export const IconFleche = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Svg>
);

export const IconImport = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15.5V4.5M8 8.3 12 4.4l4 3.9" />
    <path d="M4.5 14.5v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
  </Svg>
);

export const IconLecture = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.4 5.7 18 12l-9.6 6.3V5.7Z" />
  </Svg>
);

export const IconRecherche = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="m15.8 15.8 4 4" />
  </Svg>
);

export const IconValider = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.6 4.6 4.4L19 7" />
  </Svg>
);

export const IconCorbeille = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.8 7h14.4M9.5 7V5.6a1.6 1.6 0 0 1 1.6-1.6h1.8a1.6 1.6 0 0 1 1.6 1.6V7" />
    <path d="M6.6 7.2 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.8-11.8" />
  </Svg>
);

export const IconCrayon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 19.5h3.2L19 8.2a2.2 2.2 0 0 0-3.2-3.2L4.5 16.3v3.2Z" />
    <path d="m14.6 6.2 3.2 3.2" />
  </Svg>
);

export const IconEtoile = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 4.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 10l5.4-.8L12 4.5Z" />
  </Svg>
);

export const IconEpingle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c3.6-4.6 5.6-7.7 5.6-10.3A5.6 5.6 0 0 0 6.4 10.7C6.4 13.3 8.4 16.4 12 21Z" />
    <circle cx="12" cy="10.4" r="2.2" />
  </Svg>
);

export const IconLien = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.4 1.4" />
    <path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4" />
  </Svg>
);

export const IconJour = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 3v2.2M12 18.8V21M4.2 12H2m20 0h-2.2M6.3 6.3 4.8 4.8m14.4 14.4-1.5-1.5M6.3 17.7l-1.5 1.5M19.2 4.8l-1.5 1.5" />
  </Svg>
);

export const IconNuit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z" />
  </Svg>
);

export const IconSortie = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5H7.5A2.5 2.5 0 0 0 5 7v10a2.5 2.5 0 0 0 2.5 2.5H14" />
    <path d="M16.5 8.5 20 12l-3.5 3.5M19.6 12h-9" />
  </Svg>
);

export const IconGrille = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.6" y="3.6" width="7" height="7" rx="2" />
    <rect x="13.4" y="3.6" width="7" height="7" rx="2" />
    <rect x="3.6" y="13.4" width="7" height="7" rx="2" />
    <rect x="13.4" y="13.4" width="7" height="7" rx="2" />
  </Svg>
);

export const IconCalendrier = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.6" y="5.4" width="16.8" height="15" rx="3.4" />
    <path d="M3.6 10h16.8M8.4 3.5v3.6M15.6 3.5v3.6" />
  </Svg>
);
