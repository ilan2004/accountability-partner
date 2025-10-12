/**
 * Get the URL of the application based on the current environment
 * This ensures OAuth callbacks work correctly in both development and production
 */
export function getURL(): string {
  // Check if we're on the client side
  if (typeof window !== 'undefined') {
    // Always use the current browser URL when on client
    // This ensures we get the right URL regardless of deployment
    return window.location.origin + '/'
  }
  
  // Server-side: use environment variables
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this in your environment variables
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel
    'http://localhost:3000'

  // Make sure to include `https://` when not localhost.
  url = url.startsWith('http') ? url : `https://${url}`
  
  // Make sure to include trailing `/`.
  url = url.endsWith('/') ? url : `${url}/`
  
  return url
}

/**
 * Get the URL for auth callbacks
 */
export function getAuthCallbackURL(redirectedFrom?: string | null): string {
  const baseURL = getURL()
  const callbackURL = `${baseURL}auth/callback`
  
  if (redirectedFrom) {
    return `${callbackURL}?redirectedFrom=${encodeURIComponent(redirectedFrom)}`
  }
  
  return callbackURL
}
