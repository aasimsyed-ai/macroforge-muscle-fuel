import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { analyzeExerciseProgression, type ProgressionAnalysis } from "@/lib/workouts/calculations";
import { PROGRESSION_INSUFFICIENT_MESSAGE } from "@/lib/workouts/constants";
import {
  useExerciseHistory,
  useRecentExerciseNames,
  useTrainingPreferences,
} from "@/lib/workouts/hooks";

const RESULT_META: Record<
  ProgressionAnalysis["result"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  ready_to_progress: { label: "Ready to progress", variant: "default" },
  maintain: { label: "Maintain", variant: "secondary" },
  deload_or_recover: { label: "Deload / recover", variant: "destructive" },
  insufficient_data: { label: "Not enough data", variant: "outline" },
};

export function ProgressionSuggestion() {
  const names = useRecentExerciseNames();
  const preferences = useTrainingPreferences();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && names.data && names.data.length > 0) {
      setSelected(names.data[0] ?? null);
    }
  }, [names.data, selected]);

  const history = useExerciseHistory(selected);

  const analysis: ProgressionAnalysis | null =
    history.data && preferences.data
      ? analyzeExerciseProgression(history.data, preferences.data)
      : null;

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">Progression insight</p>
        </div>
        {names.data && names.data.length > 0 ? (
          <Select value={selected ?? undefined} onValueChange={setSelected}>
            <SelectTrigger className="h-8 w-[190px] text-xs" aria-label="Exercise">
              <SelectValue placeholder="Choose an exercise" />
            </SelectTrigger>
            <SelectContent>
              {names.data.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {names.isLoading ? (
        <Skeleton className="mt-3 h-16 w-full rounded-md" />
      ) : !names.data || names.data.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Log a few workouts to unlock progression insights.
        </p>
      ) : history.isLoading || preferences.isLoading ? (
        <Skeleton className="mt-3 h-16 w-full rounded-md" />
      ) : !analysis || analysis.result === "insufficient_data" ? (
        <div className="mt-3">
          <Badge variant="outline">Not enough data</Badge>
          <p className="mt-2 text-xs text-muted-foreground">
            {analysis?.explanation ?? PROGRESSION_INSUFFICIENT_MESSAGE}
          </p>
        </div>
      ) : (
        <div className="mt-3">
          {(() => {
            const meta = RESULT_META[analysis.result] ?? RESULT_META.insufficient_data;
            return <Badge variant={meta.variant}>{meta.label}</Badge>;
          })()}
          <p className="mt-2 text-xs text-muted-foreground">{analysis.explanation}</p>
          {analysis.suggestedWeightKg ? (
            <p className="mt-1 text-xs font-medium text-primary">
              Suggested next load: {analysis.suggestedWeightKg} kg
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
