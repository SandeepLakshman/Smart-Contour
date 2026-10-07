import { useEffect, useRef } from "react";

export function useLiveStream(onEvent, enabled) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!enabled) return undefined;
    const url = import.meta.env.VITE_LIVE_URL || "/api/live/stream";
    const es = new EventSource(url);
    const handler = (ev) => {
      try {
        cb.current?.(JSON.parse(ev.data));
      } catch {
        /* ignore malformed */
      }
    };
    es.addEventListener("sensor", handler);
    es.onerror = () => {
      cb.current?.({ __streamError: true });
    };
    return () => es.close();
  }, [enabled]);
}
