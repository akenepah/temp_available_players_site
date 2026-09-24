/**
 * Static page chrome for this microsite. Pool facts (counts, dates,
 * players) come from the snapshot, never from here.
 */
export const SITE = {
  draftSeason: "2026-27",
  statsSeason: "2025-26",
  /**
   * Hero artwork: the artwork region of the approved three-player share card
   * (Celebrini #71, Hutson #48, McKenna #92), cropped so none of the card's
   * baked-in text appears. Set to null to fall back to the mountain/pine
   * engravings.
   */
  heroCollageSrc: "/brand/hero-players.webp" as string | null,
};
