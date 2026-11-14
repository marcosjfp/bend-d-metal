/**
 * Netlify adds a fixed "Powered by Netlify" badge (iframe#nl-badge-frame) at the bottom of
 * free-plan sites. It would cover the bottom tab bar on phones, so when it is present we lift
 * the tab bar above it. The badge itself is left untouched.
 */
const BADGE_ID = 'nl-badge-frame'
const GAP = 6

function update() {
  const badge = document.getElementById(BADGE_ID)
  let offset = 0
  if (badge) {
    const r = badge.getBoundingClientRect()
    const visible = r.width > 0 && r.height > 0 && getComputedStyle(badge).display !== 'none'
    // Only reserve room when the badge actually sits along the bottom edge
    if (visible && r.bottom >= window.innerHeight - 4) offset = Math.ceil(window.innerHeight - r.top) + GAP
  }
  document.documentElement.style.setProperty('--badge-offset', `${offset}px`)
}

export function watchHostingBadge() {
  update()
  const observer = new MutationObserver(update)
  observer.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['style', 'class'] })
  // The badge can resize itself after loading; watch its attributes too once it exists
  const attach = () => {
    const badge = document.getElementById(BADGE_ID)
    if (badge) observer.observe(badge, { attributes: true, attributeFilter: ['style', 'class', 'height', 'width'] })
  }
  new MutationObserver(attach).observe(document.body, { childList: true })
  window.addEventListener('resize', update)
  // Safety net for late layout changes inside the badge
  setInterval(update, 3000)
}
