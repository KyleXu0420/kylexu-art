// middleware.js — Vercel Routing Middleware: the whole site sits behind one password (HTTP Basic
// Auth, any user name). Delete this file to open the site again.
const PASSWORD = 'kyle';

export const config = { matcher: '/:path*' };

export default function middleware(request) {
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Basic ')) {
    try {
      const pair = atob(auth.slice(6));
      if (pair.slice(pair.indexOf(':') + 1) === PASSWORD) return;
    } catch {}
  }
  return new Response('Password required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="kylexu.art", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}
