import { useEffect, useState, type CSSProperties } from "react";

/** Allows the CSS custom properties the keyframe below reads, regardless of
 * whether the installed @types/react version types them natively. */
type ParticleStyle = CSSProperties & Record<"--mf-x" | "--mf-y", string>;

/**
 * A brief, self-cleaning confetti-style burst. Pure CSS/inline-style, no
 * external library — mounts a handful of particles that animate out and
 * unmounts itself. Purely decorative; safe to render conditionally.
 */
const COLORS = ["var(--primary)", "var(--protein)", "var(--carbs)", "var(--water)"] as const;

export function DayCelebration() {
  const [particles] = useState(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      angle: (360 / 14) * i + Math.random() * 20,
      distance: 60 + Math.random() * 50,
      delay: Math.random() * 120,
      size: 5 + Math.random() * 5,
      color: COLORS[i % COLORS.length] ?? COLORS[0],
    })),
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), 900);
    return () => window.clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
      aria-hidden="true"
    >
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = Math.cos(rad) * p.distance;
        const y = Math.sin(rad) * p.distance;
        const style: ParticleStyle = {
          width: p.size,
          height: p.size,
          backgroundColor: p.color,
          animation: `mf-burst 700ms ease-out ${p.delay}ms forwards`,
          "--mf-x": `${x}px`,
          "--mf-y": `${y}px`,
        };
        return <span key={p.id} className="absolute rounded-full opacity-0" style={style} />;
      })}
      <style>{`
        @keyframes mf-burst {
          0% { transform: translate(0, 0) scale(0.6); opacity: 1; }
          100% { transform: translate(var(--mf-x), var(--mf-y)) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
