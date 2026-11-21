// A map with all photo locations, grouped into clusters. Lazy loaded: maplibre is a big library.
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { thumbnailUrl } from '../../api/assets';
import type { MapMarker } from '../../api/types';
import { useMapStyle } from './useMapStyle';

const SOURCE = 'photos';

const toGeoJson = (markers: MapMarker[]) => ({
  type: 'FeatureCollection' as const,
  features: markers.map((m) => ({
    type: 'Feature' as const,
    properties: { id: m.id, city: m.city ?? '', country: m.country ?? '' },
    geometry: { type: 'Point' as const, coordinates: [m.lon, m.lat] },
  })),
});

/** Add the clustered source and its layers (also needed again after a style change). */
function addLayers(map: MapLibreMap, markers: MapMarker[]) {
  if (map.getSource(SOURCE)) return;
  map.addSource(SOURCE, { type: 'geojson', data: toGeoJson(markers), cluster: true, clusterRadius: 50, clusterMaxZoom: 14 });
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#4250af',
      'circle-opacity': 0.85,
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 100, 30, 1000, 40],
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'points',
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: { 'circle-color': '#fa2921', 'circle-radius': 8, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
  });
}

export default function MapView({ markers, onOpenAsset, className = 'h-full w-full' }: { markers: MapMarker[]; onOpenAsset: (id: string) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>(null);
  const style = useMapStyle();
  const latest = useRef({ markers, onOpenAsset });
  latest.current = { markers, onOpenAsset };

  useEffect(() => {
    if (!box.current || !style) return;
    const map = new maplibregl.Map({ container: box.current, style, center: [0, 20], zoom: 1.5, attributionControl: { compact: true } });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({}), 'top-right');
    map.on('style.load', () => addLayers(map, latest.current.markers));

    map.on('click', 'clusters', async (e: MapMouseEvent & { features?: any[] }) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const source = map.getSource(SOURCE) as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({ center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom });
    });
    map.on('click', 'points', (e: MapMouseEvent & { features?: any[] }) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const id = feature.properties.id as string;
      const html = document.createElement('button');
      html.innerHTML = `<img src="${thumbnailUrl(id)}" alt="" style="width:160px;height:160px;object-fit:cover;border-radius:8px;display:block"/>`;
      html.onclick = () => latest.current.onOpenAsset(id);
      new maplibregl.Popup({ closeButton: false, offset: 12 })
        .setLngLat((feature.geometry as unknown as { coordinates: [number, number] }).coordinates)
        .setDOMContent(html)
        .addTo(map);
    });
    for (const layer of ['clusters', 'points']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [style]);

  // New markers (filters changed): update the data and fit the view to them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJson(markers));
      if (markers.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        markers.forEach((m) => bounds.extend([m.lon, m.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 500 });
      }
    };
    map.isStyleLoaded() ? apply() : map.once('idle', apply);
  }, [markers, style]);

  return <div ref={box} className={className} />;
}
