import { Navigate, useSearchParams } from 'react-router';

/**
 * /link?target=view_album&id=123 is the address the mobile apps and emails use for "open this".
 * It forwards to the matching page of this app.
 */
export default function LinkRedirect() {
  const [params] = useSearchParams();
  const id = params.get('id') ?? '';
  const routes: Record<string, string> = {
    view_asset: `/photos/${id}`,
    view_album: `/albums/${id}`,
    view_person: `/people/${id}`,
    view_memory: `/memories/${id}`,
    view_shared_link: `/shared-links/${id}/edit`,
  };
  return <Navigate to={(id && routes[params.get('target') ?? '']) || '/photos'} replace />;
}
