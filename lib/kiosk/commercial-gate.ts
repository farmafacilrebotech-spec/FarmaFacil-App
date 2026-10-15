/**
 * Reglas de acceso comercial del kiosko — espejo de ff_kiosk_pharmacy_runtime_allowed.
 * Testeable sin BD.
 */

export type KioskCommercialGateInput = {
  pharmacyOperable: boolean;
  hasKioskModule: boolean;
};

export function kioskPharmacyRuntimeAllowed(
  input: KioskCommercialGateInput
): boolean {
  return input.pharmacyOperable === true && input.hasKioskModule === true;
}

export type KioskSessionGateStatus =
  | 'valid'
  | 'revoked'
  | 'commercially_blocked';

/**
 * Tras autenticar dispositivo/sesión, decide el status expuesto al runtime.
 */
export function resolveKioskSessionGate(input: {
  deviceActive: boolean;
  sessionRevoked: boolean;
  sessionExpired: boolean;
  pharmacyOperable: boolean;
  hasKioskModule: boolean;
}): KioskSessionGateStatus {
  if (
    !input.deviceActive ||
    input.sessionRevoked ||
    input.sessionExpired
  ) {
    return 'revoked';
  }
  if (
    !kioskPharmacyRuntimeAllowed({
      pharmacyOperable: input.pharmacyOperable,
      hasKioskModule: input.hasKioskModule,
    })
  ) {
    return 'commercially_blocked';
  }
  return 'valid';
}
