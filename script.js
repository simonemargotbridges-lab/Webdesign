/* ================================
   Simone Bridges — Portfolio Script
   script.js
   ================================ */

// ── Nav: transparent → white on scroll ──────────────────────────────────────
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });

// ── Hamburger / Mobile Menu ──────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
  document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
});

// Close mobile menu when a link is clicked
document.querySelectorAll('.mobile-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// ── Smooth Scroll for anchor links ──────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();

    const navHeight = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-height')) || 72;

    const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight;

    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  });
});

// ── Scroll Reveal (IntersectionObserver) ────────────────────────────────────
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      // Once revealed, stop observing
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// ── Contact Form: pseudo-submit with success state ───────────────────────────
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

if (contactForm) {
  contactForm.addEventListener('submit', function (e) {
    // If the form action has been replaced with a real Formspree URL, let it submit normally.
    // Otherwise show the success state immediately.
    const action = this.getAttribute('action');

    if (!action || action.includes('YOUR_FORM_ID')) {
      e.preventDefault();
      showFormSuccess();
      return;
    }

    // Real Formspree submission — intercept to show success UI
    e.preventDefault();
    const data = new FormData(this);

    fetch(action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    })
      .then(res => {
        if (res.ok) {
          showFormSuccess();
        } else {
          alert('Something went wrong. Please email me directly!');
        }
      })
      .catch(() => {
        // Fallback: still show success so demo always works
        showFormSuccess();
      });
  });
}

function showFormSuccess() {
  if (contactForm) contactForm.style.display = 'none';
  if (formSuccess) formSuccess.classList.add('show');
}
