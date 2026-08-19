import { REPOSITORY_URL } from "./config.js";
import { initializeI18n } from "./i18n.js";
import { initializeTheme } from "./theme.js";

document.querySelectorAll("[data-repository-link]").forEach((link) => {
  link.href = REPOSITORY_URL;
});

initializeTheme();
initializeI18n();
