/**
 * URLs of the sibling apps, resolved for both local dev (separate ports) and
 * the Vercel services deployment (all apps share one domain: the customer
 * marketplace lives at `/`, so a same-origin absolute path works everywhere).
 */
export const CUSTOMER_APP_URL: string =
  import.meta.env.VITE_CUSTOMER_APP_URL ?? (import.meta.env.DEV ? 'http://localhost:5173' : '/');
