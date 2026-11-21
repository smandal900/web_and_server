// Click the map (or drag the pin) to choose a place. Lazy loaded together with maplibre.
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStyle } from './useMapStyle';

interface Props {
  lat?: number;
  lon?: number;
  onChange: (lat: number, lon: number) => void;
  className?: string;
}

export default function LocationPicker({ lat, lon, onChange, className = 'h-72 w-full overflow-hidden rounded-xl' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap>(null);
  const marker = useRef<Marker>(null);
  const style = useMapStyle();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!box.current || !style) return;
    const m = new maplibregl.Map({ container: box.current, style, center: [lon ?? 0, lat ?? 20], zoom: lat === undefined ? 1.5 : 10 });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    const place = (la: number, lo: number) => {
      if (marker.current) return void marker.current.setLngLat([lo, la]);
      const pin = new maplibregl.Marker({ draggable: true, color: '#fa2921' }).setLngLat([lo, la]).addTo(m);
      pin.on('dragend', () => {
        const p = pin.getLngLat();
        onChangeRef.current(p.lat, p.lng);
      });
      marker.current = pin;
    };
    if (lat !== undefined && lon !== undefined) place(lat, lon);
    m.on('click', (e: MapMouseEvent) => {
      place(e.lngLat.lat, e.lngLat.lng);
      onChangeRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    return () => {
      m.remove();
      marker.current = null;
    };
    // The map is created once per style; later lat/lon changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  // Typed coordinates or a searched place moves the pin.
  useEffect(() => {
    if (lat === undefined || lon === undefined || !map.current) return;
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ draggable: true, color: '#fa2921' }).setLngLat([lon, lat]).addTo(map.current);
    } else marker.current.setLngLat([lon, lat]);
    map.current.easeTo({ center: [lon, lat], zoom: Math.max(map.current.getZoom(), 8) });
  }, [lat, lon]);

  return <div ref={box} className={className} />;
}
