/* nav.js */
(function() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll shadow
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
  });

  // Hamburger / mobile nav
  const burger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNavOverlay');
  burger?.addEventListener('click', () => {
    burger.classList.toggle('open');
    mobileNav?.classList.toggle('open');
    document.body.style.overflow = mobileNav?.classList.contains('open') ? 'hidden' : '';
  });

  // Active nav link
  const path = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && (href === path || (path === '' && href === 'index.html'))) {
      a.classList.add('active');
    }
  });

  if (!reduceMotion) {
    document.documentElement.classList.add('motion-ok');

    // Reveal sections/cards as they enter the viewport.
    const revealTargets = document.querySelectorAll(
      '.hero-left, .hero-right, .section, .featured, .process-teaser, .testimonials-section, .sustainability-section, .page-hero, footer, .coll-card, .product-card, .benefit-card, .space-card, .case-card, .test-card, .sust-stat, .proc-step'
    );
    revealTargets.forEach((el, idx) => {
      el.classList.add('reveal-init');
      el.style.setProperty('--reveal-delay', `${(idx % 6) * 55}ms`);
    });

    const revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    );
    revealTargets.forEach(el => revealObserver.observe(el));
  }

  // Subtle pointer tilt on larger screens.
  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!reduceMotion && hasFinePointer) {
    document
      .querySelectorAll('.coll-card, .product-card, .benefit-card, .space-card, .case-card, .test-card, .sust-stat')
      .forEach(card => {
        card.classList.add('micro-tilt');
        card.addEventListener('pointermove', e => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          const rotateY = (x - 0.5) * 4;
          const rotateX = (0.5 - y) * 4;
          card.style.setProperty('--mx', `${rotateX.toFixed(2)}deg`);
          card.style.setProperty('--my', `${rotateY.toFixed(2)}deg`);
        });
        card.addEventListener('pointerleave', () => {
          card.style.setProperty('--mx', '0deg');
          card.style.setProperty('--my', '0deg');
        });
      });
  }
})();
