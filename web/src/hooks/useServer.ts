// Cached server-info queries. Each one is a one-liner so pages stay short.
import { useQuery } from '@tanstack/react-query';
import {
  getAbout,
  getFeatures,
  getMediaTypes,
  getPublicConfig,
  getServerConfig,
  getStorage,
  getUserConfig,
  getVersion,
} from '../api/core';

const MINUTE = 60_000;

export const useServerConfig = () => useQuery({ queryKey: ['server-config'], queryFn: getServerConfig, staleTime: MINUTE });
export const useFeatures = () => useQuery({ queryKey: ['features'], queryFn: getFeatures, staleTime: 5 * MINUTE });
export const usePublicConfig = () => useQuery({ queryKey: ['public-config'], queryFn: getPublicConfig, staleTime: MINUTE });
export const useUserConfig = () => useQuery({ queryKey: ['user-config'], queryFn: getUserConfig, staleTime: 5 * MINUTE });
export const useStorage = () => useQuery({ queryKey: ['storage'], queryFn: getStorage, staleTime: MINUTE });
export const useAbout = () => useQuery({ queryKey: ['about'], queryFn: getAbout, staleTime: 10 * MINUTE });
export const useVersion = () => useQuery({ queryKey: ['version'], queryFn: getVersion, staleTime: 10 * MINUTE });
export const useMediaTypes = () => useQuery({ queryKey: ['media-types'], queryFn: getMediaTypes, staleTime: Infinity });
