import { GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateExperienceLevel } from "@/lib/workouts/calculations";
import { EXPERIENCE_DISCLAIMER } from "@/lib/workouts/constants";
import { useTrainingHistorySummary } from "@/lib/workouts/hooks";

const LABELS: Record<"beginner" | "intermediate" | "advanced", string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function ExperienceLevelCard() {
  const summary = useTrainingHistorySummary();

  if (summary.isLoading) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  const data = summary.data;
  const estimate = data
    ? calculateExperienceLevel({
        consistentWeeks: data.consistentWeeks,
        completedSessions: data.totalSessions,
        hasProgressionEvidence: data.hasProgressionEvidence,
      })
    : { level: null, reason: "Not enough training history yet." };

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Training experience</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {estimate.level ? (
          <Badge>{LABELS[estimate.level]}</Badge>
        ) : (
          <Badge variant="outline">Not enough data yet</Badge>
        )}
        {data ? (
          <span className="text-xs text-muted-foreground">
            {data.totalSessions} sessions · {data.consistentWeeks} weeks
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{estimate.reason}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">{EXPERIENCE_DISCLAIMER}</p>
    </div>
  );
}
