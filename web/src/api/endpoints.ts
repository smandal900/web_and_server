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
    setupPin: ok('POST', '/auth/pin-code'),
    changePin: ok('PUT', '/auth/pin-code'),
    resetPin: ok('DELETE', '/auth/pin-code'),
    unlockSession: ok('POST', '/auth/session/unlock'),
    lockSession: ok('POST', '/auth/session/lock'),
  },
  oauth: {
    authorize: todo('POST', '/oauth/authorize'),
    callback: todo('POST', '/oauth/callback'),
    link: todo('POST', '/oauth/link'),
    unlink: todo('POST', '/oauth/unlink'),
  },
  users: {
    me: ok('GET', '/users/me'),
    updateMe: ok('PUT', '/users/me'),
    preferences: ok('GET', '/users/me/preferences'),
    updatePreferences: stub('PUT', '/users/me/preferences'),
    onboarding: ok('GET', '/users/me/onboarding'),
    setOnboarding: ok('PUT', '/users/me/onboarding'),
    heatmap: stub('GET', '/users/me/calendar-heatmap'),
    uploadAvatar: ok('POST', '/users/profile-image'),
    deleteAvatar: ok('DELETE', '/users/profile-image'),
    list: ok('GET', '/users'),
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
    importFiles: ok('GET', '/admin/import-files'),
    importFile: ok('POST', '/admin/import-files'),
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
    update: ok('PUT', '/assets/{id}'),
    bulkUpdate: ok('PUT', '/assets'),
    delete: ok('DELETE', '/assets'),
    edits: ok('GET', '/assets/{id}/edits'),
    saveEdits: ok('PUT', '/assets/{id}/edits'),
    removeEdits: ok('DELETE', '/assets/{id}/edits'),
    albumsOf: ok('GET', '/albums'),
    link: todo('PUT', '/assets/{id}'),
    chunkedCreate: ok('POST', '/assets/chunked'),
    chunkedGet: ok('GET', '/assets/chunked/{id}'),
    chunkedDelete: ok('DELETE', '/assets/chunked/{id}'),
    chunkedPut: ok('PUT', '/assets/chunked/{id}/chunks/{index}'),
    chunkedComplete: ok('POST', '/assets/chunked/{id}/complete'),
  },
  download: {
    info: ok('POST', '/download/info'),
    archive: ok('POST', '/download/archive'),
  },
  timeline: {
    buckets: ok('GET', '/timeline/buckets'),
    bucket: ok('GET', '/timeline/bucket'),
    selection: ok('GET', '/timeline/selection'),
  },
  trash: {
    empty: ok('POST', '/trash/empty'),
    restoreAll: ok('POST', '/trash/restore'),
    restore: ok('POST', '/trash/restore/assets'),
  },
  stacks: {
    create: ok('POST', '/stacks'),
    delete: ok('DELETE', '/stacks/{id}'),
    deleteMany: ok('DELETE', '/stacks'),
    removeAsset: ok('DELETE', '/stacks/{id}/assets/{assetId}'),
  },
  albums: {
    list: ok('GET', '/albums'),
    create: ok('POST', '/albums'),
    get: ok('GET', '/albums/{id}'),
    update: ok('PATCH', '/albums/{id}'),
    delete: ok('DELETE', '/albums/{id}'),
    addAssets: ok('PUT', '/albums/{id}/assets'),
    removeAssets: ok('DELETE', '/albums/{id}/assets'),
    addUsers: ok('PUT', '/albums/{id}/users'),
    updateUser: ok('PUT', '/albums/{id}/user/{userId}'),
    removeUser: ok('DELETE', '/albums/{id}/user/{userId}'),
    addToMany: ok('PUT', '/albums/assets'),
  },
  activities: {
    list: ok('GET', '/activities'),
    create: ok('POST', '/activities'),
    delete: ok('DELETE', '/activities/{id}'),
    statistics: ok('GET', '/activities/statistics'),
  },
  people: {
    list: ok('GET', '/people'),
    create: ok('POST', '/people'),
    get: ok('GET', '/people/{id}'),
    update: ok('PUT', '/people/{id}'),
    bulkUpdate: todo('PUT', '/people'),
    delete: ok('DELETE', '/people/{id}'),
    merge: ok('POST', '/people/{id}/merge'),
    statistics: ok('GET', '/people/{id}/statistics'),
    facesOf: stub('GET', '/faces'),
    createFace: todo('POST', '/faces'),
    reassignFace: todo('PUT', '/faces/{id}'),
    deleteFace: todo('DELETE', '/faces/{id}'),
    access: todo('GET', '/people/{id}/users'),
    setAccess: todo('PUT', '/people/{id}/users'),
  },
  search: {
    metadata: ok('POST', '/search/metadata'),
    smart: ok('POST', '/search/smart'),
    explore: ok('GET', '/search/explore'),
    cities: ok('GET', '/search/cities'),
    suggestions: ok('GET', '/search/suggestions'),
    places: todo('GET', '/search/places'),
    people: ok('GET', '/search/person'),
    largeAssets: ok('POST', '/search/large-assets'),
  },
  map: {
    markers: ok('GET', '/map/markers'),
    reverseGeocode: stub('GET', '/map/reverse-geocode'),
  },
  memories: {
    list: ok('GET', '/memories'),
    get: ok('GET', '/memories/{id}'),
    update: ok('PUT', '/memories/{id}'),
    delete: ok('DELETE', '/memories/{id}'),
    removeAssets: todo('DELETE', '/memories/{id}/assets'),
    statistics: ok('GET', '/memories/statistics'),
  },
  partners: {
    list: ok('GET', '/partners'),
    create: ok('POST', '/partners/{id}'),
    update: ok('PUT', '/partners/{id}'),
    delete: ok('DELETE', '/partners/{id}'),
  },
  sharedLinks: {
    list: ok('GET', '/shared-links'),
    create: ok('POST', '/shared-links'),
    get: ok('GET', '/shared-links/{id}'),
    update: ok('PATCH', '/shared-links/{id}'),
    delete: ok('DELETE', '/shared-links/{id}'),
    me: ok('GET', '/shared-links/me'),
    login: todo('POST', '/shared-links/login'),
    addAssets: ok('PUT', '/shared-links/{id}/assets'),
    removeAssets: ok('DELETE', '/shared-links/{id}/assets'),
  },
  tags: {
    list: ok('GET', '/tags'),
    create: ok('POST', '/tags'),
    update: ok('PUT', '/tags/{id}'),
    delete: ok('DELETE', '/tags/{id}'),
    tagAssets: ok('PUT', '/tags/{id}/assets'),
    untagAssets: ok('DELETE', '/tags/{id}/assets'),
    bulkTag: ok('PUT', '/tags/assets'),
  },
  folders: {
    paths: ok('GET', '/view/folder/unique-paths'),
    assets: ok('GET', '/view/folder'),
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
