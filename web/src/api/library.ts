// Albums, people, search, map, memories, sharing, tags, folders, duplicates.
import { call } from './client';
import { E } from './endpoints';
import type {
  Activity,
  Album,
  Asset,
  Face,
  MapMarker,
  Memory,
  PeopleResponse,
  Partner,
  Person,
  SearchFilters,
  SearchResult,
  SharedLink,
  Tag,
} from './types';

// --- albums ---------------------------------------------------------------
export const getAlbums = (query: { shared?: boolean; assetId?: string } = {}) => call<Album[]>(E.albums.list, { query });
export const getAlbum = (id: string, key?: string) => call<Album>(E.albums.get, { params: { id }, query: { key } });
export const createAlbum = (body: { albumName: string; description?: string; assetIds?: string[]; albumUsers?: unknown[] }) =>
  call<Album>(E.albums.create, { body });
export const updateAlbum = (id: string, body: Partial<Album> & { albumThumbnailAssetId?: string }) =>
  call<Album>(E.albums.update, { params: { id }, body });
export const deleteAlbum = (id: string) => call(E.albums.delete, { params: { id } });
export const addAssetsToAlbum = (id: string, ids: string[]) => call(E.albums.addAssets, { params: { id }, body: { ids } });
export const removeAssetsFromAlbum = (id: string, ids: string[]) =>
  call(E.albums.removeAssets, { params: { id }, body: { ids } });
export const addAlbumUsers = (id: string, albumUsers: Array<{ userId: string; role: string }>) =>
  call(E.albums.addUsers, { params: { id }, body: { albumUsers } });
export const updateAlbumUser = (id: string, userId: string, role: string) =>
  call(E.albums.updateUser, { params: { id, userId }, body: { role } });
export const removeAlbumUser = (id: string, userId: string) => call(E.albums.removeUser, { params: { id, userId } });

// --- activity (comments + likes on a shared album) ----------------------------
export const getActivities = (albumId: string, assetId?: string) =>
  call<Activity[]>(E.activities.list, { query: { albumId, assetId } });
export const addActivity = (body: { albumId: string; assetId?: string; type: 'comment' | 'like'; comment?: string }) =>
  call<Activity>(E.activities.create, { body });
export const deleteActivity = (id: string) => call(E.activities.delete, { params: { id } });

// --- people & faces -------------------------------------------------------
export const getPeople = (query: { withHidden?: boolean; page?: number; size?: number } = {}) =>
  call<PeopleResponse>(E.people.list, { query });
export const createPerson = (body: { name: string; birthDate?: string | null }) => call<Person>(E.people.create, { body });
export const getPerson = (id: string) => call<Person>(E.people.get, { params: { id } });
export const updatePerson = (id: string, body: Partial<Person> & { featureFaceAssetId?: string }) =>
  call<Person>(E.people.update, { params: { id }, body });
export const updatePeople = (people: Array<{ id: string; isHidden?: boolean; name?: string }>) =>
  call(E.people.bulkUpdate, { body: { people } });
export const deletePerson = (id: string) => call(E.people.delete, { params: { id } });
export const mergePeople = (id: string, ids: string[]) => call(E.people.merge, { params: { id }, body: { ids } });
export const getPersonStatistics = (id: string) => call<{ assets: number }>(E.people.statistics, { params: { id } });
export const getFaces = (assetId: string) => call<Face[]>(E.people.facesOf, { query: { id: assetId } });
export const createFace = (body: { assetId: string; personId: string; imageWidth: number; imageHeight: number; x: number; y: number; width: number; height: number }) =>
  call(E.people.createFace, { body });
export const reassignFace = (faceId: string, personId: string) =>
  call(E.people.reassignFace, { params: { id: faceId }, body: { id: personId } });
export const deleteFace = (faceId: string) => call(E.people.deleteFace, { params: { id: faceId }, body: { force: true } });
/** Which users may see a person (used by the cluster-group sharing feature). */
export const getPersonAccess = (id: string) => call<Array<{ id: string; name: string }>>(E.people.access, { params: { id } });
export const setPersonAccess = (id: string, userIds: string[]) => call(E.people.setAccess, { params: { id }, body: { userIds } });

// --- search & explore -----------------------------------------------------
export const searchAssets = (filters: SearchFilters, smart = false) =>
  call<SearchResult>(smart ? E.search.smart : E.search.metadata, { body: filters });
export const getExplore = () =>
  call<Array<{ fieldName: string; items: Array<{ value: string; data: Asset }> }>>(E.search.explore);
export const getCities = () => call<Asset[]>(E.search.cities);
export const getSuggestions = (type: string, query: Record<string, unknown> = {}) =>
  call<string[]>(E.search.suggestions, { query: { type, ...query } });
