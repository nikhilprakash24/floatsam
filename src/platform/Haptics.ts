/** No-op on web; Capacitor implementation lands in Phase 4. */
export interface Haptics {
  lightTap(): void;
  heavyHit(): void;
}

export class NoopHaptics implements Haptics {
  lightTap(): void {}
  heavyHit(): void {}
}
