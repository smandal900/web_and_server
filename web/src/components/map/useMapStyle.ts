import { useServerConfig } from '../../hooks/useServer';
import { useTheme } from '../../state/ThemeProvider';

/** The map style URL chosen by the admin, light or dark to match the theme. Empty when none is set. */
export function useMapStyle(): string {
  const config = useServerConfig().data;
  const { isDark } = useTheme();
  return (isDark ? config?.mapDarkStyleUrl : config?.mapLightStyleUrl) ?? '';
}
