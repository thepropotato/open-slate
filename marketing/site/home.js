const still = matchMedia('(prefers-reduced-motion: reduce)').matches

const STORE_URL = 'https://chromewebstore.google.com/detail/kbacclgoobafnkifgckaenacaeghfonm'
for (const el of document.querySelectorAll('[data-cws]')) el.href = STORE_URL

/* Before/after slider: sweeps once on load, then follows the pointer or arrow keys. */
;(() => {
  const compare = document.getElementById('compare')
  const handle = document.getElementById('handle')
  const hint = document.getElementById('hint')
  if (!compare || !handle) return

  let pos = 100
  let auto = !still
  let frame = 0
  const set = (value) => {
    pos = Math.max(0, Math.min(100, value))
    compare.style.setProperty('--pos', `${pos}%`)
    handle.setAttribute('aria-valuenow', String(Math.round(pos)))
  }
  const stop = () => {
    auto = false
    cancelAnimationFrame(frame)
    hint?.classList.add('gone')
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  const tween = (to, ms) =>
    new Promise((resolve) => {
      const from = pos
      const start = performance.now()
      const step = (now) => {
        if (!auto) return resolve(false)
        const k = Math.min(1, (now - start) / ms)
        set(from + (to - from) * ease(k))
        if (k < 1) frame = requestAnimationFrame(step)
        else resolve(true)
      }
      frame = requestAnimationFrame(step)
    })
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const intro = async () => {
    await wait(900)
    for (const [to, ms] of [[16, 1600], [84, 2000], [52, 1400]]) {
      if (!(await tween(to, ms))) return
    }
  }

  if (still) set(52)
  else {
    set(100)
    new IntersectionObserver((entries, io) => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      intro()
    }, { threshold: 0.4 }).observe(compare)
  }

  const fromEvent = (event) => {
    const box = compare.getBoundingClientRect()
    set(((event.clientX - box.left) / box.width) * 100)
  }
  compare.addEventListener('pointerdown', (event) => {
    stop()
    compare.setPointerCapture(event.pointerId)
    fromEvent(event)
    handle.focus({ preventScroll: true })
  })
  compare.addEventListener('pointermove', (event) => {
    if (compare.hasPointerCapture(event.pointerId)) fromEvent(event)
  })
  handle.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -4, ArrowRight: 4 }[event.key]
    if (step === undefined && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    stop()
    set(event.key === 'Home' ? 0 : event.key === 'End' ? 100 : pos + step)
  })
})()

/* Feature tabs: one panel and one image at a time. */
;(() => {
  const heads = [...document.querySelectorAll('.tab-head')]
  const panels = [...document.querySelectorAll('.tab-panel')]
  const images = [...document.querySelectorAll('.stack img')]
  const select = (index) => {
    heads.forEach((head, i) => {
      head.classList.toggle('is-open', i === index)
      head.setAttribute('aria-pressed', String(i === index))
    })
    panels.forEach((panel, i) => (panel.hidden = i !== index))
    images.forEach((image, i) => image.classList.toggle('is-on', i === index))
  }
  heads.forEach((head, i) => head.addEventListener('click', () => select(i)))
  select(0)
})()

/* Counts the tally up once it scrolls into view; the markup already holds the final numbers. */
;(() => {
  const numbers = [...document.querySelectorAll('.tally b')]
  if (still || !numbers.length || !('IntersectionObserver' in window)) return
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      io.unobserve(entry.target)
      const el = entry.target
      const final = Number(el.textContent)
      const start = performance.now()
      const tick = (now) => {
        const k = Math.min(1, (now - start) / 1100)
        el.textContent = String(Math.round(final * (1 - (1 - k) ** 3)))
        if (k < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  }, { threshold: 0.6 })
  numbers.forEach((el) => io.observe(el))
})()

/* Contributors, read from GitHub at load. Bots are dropped; the section stays hidden if the API is blocked. */
;(async () => {
  const section = document.getElementById('contributors')
  const list = document.getElementById('contribs')
  if (!section || !list) return
  try {
    const res = await fetch(
      'https://api.github.com/repos/thepropotato/open-slate/contributors?per_page=100',
      { headers: { Accept: 'application/vnd.github+json' } },
    )
    if (!res.ok) return
    const people = (await res.json())
      .filter((person) => person && person.type !== 'Bot' && person.login)
      .sort((a, b) => b.contributions - a.contributions)
    if (!people.length) return
    for (const person of people) {
      const link = document.createElement('a')
      link.className = 'contrib'
      link.href = person.html_url
      link.target = '_blank'
      link.rel = 'noopener'
      const commits = person.contributions
      link.setAttribute('aria-label', `${person.login}, ${commits} commit${commits === 1 ? '' : 's'}`)
      const avatar = document.createElement('img')
      avatar.src = `${person.avatar_url}&s=64`
      avatar.alt = ''
      avatar.loading = 'lazy'
      avatar.width = 32
      avatar.height = 32
      const name = document.createElement('span')
      name.textContent = person.login
      const count = document.createElement('span')
      count.className = 'commits'
      count.textContent = commits
      link.append(avatar, name, count)
      list.append(link)
    }
    section.hidden = false
  } catch {
    /* offline or blocked */
  }
})()
