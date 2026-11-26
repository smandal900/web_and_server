// Shapes of the data the server sends. They follow the Immich API, so they keep working when
// the server grows. Only the fields this app reads are listed.

export type Visibility = 'archive' | 'timeline' | 'hidden' | 'locked';
export type AssetType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  profileImagePath: string;
  profileChangedAt: string;
  isAdmin: boolean;
  shouldChangePassword: boolean;
  quotaSizeInBytes: number | null;
  quotaUsageInBytes: number | null;
  clusterGroupId?: string;
  oauthId?: string;
  createdAt: string;
  deletedAt: string | null;
  status?: string;
  license?: unknown;
}
export type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'avatarColor' | 'profileImagePath' | 'profileChangedAt'>;

export interface LoginResponse {
  accessToken: string;
  userId: string;
  userEmail: string;
  name: string;
  isAdmin: boolean;
  isOnboarded: boolean;
  shouldChangePassword: boolean;
}

export interface ServerConfig {
  isInitialized: boolean;
  isOnboarded: boolean;
  maintenanceMode: boolean;
  mapDarkStyleUrl: string;
  mapLightStyleUrl: string;
  oauthButtonText: string;
  trashDays: number;
  chunkSize: number; // bytes
  userDeleteDelay: number;
  minFaces: number;
}
export interface ServerFeatures {
  map: boolean;
  trash: boolean;
  search: boolean;
  smartSearch: boolean;
  facialRecognition: boolean;
  duplicateDetection: boolean;
  ocr: boolean;
  oauth: boolean;
  oauthAutoLaunch: boolean;
  passwordLogin: boolean;
  reverseGeocoding: boolean;
  importFaces: boolean;
  sidecar: boolean;
  configFile: boolean;
  realtimeTranscoding: boolean;
}
export interface ServerStorage {
  diskAvailable: string;
  diskSize: string;
  diskUse: string;
  diskUsagePercentage: number;
  diskAvailableRaw: number;
  diskSizeRaw: number;
  diskUseRaw: number;
}
export interface UsageByUser {
  userId: string;
  userName: string;
  photos: number;
  videos: number;
  usage: number;
  usagePhotos: number;
  usageVideos: number;
  quotaSizeInBytes: number | null;
}
export interface ServerStatistics {
  photos: number;
  videos: number;
  usage: number;
  usagePhotos: number;
  usageVideos: number;
  usageByUser: UsageByUser[];
}
export interface ServerVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface Exif {
  make?: string | null;
  model?: string | null;
  lensModel?: string | null;
  fNumber?: number | null;
  focalLength?: number | null;
  iso?: number | null;
  exposureTime?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  description?: string | null;
  rating?: number | null;
  timeZone?: string | null;
  dateTimeOriginal?: string | null;
  fileSizeInByte?: number | null;
  exifImageWidth?: number | null;
  exifImageHeight?: number | null;
  projectionType?: string | null;
}

export interface Asset {
  id: string;
  type: AssetType;
  originalFileName: string;
  originalMimeType?: string;
  originalPath?: string;
  ownerId: string;
  fileCreatedAt: string;
  fileModifiedAt?: string;
  localDateTime: string;
  width: number | null;
  height: number | null;
  duration: number | string | null;
  isFavorite: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  visibility: Visibility;
  thumbhash: string | null;
  livePhotoVideoId?: string | null;
  checksum?: string;
  exifInfo?: Exif;
  people?: PersonWithFaces[];
  tags?: Tag[];
  stack?: { id: string; assetCount: number; primaryAssetId: string } | null;
  isEdited?: boolean;
}

/** What the timeline shows for one picture (a row of the column-per-field bucket). */
export interface TimelineAsset {
  id: string;
  ownerId: string;
  fileCreatedAt: string;
  localOffsetHours: number;
  ratio: number;
  thumbhash: string | null;
  isImage: boolean;
  isFavorite: boolean;
  isTrashed: boolean;
  duration: number | string | null;
  livePhotoVideoId: string | null;
  projectionType: string | null;
  visibility: Visibility;
  stack?: [string, number] | null;
}

export interface TimelineBucket {
  timeBucket: string;
  count: number;
}

/** Query sent to /timeline/buckets and /timeline/bucket. */
export interface TimelineQuery {
  isFavorite?: boolean;
  isTrashed?: boolean;
  visibility?: Visibility;
  order?: 'asc' | 'desc';
  /** "createdAt" = by upload date (Recently added). Ignored by servers that do not support it. */
  sortBy?: 'createdAt';
  albumId?: string;
  personId?: string;
  tagId?: string;
  userId?: string;
  withPartners?: boolean;
  withStacked?: boolean;
  key?: string;
  slug?: string;
}