export const searchPlaces = (name: string) => call<Array<{ name: string; latitude: number; longitude: number }>>(E.search.places, { query: { name } });
export const searchPeople = (name: string) => call<Person[]>(E.search.people, { query: { name } });
export const getLargeAssets = (minSize = 0) => call<Asset[]>(E.search.largeAssets, { body: { minFileSize: minSize, size: 200 } });

// --- map --------------------------------------------------------------------
export const getMapMarkers = (query: Record<string, unknown> = {}) => call<MapMarker[]>(E.map.markers, { query });
export const reverseGeocode = (lat: number, lon: number) =>
  call<Array<{ city: string | null; state: string | null; country: string | null }>>(E.map.reverseGeocode, { query: { lat, lon } });

// --- memories ---------------------------------------------------------------
export const getMemories = () => call<Memory[]>(E.memories.list);
export const getMemory = (id: string) => call<Memory>(E.memories.get, { params: { id } });
export const updateMemory = (id: string, body: Partial<Memory>) => call<Memory>(E.memories.update, { params: { id }, body });
export const deleteMemory = (id: string) => call(E.memories.delete, { params: { id } });

// --- partners ---------------------------------------------------------------
export const getPartners = (direction: 'shared-by' | 'shared-with') =>
  call<Partner[]>(E.partners.list, { query: { direction } });
export const addPartner = (id: string) => call(E.partners.create, { params: { id } });
export const updatePartner = (id: string, inTimeline: boolean) => call(E.partners.update, { params: { id }, body: { inTimeline } });
export const removePartner = (id: string) => call(E.partners.delete, { params: { id } });

// --- shared links -------------------------------------------------------------
export interface SharedLinkInput {
  type?: 'ALBUM' | 'INDIVIDUAL';
  albumId?: string;
  assetIds?: string[];
  description?: string | null;
  password?: string | null;
  slug?: string | null;
  expiresAt?: string | null;
  allowUpload?: boolean;
  allowDownload?: boolean;
  showMetadata?: boolean;
}
export const getSharedLinks = () => call<SharedLink[]>(E.sharedLinks.list);
export const getSharedLink = (id: string) => call<SharedLink>(E.sharedLinks.get, { params: { id } });
export const createSharedLink = (body: SharedLinkInput) => call<SharedLink>(E.sharedLinks.create, { body });
export const updateSharedLink = (id: string, body: SharedLinkInput) => call<SharedLink>(E.sharedLinks.update, { params: { id }, body });
export const deleteSharedLink = (id: string) => call(E.sharedLinks.delete, { params: { id } });
/** Public page: load the link behind a key or slug (no login). */
export const getMySharedLink = (query: { key?: string; slug?: string; password?: string; token?: string }) =>
  call<SharedLink>(E.sharedLinks.me, { query });
export const loginToSharedLink = (body: { password: string; key?: string; slug?: string }) =>
  call<{ token?: string }>(E.sharedLinks.login, { body });
export const removeFromSharedLink = (id: string, assetIds: string[]) =>
  call(E.sharedLinks.removeAssets, { params: { id }, body: { assetIds } });
export const shareLinkUrl = (link: Pick<SharedLink, 'key' | 'slug'>) =>
  `${location.origin}/${link.slug ? `s/${link.slug}` : `share/${link.key}`}`;

// --- tags & folders ---------------------------------------------------------------
export const getTags = () => call<Tag[]>(E.tags.list);
export const createTag = (body: { name: string; color?: string; parentId?: string }) => call<Tag>(E.tags.create, { body });
export const updateTag = (id: string, body: { color?: string | null }) => call<Tag>(E.tags.update, { params: { id }, body });
export const deleteTag = (id: string) => call(E.tags.delete, { params: { id } });
export const tagAssets = (id: string, ids: string[]) => call(E.tags.tagAssets, { params: { id }, body: { ids } });
export const untagAssets = (id: string, ids: string[]) => call(E.tags.untagAssets, { params: { id }, body: { ids } });
export const bulkTag = (assetIds: string[], tagIds: string[]) => call(E.tags.bulkTag, { body: { assetIds, tagIds } });
export const getFolderPaths = () => call<string[]>(E.folders.paths);
export const getFolderAssets = (path: string) => call<Asset[]>(E.folders.assets, { query: { path } });

// --- duplicates ------------------------------------------------------------------
export interface DuplicateGroup {
  duplicateId: string;
  assets: Asset[];
}
export const getDuplicates = () => call<DuplicateGroup[]>(E.duplicates.list);
export const resolveDuplicates = (groups: Array<{ duplicateId: string; keepAssetIds: string[]; trashAssetIds: string[] }>) =>
  call(E.duplicates.resolve, { body: { groups } });
export const dismissDuplicate = (id: string) => call(E.duplicates.dismiss, { params: { id } });
