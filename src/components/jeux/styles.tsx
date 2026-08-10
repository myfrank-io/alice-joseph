/**
 * Les quelques images clés propres aux jeux.
 *
 * Elles vivent ici plutôt que dans `globals.css` parce qu'elles ne servent
 * qu'aux deux plateaux. React déduplique la balise grâce à `precedence`, on peut
 * donc la poser dans chaque écran sans se soucier des doublons.
 *
 * Les durées sont volontairement courtes ; la règle `prefers-reduced-motion` de
 * `globals.css` les ramène de toute façon à zéro, et chaque animation se termine
 * sur son état final (`both`) pour que rien ne dépende du mouvement.
 */
export function StylesJeux() {
  return (
    <style href="jeux-animations" precedence="default">{`
      @keyframes jeu-chute {
        0%   { transform: translateY(calc(var(--chute, 6) * -100%)); opacity: 0.4; }
        58%  { transform: translateY(0); opacity: 1; animation-timing-function: cubic-bezier(0.3, 0, 0.5, 1); }
        74%  { transform: translateY(-9%); }
        88%  { transform: translateY(0); }
        94%  { transform: translateY(-3%); }
        100% { transform: translateY(0); }
      }
      .jeu-chute {
        animation: jeu-chute 0.42s cubic-bezier(0.5, 0, 0.9, 0.6) both;
      }

      @keyframes jeu-eclat {
        0%   { transform: scale(0.82); }
        55%  { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      .jeu-eclat {
        animation: jeu-eclat 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* Le retournement d'un visage écarté : une transition, pas une image clé,
         pour qu'il revienne aussi proprement s'il est remis en jeu. */
      .jeu-carte {
        perspective: 720px;
      }
      .jeu-carte-face {
        position: relative;
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .jeu-carte-retournee .jeu-carte-face {
        transform: rotateY(180deg);
      }
      .jeu-carte-recto,
      .jeu-carte-verso {
        position: absolute;
        inset: 0;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        overflow: hidden;
      }
      .jeu-carte-verso {
        transform: rotateY(180deg);
      }
    `}</style>
  );
}
