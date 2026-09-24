/**
 * Static page chrome for this microsite. Pool facts (counts, dates,
 * players) come from the snapshot, never from here.
 */
export const SITE = {
  draftSeason: "2026-27",
  statsSeason: "2025-26",
  /**
   * Approved back-view three-player artwork (Celebrini #71, McKenna #92,
   * Hutson #48) with its own mountains and pines. Set to null to fall back to
   * the mountain/pine engravings.
   */
  heroPlayersSrc: "/brand/hero-players-back.webp" as string | null,
};
