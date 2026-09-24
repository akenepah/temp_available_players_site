"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

/** Matches the mobile composition (approved 390px endpoint). */
export const MOBILE_QUERY = "(max-width: 767px)";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalOptions {
  onClose: () => void;
  /** Lock page scroll while open (full-screen and drawer overlays). */
  lockScroll?: boolean;
  /** Keep Tab focus inside the container. */
  trapFocus?: boolean;
}

/**
 * Shared overlay behaviour: Escape closes, focus moves into the overlay and
 * returns to the previously focused element on close, Tab is trapped, and
 * page scroll is locked without losing the scroll position.
 */
export function useModal(ref: RefObject<HTMLElement | null>, { onClose, lockScroll = true, trapFocus = true }: ModalOptions) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const initial = container.querySelector<HTMLElement>("[data-autofocus]") ?? container;
    initial.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (!trapFocus || event.key !== "Tab") return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    if (lockScroll) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (lockScroll) document.body.style.overflow = overflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    };
  }, [ref, lockScroll, trapFocus]);
}
