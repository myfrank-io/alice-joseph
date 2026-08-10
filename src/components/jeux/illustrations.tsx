/**
 * Les deux vignettes du hall.
 *
 * Des formes pleines, dans les teintes du site — aucune couleur en dur, tout
 * passe par les tokens, ce qui les fait basculer d'elles-mêmes en thème sombre.
 */

const COLONNES = [50, 78, 106, 134, 162, 190];
const LIGNES = [52, 80, 108];

export function IllustrationPuissance4({ className }: { className?: string }) {
  const jetons: Record<string, "alice" | "joseph"> = {
    "50-108": "joseph",
    "78-108": "joseph",
    "106-108": "joseph",
    "50-80": "alice",
    "78-80": "alice",
    "106-52": "alice",
    "134-108": "alice",
  };

  return (
    <svg viewBox="0 0 240 140" className={className} aria-hidden="true" role="presentation">
      {/* Le jeton qui tombe */}
      <circle cx="134" cy="16" r="10.5" fill="var(--alice)" opacity="0.9" />
      <path
        d="M134 30v10"
        stroke="var(--alice)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />

      <rect x="30" y="32" width="180" height="96" rx="18" fill="var(--tint-jeux)" opacity="0.42" />
      <rect
        x="30"
        y="32"
        width="180"
        height="96"
        rx="18"
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth="1.2"
        opacity="0.5"
      />

      {LIGNES.map((cy) =>
        COLONNES.map((cx) => {
          const jeton = jetons[`${cx}-${cy}`];
          return (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="10.5"
              fill={
                jeton === "alice"
                  ? "var(--alice)"
                  : jeton === "joseph"
                    ? "var(--joseph)"
                    : "var(--surface)"
              }
              opacity={jeton ? 0.95 : 0.75}
            />
          );
        }),
      )}
    </svg>
  );
}

export function IllustrationQuiEstCe({ className }: { className?: string }) {
  const cartes: { x: number; y: number; etat: "en-jeu" | "trouve" | "ecarte" }[] = [
    { x: 16, y: 20, etat: "ecarte" },
    { x: 88, y: 20, etat: "en-jeu" },
    { x: 160, y: 20, etat: "ecarte" },
    { x: 16, y: 80, etat: "en-jeu" },
    { x: 88, y: 80, etat: "trouve" },
    { x: 160, y: 80, etat: "ecarte" },
  ];

  return (
    <svg viewBox="0 0 240 140" className={className} aria-hidden="true" role="presentation">
      {cartes.map(({ x, y, etat }) => {
        const ecarte = etat === "ecarte";
        const trouve = etat === "trouve";
        return (
          <g key={`${x}-${y}`} opacity={ecarte ? 0.45 : 1}>
            <rect
              x={x}
              y={y}
              width="64"
              height="54"
              rx="12"
              fill={trouve ? "var(--tint-jeux)" : "var(--surface)"}
              fillOpacity={trouve ? 0.55 : 1}
              stroke={trouve ? "var(--accent)" : "var(--line-strong)"}
              strokeWidth={trouve ? 2 : 1.2}
            />
            {ecarte ? (
              <path
                d={`M${x + 18} ${y + 20}l28 20M${x + 46} ${y + 20}l-28 20`}
                stroke="var(--ink-3)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            ) : (
              <>
                <circle
                  cx={x + 32}
                  cy={y + 21}
                  r="9"
                  fill={trouve ? "var(--accent)" : "var(--ink-3)"}
                  opacity={trouve ? 0.85 : 0.5}
                />
                <path
                  d={`M${x + 15} ${y + 48}a17 17 0 0 1 34 0z`}
                  fill={trouve ? "var(--accent)" : "var(--ink-3)"}
                  opacity={trouve ? 0.85 : 0.5}
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** La carte « bientôt » : trois pions esquissés, rien de plus. */
export function IllustrationBientot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 48" className={className} aria-hidden="true" role="presentation">
      {[24, 60, 96].map((cx, index) => (
        <circle
          key={cx}
          cx={cx}
          cy="24"
          r="11"
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="1.6"
          strokeDasharray="3 4"
          opacity={1 - index * 0.22}
        />
      ))}
    </svg>
  );
}
