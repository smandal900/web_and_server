// The whole route table. Every page is a lazy import, so a visitor only downloads the pages they open.
//
// Groups (outermost first):
//   public      login, sign-up, shared links, maintenance: no login needed
//   RequireAuth logged-in pages inside the AppShell (navbar + sidebar)
//   RequireAdmin the /admin pages, inside the same shell with the admin sidebar
import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { Landing, RequireAdmin, RequireAuth } from './components/layout/Guards';
import { Boundary } from './components/ui/Boundary';
import { RouteError } from './pages/NotFound';

/** `page(() => import('./pages/X'))` gives a route element that shows a spinner while the file loads. */
const page = (load: () => Promise<{ default: ComponentType }>) => {
  const Page = lazy(load);
  return (
    <Boundary>
      <Page />
    </Boundary>
  );
};

// The navbar + sidebar shell (and everything it needs) only downloads once someone is logged in.
const LazyShell = lazy(() => import('./components/layout/AppShell').then((m) => ({ default: m.AppShell })));
const Shell = ({ admin }: { admin?: boolean }) => (
  <Boundary>
    <LazyShell admin={admin} />
  </Boundary>
);

/** A picture page can show the viewer: /favorites and /favorites/photos/<id> are the same page. */
const V = ':photos?/:assetId?';

const userRoutes: RouteObject[] = [
  { path: 'photos/:assetId?', element: page(() => import('./pages/photos/Photos')) },
  { path: `favorites/${V}`, element: page(() => import('./pages/photos/Favorites')) },
  { path: `archive/${V}`, element: page(() => import('./pages/photos/Archive')) },
  { path: `trash/${V}`, element: page(() => import('./pages/photos/Trash')) },
  { path: `recently-added/${V}`, element: page(() => import('./pages/photos/RecentlyAdded')) },
  { path: `locked/${V}`, element: page(() => import('./pages/photos/Locked')) },

  { path: 'albums', element: page(() => import('./pages/albums/Albums')) },
  { path: `albums/:albumId/${V}`, element: page(() => import('./pages/albums/AlbumPage')) },

  { path: 'people', element: page(() => import('./pages/people/People')) },
  { path: 'people/manage', element: page(() => import('./pages/people/PeopleManage')) },
  { path: `people/:personId/${V}`, element: page(() => import('./pages/people/PersonPage')) },

  { path: 'explore', element: page(() => import('./pages/explore/Explore')) },
  { path: 'places', element: page(() => import('./pages/explore/Places')) },
  { path: `search/${V}`, element: page(() => import('./pages/search/Search')) },
  { path: `map/${V}`, element: page(() => import('./pages/map/MapPage')) },

  { path: 'memories', element: page(() => import('./pages/memories/Memories')) },
  { path: `memories/:id/${V}`, element: page(() => import('./pages/memories/MemoryViewer')) },
  { path: `memory/${V}`, element: page(() => import('./pages/memories/MemoryViewer')) },

  { path: 'sharing', element: page(() => import('./pages/sharing/Sharing')) },
  { path: 'sharing/sharedlinks', element: page(() => import('./pages/sharing/SharedLinks')) },
  { path: 'shared-links', element: page(() => import('./pages/sharing/SharedLinks')) },
  { path: 'shared-links/:id/edit', element: page(() => import('./pages/sharing/SharedLinkEdit')) },
  { path: `partners/:userId/${V}`, element: page(() => import('./pages/sharing/Partner')) },

  { path: `folders/${V}`, element: page(() => import('./pages/tags/Folders')) },
  { path: `tags/${V}`, element: page(() => import('./pages/tags/Tags')) },

  { path: 'utilities', element: page(() => import('./pages/utilities/Utilities')) },
  { path: 'utilities/duplicates', element: page(() => import('./pages/utilities/Duplicates')) },
  { path: 'utilities/large-files', element: page(() => import('./pages/utilities/LargeFiles')) },
  { path: 'utilities/geolocation', element: page(() => import('./pages/utilities/Geolocation')) },
  { path: 'utilities/geolocation/photos/:photoId', element: page(() => import('./pages/utilities/GeolocationPhoto')) },

  { path: 'workflows', element: page(() => import('./pages/workflows/Workflows')) },
  { path: 'workflows/:workflowId', element: page(() => import('./pages/workflows/WorkflowEditor')) },

  { path: 'user-settings', element: page(() => import('./pages/settings/UserSettings')) },
  { path: 'buy', element: page(() => import('./pages/settings/Buy')) },
];

const adminRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="users" replace /> },
  { path: 'user-management', element: <Navigate to="/admin/users" replace /> },
  { path: 'users', element: page(() => import('./pages/admin/Users')) },
  { path: 'users/new', element: page(() => import('./pages/admin/UserForm')) },
  { path: 'users/:id', element: page(() => import('./pages/admin/UserDetail')) },
  { path: 'users/:id/edit', element: page(() => import('./pages/admin/UserForm')) },
  { path: 'system-settings', element: page(() => import('./pages/admin/SystemSettings')) },
  { path: 'server-status', element: page(() => import('./pages/admin/ServerStatus')) },
  { path: 'error-log', element: page(() => import('./pages/admin/ErrorLog')) },
  { path: 'maintenance', element: page(() => import('./pages/admin/Maintenance')) },
  { path: 'maintenance/integrity-report/:type', element: page(() => import('./pages/admin/IntegrityReport')) },
  { path: 'library-management', element: page(() => import('./pages/admin/Libraries')) },
  { path: 'library-management/new', element: page(() => import('./pages/admin/LibraryForm')) },
  { path: 'library-management/:id', element: page(() => import('./pages/admin/LibraryForm')) },
  { path: 'library-management/:id/edit', element: page(() => import('./pages/admin/LibraryForm')) },
];

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Landing /> },

      // --- public ---
      {
        path: 'auth',
        children: [
          { path: 'login', element: page(() => import('./pages/auth/Login')) },
          { path: 'register', element: page(() => import('./pages/auth/Register')) },
          { path: 'logout', element: page(() => import('./pages/auth/Logout')) },
          {
            element: <RequireAuth />,
            children: [
              { path: 'change-password', element: page(() => import('./pages/auth/ChangePassword')) },
              { path: 'onboarding', element: page(() => import('./pages/auth/Onboarding')) },
              { path: 'pin-prompt', element: page(() => import('./pages/auth/PinPrompt')) },
            ],
          },
        ],
      },
      { path: `s/:slug/${V}`, element: page(() => import('./pages/share/SharedLinkPage')) },
      { path: `share/:key/${V}`, element: page(() => import('./pages/share/SharedLinkPage')) },
      { path: 'link', element: page(() => import('./pages/share/LinkRedirect')) },
      { path: 'maintenance', element: page(() => import('./pages/admin/MaintenanceRestore')) },

      // --- logged in ---
      {
        element: <RequireAuth />,
        children: [
          { element: <Shell />, children: userRoutes },
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [{ element: <Shell admin />, children: adminRoutes }],
          },
        ],
      },
      { path: '*', element: page(() => import('./pages/NotFound')) },
    ],
  },
]);
