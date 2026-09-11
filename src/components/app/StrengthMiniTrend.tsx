import { format, parseISO } from "date-fns";
import { Bar, BarChart, ResponsiveContainer } from "recharts";

import { useRecentSessionVolumes } from "@/lib/workouts/hooks";

/**
 * A compact "is your training load trending up" glance — so weight isn't the
 * only number on the dashboard. Renders nothing for guests, errors, or fewer
 * than two sessions, rather than showing an empty chart.
 */
export function StrengthMiniTrend() {
  const volumes = useRecentSessionVolumes(8);
  const data = volumes.data;

  if (volumes.isLoading || volumes.isError || !data || data.length < 2) return null;

  const chartData = data.map((point) => ({
    label: format(parseISO(point.date), "d MMM"),
    volume: point.volume,
  }));
  const latest = data[data.length - 1]!.volume;
  const first = data[0]!.volume;

  return (
    <div className="panel p-4">
      <p className="text-sm font-semibold">Strength trend</p>
      <p className="text-xs text-muted-foreground">
        Total load moved across your last {data.length} sessions
      </p>
      <div className="mt-3 h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <Bar dataKey="volume" fill="var(--primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {latest >= first ? "Trending up" : "Holding steady"} · latest{" "}
        {Math.round(latest).toLocaleString()} kg moved
      </p>
    </div>
  );
}
