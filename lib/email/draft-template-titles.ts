/** Títulos de catálogo estático (fallback si no hay fila en BD). */
const CATALOG_TITLES: Record<string, string> = {
  blank: 'En blanco',
  lanzadera: 'Lanzadera',
  imprentas: 'Presupuesto imprentas',
  demo: 'Invitación demostración',
  piloto: 'Invitación piloto',
};

/** Resuelve títulos en servidor (mapa serializable; no pasar funciones al cliente). */
export function buildDraftTemplateTitleMap(
  drafts: Array<{ templateSlug: string; templateId: string | null }>,
  templates: Array<{ id: string; name: string; systemKey: string | null }>
): Record<string, string> {
  const byId = new Map(templates.map((t) => [t.id, t.name]));
  const bySystem = new Map(
    templates
      .filter((t) => t.systemKey)
      .map((t) => [t.systemKey as string, t.name])
  );
  const map: Record<string, string> = {};
  for (const d of drafts) {
    const key = d.templateId || d.templateSlug || 'blank';
    if (map[key]) continue;
    if (d.templateId && byId.has(d.templateId)) {
      map[key] = byId.get(d.templateId)!;
      continue;
    }
    if (bySystem.has(d.templateSlug)) {
      map[key] = bySystem.get(d.templateSlug)!;
      continue;
    }
    map[key] = CATALOG_TITLES[d.templateSlug] ?? d.templateSlug;
  }
  return map;
}
