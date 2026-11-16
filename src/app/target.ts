/**
 * Build targets.
 *  - web build (`npm run build`): the public site, hash-routed so it works on any static host.
 *  - phone page (`npm run build:mobile`): one self-contained file for the claude.ai link; routes in memory.
 */
// `import.meta.env` is undefined when scripts run this code outside Vite (e.g. scripts/kitchen-preview.ts).
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {}
export const IS_MOBILE_PAGE = env.MODE === 'artifact'

/** Where the public site lives. Links sent to other people (invites, the cook's link) always point here. */
const HOSTED_URL = 'https://sammy1804.github.io/rasoi/'

export function publicBase(): string {
  const fromEnv = env.VITE_PUBLIC_URL
  if (fromEnv) return fromEnv.endsWith('/') ? fromEnv : fromEnv + '/'
  if (IS_MOBILE_PAGE || typeof window === 'undefined') return HOSTED_URL
  const { origin, pathname } = window.location
  // local dev and previews link to themselves; the deployed site links to itself too
  return origin + pathname.replace(/[^/]*$/, '')
}

/** A shareable link to a route of the public site, e.g. publicLink('/join/7XK92A'). */
export const publicLink = (route: string) => `${publicBase()}#${route}`
