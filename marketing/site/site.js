const header = document.querySelector('.site-header')
if (header) {
  const update = () => header.classList.toggle('scrolled', scrollY > 8)
  update()
  addEventListener('scroll', update, { passive: true })
}

const revealed = document.querySelectorAll('[data-reveal]')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        io.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )
  revealed.forEach((el) => io.observe(el))
} else {
  revealed.forEach((el) => el.classList.add('is-in'))
}

// Marks the header link for the current page; the home page tracks its Features section instead.
const links = [...document.querySelectorAll('.nav-links a:not(.btn)')]
const path = location.pathname.replace(/\/$/, '') || '/'
for (const link of links) {
  const target = new URL(link.href).pathname.replace(/\/$/, '') || '/'
  if (target !== '/' && target === path) link.setAttribute('aria-current', 'page')
}
const features = document.getElementById('features')
const featuresLink = links.find((link) => link.getAttribute('href')?.endsWith('#features'))
if (features && featuresLink && 'IntersectionObserver' in window) {
  new IntersectionObserver(
    ([entry]) => featuresLink.toggleAttribute('aria-current', entry.isIntersecting),
    { rootMargin: '-35% 0px -35% 0px' },
  ).observe(features)
}
