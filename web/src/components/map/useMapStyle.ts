import { useFeatures, useServerConfig } from '../../hooks/useServer';
import { useTheme } from '../../state/ThemeProvider';

/**
 * The map style URL chosen by the admin, light or dark to match the theme. Empty when none is set or when the admin has
 * turned the map off: every map (photo details, location picker, map page) is then left out, so nothing is requested
 * from the map tile server.
 */
export function useMapStyle(): string {
  const config = useServerConfig().data;
  const features = useFeatures().data;
  const { isDark } = useTheme();
  if (features?.map === false) return '';
  return (isDark ? config?.mapDarkStyleUrl : config?.mapLightStyleUrl) ?? '';
}
