"use client";

import { useCallback, useEffect, useState } from "react";
import type { PoolSnapshot } from "./types";
import { parseSnapshot } from "./validate";

/**
 * The committed player-pool snapshot — the sole runtime source of truth for
 * this site. Served as a static file from public/data/ (see docs/DATA.md).
 */
export const SNAPSHOT_PATH = "/data/available-players.json";

export async function fetchSnapshot(fetchImpl: typeof fetch = fetch): Promise<PoolSnapshot> {
  const response = await fetchImpl(SNAPSHOT_PATH, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Player pool snapshot request failed (${response.status})`);
  return parseSnapshot(await response.json());
}

export type SnapshotState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; snapshot: PoolSnapshot };

export function usePoolSnapshot(): SnapshotState & { retry: () => void } {
  const [state, setState] = useState<SnapshotState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchSnapshot().then(
      (snapshot) => {
        if (!cancelled) setState({ status: "ready", snapshot });
      },
      (error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setState({ status: "error", error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
