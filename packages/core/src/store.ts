import type { ConsentLoopConfig, ConsentRecord, ResolvedConfig, Regulation } from "./types";
import { COOKIE_NAME, DEFAULT_EXPIRES_DAYS, GCM_MAP } from "./defaults";
import { getCookie, setCookie, eraseCookie } from "./cookies";
import { uuid } from "./util";

export const VERSION = "0.1.0";

/* ------------------------------------------------------------------ config */

export function resolveConfig(user: ConsentLoopConfig = {}): ResolvedConfig {
  const categories: ResolvedConfig["categories"] = {};
  const rawCats = user.categories && Object.keys(user.categories).length ? user.categories : defaultCategories();
  if (!rawCats.necessary) categories.necessary = { required: true, default: true };
  for (const [name, c] of Object.entries(rawCats)) {
    categories[name] = {
      ...c,
      required: !!c.required,
      default: c.required ? true : c.default ?? false,
    };
  }

  const regulation: Regulation = user.regulation || "gdpr";
  const respectGPC = user.respectGPC !== false;
  const uiUser = user.ui === false ? false : user.ui || {};
  const layout = uiUser === false ? "box" : uiUser.layout || "box";

  const gcmUser = user.googleConsentMode;
  const gcm =
    gcmUser === true
      ? { map: GCM_MAP, waitForUpdate: 500 }
      : gcmUser
        ? { ...gcmUser, map: gcmUser.map || GCM_MAP, waitForUpdate: gcmUser.waitForUpdate ?? 500 }
        : false;

  return {
    categories,
    regulation,
    respectGPC,
    autoScripts: user.autoScripts !== false,
    ui:
      uiUser === false
        ? false
        : {
            ...uiUser,
            layout,
            position: uiUser.position || (layout === "box" ? "bottom-right" : "bottom-center"),
            preferences: uiUser.preferences || "modal",
          },
    content: user.content || {},
    storage: {
      ...user.storage,
      name: user.storage?.name || COOKIE_NAME,
      type: user.storage?.type || "cookie",
      expiresDays: user.storage?.expiresDays ?? DEFAULT_EXPIRES_DAYS,
      path: user.storage?.path || "/",
      sameSite: user.storage?.sameSite || "Lax",
      revision: user.storage?.revision ?? 0,
    },
    googleConsentMode: gcm,
    hooks: user.hooks || {},
    adapter: user.adapter,
    debug: user.debug ?? isDev(),
  };
}

function defaultCategories(): NonNullable<ConsentLoopConfig["categories"]> {
  return {
    necessary: { required: true },
    analytics: {},
  };
}

function isDev(): boolean {
  if (typeof location === "undefined") return false;
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local") || h.endsWith(".test");
}

/* ----------------------------------------------------------------- records */

interface StoredShape {
  id: string;
  t: string; // firstAt
  u: string; // updatedAt
  r: number; // revision
  a: string[]; // accepted
  j?: string[]; // rejected (decided-against) at consent time
  s?: Record<string, string[]>; // services
  g?: Regulation;
  m?: "explicit" | "implied";
  v?: string;
}

export function readStored(cfg: ResolvedConfig): ConsentRecord | null {
  const raw =
    cfg.storage.type === "localStorage"
      ? safeLocalStorage()?.getItem(cfg.storage.name) ?? null
      : getCookie(cfg.storage.name);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as StoredShape;
    if (!s || !Array.isArray(s.a) || typeof s.id !== "string") return null;
    const record: ConsentRecord = {
      id: s.id,
      firstAt: s.t,
      updatedAt: s.u || s.t,
      revision: s.r ?? 0,
      accepted: s.a,
      rejected: s.j || Object.keys(cfg.categories).filter((c) => !s.a.includes(c)),
      services: s.s || {},
      regulation: s.g || cfg.regulation,
      method: s.m || "explicit",
      v: s.v || "0",
    };
    return record;
  } catch {
    return null;
  }
}

export function isValid(record: ConsentRecord | null, cfg: ResolvedConfig): record is ConsentRecord {
  if (!record) return false;
  if (record.revision !== cfg.storage.revision) return false;
  const ageMs = Date.now() - Date.parse(record.updatedAt || record.firstAt);
  if (!(ageMs >= 0) || ageMs > cfg.storage.expiresDays * 86400_000) return false;
  // A newly-added optional category the visitor never decided on -> re-prompt (GDPR only).
  if (cfg.regulation === "gdpr") {
    const decided = new Set([...record.accepted, ...record.rejected]);
    for (const name of Object.keys(cfg.categories)) {
      if (!cfg.categories[name]!.required && !decided.has(name)) return false;
    }
  }
  return true;
}

export function persist(record: ConsentRecord, cfg: ResolvedConfig): void {
  const s: StoredShape = {
    id: record.id,
    t: record.firstAt,
    u: record.updatedAt,
    r: record.revision,
    a: record.accepted,
    j: record.rejected,
    g: record.regulation,
    m: record.method,
    v: record.v,
  };
  if (Object.keys(record.services).length) s.s = record.services;
  const raw = JSON.stringify(s);
  if (cfg.storage.type === "localStorage") {
    safeLocalStorage()?.setItem(cfg.storage.name, raw);
  } else {
    setCookie(cfg.storage.name, raw, cfg.storage);
  }
}

export function erase(cfg: ResolvedConfig): void {
  if (cfg.storage.type === "localStorage") safeLocalStorage()?.removeItem(cfg.storage.name);
  else eraseCookie(cfg.storage.name, cfg.storage.domain, cfg.storage.path);
}

/** Build a fresh record from a set of accepted categories/services. */
export function buildRecord(
  accepted: string[],
  services: Record<string, string[]>,
  cfg: ResolvedConfig,
  prev: ConsentRecord | null,
  method: "explicit" | "implied"
): ConsentRecord {
  const now = new Date().toISOString();
  const all = Object.keys(cfg.categories);
  const acc = all.filter((c) => cfg.categories[c]!.required || accepted.includes(c));
  const svc: Record<string, string[]> = {};
  for (const c of acc) {
    const catServices = cfg.categories[c]!.services;
    if (!catServices) continue;
    svc[c] = services[c] ? services[c]!.filter((s) => s in catServices) : Object.keys(catServices);
  }
  return {
    id: prev?.id || uuid(),
    firstAt: prev?.firstAt || now,
    updatedAt: now,
    revision: cfg.storage.revision,
    accepted: acc,
    rejected: all.filter((c) => !acc.includes(c)),
    services: svc,
    regulation: cfg.regulation,
    method,
    v: VERSION,
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
