import { cn } from "@/lib/utils";

type Props = {
  value: number;
  target: number;
  label: string;
  unit?: string;
  size?: number;
  thickness?: number;
  tone?: "primary" | "protein" | "carbs" | "fat" | "water";
  className?: string;
};

const toneStroke: Record<NonNullable<Props["tone"]>, string> = {
  primary: "stroke-primary",
  protein: "stroke-protein",
  carbs: "stroke-carbs",
  fat: "stroke-fat",
  water: "stroke-water",
};

export function ProgressRing({
  value,
  target,
  label,
  unit = "",
  size = 132,
  thickness = 11,
  tone = "primary",
  className,
}: Props) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = target > 0 ? Math.round((value / target) * 100) : 0;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            className="stroke-secondary"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className={cn(toneStroke[tone], "transition-[stroke-dashoffset] duration-700 ease-out")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-2xl font-bold">{Math.round(value).toLocaleString()}</span>
          <span className="text-[11px] text-muted-foreground">
            / {Math.round(target).toLocaleString()}
            {unit}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{percent}% of target</p>
      </div>
      <span className="sr-only">
        {label}: {Math.round(value)} of {Math.round(target)} {unit} ({percent}%)
      </span>
    </div>
  );
}
