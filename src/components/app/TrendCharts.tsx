import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyMetric, Meal } from "@/lib/data";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11 } as const;

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
} as const;

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="text-sm font-semibold">{title}</p>
      {subtitle ? <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p> : null}
      <div className="h-56 w-full">{children}</div>
    </div>
  );
}

export function DailyIntakeChart({
  meals,
  calorieTarget,
  proteinTarget,
}: {
  meals: Meal[];
  calorieTarget: number;
  proteinTarget: number;
}) {
  const byDay = new Map<string, { day: string; calories: number; protein: number }>();
  for (const m of meals) {
    const key = format(new Date(m.eaten_at), "yyyy-MM-dd");
    const row = byDay.get(key) ?? { day: key, calories: 0, protein: 0 };
    row.calories += Number(m.calories);
    row.protein += Number(m.protein_g);
    byDay.set(key, row);
  }
  const data = [...byDay.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => ({ ...r, label: format(parseISO(r.day), "d MMM") }));

  return (
    <Panel title="Calories & protein per day" subtitle={`Targets: ${calorieTarget} kcal · ${proteinTarget} g protein`}>
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="calories" name="kcal" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="protein" name="protein g" fill="var(--protein)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty />
      )}
    </Panel>
  );
}

export function BodyTrendChart({ metrics }: { metrics: DailyMetric[] }) {
  const data = metrics
    .filter((m) => m.weight_kg != null || m.waist_cm != null)
    .map((m) => ({
      label: format(parseISO(m.metric_date), "d MMM"),
      weight: m.weight_kg == null ? null : Number(m.weight_kg),
      waist: m.waist_cm == null ? null : Number(m.waist_cm),
    }));

  return (
    <Panel title="Weight & waist trend" subtitle="Logged body measurements over time">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} domain={["auto", "auto"]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="weight" name="weight kg" stroke="var(--primary)" strokeWidth={2} connectNulls dot={false} />
            <Line type="monotone" dataKey="waist" name="waist cm" stroke="var(--carbs)" strokeWidth={2} connectNulls dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Empty text="Log your weight and waist to see this trend." />
      )}
    </Panel>
  );
}

export function HabitChart({ metrics }: { metrics: DailyMetric[] }) {
  const data = metrics.map((m) => ({
    label: format(parseISO(m.metric_date), "d MMM"),
    workout: Number(m.workout_minutes ?? 0),
    sleep: Number(m.sleep_hours ?? 0),
    water: Number(m.water_ml ?? 0) / 1000,
  }));

  return (
    <Panel title="Workouts, sleep & water" subtitle="Minutes trained, hours slept, litres of water">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="workout" name="workout min" fill="var(--fat)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sleep" name="sleep h" fill="var(--water)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="water" name="water L" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty text="Log daily metrics to track consistency." />
      )}
    </Panel>
  );
}

function Empty({ text = "No data in this range yet." }: { text?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
