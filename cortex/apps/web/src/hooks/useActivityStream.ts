import { useEffect, useRef, useState } from "react";
import type { ActivityEvent } from "@cortex/shared";
import { api } from "../api.js";

/**
 * Loads the /stream snapshot, then subscribes to /stream/live over SSE.
 * FRONTEND_SPEC §3 Section C: "If SSE errors, poll /stream every 3s."
 */
export function useActivityStream(): { events: ActivityEvent[]; live: boolean; refresh: () => void } {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [live, setLive] = useState(false);
  const seenIds = useRef(new Set<string>());

  function ingest(list: ActivityEvent[]): void {
    for (const e of list) seenIds.current.add(e.id);
    setEvents(list);
  }

  async function refresh(): Promise<void> {
    try {
      ingest(await api.getStreamSnapshot());
    } catch {
      // leave existing events in place; next poll/SSE tick will retry
    }
  }

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let es: EventSource | undefined;

    async function start(): Promise<void> {
      await refresh();
      if (cancelled) return;

      try {
        es = new EventSource(`${api.base}/api/cortex/stream/live`);
        es.addEventListener("activity", (evt) => {
          setLive(true);
          try {
            const parsed = JSON.parse((evt as MessageEvent).data) as ActivityEvent;
            if (!seenIds.current.has(parsed.id)) {
              seenIds.current.add(parsed.id);
              setEvents((prev) => [...prev, parsed]);
            }
          } catch {
            // ignore malformed frame
          }
        });
        es.onerror = () => {
          setLive(false);
          es?.close();
          pollTimer ??= setInterval(refresh, 3000);
        };
      } catch {
        pollTimer = setInterval(refresh, 3000);
      }
    }

    void start();
    return () => {
      cancelled = true;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { events, live, refresh };
}
