/**
 * Shared environment constants.
 * Import from this module instead of reading process.env directly
 * so that there's a single place to configure fallbacks.
 */

/** Base URL for the backend API. Configured via NEXT_PUBLIC_API_URL in .env / .env.local */
export const API_BASE: string = process.env.NEXT_PUBLIC_API_URL || ''

// Warn once in the browser console when the env var is missing.
// Next.js inlines NEXT_PUBLIC_* vars at build time — if this is empty,
// the variable was not set when the bundle was compiled.
if (typeof window !== 'undefined' && !API_BASE) {
  console.warn(
    '[XenosMeta] NEXT_PUBLIC_API_URL is not set. ' +
      'API calls will fail. Set it in .env.local or your deployment environment.'
  )
}
