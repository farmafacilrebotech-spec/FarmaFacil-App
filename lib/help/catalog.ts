/**
 * Catálogo documental del Centro de ayuda.
 * Las rutas `repoPath` apuntan a markdown versionado en el repo.
 * La visibilidad se filtra con `lib/help/access.ts` (backend).
 */

export type HelpAudience =
  | 'sa_total'
  | 'sa_comercial'
  | 'sa_soporte'
  | 'pharmacy_admin'
  | 'pharmacy_staff'
  | 'customer';

export type HelpDoc = {
  id: string;
  title: string;
  summary: string;
  audiences: HelpAudience[];
  /** Ruta relativa al repo (solo referencia; render fase A = metadatos). */
  repoPath: string;
  module: string;
  updatedAt: string;
  /** Si true, solo SuperAdmin Total. */
  internalTests?: boolean;
  status: 'published' | 'staging' | 'planned';
};

export const HELP_DOCS: readonly HelpDoc[] = [
  {
    id: 'manual-sa-total',
    title: 'Manual SuperAdmin',
    summary: 'Operación de plataforma: farmacias, inventario, catálogo, tarifas.',
    audiences: ['sa_total', 'sa_comercial', 'sa_soporte'],
    repoPath: 'docs/manuales/MANUAL_SUPERADMIN.md',
    module: 'plataforma',
    updatedAt: '2026-11-05',
    status: 'published',
  },
  {
    id: 'manual-farmacia',
    title: 'Manual de farmacia',
    summary: 'Gestión de la farmacia, pedidos QR, equipo y catálogo.',
    audiences: ['sa_total', 'sa_soporte', 'pharmacy_admin'],
    repoPath: 'docs/manuales/MANUAL_FARMACIA.md',
    module: 'farmacia',
    updatedAt: '2026-11-05',
    status: 'published',
  },
  {
    id: 'manual-cliente',
    title: 'Manual del área de cliente',
    summary: 'Catálogo QR, pedidos, cuenta y seguimiento.',
    audiences: ['sa_total', 'sa_soporte', 'pharmacy_admin', 'customer'],
    repoPath: 'docs/manuales/MANUAL_CLIENTE.md',
    module: 'cliente',
    updatedAt: '2026-11-05',
    status: 'published',
  },
  {
    id: 'manual-kiosko',
    title: 'Manual del Kiosko',
    summary: 'Instalación y uso del kiosko (en preparación).',
    audiences: ['sa_total', 'sa_soporte', 'pharmacy_admin'],
    repoPath: 'docs/manuales/MANUAL_KIOSKO.md',
    module: 'kiosko',
    updatedAt: '2026-11-12',
    status: 'planned',
  },
  {
    id: 'plan-pruebas',
    title: 'Documento maestro de pruebas',
    summary: 'Matriz, estados, evidencias e incidencias (uso interno).',
    audiences: ['sa_total'],
    repoPath: 'docs/pruebas/PLAN_MAESTRO_PRUEBAS.md',
    module: 'gobernanza',
    updatedAt: '2026-11-12',
    internalTests: true,
    status: 'published',
  },
  {
    id: 'historial-versiones',
    title: 'Historial de versiones',
    summary: 'Publicaciones y alineación documental.',
    audiences: ['sa_total'],
    repoPath: 'docs/gobernanza/HISTORIAL_VERSIONES.md',
    module: 'gobernanza',
    updatedAt: '2026-11-12',
    status: 'published',
  },
  {
    id: 'emails-staging',
    title: 'Emails corporativos (pendiente de publicación)',
    summary: 'Compositor y plantillas en staging — PR #25.',
    audiences: ['sa_total'],
    repoPath: 'docs/releases/emails/087_COMPOSER_REDESIGN_NOTES.md',
    module: 'emails',
    updatedAt: '2026-11-12',
    status: 'staging',
  },
] as const;

export function getHelpDoc(id: string): HelpDoc | undefined {
  return HELP_DOCS.find((d) => d.id === id);
}

/** Filtro puro (testeable sin Supabase). */
export function filterHelpDocsForAudiences(
  audiences: HelpAudience[]
): HelpDoc[] {
  if (audiences.length === 0) return [];
  const set = new Set(audiences);
  return HELP_DOCS.filter((doc) => {
    if (doc.internalTests && !set.has('sa_total')) return false;
    return doc.audiences.some((a) => set.has(a));
  });
}
