"use client";

import { useEffect, useRef } from "react";

/**
 * Polls a callback function at a fixed interval using the useRef pattern
 * to prevent stale closures.
 *
 * The callback ref is updated on every render so the interval always
 * calls the latest version of the callback without recreating the interval.
 *
 * @param callback  - Async or sync function to call on each poll tick
 * @param intervalMs - Polling interval in milliseconds (e.g. 5000 for 5s)
 * @param enabled   - When false, polling stops immediately (default: true)
 */
export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs: number,
  enabled = true
) {
  // Store latest callback in a ref to prevent stale closures
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Start polling when enabled; clean up on unmount or when deps change
  useEffect(() => {
    if (!enabled) return;

    // Call immediately on mount so UI shows fresh data without waiting
    void callbackRef.current();

    const id = setInterval(() => void callbackRef.current(), intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
