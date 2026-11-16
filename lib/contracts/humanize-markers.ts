/**
 * Sustituye marcadores técnicos [CLAVE] por texto comprensible para el cliente.
 * No altera el significado legal: indica que el dato está pendiente de completar.
 */

const KNOWN_LABELS: Record<string, string> = {
  FECHA_ACTIVACION: 'fecha de inicio',
  FORMA_PAGO_INICIAL: 'forma de pago inicial',
  DIA_CARGO: 'día de cargo de la domiciliación',
  DURACION_INICIAL_MESES: 'duración inicial (meses)',
  RENOVACION_MESES: 'periodo de renovación (meses)',
  PREAVISO_DIAS: 'días de preaviso',
  SUBSANACION_DIAS: 'días para subsanar incumplimiento',
  FF_RAZON_SOCIAL: 'razón social del proveedor',
  FF_CIF: 'CIF del proveedor',
  FF_DOMICILIO: 'domicilio del proveedor',
  FF_REPRESENTANTE: 'representante del proveedor',
  FF_CARGO_REPRESENTANTE: 'cargo del representante del proveedor',
  FF_REPRESENTANTE_NIF: 'NIF del representante del proveedor',
  FARMACIA_RAZON_SOCIAL: 'razón social de la farmacia',
  FARMACIA_CIF: 'CIF de la farmacia',
  FARMACIA_NOMBRE: 'nombre de la farmacia',
  FARMACIA_DOMICILIO: 'domicilio de la farmacia',
  FARMACIA_REPRESENTANTE: 'representante de la farmacia',
  FARMACIA_CARGO: 'cargo del representante de la farmacia',
  FARMACIA_REPRESENTANTE_NIF: 'NIF del representante de la farmacia',
  CONTACT_EMAIL: 'correo de contacto de la farmacia',
  KIOSCO_MODELO: 'modelo del kiosco',
  KIOSCO_SERIE: 'número de serie del kiosco',
  KIOSCO_ESTADO: 'estado y accesorios del kiosco',
  KIOSCO_ENTREGA_UBICACION: 'fecha de entrega y ubicación del kiosco',
  KIOSCO_DEVOLUCION_DIAS: 'plazo de devolución del kiosco (días)',
  KIOSCO_DEVOLUCION_LUGAR: 'lugar de devolución del kiosco',
  KIOSCO_PERSONALIZACION_MARCA: 'personalización de marca del kiosco',
  LUGAR_FECHA_FIRMA: 'lugar y fecha de firma',
  FACTURACION_A: 'datos de facturación',
  ANEXO_ENCARGO_ESTADO: 'estado del anexo de encargo',
  OBSERVACIONES: 'observaciones',
  canal: 'canal de comunicación de incidencias',
};

function fallbackLabel(key: string): string {
  return key
    .replace(/^FF_/, '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

export function humanizeContractMarkers(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, (_full, rawKey: string) => {
    const key = String(rawKey).trim();
    if (/^completar antes de firma$/i.test(key)) {
      return 'Pendiente de completar: canales, horario y tiempos de soporte';
    }
    if (/^canal$/i.test(key)) {
      return 'Pendiente de completar: canal de comunicación de incidencias';
    }
    if (key === '●' || key === '•') {
      return 'Pendiente de completar';
    }
    const label = KNOWN_LABELS[key] ?? fallbackLabel(key);
    return `Pendiente de completar: ${label}`;
  });
}
