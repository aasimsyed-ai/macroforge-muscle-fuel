import {
  WearableNotConfiguredError,
  type WearableHeartRateSample,
  type WearableProvider,
  type WearableSleepSample,
  type WearableStatus,
  type WearableWorkoutSample,
} from "./types";

/**
 * Disabled provider used until a real, supported official wearable integration
 * is implemented and tested. It never returns fabricated data — every sync
 * rejects with a clear "not configured" error and the status stays
 * `not_configured`.
 */
export class DisabledWearableProvider implements WearableProvider {
  readonly id: string;
  readonly label: string;

  constructor(id: string, label: string) {
    this.id = id;
    this.label = label;
  }

  async getConnectionStatus(): Promise<WearableStatus> {
    return {
      state: "not_configured",
      providerId: this.id,
      providerLabel: this.label,
      message: `${this.label} synchronization is not configured yet. Manual workout tracking remains available.`,
      lastSyncedAt: null,
    };
  }

  async connect(): Promise<WearableStatus> {
    throw new WearableNotConfiguredError(this.label);
  }

  async disconnect(): Promise<WearableStatus> {
    return this.getConnectionStatus();
  }

  async syncWorkouts(): Promise<WearableWorkoutSample[]> {
    throw new WearableNotConfiguredError(this.label);
  }

  async syncSleep(): Promise<WearableSleepSample[]> {
    throw new WearableNotConfiguredError(this.label);
  }

  async syncHeartRate(): Promise<WearableHeartRateSample[]> {
    throw new WearableNotConfiguredError(this.label);
  }
}

/** No provider is active. */
export const activeWearableProvider: WearableProvider | null = null;
