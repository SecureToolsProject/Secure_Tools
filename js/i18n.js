import { en } from "./locales/en.js";
import { ko } from "./locales/ko.js";

const STORAGE_KEY = "secure-tools-language";
const translations = { en, ko };

const getStoredLanguage = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value in translations ? value : null;
  } catch {
    return null;
  }
};

const detectLanguage = () => {
  const browserLanguage = navigator.language?.toLowerCase() || "en";
  return browserLanguage.startsWith("ko") ? "ko" : "en";
};

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
  currentLanguage = getStoredLanguage() || detectLanguage();
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
