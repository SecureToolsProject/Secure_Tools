const STORAGE_KEY = "secure-tools-theme";
const THEME_QUERY = "(prefers-color-scheme: dark)";
const THEMES = new Set(["light", "dark", "system"]);

const getStoredTheme = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.has(value) ? value : "system";
  } catch {
    return "system";
  }
};

const resolveTheme = (theme, mediaQuery) => (
  theme === "system" ? (mediaQuery.matches ? "dark" : "light") : theme
);

const applyTheme = (theme, mediaQuery) => {
  const root = document.documentElement;
  const resolvedTheme = resolveTheme(theme, mediaQuery);
  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#111210" : "#f7f7f5");
  document.querySelectorAll("[data-theme-select]").forEach((select) => {
    select.value = theme;
  });
};

export function initializeTheme() {
  const mediaQuery = window.matchMedia(THEME_QUERY);
  let theme = getStoredTheme();

  applyTheme(theme, mediaQuery);

  document.querySelectorAll("[data-theme-select]").forEach((select) => {
    select.addEventListener("change", (event) => {
      const nextTheme = THEMES.has(event.target.value) ? event.target.value : "system";
      theme = nextTheme;
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // Preferences still work for this session when storage is unavailable.
      }
      applyTheme(theme, mediaQuery);
    });
  });

  mediaQuery.addEventListener("change", () => {
    if (theme === "system") applyTheme(theme, mediaQuery);
  });
}
