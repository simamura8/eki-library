import { base64url, jwtVerify, SignJWT } from 'jose';
export const SESSION_COOKIE = '__Host-eki_session';
export const CHALLENGE_COOKIE = '__Host-eki_challenge';
export const SESSION_SECONDS = 12 * 60 * 60;

export function configured(env) {
  return /^https:\/\/[^/]+$/.test(env.SITE_ORIGIN || '') &&
    typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 43 &&
    /^[A-Za-z0-9_-]{43}$/.test(env.PASSWORD_KEY || '') &&
    /^[A-Za-z0-9_-]{43}$/.test(env.PASSWORD_VERIFIER || '') &&
    typeof env.LOGIN_LIMITER?.limit === 'function';
}

export function readCookie(request, name) {
  const matches = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : '';
}

export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function signLocal(payload, purpose, env, seconds) {
  return new SignJWT({ ...payload, purpose })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(env.SITE_ORIGIN).setAudience(env.SITE_ORIGIN)
    .setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000) + seconds)
    .sign(new TextEncoder().encode(env.SESSION_SECRET));
}

export async function verifyLocal(token, purpose, env) {
  try {
    if (!token || token.length > 4096) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SESSION_SECRET), {
      algorithms: ['HS256'], issuer: env.SITE_ORIGIN, audience: env.SITE_ORIGIN,
      requiredClaims: ['iat', 'exp', 'purpose'], maxTokenAge: purpose === 'session' ? '12h' : '10m'
    });
    return payload.purpose === purpose ? payload : null;
  } catch { return null; }
}

export async function session(request, env) {
  const payload = await verifyLocal(readCookie(request, SESSION_COOKIE), 'session', env);
  return payload?.sub === 'owner' ? payload : null;
}

// The password is generated with 192 bits of randomness by setup-password.mjs.
// HMAC verification keeps its secret key server-side and avoids timing-sensitive string comparison.
export async function verifyPassword(password, env) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 128) return false;
  const key = await crypto.subtle.importKey('raw', base64url.decode(env.PASSWORD_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, base64url.decode(env.PASSWORD_VERIFIER), new TextEncoder().encode(password));
}
