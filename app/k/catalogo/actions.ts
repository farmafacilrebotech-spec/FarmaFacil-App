'use server';

import { searchKioskCatalog } from '@/lib/kiosk/catalog';

export async function searchKioskCatalogAction(input: {
  query?: string;
  limit?: number;
}) {
  return searchKioskCatalog(input);
}
