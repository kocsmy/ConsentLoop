export const doc = /* @__PURE__ */ (() => (typeof document === "undefined" ? null : document))();

export const isBrowser = (): boolean => typeof window !== "undefined" && !!doc;

export function uuid(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Run `fn` when the DOM is ready (immediately if it already is). */
export function onReady(fn: () => void): void {
  if (!doc || doc.readyState !== "loading") fn();
  else doc.addEventListener("DOMContentLoaded", fn, { once: true });
}

/** Schedule non-urgent work off the critical path (idle callback with fallbacks). */
export function onIdle(fn: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => fn(), { timeout: 300 });
  else if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(fn, 0));
  else setTimeout(fn, 0);
}

export type Listener = (detail?: unknown) => void;

export interface Emitter {
  on(event: string, cb: Listener): () => void;
  emit(event: string, detail?: unknown): void;
  clear(): void;
}

export function createEmitter(domPrefix?: string): Emitter {
  const map = new Map<string, Set<Listener>>();
  return {
    on(event, cb) {
      let set = map.get(event);
      if (!set) map.set(event, (set = new Set()));
      set.add(cb);
      return () => set!.delete(cb);
    },
    emit(event, detail) {
      map.get(event)?.forEach((cb) => {
        try {
          cb(detail);
        } catch (e) {
          console.error("[consentloop] listener error", e);
        }
      });
      if (domPrefix && isBrowser()) {
        window.dispatchEvent(new CustomEvent(`${domPrefix}:${event}`, { detail }));
      }
    },
    clear: () => map.clear(),
  };
}

/** Race a promise against a timeout; resolves `undefined` on timeout/failure. */
export function withTimeout<T>(p: Promise<T> | T | undefined | void, ms: number): Promise<T | undefined> {
  if (!p || typeof (p as Promise<T>).then !== "function") return Promise.resolve(p as T | undefined);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), ms);
    (p as Promise<T>).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(undefined);
      }
    );
  });
}
