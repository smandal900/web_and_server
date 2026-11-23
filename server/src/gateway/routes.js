// Which worker group answers which URL. Pure function, no imports: the gateway must stay tiny.
//
//   web       everything that is not /api (the React app)
//   realtime  /api/socket.io
//   upload    POST /api/assets, POST /api/assets/bulk-upload-check, /api/assets/chunked/**
//   media     every other /api/assets/** (thumbnails, originals, video, statistics) and /api/download/** (zip)
//   timeline  /api/timeline/**
//   admin     /api/admin/**
//   core      all remaining /api (auth, users, sessions, config, server, stubs, error-logs)
export function groupFor(method, url) {
  const q = url.indexOf('?');
  const path = q === -1 ? url : url.slice(0, q);

  if (path !== '/api' && !path.startsWith('/api/')) return 'web';
  const p = path.slice(4); // strip "/api"

  if (p.startsWith('/socket.io')) return 'realtime';
  if (p === '/assets' || p === '/assets/' || p.startsWith('/assets/')) {
    if (p.startsWith('/assets/chunked')) return 'upload';
    if (p === '/assets/bulk-upload-check') return 'upload';
    if ((p === '/assets' || p === '/assets/') && method === 'POST') return 'upload';
    return 'media';
  }
  if (p === '/download' || p.startsWith('/download/')) return 'media'; // zip downloads stream files: same worker as thumbnails and originals
  if (p === '/timeline' || p.startsWith('/timeline/')) return 'timeline';
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  return 'core';
}
