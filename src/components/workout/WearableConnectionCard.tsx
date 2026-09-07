import { Watch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { miFitnessProvider } from "@/lib/wearables/miFitnessProvider";

export function WearableConnectionCard() {
  return (
    <div className="panel space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Watch className="size-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Wearable sync</p>
        <Badge variant="outline">Not configured</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {miFitnessProvider.label} synchronization is not configured yet. Manual workout tracking
        remains available. When a supported official integration is added, wearables may provide
        workout duration, heart rate, active calories, steps, sleep and recovery — never lifted
        weight, reps, exercise variant, muscle group or resistance-training volume.
      </p>
      <Button type="button" size="sm" variant="secondary" disabled>
        Connect (coming soon)
      </Button>
    </div>
  );
}
