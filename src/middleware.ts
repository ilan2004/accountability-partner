import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareSupabaseClient } from '@/lib/supabase-server'

export async function middleware(request: NextRequest) {
  // Skip middleware for auth routes and API routes
  if (request.nextUrl.pathname.startsWith('/auth/') || 
      request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Create response first
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create supabase client with the response
  const supabase = createMiddlewareSupabaseClient(request, response)

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log(`[Middleware] Path: ${request.nextUrl.pathname}, Session: ${session?.user?.id ? 'Present' : 'None'}`)

  // Protected routes
  const protectedPaths = ['/dashboard', '/settings', '/api/tasks', '/api/users', '/api/settings']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  // Redirect to login if not authenticated and trying to access protected route
  if (isProtectedPath && !session) {
    console.log('[Middleware] Redirecting to login - no session')
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to dashboard if authenticated and trying to access login
  if (request.nextUrl.pathname === '/login' && session) {
    console.log('[Middleware] User already authenticated, redirecting to dashboard')
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Don't redirect root page - let it handle its own logic
  // This allows the homepage to show properly
  // if (request.nextUrl.pathname === '/') {
  //   if (session) {
  //     return NextResponse.redirect(new URL('/dashboard', request.url))
  //   } else {
  //     return NextResponse.redirect(new URL('/login', request.url))
  //   }
  // }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
  runtime: 'nodejs',
}
