/**
 * Plantilla maestra única FF-MARCO-v1.
 *
 * Estructura: Contrato_Marco_FarmaFacil_Seleccion_Plan.
 * Condiciones de modalidad: textos fieles de 02/03/04 en docs/contratos/fuentes/.
 * No inventa cláusulas. Importes variables: placeholders rellenados desde el snapshot.
 * Piloto y Anexo de Encargo quedan fuera de este módulo.
 */

import type { ContractTemplateKey } from '../../../lib/contracts/types.ts';

export const MASTER_TEMPLATE_VERSION = 'FF-MARCO-v1' as const;
export const MASTER_TEMPLATE_CODE = 'FF-MARCO-SELECCION-PLAN' as const;
export const MASTER_SOURCE_DATE = '22 OCTUBRE 2026' as const;

export const MODALITY_LABELS: Record<ContractTemplateKey, string> = {
  catalog: 'Catálogo',
  'catalog-ai': 'Catálogo + Asistente IA',
  'full-kiosk': 'Completo + kiosco',
};

/** Inclusión de cada modalidad (marco §2 «Qué incluye»), texto fiel. */
export const MODALITY_INCLUDES: Record<ContractTemplateKey, string> = {
  catalog: 'Catálogo digital propio y solicitudes de productos.',
  'catalog-ai':
    'Catálogo propio y asistente configurado para la Farmacia.',
  'full-kiosk':
    'Software Completo y alquiler del kiosco identificado en el apartado 5.',
};

/**
 * Cláusula de asistente (fuentes 03 y 04 / marco §7).
 * Se incluye en Catálogo+IA y Completo+kiosco.
 */
export const ASSISTANT_CLAUSE = `El módulo de asistente ofrece respuestas informativas basadas en la configuración y contenidos acordados. No diagnostica, prescribe ni sustituye el criterio del farmacéutico. La Farmacia mantiene la responsabilidad de validar y supervisar la información ofrecida y de atender las consultas que se deriven a su personal.`;

/**
 * Condiciones de kiosco (fuente 04 §4 + marco §5), texto fiel.
 * Placeholders operativos pendientes de ficha/configuración.
 */
export const KIOSK_SECTION = `5. Kiosco y servicios opcionales
El plan incluye el uso en alquiler del equipo identificado abajo. La propiedad del equipo permanece en el Proveedor. La Farmacia se compromete a custodiarlo, utilizarlo de forma diligente y permitir su devolución al terminar el contrato.

Modelo / referencia: [KIOSCO_MODELO]
Número de serie: [KIOSCO_SERIE]
Estado y accesorios: [KIOSCO_ESTADO]
Fecha de entrega y ubicación: [KIOSCO_ENTREGA_UBICACION]
Personalización solicitada: [KIOSCO_PERSONALIZACION_MARCA] ([PERSONALIZACION_KIOSCO] + impuestos si se selecciona)

Uso, daños y devolución
La Farmacia no venderá, cederá, gravará ni trasladará el equipo sin autorización escrita. Comunicará inmediatamente cualquier pérdida, robo o avería. El desgaste ordinario no se considera daño. Al terminar el alquiler, devolverá el equipo y accesorios en [KIOSCO_DEVOLUCION_DIAS] días, en [KIOSCO_DEVOLUCION_LUGAR], salvo que las partes acuerden otra solución por escrito. Los daños imputables se documentarán y valorarán antes de cualquier cargo.

Coste de personalización
La personalización es un servicio separado del alquiler. Solo se encargará y facturará si se marca expresamente en la ficha económica o en una orden firmada. El importe aplicable es el del presupuesto aceptado (snapshot): [PERSONALIZACION_KIOSCO] más impuestos. La personalización no transfiere la propiedad del equipo.`;

export type MasterComposeInput = {
  modality: ContractTemplateKey;
  values: Record<string, string | null | undefined>;
};

/**
 * Compone el cuerpo único del contrato comercial.
 * Los importes salen de placeholders rellenados desde el snapshot; no de tablas Word.
 */
