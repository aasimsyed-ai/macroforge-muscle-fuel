import { DisabledWearableProvider } from "./provider";

/**
 * Mi Band / Mi Fitness.
 *
 * There is no official public Mi Fitness / Zepp Life API that this app can
 * integrate against, so this provider is DISABLED. It is not presented anywhere
 * as working and it never produces fake heart-rate, sleep, step or calorie data.
 * If an officially supported integration becomes available, replace this stub
 * with a real implementation of `WearableProvider` and add server-side
 * credential handling.
 */
export const miFitnessProvider = new DisabledWearableProvider("mi_fitness", "Mi Fitness");
