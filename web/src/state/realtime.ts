// Live updates from the server (socket.io at /api/socket.io).
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerVersion } from '../api/types';

/**
 * Connects while the user is logged in.
 *  - `on_upload_success`  -> refresh the timeline so a new upload appears at once
 *  - `on_server_version`  -> remember the version, so the app can tell when the server was upgraded
 */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [serverVersion, setServerVersion] = useState<ServerVersion>();

  useEffect(() => {
    if (!enabled) return;
    let socket: { disconnect: () => void } | undefined;
    let cancelled = false;
    // socket.io-client is downloaded after the page is ready instead of being part of the first load.
    import('socket.io-client').then(({ io }) => {
      if (cancelled) return;
      const s = io({ path: '/api/socket.io', transports: ['websocket'], reconnectionDelayMax: 10_000 });
      socket = s;
      s.on('connect', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      s.on('on_server_version', setServerVersion);
      s.on('on_upload_success', () => {
        qc.invalidateQueries({ queryKey: ['timeline'] });
        qc.invalidateQueries({ queryKey: ['asset-statistics'] });
        qc.invalidateQueries({ queryKey: ['storage'] });
      });
    });
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [enabled, qc]);

  return { connected, serverVersion };
}
