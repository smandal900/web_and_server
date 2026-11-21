// The permissions an API key can be limited to (grouped for the picker). "all" gives full access.
export const PERMISSION_GROUPS: Array<{ group: string; items: string[] }> = [
  { group: 'Assets', items: ['asset.read', 'asset.update', 'asset.delete', 'asset.upload', 'asset.download', 'asset.view', 'asset.statistics'] },
  { group: 'Albums', items: ['album.create', 'album.read', 'album.update', 'album.delete', 'album.statistics', 'albumAsset.create', 'albumAsset.delete', 'albumUser.create', 'albumUser.update', 'albumUser.delete'] },
  { group: 'People & faces', items: ['person.create', 'person.read', 'person.update', 'person.delete', 'person.merge', 'face.create', 'face.read', 'face.update', 'face.delete'] },
  { group: 'Tags', items: ['tag.create', 'tag.read', 'tag.update', 'tag.delete', 'tag.asset'] },
  { group: 'Sharing', items: ['sharedLink.create', 'sharedLink.read', 'sharedLink.update', 'sharedLink.delete', 'partner.create', 'partner.read', 'partner.update', 'partner.delete'] },
  { group: 'Memories', items: ['memory.create', 'memory.read', 'memory.update', 'memory.delete'] },
  { group: 'Library & server', items: ['library.read', 'library.create', 'library.update', 'library.delete', 'timeline.read', 'serverInfo.read', 'user.read', 'duplicate.read', 'duplicate.delete'] },
];
export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items);
