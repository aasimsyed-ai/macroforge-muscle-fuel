/**
 * Wearable adapter contract. No supported official integration is wired up yet,
 * so the only provider is a disabled stub — see `provider.ts`. Nothing in the
 * app fabricates wearable data.
 */

export type WearableConnectionState = "not_configured" | "disconnected" | "connected" | "error";

export interface WearableStatus {
  state: WearableConnectionState;
  providerId: string;
  providerLabel: string;
  message: string;
  lastSyncedAt: string | null;
}

/** Fields a wearable MAY provide. It is never a source of truth for lifted load,
 * reps, exercise variant, muscle group or resistance-training volume. */
export interface WearableWorkoutSample {
  externalId: string;
  startedAt: string;
  durationMinutes: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  activeCalories: number | null;
}

export interface WearableSleepSample {
  date: string;
  hours: number | null;
}

export interface WearableHeartRateSample {
  date: string;
  restingHeartRate: number | null;
}

export interface WearableProvider {
  readonly id: string;
  readonly label: string;
  getConnectionStatus(): Promise<WearableStatus>;
  connect(): Promise<WearableStatus>;
  disconnect(): Promise<WearableStatus>;
  syncWorkouts(): Promise<WearableWorkoutSample[]>;
  syncSleep(): Promise<WearableSleepSample[]>;
  syncHeartRate(): Promise<WearableHeartRateSample[]>;
}

export class WearableNotConfiguredError extends Error {
  constructor(providerLabel: string) {
    super(
      `${providerLabel} synchronization is not configured yet. Manual workout tracking remains available.`,
    );
    this.name = "WearableNotConfiguredError";
  }
}
