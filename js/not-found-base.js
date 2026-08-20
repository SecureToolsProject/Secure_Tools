(() => {
  const base = location.hostname.endsWith(".github.io") ? "/Secure_Tools/" : "/";
  const baseElement = document.createElement("base");
  baseElement.href = base;
  document.head.append(baseElement);
})();
