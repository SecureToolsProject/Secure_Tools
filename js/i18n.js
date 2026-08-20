import { en } from "./locales/en.js";
import { ko } from "./locales/ko.js";
import { ja } from "./locales/ja.js";
import { es } from "./locales/es.js";
import { de } from "./locales/de.js";
import { fr } from "./locales/fr.js";

const STORAGE_KEY = "secure-tools-language";
export const translations = { en, ko, ja, es, de, fr };

export function resolveLanguage(value, availableLanguages = Object.keys(translations)) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "en";
  if (availableLanguages.includes(normalized)) return normalized;
  const primary = normalized.split("-")[0];
  return availableLanguages.includes(primary) ? primary : "en";
}

export function getStoredLanguage(storage = globalThis.localStorage, availableLanguages = Object.keys(translations)) {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    if (!value || !availableLanguages.includes(String(value).toLowerCase())) return null;
    return resolveLanguage(value, availableLanguages);
  } catch {
    return null;
  }
}

export function detectLanguage(navigatorObject = globalThis.navigator, availableLanguages = Object.keys(translations)) {
  const candidates = [navigatorObject?.language, ...(navigatorObject?.languages || [])].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = resolveLanguage(candidate, availableLanguages);
    if (resolved !== "en" || String(candidate).toLowerCase().startsWith("en")) return resolved;
  }
  return "en";
}

export function selectInitialLanguage({ storage = globalThis.localStorage, navigatorObject = globalThis.navigator } = {}) {
  return getStoredLanguage(storage) || detectLanguage(navigatorObject);
}

const getValue = (language, key) => key.split(".").reduce(
  (value, part) => value?.[part],
  translations[language],
);

let currentLanguage = "en";

export const t = (key) => getValue(currentLanguage, key) ?? getValue("en", key) ?? key;

const translateDocument = () => {
  document.documentElement.lang = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });

  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", t(element.dataset.i18nTitle));
  });

  document.querySelectorAll("[data-language-select]").forEach((select) => {
    select.value = currentLanguage;
  });

  const pageKey = document.body.dataset.page || "home";
  document.title = t(`metadata.${pageKey}.title`);
  document.querySelector('meta[name="description"]')?.setAttribute("content", t(`metadata.${pageKey}.description`));
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", t(`metadata.${pageKey}.title`));
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", t(`metadata.${pageKey}.description`));
};

export function initializeI18n() {
  currentLanguage = selectInitialLanguage();
  translateDocument();

  document.querySelectorAll("[data-language-select]").forEach((select) => {
    select.addEventListener("change", (event) => {
      currentLanguage = event.target.value in translations ? event.target.value : "en";
      try {
        localStorage.setItem(STORAGE_KEY, currentLanguage);
      } catch {
        // Preferences still work for this session when storage is unavailable.
      }
      translateDocument();
      document.dispatchEvent(new CustomEvent("securetools:languagechange", {
        detail: { language: currentLanguage },
      }));
    });
  });
}
