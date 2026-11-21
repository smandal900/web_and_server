// The single table of every server endpoint this web app uses.
//
//   ok   = the server implements it today
//   stub = the server answers, but with an empty/static result
//   todo = the server does not have it yet (the UI is built; calls show "not supported yet")
//
// When you add an endpoint to the server, change `todo(...)` to `ok(...)`.
// `npm run server-todo` prints every stub/todo into docs/server-todo.md.
// Keep this file free of imports: the script loads it with plain Node.

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Support = 'ok' | 'stub' | 'todo';
export interface Endpoint {
  method: Method;
  path: string;
  support: Support;
}

const make = (support: Support) => (method: Method, path: string): Endpoint => ({ method, path, support });
const ok = make('ok');
const stub = make('stub');
const todo = make('todo');

export const E = {
  server: {
    ping: ok('GET', '/server/ping'),
    config: ok('GET', '/server/config'),
    features: ok('GET', '/server/features'),
    version: ok('GET', '/server/version'),
    about: ok('GET', '/server/about'),
    storage: ok('GET', '/server/storage'),
    statistics: ok('GET', '/server/statistics'),
    versionHistory: ok('GET', '/server/version-history'),
    mediaTypes: ok('GET', '/server/media-types'),
    setLicense: todo('PUT', '/server/license'),
    restart: todo('POST', '/admin/maintenance'),
  },
  config: {
    public: ok('GET', '/public/config'),
    user: ok('GET', '/config'),
  },
  auth: {
    signUp: ok('POST', '/auth/admin-sign-up'),
    login: ok('POST', '/auth/login'),
    logout: ok('POST', '/auth/logout'),
    changePassword: ok('POST', '/auth/change-password'),
    status: ok('GET', '/auth/status'),
    validate: ok('POST', '/auth/validateToken'),
    setupPin: todo('POST', '/auth/pin-code'),
    changePin: todo('PUT', '/auth/pin-code'),
    resetPin: todo('DELETE', '/auth/pin-code'),
    unlockSession: todo('POST', '/auth/session/unlock'),
    lockSession: todo('POST', '/auth/session/lock'),
  },
  oauth: {
    authorize: todo('POST', '/oauth/authorize'),
    callback: todo('POST', '/oauth/callback'),
    link: todo('POST', '/oauth/link'),
    unlink: todo('POST', '/oauth/unlink'),
  },
  users: {
    me: ok('GET', '/users/me'),
    updateMe: todo('PUT', '/users/me'),
    preferences: ok('GET', '/users/me/preferences'),
    updatePreferences: stub('PUT', '/users/me/preferences'),
    onboarding: ok('GET', '/users/me/onboarding'),
    setOnboarding: ok('PUT', '/users/me/onboarding'),
    heatmap: stub('GET', '/users/me/calendar-heatmap'),
    uploadAvatar: todo('POST', '/users/profile-image'),
    deleteAvatar: todo('DELETE', '/users/profile-image'),
    list: todo('GET', '/users'),
  },
  sessions: {
    list: ok('GET', '/sessions'),
    deleteOthers: ok('DELETE', '/sessions'),
    delete: ok('DELETE', '/sessions/{id}'),
  },
  admin: {
    config: ok('GET', '/admin/config'),
    defaults: ok('GET', '/admin/config/defaults'),
    saveConfig: ok('PUT', '/admin/config'),
    users: ok('GET', '/admin/users'),
    createUser: ok('POST', '/admin/users'),
    user: ok('GET', '/admin/users/{id}'),
    updateUser: ok('PUT', '/admin/users/{id}'),
    deleteUser: ok('DELETE', '/admin/users/{id}'),
    restoreUser: ok('POST', '/admin/users/{id}/restore'),
    userPreferences: stub('GET', '/admin/users/{id}/preferences'),
    updateUserPreferences: stub('PUT', '/admin/users/{id}/preferences'),
    userStatistics: stub('GET', '/admin/users/{id}/statistics'),
    userSessions: ok('GET', '/admin/users/{id}/sessions'),
    userHeatmap: stub('GET', '/admin/users/{id}/calendar-heatmap'),
    integritySummary: stub('GET', '/admin/integrity/summary'),
    integrityReport: todo('GET', '/admin/integrity/report/{type}'),
    integrityDelete: todo('DELETE', '/admin/integrity/report/{type}'),
    backups: stub('GET', '/admin/database-backups'),
    createBackup: todo('POST', '/admin/database-backups'),
    deleteBackup: todo('DELETE', '/admin/database-backups/{name}'),
    restoreBackup: todo('POST', '/admin/database-backups/{name}/restore'),
    testEmail: todo('POST', '/admin/notifications/test-email'),
    previewTemplate: todo('POST', '/admin/notifications/templates/{name}'),
    storageTemplatePreview: todo('POST', '/admin/storage-template/preview'),
  },
  errors: {
    report: ok('POST', '/error-logs'),
    list: ok('GET', '/error-logs'),
    clear: ok('DELETE', '/error-logs'),
  },
  clusterGroups: {
    users: ok('GET', '/cluster-groups/{id}/users'),
    requests: stub('GET', '/cluster-groups/requests'),
  },
  assets: {
    upload: ok('POST', '/assets'),
    bulkCheck: ok('POST', '/assets/bulk-upload-check'),
    statistics: ok('GET', '/assets/statistics'),
    get: ok('GET', '/assets/{id}'),
    ocr: stub('GET', '/assets/{id}/ocr'),
    update: todo('PUT', '/assets/{id}'),
    bulkUpdate: todo('PUT', '/assets'),
    delete: todo('DELETE', '/assets'),
    edits: todo('GET', '/assets/{id}/edits'),
    saveEdits: todo('PUT', '/assets/{id}/edits'),
    removeEdits: todo('DELETE', '/assets/{id}/edits'),
    albumsOf: todo('GET', '/albums'),
    link: todo('PUT', '/assets/{id}'),
    chunkedCreate: ok('POST', '/assets/chunked'),
    chunkedGet: ok('GET', '/assets/chunked/{id}'),
    chunkedDelete: ok('DELETE', '/assets/chunked/{id}'),
    chunkedPut: ok('PUT', '/assets/chunked/{id}/chunks/{index}'),
    chunkedComplete: ok('POST', '/assets/chunked/{id}/complete'),
  },
  download: {
    info: todo('POST', '/download/info'),
    archive: todo('POST', '/download/archive'),
  },
  timeline: {
    buckets: ok('GET', '/timeline/buckets'),
    bucket: ok('GET', '/timeline/bucket'),
  },
  trash: {
    empty: todo('POST', '/trash/empty'),
    restoreAll: todo('POST', '/trash/restore'),
    restore: todo('POST', '/trash/restore/assets'),
  },
  stacks: {
    create: todo('POST', '/stacks'),
    delete: todo('DELETE', '/stacks/{id}'),
    deleteMany: todo('DELETE', '/stacks'),
    removeAsset: todo('DELETE', '/stacks/{id}/assets/{assetId}'),
  },
  albums: {
    list: stub('GET', '/albums'),
    create: todo('POST', '/albums'),
    get: todo('GET', '/albums/{id}'),
    update: todo('PATCH', '/albums/{id}'),
    delete: todo('DELETE', '/albums/{id}'),
    addAssets: todo('PUT', '/albums/{id}/assets'),
    removeAssets: todo('DELETE', '/albums/{id}/assets'),
    addUsers: todo('PUT', '/albums/{id}/users'),
    updateUser: todo('PUT', '/albums/{id}/user/{userId}'),
    removeUser: todo('DELETE', '/albums/{id}/user/{userId}'),
    addToMany: todo('PUT', '/albums/assets'),
  },
  activities: {
    list: todo('GET', '/activities'),
    create: todo('POST', '/activities'),
    delete: todo('DELETE', '/activities/{id}'),
    statistics: todo('GET', '/activities/statistics'),
  },
  people: {
    list: stub('GET', '/people'),
    create: todo('POST', '/people'),
    get: todo('GET', '/people/{id}'),
    update: todo('PUT', '/people/{id}'),
    bulkUpdate: todo('PUT', '/people'),
    delete: todo('DELETE', '/people/{id}'),
    merge: todo('POST', '/people/{id}/merge'),
    statistics: todo('GET', '/people/{id}/statistics'),
    facesOf: stub('GET', '/faces'),
    createFace: todo('POST', '/faces'),
    reassignFace: todo('PUT', '/faces/{id}'),
    deleteFace: todo('DELETE', '/faces/{id}'),
    access: todo('GET', '/people/{id}/users'),
    setAccess: todo('PUT', '/people/{id}/users'),
  },
  search: {
    metadata: stub('POST', '/search/metadata'),
    smart: todo('POST', '/search/smart'),
    explore: stub('GET', '/search/explore'),
    cities: stub('GET', '/search/cities'),
    suggestions: todo('GET', '/search/suggestions'),
    places: todo('GET', '/search/places'),
    people: todo('GET', '/search/person'),
    largeAssets: todo('POST', '/search/large-assets'),
  },
  map: {
    markers: todo('GET', '/map/markers'),
    reverseGeocode: todo('GET', '/map/reverse-geocode'),
  },
  memories: {
    list: stub('GET', '/memories'),
    get: todo('GET', '/memories/{id}'),
    update: todo('PUT', '/memories/{id}'),
    delete: todo('DELETE', '/memories/{id}'),
    removeAssets: todo('DELETE', '/memories/{id}/assets'),
    statistics: stub('GET', '/memories/statistics'),
  },
  partners: {
    list: stub('GET', '/partners'),
    create: todo('POST', '/partners/{id}'),
    update: todo('PUT', '/partners/{id}'),
    delete: todo('DELETE', '/partners/{id}'),
  },
  sharedLinks: {
    list: stub('GET', '/shared-links'),
    create: todo('POST', '/shared-links'),
    get: todo('GET', '/shared-links/{id}'),
    update: todo('PATCH', '/shared-links/{id}'),
    delete: todo('DELETE', '/shared-links/{id}'),
    me: todo('GET', '/shared-links/me'),
    login: todo('POST', '/shared-links/login'),
    addAssets: todo('PUT', '/shared-links/{id}/assets'),
    removeAssets: todo('DELETE', '/shared-links/{id}/assets'),
  },
  tags: {
    list: todo('GET', '/tags'),
    create: todo('POST', '/tags'),
    update: todo('PUT', '/tags/{id}'),
    delete: todo('DELETE', '/tags/{id}'),
    tagAssets: todo('PUT', '/tags/{id}/assets'),
    untagAssets: todo('DELETE', '/tags/{id}/assets'),
    bulkTag: todo('PUT', '/tags/assets'),
  },
  folders: {
    paths: todo('GET', '/view/folder/unique-paths'),
    assets: todo('GET', '/view/folder'),
  },
  duplicates: {
    list: todo('GET', '/duplicates'),
    resolve: todo('POST', '/duplicates/resolve'),
    dismiss: todo('DELETE', '/duplicates/{id}'),
  },
  libraries: {
    list: stub('GET', '/libraries'),
    create: todo('POST', '/libraries'),
    get: todo('GET', '/libraries/{id}'),
    update: todo('PUT', '/libraries/{id}'),
    delete: todo('DELETE', '/libraries/{id}'),
    scan: todo('POST', '/libraries/{id}/scan'),
    statistics: todo('GET', '/libraries/{id}/statistics'),
  },
  apiKeys: {
    list: stub('GET', '/api-keys'),
    create: todo('POST', '/api-keys'),
    update: todo('PUT', '/api-keys/{id}'),
    delete: todo('DELETE', '/api-keys/{id}'),
  },
  passkeys: {
    list: stub('GET', '/passkeys'),
    start: todo('POST', '/passkeys/registration/start'),
    finish: todo('POST', '/passkeys/registration/finish'),
    update: todo('PUT', '/passkeys/{id}'),
    delete: todo('DELETE', '/passkeys/{id}'),
  },
  notifications: {
    list: stub('GET', '/notifications'),
    update: todo('PUT', '/notifications/{id}'),
    markAllRead: todo('PUT', '/notifications'),
    delete: todo('DELETE', '/notifications/{id}'),
  },
  workflows: {
    list: stub('GET', '/workflows'),
    triggers: stub('GET', '/workflows/triggers'),
    create: todo('POST', '/workflows'),
    get: todo('GET', '/workflows/{id}'),
    update: todo('PUT', '/workflows/{id}'),
    delete: todo('DELETE', '/workflows/{id}'),
    logs: todo('GET', '/workflows/{id}/logs'),
    methods: stub('GET', '/plugins/methods'),
    templates: stub('GET', '/plugins/templates'),
  },
} as const;

/** Every endpoint, flattened, for the server-todo script. */
export const allEndpoints = (): Array<Endpoint & { name: string }> =>
  Object.entries(E).flatMap(([group, items]) =>
    Object.entries(items).map(([name, e]) => ({ name: `${group}.${name}`, ...(e as Endpoint) })),
  );
