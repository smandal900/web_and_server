// Casting to a Chromecast through Google's sender library, which is only downloaded when someone clicks Cast.
const SCRIPT = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

interface CastWindow {
  cast?: any;
  chrome?: any;
  __onGCastApiAvailable?: (available: boolean) => void;
}
const w = window as unknown as CastWindow;
let loading: Promise<boolean> | undefined;

function loadCastSdk(): Promise<boolean> {
  loading ??= new Promise((resolve) => {
    if (w.cast?.framework) return resolve(true);
    w.__onGCastApiAvailable = (available) => resolve(available);
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
  return loading;
}

/** Ask the user to pick a device, then play `url` on it. The device must be able to open `url` itself. */
export async function castMedia(url: string, contentType: string, title: string) {
  if (!(await loadCastSdk()) || !w.cast?.framework) throw new Error('Casting is not available in this browser.');
  const context = w.cast.framework.CastContext.getInstance();
  context.setOptions({ receiverApplicationId: w.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, autoJoinPolicy: w.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
  await context.requestSession();
  const session = context.getCurrentSession();
  const info = new w.chrome.cast.media.MediaInfo(new URL(url, location.origin).href, contentType);
  info.metadata = new w.chrome.cast.media.PhotoMediaMetadata();
  info.metadata.title = title;
  await session.loadMedia(new w.chrome.cast.media.LoadRequest(info));
}
