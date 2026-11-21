import { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

/**
 * The viewer is part of the address: /favorites/photos/<assetId>. So the browser's back button closes it
 * and a viewer link can be shared. `base` is the page's own path, e.g. "/favorites" or "/albums/42".
 */
export function useAssetRoute(base: string) {
  const { assetId } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  // The main page is /photos/<id>; every other page is <page>/photos/<id>.
  const pathFor = useCallback((id: string) => (base === '/photos' ? `/photos/${id}` : `${base}/photos/${id}`) + search, [base, search]);

  return {
    assetId,
    open: useCallback((id: string) => navigate(pathFor(id)), [navigate, pathFor]),
    /** Next/previous replace the entry, so Back leaves the viewer instead of stepping through photos. */
    show: useCallback((id: string) => navigate(pathFor(id), { replace: true }), [navigate, pathFor]),
    close: useCallback(() => navigate(base + search), [navigate, base, search]),
  };
}
