import type { CookieMatcher } from "./types";
import { doc } from "./util";

export interface CookieAttrs {
  expiresDays?: number;
  domain?: string;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
}

export function getCookie(name: string): string | null {
  if (!doc) return null;
  const m = doc.cookie.match(new RegExp("(?:^|;\\s*)" + escapeRe(name) + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setCookie(name: string, value: string, attrs: CookieAttrs = {}): void {
  if (!doc) return;
  const days = attrs.expiresDays ?? 182;
  let s = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.round(days * 86400)}; Path=${attrs.path || "/"}; SameSite=${attrs.sameSite || "Lax"}`;
  if (attrs.domain) s += `; Domain=${attrs.domain}`;
  if (attrs.sameSite === "None" || (typeof location !== "undefined" && location.protocol === "https:")) s += "; Secure";
  doc.cookie = s;
}

export function eraseCookie(name: string, domain?: string, path?: string): void {
  if (!doc) return;
  const base = `${name}=; Max-Age=0; Path=${path || "/"}`;
  doc.cookie = base;
  const host = typeof location !== "undefined" ? location.hostname : "";
  const domains = new Set<string>();
  if (domain) domains.add(domain);
  if (host) {
    domains.add(host);
    // parent domains: a.b.example.com -> .b.example.com, .example.com
    const parts = host.split(".");
    for (let i = 1; i < parts.length - 1; i++) domains.add("." + parts.slice(i).join("."));
  }
  domains.forEach((d) => {
    doc!.cookie = `${base}; Domain=${d}`;
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameMatches(cookieName: string, matcher: string | RegExp): boolean {
  return typeof matcher === "string" ? cookieName === matcher : matcher.test(cookieName);
}

/** Delete all cookies matching the given matchers (checks every cookie currently visible). */
export function clearCookies(matchers: CookieMatcher[]): string[] {
  if (!doc || !matchers.length) return [];
  const names = doc.cookie
    .split(";")
    .map((c) => c.split("=")[0]!.trim())
    .filter(Boolean);
  const cleared: string[] = [];
  for (const name of names) {
    for (const m of matchers) {
      const rule = typeof m === "string" || m instanceof RegExp ? { name: m } : m;
      if (nameMatches(name, rule.name)) {
        eraseCookie(name, rule.domain, rule.path);
        cleared.push(name);
        break;
      }
    }
  }
  return cleared;
}
