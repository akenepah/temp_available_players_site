/**
 * Static page chrome for this microsite. Pool facts (counts, dates,
 * players) come from the snapshot, never from here.
 */
export const SITE = {
  draftSeason: "2026-27",
  statsSeason: "2025-26",
  /**
   * Back-view three-player artwork (Celebrini #71, McKenna #92, Hutson #48)
   * layered in front of the mountain/pine engravings. Not supplied yet: set to
   * its public path (e.g. "/brand/hero-players-back.png", a transparent PNG or
   * WebP with no text) once added. The hero renders cleanly without it.
   */
  heroPlayersSrc: null as string | null,
};
