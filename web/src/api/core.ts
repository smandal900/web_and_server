// Server info, auth, current user, sessions and error reporting.
import { call } from './client';
import { E } from './endpoints';
import type {
  CalendarHeatmap,
  ErrorLogPage,
  LoginResponse,
  Preferences,
  ServerConfig,
  ServerFeatures,
  ServerStatistics,
  ServerStorage,
  ServerVersion,
  Session,
  User,
} from './types';

// --- server -----------------------------------------------------------
export const getServerConfig = () => call<ServerConfig>(E.server.config);
export const getFeatures = () => call<ServerFeatures>(E.server.features);
export const getVersion = () => call<ServerVersion>(E.server.version);
export const getAbout = () =>
  call<{ version: string; nodejs?: string; licensed?: boolean; versionUrl?: string }>(E.server.about);
export const getStorage = () => call<ServerStorage>(E.server.storage);
export const getServerStatistics = () => call<ServerStatistics>(E.server.statistics);
export const getVersionHistory = () =>
  call<Array<{ id: string; createdAt: string; version: string }>>(E.server.versionHistory);
export const getMediaTypes = () => call<{ image: string[]; video: string[] }>(E.server.mediaTypes);
export const getPublicConfig = () => call<Record<string, any>>(E.config.public);
export const getUserConfig = () => call<Record<string, any>>(E.config.user);

// --- auth ---------------------------------------------------------------
export const signUpAdmin = (body: { email: string; name: string; password: string }) =>
  call<User>(E.auth.signUp, { body });
export const login = (body: { email: string; password: string }) => call<LoginResponse>(E.auth.login, { body });
export const logout = () => call<{ redirectUri: string }>(E.auth.logout);
export const changePassword = (body: { password: string; newPassword: string; invalidateSessions?: boolean }) =>
  call<User>(E.auth.changePassword, { body });
export const getAuthStatus = () => call<{ isElevated: boolean; password: boolean; pinCode: boolean }>(E.auth.status);
export const setupPin = (pinCode: string) => call(E.auth.setupPin, { body: { pinCode } });
export const changePin = (body: { pinCode: string; newPinCode: string }) => call(E.auth.changePin, { body });
export const resetPin = (body: { pinCode?: string; password?: string }) => call(E.auth.resetPin, { body });
export const unlockSession = (pinCode: string) => call(E.auth.unlockSession, { body: { pinCode } });
export const lockSession = () => call(E.auth.lockSession);
export const oauthAuthorize = (redirectUri: string) =>
  call<{ url: string }>(E.oauth.authorize, { body: { redirectUri } });
export const oauthCallback = (url: string) => call<LoginResponse>(E.oauth.callback, { body: { url } });
export const oauthLink = (url: string) => call<User>(E.oauth.link, { body: { url } });
export const oauthUnlink = () => call<User>(E.oauth.unlink);

// --- users --------------------------------------------------------------
export const getMe = () => call<User>(E.users.me);
export const updateMe = (body: Partial<Pick<User, 'name' | 'email'>>) => call<User>(E.users.updateMe, { body });
export const getPreferences = () => call<Preferences>(E.users.preferences);
export const updatePreferences = (body: Partial<Record<keyof Preferences, unknown>>) =>
  call<Preferences>(E.users.updatePreferences, { body });
export const setOnboarded = (isOnboarded: boolean) => call(E.users.setOnboarding, { body: { isOnboarded } });
export const getHeatmap = (from: string, to: string) =>
  call<CalendarHeatmap>(E.users.heatmap, { query: { from, to } });
export const uploadAvatar = (file: Blob) => {
  const body = new FormData();
  body.append('file', file, 'avatar.png');
  return call<User>(E.users.uploadAvatar, { body });
};
export const deleteAvatar = () => call(E.users.deleteAvatar);
export const listUsers = () => call<User[]>(E.users.list);
export const getGroupUsers = (id: string) => call<User[]>(E.clusterGroups.users, { params: { id } });

// --- sessions -----------------------------------------------------------
export const getSessions = () => call<Session[]>(E.sessions.list);
export const deleteSession = (id: string) => call(E.sessions.delete, { params: { id } });
export const deleteOtherSessions = () => call(E.sessions.deleteOthers);

// --- error reporting (never throws) -------------------------------------
export function reportError(error: unknown, section = 'web') {
  const e = error instanceof Error ? error : new Error(String(error));
  call(E.errors.report, { body: { message: e.message, stack: e.stack, section, url: location.href } }).catch(() => {});
}
export const getErrorLogs = (query: Record<string, unknown>) => call<ErrorLogPage>(E.errors.list, { query });
export const clearErrorLogs = () => call(E.errors.clear);
