// Admin area, libraries, API keys, passkeys, notifications and workflows.
import { call } from './client';
import { E } from './endpoints';
import type {
  AdminConfig,
  ApiKey,
  CalendarHeatmap,
  Library,
  Notification,
  Passkey,
  Preferences,
  Session,
  User,
  Workflow,
} from './types';

// --- system config ---------------------------------------------------------
export const getAdminConfig = () => call<AdminConfig>(E.admin.config);
export const getAdminDefaults = () => call<AdminConfig>(E.admin.defaults);
export const saveAdminConfig = (body: AdminConfig) => call<AdminConfig>(E.admin.saveConfig, { body });
export const sendTestEmail = (body: AdminConfig) => call(E.admin.testEmail, { body });
export const previewEmailTemplate = (name: string, template: string) =>
  call<{ html: string; name: string }>(E.admin.previewTemplate, { params: { name }, body: { template } });
export const previewStorageTemplate = (template: string) =>
  call<{ path: string }>(E.admin.storageTemplatePreview, { body: { template } });

// --- users ------------------------------------------------------------------
export interface UserInput {
  email?: string;
  name?: string;
  password?: string;
  isAdmin?: boolean;
  shouldChangePassword?: boolean;
  quotaSizeInBytes?: number | null;
  storageLabel?: string | null;
}
export const getAdminUsers = (withDeleted = true) => call<User[]>(E.admin.users, { query: { withDeleted } });
export const getAdminUser = (id: string) => call<User>(E.admin.user, { params: { id } });
export const createAdminUser = (body: UserInput) => call<User>(E.admin.createUser, { body });
export const updateAdminUser = (id: string, body: UserInput) => call<User>(E.admin.updateUser, { params: { id }, body });
export const deleteAdminUser = (id: string, force = false) => call<User>(E.admin.deleteUser, { params: { id }, body: { force } });
export const restoreAdminUser = (id: string) => call<User>(E.admin.restoreUser, { params: { id } });
export const getAdminUserPreferences = (id: string) => call<Preferences>(E.admin.userPreferences, { params: { id } });
export const getAdminUserStatistics = (id: string) =>
  call<{ images: number; videos: number; total: number; usageByUser?: unknown[] }>(E.admin.userStatistics, { params: { id } });
export const getAdminUserSessions = (id: string) => call<Session[]>(E.admin.userSessions, { params: { id } });
export const getAdminUserHeatmap = (id: string, from: string, to: string) =>
  call<CalendarHeatmap>(E.admin.userHeatmap, { params: { id }, query: { from, to } });

// --- maintenance ------------------------------------------------------------
export const getIntegritySummary = () => call<Record<string, number>>(E.admin.integritySummary);
export const getIntegrityReport = (type: string, query: Record<string, unknown> = {}) =>
  call<{ items: Array<{ id: string; path: string; createdAt: string }>; nextCursor?: string }>(E.admin.integrityReport, { params: { type }, query });
export const deleteIntegrityItems = (type: string, ids: string[]) =>
  call(E.admin.integrityDelete, { params: { type }, body: { ids } });
export const getBackups = () => call<{ backups: Array<{ filename: string; filesize: number; timezone?: string }> }>(E.admin.backups);
export const createBackup = () => call(E.admin.createBackup);
export const deleteBackup = (name: string) => call(E.admin.deleteBackup, { params: { name } });
export const restoreBackup = (name: string) => call(E.admin.restoreBackup, { params: { name } });
export const restartServer = () => call(E.server.restart, { body: { action: 'restart' } });

// --- libraries --------------------------------------------------------------
export const getLibraries = () => call<Library[]>(E.libraries.list);
export const getLibrary = (id: string) => call<Library>(E.libraries.get, { params: { id } });
export const createLibrary = (body: Partial<Library>) => call<Library>(E.libraries.create, { body });
export const updateLibrary = (id: string, body: Partial<Library>) => call<Library>(E.libraries.update, { params: { id }, body });
export const deleteLibrary = (id: string) => call(E.libraries.delete, { params: { id } });
export const scanLibrary = (id: string) => call(E.libraries.scan, { params: { id } });
export const getLibraryStatistics = (id: string) =>
  call<{ photos: number; videos: number; total: number; usage: number }>(E.libraries.statistics, { params: { id } });

// --- API keys, passkeys -------------------------------------------------------------
export const getApiKeys = () => call<ApiKey[]>(E.apiKeys.list);
export const createApiKey = (body: { name: string; permissions: string[] }) =>
  call<{ apiKey: ApiKey; secret: string }>(E.apiKeys.create, { body });
export const updateApiKey = (id: string, body: { name?: string; permissions?: string[] }) =>
  call<ApiKey>(E.apiKeys.update, { params: { id }, body });
export const deleteApiKey = (id: string) => call(E.apiKeys.delete, { params: { id } });
export const getPasskeys = () => call<Passkey[]>(E.passkeys.list);
export const startPasskeyRegistration = () => call<Record<string, any>>(E.passkeys.start);
export const finishPasskeyRegistration = (body: Record<string, unknown>) => call<Passkey>(E.passkeys.finish, { body });
export const renamePasskey = (id: string, name: string) => call(E.passkeys.update, { params: { id }, body: { name } });
export const deletePasskey = (id: string) => call(E.passkeys.delete, { params: { id } });

// --- notifications ----------------------------------------------------------------
export const getNotifications = () => call<Notification[]>(E.notifications.list);
export const markNotificationRead = (id: string) => call(E.notifications.update, { params: { id }, body: { readAt: new Date().toISOString() } });
export const markAllNotificationsRead = () => call(E.notifications.markAllRead, { body: { ids: [], readAt: new Date().toISOString() } });
export const deleteNotification = (id: string) => call(E.notifications.delete, { params: { id } });

// --- workflows ---------------------------------------------------------------------
export interface WorkflowMethod {
  name: string;
  title: string;
  description?: string;
  schema?: Array<{ key: string; label: string; type: 'text' | 'number' | 'boolean' | 'album' | 'tag' | 'select'; options?: string[] }>;
}
export const getWorkflows = () => call<Workflow[]>(E.workflows.list);
export const getWorkflow = (id: string) => call<Workflow>(E.workflows.get, { params: { id } });
export const getWorkflowTriggers = () => call<Array<{ name: string; title: string }>>(E.workflows.triggers);
export const getPluginMethods = () => call<WorkflowMethod[]>(E.workflows.methods);
export const getWorkflowTemplates = () => call<Array<{ name: string; description?: string; workflow: Partial<Workflow> }>>(E.workflows.templates);
export const createWorkflow = (body: Partial<Workflow>) => call<Workflow>(E.workflows.create, { body });
export const updateWorkflow = (id: string, body: Partial<Workflow>) => call<Workflow>(E.workflows.update, { params: { id }, body });
export const deleteWorkflow = (id: string) => call(E.workflows.delete, { params: { id } });
export const getWorkflowLogs = (id: string) =>
  call<Array<{ id: string; createdAt: string; level: string; message: string }>>(E.workflows.logs, { params: { id } });
