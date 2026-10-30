// The native disclosure remains usable when scripts or preference storage fail.
export function initializeNavigation() {
  const desktop = window.matchMedia('(min-width: 38.001rem)');
  document.querySelectorAll('.header-menu').forEach((menu) => {
    const summary = menu.querySelector('summary');
    const update = () => {
      const focusInside = menu.contains(document.activeElement);
      menu.open = desktop.matches;
      menu.toggleAttribute('data-desktop', desktop.matches);
      if (!desktop.matches && focusInside) summary.focus();
    };
    update();
    desktop.addEventListener('change', update);
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !desktop.matches && menu.open) {
        event.preventDefault();
        menu.open = false;
        summary.focus();
      }
    });
    menu.querySelectorAll('nav a').forEach((link) => link.addEventListener('click', () => {
      if (!desktop.matches) {
        menu.open = false;
        summary.focus();
      }
    }));
    menu.dataset.navigationReady = 'true';
  });
}
