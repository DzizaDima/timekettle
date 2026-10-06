/*
 * Липкая колонка информации о товаре (.product__column-sticky, Dawn enable_sticky_info).
 * Dawn прилипает её на top: 3rem — при всегда-липком хедере (reduce-logo-size) хедер
 * наезжает на заголовок, а если колонка выше экрана, её низ недоступен до конца галереи.
 *
 * Здесь top считается под ситуацию и пишется в --tk-sticky-top (CSS — theme-brand.css):
 *   колонка помещается под хедером → прилипает сразу под хедером;
 *   колонка выше экрана → top отрицательный: колонка прокручивается вместе со страницей
 *   и прилипает нижним краем, так что видно всё её содержимое.
 */
(() => {
  const GAP = 24;

  const headerHeight = () => {
    const header = document.querySelector('sticky-header, .section-header');
    if (!header) return 0;
    const position = getComputedStyle(header).position;
    return position === 'sticky' || position === 'fixed' ? header.offsetHeight : 0;
  };

  const update = (column) => {
    const top = headerHeight() + GAP;
    const fits = column.offsetHeight + top + GAP <= window.innerHeight;
    const value = fits ? top : window.innerHeight - column.offsetHeight - GAP;
    column.style.setProperty('--tk-sticky-top', `${Math.round(value)}px`);
  };

  const init = () => {
    const columns = document.querySelectorAll('.product__column-sticky');
    if (!columns.length) return;
    const updateAll = () => columns.forEach(update);
    // высота колонки меняется при смене варианта, раскрытии аккордеонов, догрузке картинок
    const observer = new ResizeObserver(updateAll);
    columns.forEach((column) => observer.observe(column));
    window.addEventListener('resize', updateAll);
    updateAll();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
