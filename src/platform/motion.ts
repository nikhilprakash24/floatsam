/** F-5 (v0.6.1): honor the OS/browser reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
