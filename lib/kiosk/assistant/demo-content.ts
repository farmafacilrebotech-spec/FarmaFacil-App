/**
 * Contenido genérico del modo DEMO (no datos de farmacia real).
 */

export const DEMO_ASSISTANT_NAME = 'Asistente FarmaFácil (demo)';

export const DEMO_WELCOME_MESSAGE =
  'Hola, soy el asistente de demostración de FarmaFácil. Puedo orientarte con ejemplos genéricos de parafarmacia. No tengo el catálogo real de esta farmacia ni puedo consultar al farmacéutico online.';

export const DEMO_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: '¿Qué puedes hacer en modo demo?',
    answer:
      'Orientarte de forma general sobre categorías de parafarmacia y el uso del kiosko. No consulto el inventario real ni precios de esta farmacia.',
  },
  {
    question: '¿Puedo pedir cita o hablar con el farmacéutico desde aquí?',
    answer:
      'En modo demo no hay consultas online al farmacéutico. Acude al mostrador si necesitas atención profesional.',
  },
  {
    question: '¿Los productos que mencionas están en esta farmacia?',
    answer:
      'No. En demo solo uso ejemplos genéricos. Para existencias reales usa el buscador del kiosko o pregunta en el mostrador.',
  },
];

export const DEMO_SERVICES_INFO =
  'Servicios de demostración: orientación general en kiosko. No incluye servicios clínicos ni pedidos online reales.';

export const DEMO_HOURS_INFO =
  'Horario demo: consulta el horario publicado en el mostrador de la farmacia.';

export const DEMO_CUSTOM_INSTRUCTIONS =
  'Estás en modo DEMO. Usa solo información genérica de demostración. No inventes catálogo, precios ni existencias de esta farmacia.';
