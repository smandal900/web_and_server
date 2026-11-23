import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

const scrypt = promisify(crypto.scrypt);
export const COOKIE = { token: 'immich_access_token', type: 'immich_auth_type', flag: 'immich_is_authenticated' };
const MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

export class HttpError extends Error {
  /**
   * @param {{ log?: boolean }} options `log: false` marks a failure that is a normal answer rather than a problem
   *   (a user without a profile picture), so it is not written to the error log.
   */
  constructor(status, message, { log = true } = {}) {
    super(message);
    this.status = status;
    this.log = log;
  }
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = stored.split(':');
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

export function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (id, token_hash, user_id, device_type) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    sha256(token),
    userId,
    String(req.headers['user-agent'] ?? '').slice(0, 200),
  );
  return token;
}

export function setAuthCookies(res, token) {
  const base = { sameSite: 'lax', maxAge: MAX_AGE_MS, path: '/' };
  res.cookie(COOKIE.token, token, { ...base, httpOnly: true });
  res.cookie(COOKIE.type, 'password', { ...base, httpOnly: true });
  res.cookie(COOKIE.flag, 'true', { ...base, httpOnly: false });
}

export function clearAuthCookies(res) {
  for (const name of Object.values(COOKIE)) res.clearCookie(name, { path: '/' });
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Header the official Immich clients (and the native Android app) send the session token in. */
export const TOKEN_HEADER = 'x-immich-user-token';

export function extractToken(req) {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  const header = req.headers[TOKEN_HEADER];
  return bearer ?? (typeof header === 'string' && header.trim() ? header.trim() : null) ?? parseCookies(req.headers.cookie)[COOKIE.token] ?? null;
}

function findSession(token) {
  return db
    .prepare(
      `SELECT s.id AS session_id, u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND u.deleted_at IS NULL`,
    )
    .get(sha256(token));
}

/** Resolve the session row (user columns + session_id) for any request-like object with headers. */
export function authenticate(req) {
  const token = extractToken(req);
  return token ? findSession(token) : undefined;
}

/** Express middleware: requires a valid session, sets req.user and req.sessionId. */
export function requireAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next(new HttpError(401, 'Authentication required'));
  const row = findSession(token);
  if (!row) return next(new HttpError(401, 'Invalid user token'));
  req.user = row;
  req.sessionId = row.session_id;
  next();
}

/** Like requireAuth, but anonymous requests pass through with req.user unset. */
export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  const row = token ? findSession(token) : undefined;
  if (row) {
    req.user = row;
    req.sessionId = row.session_id;
  }
  next();
}

export function requireAdmin(req, _res, next) {
  next(req.user?.is_admin ? undefined : new HttpError(403, 'Forbidden'));
}

const ELEVATED_MS = 15 * 60 * 1000;

/** Whether this session unlocked the locked folder (PIN or password) during the last 15 minutes. */
export function isElevated(req) {
  const row = req.sessionId ? db.prepare('SELECT elevated_at FROM sessions WHERE id = ?').get(req.sessionId) : undefined;
  return !!row?.elevated_at && Date.now() - Date.parse(row.elevated_at) < ELEVATED_MS;
}

export function requireElevated(req) {
  if (!isElevated(req)) throw new HttpError(401, 'Elevated session required');
}

export const toUserDto = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarColor: 'primary',
  clusterGroupId: u.cluster_group_id ?? u.id,
  createdAt: u.created_at,
  deletedAt: u.deleted_at,
  isAdmin: !!u.is_admin,
  license: null,
  oauthId: '',
  profileChangedAt: u.updated_at,
  profileImagePath: u.profile_image_path ?? '',
  quotaSizeInBytes: null,
  quotaUsageInBytes: 0,
  shouldChangePassword: !!u.should_change_password,
  status: 'active',
  updatedAt: u.updated_at,
});

/** Public user shape (UserResponseDto) shown to other users. */
export const toPublicUserDto = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarColor: 'primary',
  profileChangedAt: u.updated_at,
  profileImagePath: u.profile_image_path ?? '',
});

export const toLoginDto = (u, accessToken) => ({
  accessToken,
  isAdmin: !!u.is_admin,
  isOnboarded: !!u.is_onboarded,
  name: u.name,
  profileImagePath: u.profile_image_path ?? '',
  shouldChangePassword: !!u.should_change_password,
  userEmail: u.email,
  userId: u.id,
});
