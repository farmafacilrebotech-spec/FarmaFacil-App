import type { MetadataRoute } from 'next';
import { isStagingAppEnv } from '@/lib/env/staging-runtime-guard';

/** Staging: disallow total. Producción: política mínima (sin sitemap staging). */
export default function robots(): MetadataRoute.Robots {
  if (isStagingAppEnv()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/'],
    },
  };
}
