/** Compact streak pills — renders nothing until there's actually a streak to show. */
export function StreakBadges({
  loggingStreak,
  proteinStreak,
}: {
  loggingStreak: number;
  proteinStreak: number;
}) {
  if (loggingStreak < 2 && proteinStreak < 2) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {loggingStreak >= 2 ? (
        <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium">
          🔥 {loggingStreak}-day logging streak
        </span>
      ) : null}
      {proteinStreak >= 2 ? (
        <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium">
          🥩 {proteinStreak}-day protein streak
        </span>
      ) : null}
    </div>
  );
}
