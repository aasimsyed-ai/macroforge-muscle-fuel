import { useAllMetrics, useProfile } from "@/lib/data";

/** Latest logged body weight, falling back to the profile's starting weight. */
export function useCurrentBodyWeightKg(): number | null {
  const profile = useProfile();
  const allMetrics = useAllMetrics();

  const weighIns = (allMetrics.data ?? []).filter((m) => m.weight_kg != null);
  const latestWeight = weighIns.length ? Number(weighIns[weighIns.length - 1]!.weight_kg) : null;
  const profileWeight =
    profile.data?.start_weight_kg != null ? Number(profile.data.start_weight_kg) : null;

  return latestWeight ?? profileWeight;
}
