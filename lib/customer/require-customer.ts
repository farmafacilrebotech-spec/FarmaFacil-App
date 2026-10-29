import { redirect } from 'next/navigation';

import {
  getCustomerProfile,
  type CustomerProfile,
} from '@/lib/customer/queries';

/**
 * Gate de páginas protegidas bajo /e/{publicId}/cuenta/*.
 * Redirige a entrar/registro según el caso; no usa /login del panel staff.
 */
export async function requireCustomerForPublicId(
  publicId: string
): Promise<CustomerProfile> {
  const result = await getCustomerProfile();
  if (!result.ok) {
    if (result.code === 'unauthenticated') {
      redirect(`/e/${publicId}/cuenta/entrar`);
    }
    redirect(`/e/${publicId}/cuenta`);
  }
  return result.profile;
}
