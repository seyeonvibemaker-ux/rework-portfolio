(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var groups = [
    '.cover-kicker, .cover-title, .pain, .cover-answer',
    '.kicker-row, .headline, .subhead, .about-lede, .about-intro, .pillar',
    '.step, .grid6-item, .price-tier, .addon, .stat, .ig-card',
    '.journey-row, .conv-title, .conv-step',
    '.manifesto-line, .manifesto-sub, .founder-name, .founder-role, .founder-quote, .founder-stats, .founder-item',
    '.list-row, .closing-head, .cl-card, .closing-foot'
  ].join(', ');

  var nodes = Array.prototype.slice.call(document.querySelectorAll(groups));
  if (!nodes.length) return;
  nodes.forEach(function (el) { el.setAttribute('data-anim', ''); });
  document.documentElement.classList.add('js-anim');

  function revealGroup(el) {
    var parent = el.parentNode;
    var sibs = Array.prototype.filter.call(parent.children, function (c) { return c.hasAttribute && c.hasAttribute('data-anim'); });
    var i = sibs.indexOf(el);
    el.style.transitionDelay = Math.min(i < 0 ? 0 : i, 6) * 70 + 'ms';
    el.classList.add('is-in');
  }

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { revealGroup(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  nodes.forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < (window.innerHeight || 800)) { revealGroup(el); }   // already visible on load
    else { io.observe(el); }
  });
})();
