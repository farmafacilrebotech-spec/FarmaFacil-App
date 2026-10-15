/**
 * Etiquetas de dispositivo kiosko: estado técnico vs comercial.
 * El estado técnico (vinculado/revocado) se conserva siempre.
 * Puro: testeable sin BD / sin path aliases.
 */

export type KioskDeviceTechnicalStatus = 'active' | 'revoked';

export type KioskDeviceCommercialServiceStatus =
  | 'enabled'
  | 'blocked_by_subscription'
  | 'not_applicable';

export function kioskDeviceTechnicalLabel(
  status: KioskDeviceTechnicalStatus
): string {
  return status === 'active' ? 'Vinculado' : 'Revocado';
}

/**
 * Servicio comercial del dispositivo.
 * Solo aplica a dispositivos vinculados; si el add-on no es usable → bloqueado.
 */
export function resolveKioskDeviceCommercialService(input: {
  deviceStatus: KioskDeviceTechnicalStatus;
  moduleUsable: boolean;
}): KioskDeviceCommercialServiceStatus {
  if (input.deviceStatus !== 'active') {
    return 'not_applicable';
  }
  return input.moduleUsable ? 'enabled' : 'blocked_by_subscription';
}

export function kioskDeviceCommercialServiceLabel(
  status: KioskDeviceCommercialServiceStatus
): string {
  switch (status) {
    case 'enabled':
      return 'Servicio habilitado';
    case 'blocked_by_subscription':
      return 'Bloqueado por suscripción';
    case 'not_applicable':
      return '—';
  }
}
