import { redirect } from 'next/navigation';

import {
  getCustomerProfile,
  type CustomerProfile,
} from '@/lib/customer/queries';

/**
 * Gate de páginas protegidas bajo /e/{publicId}/cuenta/*.
 * Redirige a entrar / activar cliente según el caso; no usa /login del panel staff.
 */
export async function requireCustomerForPublicId(
  publicId: string
): Promise<CustomerProfile> {
  const result = await getCustomerProfile();
  if (!result.ok) {
    if (result.code === 'unauthenticated') {
      redirect(`/e/${publicId}/cuenta/entrar`);
    }
    // staff_needs_enable y not_customer → hub con flujo de activación
    redirect(`/e/${publicId}/cuenta`);
  }
  return result.profile;
}
