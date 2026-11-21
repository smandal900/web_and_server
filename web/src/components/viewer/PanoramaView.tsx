// 360° photos. The photo-sphere-viewer library is large, so this file is only downloaded for panoramas.
import { useEffect, useRef } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import { thumbnailUrl } from '../../api/assets';

export default function PanoramaView({ assetId, shareKey }: { assetId: string; shareKey?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const viewer = new Viewer({ container: box.current, panorama: thumbnailUrl(assetId, 'fullsize', shareKey), navbar: ['zoom', 'move', 'fullscreen'], defaultZoomLvl: 20 });
    return () => viewer.destroy();
  }, [assetId, shareKey]);
  return <div ref={box} className="size-full" />;
}