export function composeMasterContractBody(
  input: MasterComposeInput
): string {
  const m = input.modality;
  const modalityLabel = MODALITY_LABELS[m];
  const modalityIncludes = MODALITY_INCLUDES[m];
  const includeAssistant = m === 'catalog-ai' || m === 'full-kiosk';
  const includeKiosk = m === 'full-kiosk';

  const parts: string[] = [];

  parts.push(`Contrato de servicios FarmaFácil
Formulario único de contratación y ficha económica
Plantilla maestra ${MASTER_TEMPLATE_VERSION} · ${MASTER_TEMPLATE_CODE} · ${MASTER_SOURCE_DATE}
Borrador de trabajo. Completar los campos entre corchetes y revisar jurídicamente antes de firmar.

Los importes económicos de este documento proceden exclusivamente del presupuesto aceptado indicado más abajo (snapshot). Las tablas de precios de documentos de referencia no son fuente de datos.

1. Identificación de las partes

Proveedor del servicio
Razón social: [FF_RAZON_SOCIAL]
NIF/CIF: [FF_CIF]
Domicilio: [FF_DOMICILIO]
Representante: [FF_REPRESENTANTE]
Cargo: [FF_CARGO_REPRESENTANTE]
DNI/NIE del representante: [FF_REPRESENTANTE_NIF]

Farmacia
Titular / razón social: [FARMACIA_RAZON_SOCIAL]
NIF/CIF: [FARMACIA_CIF]
Farmacia: [FARMACIA_NOMBRE]
Dirección: [FARMACIA_DOMICILIO]
Representante: [FARMACIA_REPRESENTANTE]
Cargo/condición: [FARMACIA_CARGO]
DNI/NIE del representante: [FARMACIA_REPRESENTANTE_NIF]
Correo de la farmacia para avisos y entrega de copia: [CONTACT_EMAIL]

Ambas partes manifiestan que cuentan con capacidad suficiente para contratar y acuerdan lo siguiente.`);

  parts.push(`2. Servicio elegido
Modalidad contratada: ${modalityLabel}
Qué incluye: ${modalityIncludes}

(El piloto gratuito y el Anexo de Encargo de Tratamiento no forman parte de este documento; se gestionan por separado.)`);

  parts.push(`3. Precio y periodicidad — ficha económica del presupuesto aceptado
Los importes se expresan en euros y no incluyen IVA ni otros impuestos aplicables, salvo que se indique lo contrario. Prevalece el importe del presupuesto aceptado incorporado como ficha económica.

Referencia de presupuesto: [PRESUPUESTO_REF]
Identificador de presupuesto: [PRESUPUESTO_ID]
Versión del snapshot: [PRESUPUESTO_SNAPSHOT_VERSION]
Plan: [PLAN_NOMBRE]
Periodicidad: [PERIODICIDAD]
Cohorte / tarifa del snapshot: [COHORTE_PRICING]

Concepto — Importe (neto) — Periodicidad
Cuota de software / plan: [PLAN_RECURRENTE] — [PERIODICIDAD]
Alquiler de kiosco (si aplica): [ALQUILER_KIOSCO] — mensual (según unidades del snapshot)
Total recurrente neto: [CUOTA_RECURRENTE] — [PERIODICIDAD]
Total recurrente con IVA ([IVA_PCT]): [CUOTA_RECURRENTE_IVA]
Alta de aplicación: [CUOTA_ALTA] — pago único
Personalización de kiosco: [PERSONALIZACION_KIOSCO] — pago único si se solicita
Número de kioscos: [NUM_KIOSCOS]
Instalación onsite: [INSTALACION]
Pago único neto: [PAGO_UNICO_NETO]
Pago único con IVA: [PAGO_UNICO_IVA]

Fecha de activación: [FECHA_ACTIVACION]
Forma de pago inicial: [FORMA_PAGO_INICIAL]
Cuota recurrente: domiciliación bancaria
Día de cargo: [DIA_CARGO]
Facturación a: [FACTURACION_A]

Confirmación de los importes
Si cualquier documento de plantilla o tabla de tarifas muestra un importe diferente, prevalecerá únicamente el importe que figure en el presupuesto o propuesta individual aceptada por ambas partes (snapshot referenciado arriba).`);

  parts.push(`4. Vigencia y entrega del contrato
En los planes de pago mensual, la duración inicial será de [DURACION_INICIAL_MESES] meses y se renovará por periodos de [RENOVACION_MESES] meses, salvo preaviso escrito de [PREAVISO_DIAS] días. La modalidad anual tiene un periodo inicial de 12 meses y se factura por adelantado. La terminación por incumplimiento esencial requerirá requerimiento escrito y un plazo de [SUBSANACION_DIAS] días para subsanar, salvo que la ley permita otra cosa.

Tras la firma se entregará a la Farmacia una copia. Si se firma en papel, se escaneará el documento firmado y se incorporará al expediente de la Farmacia en la aplicación. También se enviará una copia al correo indicado arriba. La copia digital será reproducción del original firmado.`);

  if (includeKiosk) {
    parts.push(KIOSK_SECTION);
  } else {
    parts.push(`5. Kiosco y servicios opcionales
No aplicable a la modalidad ${modalityLabel}.`);
  }

  parts.push(`Condiciones generales del servicio

6. Alcance y uso
El Proveedor habilita a la Farmacia el acceso al servicio digital indicado en la ficha económica. FarmaFácil complementa la atención y el catálogo de la Farmacia; no sustituye su programa de gestión ni implica integración con stock, ERP o distribuidores, salvo acuerdo escrito. La Farmacia mantendrá actualizados usuarios, contenidos, correo de notificación y autorizaciones, y no incorporará productos o contenidos prohibidos por la normativa aplicable.

El Proveedor habilitará a la Farmacia el acceso al servicio SaaS seleccionado y a las funciones descritas en este contrato. FarmaFácil es una capa digital de atención y catálogo; no sustituye el programa de gestión farmacéutica ni implica integración con su stock, ERP o distribuidores salvo que se pacte expresamente en un anexo firmado.

Uso autorizado
La Farmacia utilizará el servicio en su actividad profesional y mantendrá actualizados sus datos, usuarios, correo de notificación, contenidos y autorizaciones. La Farmacia no incorporará al catálogo medicamentos sujetos a receta ni contenido que no esté permitido por la normativa aplicable.`);

  parts.push(`7. Asistente y responsabilidad profesional
${
    includeAssistant
      ? ASSISTANT_CLAUSE
      : 'Cuando se contrate un asistente, este ofrece respuestas informativas de acuerdo con su configuración y contenidos. No diagnostica ni prescribe, ni sustituye el criterio del farmacéutico. La Farmacia supervisará las respuestas y atenderá las consultas derivadas a su personal.'
  }`);

  parts.push(`8. Alta, soporte y cambios
El alta incluye la creación de la cuenta y la configuración inicial descrita en la propuesta aceptada. Importaciones, integraciones, personalizaciones u otros trabajos no incluidos requieren presupuesto y aceptación separados.

Disponibilidad y soporte
Canales, horario de soporte, tiempos objetivo y ventanas de mantenimiento: [completar antes de firma]. El Proveedor comunicará las incidencias relevantes por [canal]. No se promete un nivel de disponibilidad que no figure expresamente en un acuerdo de nivel de servicio firmado.`);

  parts.push(`9. Datos personales
Cada parte responde de los tratamientos que realice como responsable. Cuando el Proveedor trate datos por cuenta de la Farmacia, ambas partes firmarán el anexo de encargo de tratamiento, que deberá identificar finalidad, duración, categorías de datos, medidas y subencargados antes de la puesta en marcha.

Anexo de encargo de tratamiento: [ANEXO_ENCARGO_ESTADO]
(El Anexo de Encargo de Tratamiento es un documento independiente y no se incorpora automáticamente a este PDF.)`);

  parts.push(`10. Propiedad intelectual y confidencialidad
El software, marcas, diseños y documentación pertenecen al Proveedor o a sus licenciantes. Durante la vigencia, la Farmacia recibe un derecho de uso no exclusivo, no transferible y limitado al servicio contratado. Cada parte protegerá la información no pública recibida de la otra y la usará para ejecutar el contrato, salvo obligación legal o autorización escrita.

La Farmacia conserva sus derechos sobre los datos y materiales que aporte.`);

  parts.push(`11. Incumplimiento y finalización
Cualquiera de las partes podrá resolver el contrato por incumplimiento esencial no subsanado dentro del plazo indicado en la ficha. Al finalizar, se desactivará el acceso y se tramitará la exportación o supresión de los datos conforme al anexo de tratamiento y los plazos legales. Las responsabilidades se regirán por la legislación aplicable; no se excluyen las que legalmente no puedan excluirse.

Cada parte responderá conforme a la legislación aplicable por los daños que le sean imputables. Ninguna cláusula excluye responsabilidades que legalmente no puedan excluirse.`);

  parts.push(`12. Ley aplicable
El contrato se rige por la legislación española. Para las controversias, las partes se someten a los juzgados y tribunales competentes conforme a la ley.`);

  parts.push(`Aceptación y firmas
Las partes declaran que han leído y aceptan la modalidad, tarifa, periodicidad y condiciones marcadas. Cada persona firmante manifiesta que cuenta con facultades suficientes para obligar a la parte que representa.

La firma se realizará presencialmente mediante trazado manuscrito en la pantalla del dispositivo del Proveedor, o en papel según se indique. Las partes acuerdan utilizar ese mecanismo para expresar su consentimiento y conservar como evidencia el documento final, la fecha y hora, la identidad y cargo declarados por la persona firmante, la versión del contrato y el registro técnico asociado a la operación.

Una vez completado, el documento se cerrará en PDF y se conservará en el expediente de la Farmacia. Se enviará una copia al correo de la Farmacia indicado en este contrato: [CONTACT_EMAIL].

POR EL PROVEEDOR
Razón social: [FF_RAZON_SOCIAL]
Nombre: [FF_REPRESENTANTE]
Cargo: [FF_CARGO_REPRESENTANTE]
NIF/DNI: [FF_REPRESENTANTE_NIF]
Lugar y fecha: [LUGAR_FECHA_FIRMA]
Firma:

POR LA FARMACIA
Farmacia / razón social: [FARMACIA_RAZON_SOCIAL]
Nombre: [FARMACIA_REPRESENTANTE]
Cargo/condición: [FARMACIA_CARGO]
NIF/DNI: [FARMACIA_REPRESENTANTE_NIF]
Lugar y fecha: [LUGAR_FECHA_FIRMA]
Firma:

Observaciones o condiciones particulares aceptadas por ambas partes:
[OBSERVACIONES]

Checklist de cierre: selección económica completa · copia entregada · escaneo cargado al expediente · correo de copia enviado

Versión de plantilla: ${MASTER_TEMPLATE_VERSION}
Fecha del documento: [FECHA_CONTRATO]`);

  const body = parts.join('\n\n');
  return fillPlaceholders(body, input.values);
}

const PLACEHOLDER_RE = /\[([^\]]+)\]/g;

/**
 * Sustituye solo placeholders con clave conocida y valor no vacío.
 * Conserva literales pendientes ([●], [completar antes de firma], [canal], etc.).
 */
export function fillPlaceholders(
  body: string,
  values: Record<string, string | null | undefined>
): string {
  return body.replace(PLACEHOLDER_RE, (full, key: string) => {
    const trimmedKey = String(key).trim();
    if (!(trimmedKey in values)) return full;
    const v = values[trimmedKey];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    return full;
  });
}

/** Detecta marcadores legales/operativos aún sin resolver. */
export function findUnresolvedMarkers(body: string): string[] {
  const found = new Set<string>();
  const re = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    found.add(`[${match[1].trim()}]`);
  }
  return Array.from(found).sort();
}

export function isBlockingMarker(marker: string): boolean {
  const inner = marker.replace(/^\[|\]$/g, '').trim();
  if (!inner) return true;
  if (inner === '●' || inner === '•') return true;
  if (/^completar antes de firma$/i.test(inner)) return true;
  if (/^canal$/i.test(inner)) return true;
  // Cualquier placeholder con clave MACHINE_CASE o texto pendiente
  return true;
}
