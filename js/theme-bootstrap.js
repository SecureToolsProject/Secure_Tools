(() => {
  let preference = "system";
  try { preference = localStorage.getItem("secure-tools-theme") || "system"; } catch {}
  const dark = preference === "dark"
    || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = preference;
  document.documentElement.dataset.resolvedTheme = dark ? "dark" : "light";
})();
