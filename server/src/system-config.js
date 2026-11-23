import { db } from './db.js';


export const DEFAULT_ADMIN_CONFIG = {
  ffmpeg: {
    accel: 'disabled',
    accelDecode: false,
    acceptedAudioCodecs: ['aac', 'mp3', 'opus'],
    acceptedContainers: ['mov', 'ogg', 'webm'],
    acceptedVideoCodecs: ['h264'],
    bframes: -1,
    cqMode: 'auto',
    crf: 23,
    gopSize: 0,
    maxBitrate: '0',
    preferredHwDevice: 'auto',
    preset: 'ultrafast',
    realtime: { enabled: false, resolutions: [480, 720, 1080], videoCodecs: ['h264'] },
    refs: 0,
    targetAudioCodec: 'aac',
    targetResolution: '720',
    targetVideoCodec: 'h264',
    temporalAQ: false,
    threads: 0,
    tonemap: 'hable',
    transcode: 'required',
    twoPass: false,
  },
  image: {
    preview: { format: 'webp', progressive: false, quality: 80, size: 1440 },
    previewOnDemand: { enabled: false, retentionDays: 30 },
    thumbnail: { format: 'webp', progressive: false, quality: 80, size: 250 },
  },
  logging: { enabled: true, level: 'log' },
  machineLearning: {
    availabilityChecks: { enabled: true, interval: 30_000, timeout: 2000 },
    clip: { enabled: false, modelName: 'ViT-B-32__openai' },
    duplicateDetection: { enabled: false, maxDistance: 0.01 },
    enabled: false,
    facialRecognition: {
      enabled: false,
      maxDistance: 0.5,
      minFaces: 3,
      minScore: 0.7,
      modelName: 'buffalo_l',
    },
    ocr: {
      enabled: false,
      maxResolution: 736,
      minDetectionScore: 0.5,
      minRecognitionScore: 0.8,
      modelName: 'PP-OCRv5_mobile',
    },
    urls: [],
  },
  map: {
    enabled: false,
    darkStyle: 'https://tiles.immich.cloud/v1/style/dark.json',
    lightStyle: 'https://tiles.immich.cloud/v1/style/light.json',
  },
  metadata: { faces: { import: false } },
  newVersionCheck: { channel: 'stable', enabled: false },
  oauth: {
    allowInsecureRequests: false,
    autoLaunch: false,
    autoRegister: true,
    buttonText: 'Login with OAuth',
    clientId: '',
    clientSecret: '',
    defaultStorageQuota: null,
    enabled: false,
    endSessionEndpoint: '',
    issuerUrl: '',
    mobileOverrideEnabled: false,
    mobileRedirectUri: '',
    profileSigningAlgorithm: 'none',
    prompt: '',
    roleClaim: 'immich_role',
    scope: 'openid email profile',
    signingAlgorithm: 'RS256',
    storageQuotaClaim: 'immich_quota',
    timeout: 30_000,
    tokenEndpointAuthMethod: 'client_secret_post',
  },
  passkey: { additionalDomains: [], domain: null, enabled: false },
  passwordLogin: { enabled: true },
  trash: { enabled: true, days: 30 },
  upload: { chunkSizeMiB: 10, resumeWindowMinutes: 60 },
  user: { deleteDelay: 7 },
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep-merge `override` onto `base`, keeping only keys that exist in `base`. */
function merge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
  const out = {};
  for (const key of Object.keys(base)) out[key] = merge(base[key], override[key]);
  return out;
}

/** The format new previews are saved in: 'webp' (default) or 'jpeg' (System settings > Image settings > Preview format). */
export const previewFormat = () => (getAdminConfig().image.preview.format === 'jpeg' ? 'jpeg' : 'webp');

export function getAdminConfig() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'admin-config'").get();
  return merge(structuredClone(DEFAULT_ADMIN_CONFIG), row ? JSON.parse(row.value) : {});
}

export function setAdminConfig(update) {
  const next = merge(structuredClone(DEFAULT_ADMIN_CONFIG), update);
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('admin-config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(next));
  return next;
}

/** Subset of the admin config visible to any logged-in user (GET /api/config). */
export function getUserConfig(c = getAdminConfig()) {
  const ml = c.machineLearning;
  return {
    ffmpeg: { realtime: { ...c.ffmpeg.realtime } },
    image: {
      preview: { size: c.image.preview.size },
      thumbnail: { size: c.image.thumbnail.size },
    },
    machineLearning: {
      clip: { enabled: ml.clip.enabled },
      duplicateDetection: { enabled: ml.duplicateDetection.enabled },
      enabled: ml.enabled,
      facialRecognition: { enabled: ml.facialRecognition.enabled, minFaces: ml.facialRecognition.minFaces },
      ocr: { enabled: ml.ocr.enabled },
    },
    map: { ...c.map },
    oauth: {
      autoLaunch: c.oauth.autoLaunch,
      buttonText: c.oauth.buttonText,
      enabled: c.oauth.enabled,
    },
    passkey: { enabled: c.passkey.enabled },
    passwordLogin: { ...c.passwordLogin },
    trash: { ...c.trash },
    user: { ...c.user },
  };
}

/** Unauthenticated config (GET /api/public/config). */
export function getPublicConfig(c = getAdminConfig()) {
  return {
    ffmpeg: { realtime: { enabled: c.ffmpeg.realtime.enabled } },
    map: { ...c.map },
    oauth: { autoLaunch: c.oauth.autoLaunch, buttonText: c.oauth.buttonText, enabled: c.oauth.enabled },
    passkey: { enabled: c.passkey.enabled },
    passwordLogin: { ...c.passwordLogin },
  };
}
