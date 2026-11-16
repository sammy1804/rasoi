/**
 * Build target. `npm run build:mobile` builds a single self-contained page for
 * the claude.ai artifact link (no server, in-memory routing, invite by code).
 */
export const IS_MOBILE_PAGE = import.meta.env.MODE === 'artifact'
