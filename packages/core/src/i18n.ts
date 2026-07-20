import type { ContentConfig, ResolvedConfig, Translation } from "./types";
import { EN } from "./defaults";
import { doc } from "./util";

export interface I18n {
  lang: string;
  t: Required<Translation> & Translation;
}

function detect(content: ContentConfig): string {
  if (content.lang) return content.lang;
  const auto = content.autoDetect ?? "document";
  let raw = "";
  if (auto === "document" && doc) raw = doc.documentElement.lang || "";
  if (!raw && auto !== false && typeof navigator !== "undefined") raw = navigator.language || "";
  return (raw || content.fallback || "en").toLowerCase();
}

function pick(content: ContentConfig, lang: string): { lang: string; value: Translation | string | undefined } {
  const table = content.translations || {};
  const short = lang.split("-")[0]!;
  if (table[lang] !== undefined) return { lang, value: table[lang] };
  if (table[short] !== undefined) return { lang: short, value: table[short] };
  const fb = content.fallback || "en";
  if (table[fb] !== undefined) return { lang: fb, value: table[fb] };
  return { lang: short === "en" || !Object.keys(table).length ? short : fb, value: undefined };
}

function merge(base: Translation, over?: Translation): Translation {
  if (!over) return base;
  return {
    rtl: over.rtl ?? base.rtl,
    banner: { ...base.banner, ...over.banner },
    preferences: { ...base.preferences, ...over.preferences },
    categories: deepMergeCats(base.categories, over.categories),
  };
}

function deepMergeCats(
  a: Translation["categories"],
  b: Translation["categories"]
): Translation["categories"] {
  const out: NonNullable<Translation["categories"]> = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = { ...out[k], ...v };
  return out;
}

/** Resolve the active language + fully-merged texts. Fetches URL-based translations lazily. */
export async function resolveI18n(cfg: ResolvedConfig, forceLang?: string): Promise<I18n> {
  const content = cfg.content;
  const wanted = (forceLang || detect(content)).toLowerCase();
  const picked = pick(content, wanted);
  let overlay: Translation | undefined;
  if (typeof picked.value === "string") {
    try {
      const res = await fetch(picked.value);
      overlay = (await res.json()) as Translation;
      // cache so future setLanguage() calls don't refetch
      (content.translations as Record<string, Translation>)[picked.lang] = overlay;
    } catch {
      overlay = undefined;
    }
  } else {
    overlay = picked.value;
  }
  return { lang: picked.lang, t: merge(EN, overlay) as I18n["t"] };
}
