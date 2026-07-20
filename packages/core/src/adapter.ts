import type { AdapterContext, ConsentAdapter, ConsentRecord, ManageConfig, RemoteDecision } from "./types";

/**
 * HTTP adapter for the ConsentLoop managed backend (ConsentLoop Cloud).
 *
 * Contract (any server implementing it can be plugged in):
 *   GET  {endpoint}/decision?site={siteId}         -> { show?: boolean, regulation?: string, lang?: string }
 *   POST {endpoint}/consent   (JSON ConsentRecord + site) -> 204
 *
 * Both calls are best-effort: they never block or break the banner.
 */
export function createHttpAdapter(manage: ManageConfig): ConsentAdapter {
  const base = manage.endpoint.replace(/\/$/, "");
  const site = manage.siteId ? `?site=${encodeURIComponent(manage.siteId)}` : "";
  return {
    async init(): Promise<RemoteDecision | void> {
      try {
        const res = await fetch(`${base}/decision${site}`, {
          method: "GET",
          credentials: "omit",
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        return (await res.json()) as RemoteDecision;
      } catch {
        return;
      }
    },
    persist(record: ConsentRecord, _ctx: AdapterContext): void {
      const body = JSON.stringify({ site: manage.siteId, record });
      const url = `${base}/consent`;
      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
          return;
        }
      } catch {
        /* fall through */
      }
      fetch(url, {
        method: "POST",
        keepalive: true,
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body,
      }).catch(() => undefined);
    },
  };
}
