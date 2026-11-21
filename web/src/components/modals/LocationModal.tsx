import { lazy, useState } from 'react';
import { updateAssets } from '../../api/assets';
import { searchPlaces } from '../../api/library';
import { useMapStyle } from '../map/useMapStyle';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { Boundary } from '../ui/Boundary';
import { Button } from '../ui/Button';
import { NumberField, TextField } from '../ui/Fields';
import { Modal } from '../ui/Modal';

const LocationPicker = lazy(() => import('../map/LocationPicker'));

/** Choose a place on the map (or type coordinates / search a name) and write it to the pictures. */
export default function LocationModal({ assetIds, lat: initialLat, lon: initialLon, onClose, onDone }: { assetIds: string[]; lat?: number; lon?: number; onClose: () => void; onDone: () => void }) {
  const run = useRun();
  const hasMap = !!useMapStyle();
  const [lat, setLat] = useState<number | undefined>(initialLat);
  const [lon, setLon] = useState<number | undefined>(initialLon);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Array<{ name: string; latitude: number; longitude: number }>>([]);

  const search = async () => {
    const result = await run(() => searchPlaces(query), { quiet: false });
    if (result.ok) setPlaces(result.data);
  };
  const save = async () => {
    const result = await run(() => updateAssets(assetIds, { latitude: lat, longitude: lon }), { success: t('Location changed'), invalidate: [['asset'], ['timeline']] });
    if (result.ok) onDone();
  };

  return (
    <Modal
      title={t('Change location')}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={save} disabled={lat === undefined || lon === undefined}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <div className="flex gap-2">
        <div className="flex-1">
          <TextField placeholder={t('Search for a place')} value={query} onChange={setQuery} onKeyDown={(e) => e.key === 'Enter' && search()} />
        </div>
        <Button variant="outline" onClick={search} disabled={!query.trim()}>
          {t('Search')}
        </Button>
      </div>
      {places.length > 0 && (
        <ul className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-line">
          {places.map((p) => (
            <li key={`${p.latitude},${p.longitude}`}>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-panel"
                onClick={() => {
                  setLat(p.latitude);
                  setLon(p.longitude);
                  setPlaces([]);
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        {hasMap ? (
          <Boundary compact>
            <LocationPicker lat={lat} lon={lon} onChange={(a, b) => (setLat(a), setLon(b))} />
          </Boundary>
        ) : (
          <p className="rounded-xl bg-panel p-4 text-sm text-muted">{t('No map style is configured on the server, so enter the coordinates by hand.')}</p>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumberField label={t('Latitude')} step="any" value={lat} onChange={setLat} />
        <NumberField label={t('Longitude')} step="any" value={lon} onChange={setLon} />
      </div>
    </Modal>
  );
}