export interface PersonWithFaces extends Person {
  faces?: Face[];
}
export interface Person {
  id: string;
  name: string;
  birthDate: string | null;
  thumbnailPath?: string;
  isHidden: boolean;
  isFavorite?: boolean;
  color?: string;
  updatedAt?: string;
}
export interface Face {
  id: string;
  imageWidth: number;
  imageHeight: number;
  boundingBoxX1: number;
  boundingBoxX2: number;
  boundingBoxY1: number;
  boundingBoxY2: number;
  person?: Person | null;
}
export interface PeopleResponse {
  people: Person[];
  total: number;
  hidden: number;
  hasNextPage?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  value: string;
  color?: string | null;
  parentId?: string | null;
}

export interface AlbumUser {
  user: PublicUser;
  role: 'editor' | 'viewer';
}
export interface Album {
  id: string;
  albumName: string;
  description: string;
  albumThumbnailAssetId: string | null;
  assetCount: number;
  shared: boolean;
  owner: PublicUser;
  albumUsers: AlbumUser[];
  hasSharedLink: boolean;
  startDate?: string;
  endDate?: string;
  isActivityEnabled: boolean;
  order?: 'asc' | 'desc';
  assets?: Asset[];
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: 'comment' | 'like';
  comment?: string | null;
  assetId?: string | null;
  createdAt: string;
  user: PublicUser;
}

export interface Memory {
  id: string;
  type: string;
  data: { year: number };
  memoryAt: string;
  isSaved: boolean;
  assets: Asset[];
  seenAt?: string | null;
}

export interface Partner extends PublicUser {
  inTimeline?: boolean;
}

export interface SharedLink {
  id: string;
  key: string;
  slug?: string | null;
  type: 'ALBUM' | 'INDIVIDUAL';
  description?: string | null;
  password?: string | null;
  expiresAt?: string | null;
  allowUpload: boolean;
  allowDownload: boolean;
  showMetadata: boolean;
  createdAt: string;
  album?: Album;
  assets: Asset[];
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  current: boolean;
  deviceOS: string;
  deviceType: string;
}

export interface ApiKey {
  id: string;
  name: string;
  permissions: string[];
  createdAt: string;
}
export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
}
export interface Notification {
  id: string;
  title: string;
  description?: string;
  level: 'info' | 'success' | 'warning' | 'error';
  readAt?: string | null;
  createdAt: string;
}
export interface Library {
  id: string;
  name: string;
  importPaths: string[];
  exclusionPatterns: string[];
  assetCount?: number;
  refreshedAt?: string | null;
  ownerId: string;
}

export interface WorkflowStep {
  id?: string;
  method: string;
  config: Record<string, unknown>;
  enabled?: boolean;
}
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  enabled: boolean;
  steps: WorkflowStep[];
}

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface CalendarHeatmap {
  from: string;
  to: string;
  totalCount: number;
  series: Array<{ date: string; count: number }>;
}

export interface Preferences {
  albums: { defaultAssetOrder: 'asc' | 'desc' };
  cast: { gCastEnabled: boolean };
  download: { archiveSize: number; includeEmbeddedVideos: boolean };
  folders: { enabled: boolean; sidebarWeb: boolean };
  memories: { enabled: boolean; duration: number; sidebarWeb?: boolean };
  people: { enabled: boolean; sidebarWeb: boolean; updateStrategy?: string };
  purchase: { showSupportBadge: boolean; hideBuyButtonUntil: string };
  ratings: { enabled: boolean };
  recentlyAdded: { sidebarWeb: boolean };
  sharedLinks: { enabled: boolean; sidebarWeb: boolean };
  tags: { enabled: boolean; sidebarWeb: boolean };
}

/** The admin system config is a large nested object; sections read it by path. */
export type AdminConfig = Record<string, any>;

export interface ErrorLogItem {
  id: number;
  createdAt: string;
  level: string;
  source: string;
  section: string;
  message: string;
  stack: string | null;
  method: string | null;
  path: string | null;
  status: number | null;
}
export interface ErrorLogPage {
  items: ErrorLogItem[];
  total: number;
  page: number;
  size: number;
  sections: Array<{ section: string; count: number }>;
}

export interface SearchFilters {
  query?: string;
  queryAssetId?: string;
  originalFileName?: string;
  description?: string;
  ocr?: string;
  personIds?: string[];
  tagIds?: string[];
  country?: string;
  state?: string;
  city?: string;
  make?: string;
  model?: string;
  lensModel?: string;
  takenAfter?: string;
  takenBefore?: string;
  type?: 'IMAGE' | 'VIDEO';
  rating?: number;
  isNotInAlbum?: boolean;
  isFavorite?: boolean;
  visibility?: Visibility;
  withArchived?: boolean;
  page?: number;
  size?: number;
}
export interface SearchResult {
  albums?: { total: number; count: number; items: Album[] };
  assets: { total: number; count: number; items: Asset[]; nextPage: string | null };
}
