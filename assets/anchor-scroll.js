// Smooth in-page anchor scrolling. Runs in the capture phase so it still works
// where another script cancels the click (Shopify's theme editor preview does).
(() => {
  const headerOffset = () => {
    const header = document.querySelector('sticky-header, .section-header');
    if (!header) return 0;
    const position = getComputedStyle(header).position;
    return position === 'sticky' || position === 'fixed' ? header.offsetHeight : 0;
  };

  // Shopify generates the footer's section id (sections--<n>__footer) and it changes
  // whenever the section group is recreated, so fall back to the footer element.
  const resolveTarget = (hash) => {
    if (!hash || hash === '#') return null;
    const id = decodeURIComponent(hash.slice(1));
    return (
      document.getElementById(id) ||
      (/__footer$|^contact$/i.test(id) ? document.querySelector('footer, .brand-footer') : null)
    );
  };

  const scrollToTarget = (target, behavior) => {
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset();
    window.scrollTo({ top: Math.max(top, 0), behavior });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };

  document.addEventListener(
    'click',
    (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest?.('a[href*="#"]');
      if (!link || link.target === '_blank') return;

      const url = new URL(link.href, window.location.href);
      if (url.pathname !== window.location.pathname || url.search !== window.location.search) return;

      const target = resolveTarget(url.hash);
      if (!target) return;

      event.preventDefault();
      scrollToTarget(target, 'smooth');
      window.history.pushState(null, '', url.hash);
    },
    true
  );

  window.addEventListener('hashchange', () => {
    const target = resolveTarget(window.location.hash);
    if (target) scrollToTarget(target, 'smooth');
  });

  // Landing on a hash from another page: images above the fold settle late, so
  // re-run the positioning once everything has loaded.
  window.addEventListener('load', () => {
    const target = resolveTarget(window.location.hash);
    if (target) requestAnimationFrame(() => scrollToTarget(target, 'instant'));
  });
})();
