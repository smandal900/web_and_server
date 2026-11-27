import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, NavLink, Outlet } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { mdiDeleteOutline, mdiImageAlbum, mdiImageMultipleOutline, mdiMagnify, mdiViewDashboardOutline } from '@mdi/js';
import { Icon } from '@web/components/ui/Icon';
import { useFeatures } from '@web/hooks/useServer';
import { AuthProvider, useAuth } from '@web/state/AuthProvider';
import { ToastProvider } from '@web/state/ToastProvider';
import { UploadProvider, useUpload } from '@web/state/UploadProvider';
import { UploadStatus } from './components/Upload';
import { Spinner } from './components/ui';
import { setUpPwa, takeSharedFiles } from './pwa';
import { Albums, Library, Login, Search } from './screens/Pages';
import { Album, Archive, Bin, Favorites, Photos } from './screens/Timelines';
import './styles.css';

/** The five tabs of the Android app. */
function Tabs() {
  const trash = useFeatures().data?.trash !== false;
  const tabs = [
    { label: 'Photos', to: '/', icon: mdiImageMultipleOutline },
    { label: 'Search', to: '/search', icon: mdiMagnify },
    { label: 'Albums', to: '/albums', icon: mdiImageAlbum },
    { label: 'Library', to: '/library', icon: mdiViewDashboardOutline },
    ...(trash ? [{ label: 'Bin', to: '/bin', icon: mdiDeleteOutline }] : []),
  ];
  return (
    <nav className="flex shrink-0 bg-panel pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium">
          {({ isActive }) => (
            <>
              <span className={`flex rounded-full px-5 py-1 ${isActive ? 'bg-primary/20 text-primary' : ''}`}>
                <Icon path={tab.icon} />
              </span>
              <span className={isActive ? '' : 'text-muted'}>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SignedIn() {
  const { addFiles } = useUpload();
  // photos shared to the installed app from the phone's gallery are uploaded
  useEffect(() => {
    void takeSharedFiles().then((files) => files.length > 0 && addFiles(files));
  }, [addFiles]);
  return (
    <div className="flex h-full flex-col">
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
      <UploadStatus />
      <Tabs />
    </div>
  );
}

function Root() {
  const { user, isLoading, isError, refresh } = useAuth();
  if (isLoading) return <Spinner />;
  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p>Cannot reach the server.</p>
        <button type="button" className="rounded-full bg-primary px-6 py-3 text-on-primary" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  }
  if (!user) return <Login />;
  return (
    <UploadProvider>
      <SignedIn />
    </UploadProvider>
  );
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Root />,
      children: [
        { index: true, element: <Photos /> },
        { path: 'search', element: <Search /> },
        { path: 'albums', element: <Albums /> },
        { path: 'albums/:albumId', element: <Album /> },
        { path: 'library', element: <Library /> },
        { path: 'favorites', element: <Favorites /> },
        { path: 'archive', element: <Archive /> },
        { path: 'bin', element: <Bin /> },
        { path: '*', element: <Photos /> },
      ],
    },
  ],
  { basename: '/app' },
);

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, gcTime: 2 * 60_000, retry: 1 } } });

setUpPwa(import.meta.env.PROD);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
