import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/** Tests toggle the mobile composition by setting this before render. */
export const viewport = { mobile: false };

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query.includes("max-width: 767px") ? viewport.mobile : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
});

afterEach(() => {
  cleanup();
  viewport.mobile = false;
});
