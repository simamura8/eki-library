import DATA from '../.private/data.json' with { type: 'json' };
import { CHALLENGE_COOKIE, SESSION_COOKIE, SESSION_SECONDS, configured, cookie, readCookie, session, signLocal, verifyPassword, verifyLocal } from './auth.js';
import { LOGIN_HTML, LOGIN_JS } from './login-page.js';

const baseHeaders = {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-src 'none'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function response(body, status = 200, type = 'text/plain; charset=utf-8', extra = {}) {
  return new Response(body, { status, headers: { ...baseHeaders, 'Content-Type': type, ...extra } });
}
const json = (body, status = 200) => response(JSON.stringify(body), status, 'application/json; charset=utf-8');
const redirect = url => response('', 303, 'text/plain', { Location: url });
function sameOriginPost(request, env) {
  return request.headers.get('Origin') === env.SITE_ORIGIN && request.headers.get('Sec-Fetch-Site') !== 'cross-site';
}
async function readSmallJSON(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw Error('Content type');
  if (+request.headers.get('Content-Length') > 20000 || !request.body) throw Error('Body size');
  const reader = request.body.getReader();
  let size = 0, text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 20000) { await reader.cancel(); throw Error('Body size'); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

export function createWorker() {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      // Browsers request this automatically. Never redirect it to /login and replace the login challenge.
      if (url.pathname === '/favicon.ico' && request.method === 'GET') return response(null, 204, 'image/x-icon');
      if (url.pathname === '/auth/login.js' && request.method === 'GET') return response(LOGIN_JS, 200, 'text/javascript; charset=utf-8');
      if (!configured(env) || url.origin !== env.SITE_ORIGIN) {
        return url.pathname === '/login' || url.pathname === '/' ? response(LOGIN_HTML, 503, 'text/html; charset=utf-8') : response('ログイン設定の準備中です。', 503);
      }
      if (url.pathname === '/login' && request.method === 'GET') {
        if (await session(request, env)) return redirect('/');
        const existing = readCookie(request, CHALLENGE_COOKIE);
        const challenge = await verifyLocal(existing, 'challenge', env);
        if (challenge?.nonce) return response(LOGIN_HTML, 200, 'text/html; charset=utf-8');
        const token = await signLocal({ nonce: crypto.randomUUID() }, 'challenge', env, 600);
        return response(LOGIN_HTML, 200, 'text/html; charset=utf-8', { 'Set-Cookie': cookie(CHALLENGE_COOKIE, token, 600) });
      }
      if (url.pathname === '/auth/config' && request.method === 'GET') {
        const challenge = await verifyLocal(readCookie(request, CHALLENGE_COOKIE), 'challenge', env);
        if (!challenge?.nonce) return json({ error: 'Login required' }, 401);
        return json({ nonce: challenge.nonce });
      }
      if (url.pathname === '/auth/password') {
        if (request.method !== 'POST') return response('Method not allowed', 405, 'text/plain', { Allow: 'POST' });
        if (!sameOriginPost(request, env)) return json({ error: 'Forbidden' }, 403);
        const challenge = await verifyLocal(readCookie(request, CHALLENGE_COOKIE), 'challenge', env);
        if (!challenge?.nonce || request.headers.get('X-Eki-CSRF') !== challenge.nonce) return json({ error: 'Forbidden' }, 403);
        try {
          const { success } = await env.LOGIN_LIMITER.limit({ key: 'eki-login:' + (request.headers.get('CF-Connecting-IP') || 'unknown') });
          if (!success) return response(JSON.stringify({ error: 'Too many attempts' }), 429, 'application/json', { 'Retry-After': '60' });
        } catch { return json({ error: 'Login unavailable' }, 503); }
        let body;
        try { body = await readSmallJSON(request); } catch { return json({ error: 'Invalid request' }, 400); }
        if (typeof body?.password !== 'string' || body.password.length > 128) return json({ error: 'Invalid request' }, 400);
        if (!await verifyPassword(body.password, env)) return json({ error: 'Login denied' }, 403);
        const token = await signLocal({ sub: 'owner' }, 'session', env, SESSION_SECONDS);
        const result = json({ ok: true });
        result.headers.append('Set-Cookie', cookie(SESSION_COOKIE, token, SESSION_SECONDS));
        result.headers.append('Set-Cookie', cookie(CHALLENGE_COOKIE, '', 0));
        return result;
      }
      if (url.pathname === '/auth/logout') {
        if (request.method !== 'POST') return response('Method not allowed', 405, 'text/plain', { Allow: 'POST' });
        if (!sameOriginPost(request, env) || request.headers.get('X-Eki-CSRF') !== 'logout') return json({ error: 'Forbidden' }, 403);
        const result = json({ ok: true });
        result.headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0));
        result.headers.append('Set-Cookie', cookie(CHALLENGE_COOKIE, '', 0));
        return result;
      }
      // Both assets and private data require the same verified session.
      if (!await session(request, env)) {
        return url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') ? json({ error: 'Login required' }, 401) : redirect('/login');
      }
      if (!['GET', 'HEAD'].includes(request.method)) return response('Method not allowed', 405, 'text/plain', { Allow: 'GET, HEAD' });
      if (url.pathname === '/api/data') return request.method === 'HEAD' ? response(null, 200, 'application/json') : json(DATA);
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return response('Not found', 404);
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      for (const [key, value] of Object.entries(baseHeaders)) headers.set(key, value);
      return new Response(request.method === 'HEAD' ? null : asset.body, { status: asset.status, headers });
    }
  };
}
export default createWorker();
