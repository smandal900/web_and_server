import { useState } from 'react';
import { thumbnailUrl, videoUrl, originalUrl } from '../../api/assets';
import type { Asset } from '../../api/types';

/** Plays the video with the browser's own controls (the server supports seeking). */
export function VideoView({ asset, shareKey, autoPlay = true }: { asset: Asset; shareKey?: string; autoPlay?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-white/80">
        <p>Your browser cannot play this video format.</p>
        <a className="rounded-full bg-white/15 px-5 py-2 hover:bg-white/25" href={originalUrl(asset.id, shareKey)} download>
          Download the original
        </a>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center">
      <video
        key={asset.id}
        src={videoUrl(asset.id, shareKey)}
        poster={thumbnailUrl(asset.id, 'preview', shareKey)}
        controls
        autoPlay={autoPlay}
        playsInline
        onError={() => setFailed(true)}
        className="max-h-full max-w-full"
      />
    </div>
  );
}
