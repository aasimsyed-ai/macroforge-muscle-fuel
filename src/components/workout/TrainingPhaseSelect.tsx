import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRAINING_PHASES } from "@/lib/workouts/constants";
import type { TrainingPhase } from "@/lib/workouts/types";

export function TrainingPhaseSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: TrainingPhase;
  onChange: (value: TrainingPhase) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as TrainingPhase)}>
      <SelectTrigger id={id} aria-label="Training phase">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TRAINING_PHASES.map((phase) => (
          <SelectItem key={phase.value} value={phase.value}>
            {phase.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
