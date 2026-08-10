import type { SVGProps } from "react";

/**
 * Les quelques icônes que seule la carte utilise — même trait que
 * `src/components/icons.tsx` (1,6 px, extrémités arrondies), pour qu'on ne voie
 * pas la couture.
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

export const IconMoins = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 12h13" />
  </Svg>
);

export const IconRecentrer = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.8v3.2M12 18v3.2M2.8 12h3.2M18 12h3.2" />
  </Svg>
);

export const IconPleinEcran = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v3.5M14.5 4.5H18A1.5 1.5 0 0 1 19.5 6v3.5" />
    <path d="M9.5 19.5H6A1.5 1.5 0 0 1 4.5 18v-3.5M14.5 19.5H18a1.5 1.5 0 0 0 1.5-1.5v-3.5" />
  </Svg>
);

export const IconReduire = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 9.5H8A1.5 1.5 0 0 0 9.5 8V4.5M19.5 9.5H16A1.5 1.5 0 0 1 14.5 8V4.5" />
    <path d="M4.5 14.5H8A1.5 1.5 0 0 1 9.5 16v3.5M19.5 14.5H16a1.5 1.5 0 0 0-1.5 1.5v3.5" />
  </Svg>
);

export const IconCible = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="1.6" />
    <path d="M12 1.8v2.7M12 19.5v2.7M1.8 12h2.7M19.5 12h2.7" />
  </Svg>
);

export const IconClavier = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6.5" width="18" height="11" rx="2.6" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M17 10h.01M7 14h10" />
  </Svg>
);
