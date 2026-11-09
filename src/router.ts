import { useSyncExternalStore, type MouseEvent } from 'react'

/** A tiny history router: the site has only a few pages, so no package is needed. */
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/'

export function usePath() {
  return useSyncExternalStore(subscribe, currentPath)
}

/** Smoothly scrolls to the element named by a hash like '#library', once the page has rendered. */
export function scrollToHash(hash: string, smooth = true) {
  const id = decodeURIComponent(hash.replace(/^#/, ''))
  if (!id) return
  // Two frames: the first lets React paint a page that just changed.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    }),
  )
}

export function navigate(to: string) {
  const url = new URL(to, window.location.href)
  const samePage = (url.pathname.replace(/\/+$/, '') || '/') === currentPath()
  if (samePage && url.hash) {
    window.history.replaceState(null, '', url.pathname + url.hash)
    scrollToHash(url.hash)
    return
  }
  if (samePage && url.hash === window.location.hash && url.search === window.location.search) return
  window.history.pushState(null, '', url.pathname + url.search + url.hash)
  listeners.forEach((listener) => listener())
  if (url.hash) scrollToHash(url.hash, false)
  else window.scrollTo(0, 0)
}

/** Swaps the current address for another without a history entry, e.g. for an old URL that moved. */
export function redirect(to: string) {
  window.history.replaceState(null, '', to)
  listeners.forEach((listener) => listener())
}

/** Use as an anchor's onClick so in-site links skip a full page load. Modified clicks still open new tabs. */
export function followLink(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const href = event.currentTarget.getAttribute('href')
  if (!href || !href.startsWith('/')) return
  event.preventDefault()
  navigate(href)
}
