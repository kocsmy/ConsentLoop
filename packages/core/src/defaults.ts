import type { Translation } from "./types";

/** Built-in English texts — every key can be overridden per language. */
export const EN: Translation = {
  banner: {
    title: "We value your privacy",
    description:
      "We use cookies to run this site and to understand how it is used. You choose what we may use — change your mind any time.",
    acceptAll: "Accept all",
    rejectAll: "Reject all",
    preferences: "Preferences",
    privacyPolicy: "Privacy policy",
    terms: "Terms & conditions",
  },
  preferences: {
    title: "Privacy preferences",
    description:
      "Decide per category. Required cookies keep the site working and are always on.",
    acceptAll: "Accept all",
    rejectAll: "Reject all",
    save: "Save preferences",
    close: "Close",
    alwaysOn: "Always on",
    servicesLabel: "Services",
  },
  categories: {
    necessary: {
      title: "Strictly necessary",
      description: "Required for core site functionality like security and network management.",
    },
    functionality: {
      title: "Functionality",
      description: "Remembers your settings and preferences to personalize your visit.",
    },
    analytics: {
      title: "Analytics",
      description: "Helps us understand how visitors use the site so we can improve it.",
    },
    marketing: {
      title: "Marketing",
      description: "Used to show relevant content and measure ad performance.",
    },
  },
};

/** Default mapping from ConsentLoop categories to Google Consent Mode v2 keys. */
export const GCM_MAP: Record<string, string[]> = {
  necessary: ["security_storage"],
  functionality: ["functionality_storage", "personalization_storage"],
  analytics: ["analytics_storage"],
  marketing: ["ad_storage", "ad_user_data", "ad_personalization"],
};

/** All Consent Mode v2 keys ConsentLoop manages. */
export const GCM_KEYS = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
  "functionality_storage",
  "personalization_storage",
  "security_storage",
] as const;

export const COOKIE_NAME = "cl_consent";
export const DEFAULT_EXPIRES_DAYS = 182;
export const Z_INDEX = 2147483000;
