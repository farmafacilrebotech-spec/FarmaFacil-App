/**
 * Resolución visual de productos del catálogo genérico (solo UI).
 *
 * Nivel A — formato/envase verificado (`formats/*.svg`) por palabras clave
 *           del nombre o subcategoría (sin marcas comerciales).
 * Nivel B — icono de categoría (inyectado; ver `category-icons.ts`).
 * Nivel C — placeholder elegante neutro.
 *
 * No escribe en BD. No inventa fotos de producto.
 */

const FORMATS_BASE = '/images/catalog-proposal/formats';
const PLACEHOLDER_SRC = `${FORMATS_BASE}/placeholder-producto.svg`;

export type ProductIllustrationKind = 'format' | 'category' | 'placeholder';

export type ProductIllustration = {
  src: string;
  kind: ProductIllustrationKind;
  /** Identificador estable del recurso (slug de archivo o categoría). */
  slug: string;
};

export type CategoryIllustrationFallback = {
  src: string;
  slug: string;
} | null;

type FormatRule = {
  slug: string;
  needles: readonly string[];
};

/**
 * Reglas de formato ordenadas de más específicas a más genéricas.
 * Solo se asigna un format si el texto del producto lo respalda.
 */
const FORMAT_RULES: readonly FormatRule[] = [
  { slug: 'termometro', needles: ['termómetro', 'termometro'] },
  {
    slug: 'aposito-venda',
    needles: ['apósito', 'aposito', 'venda', 'gasa', 'esparadrapo', 'tirit'],
  },
  {
    slug: 'cepillo-bucodental',
    needles: [
      'cepillo dental',
      'cepillo interdental',
      'cepillos interdentales',
      'cepillo de dientes',
    ],
  },
  {
    slug: 'higiene-menstrual',
    needles: [
      'higiene menstrual',
      'compresa menstrual',
      'compresas menstruales',
      'compresa higienica',
      'compresas de maternidad',
      'salvaslip',
      'tampon',
      'tampón',
      'copa menstrual',
    ],
  },
  { slug: 'spray', needles: ['spray', 'aerosol'] },
  {
    slug: 'dosificador',
    needles: ['sérum', 'serum', 'dosificador', 'pump'],
  },
  {
    slug: 'tubo',
    needles: [
      'tubo',
      'pasta dental',
      'pasta dentífrica',
      'bálsamo labial',
      'balsamo labial',
      'crema de manos',
      'gel facial',
      'gel dental',
    ],
  },
  {
    slug: 'botella',
    needles: [
      'champú',
      'champu',
      'agua micelar',
      'tónico',
      'tonico',
      'aceite',
      'loción',
      'locion',
      'gel de baño',
      'gel de ducha',
      'colonia',
      'enjuague',
      'elixir',
    ],
  },
  {
    slug: 'bote',
    needles: [
      'crema facial',
      'hidratante facial',
      'mascarilla',
      'exfoliante',
      'desodorante',
      'tarro',
      'bote',
    ],
  },
  {
    slug: 'caja',
    needles: ['pañal', 'panal', 'toallitas', 'caja', 'kit ', 'preservativo'],
  },
  {
    slug: 'cuidado-infantil',
    needles: ['infantil', 'bebé', 'bebe', 'lactancia', 'chupete'],
  },
  {
    slug: 'aparato-cuidado',
    needles: ['aparato', 'nebulizador', 'inhalador', 'humidificador'],
  },
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function haystack(input: {
  name: string;
  category: string | null;
  subcategory: string | null;
}): string {
  return normalize(
    [input.name, input.subcategory ?? '', input.category ?? ''].join(' ')
  );
}

function matchFormatSlug(text: string): string | null {
  for (const rule of FORMAT_RULES) {
    for (const needle of rule.needles) {
      if (text.includes(normalize(needle))) {
        return rule.slug;
      }
    }
  }
  return null;
}

export function resolveProductIllustration(
  input: {
    name: string;
    category: string | null;
    subcategory: string | null;
  },
  categoryFallback: CategoryIllustrationFallback = null
): ProductIllustration {
  const text = haystack(input);
  const formatSlug = matchFormatSlug(text);
  if (formatSlug) {
    return {
      src: `${FORMATS_BASE}/${formatSlug}.svg`,
      kind: 'format',
      slug: formatSlug,
    };
  }

  if (categoryFallback?.src) {
    return {
      src: categoryFallback.src,
      kind: 'category',
      slug: categoryFallback.slug,
    };
  }

  return {
    src: PLACEHOLDER_SRC,
    kind: 'placeholder',
    slug: 'placeholder-producto',
  };
}

/** Inventario de apoyo (UI/tests): recursos format disponibles. */
export const PRODUCT_FORMAT_SLUGS: readonly string[] = FORMAT_RULES.map(
  (r) => r.slug
);

export const PRODUCT_ILLUSTRATION_PLACEHOLDER = PLACEHOLDER_SRC;

export function countIllustrationCoverage(
  items: readonly {
    name: string;
    category: string | null;
    subcategory: string | null;
  }[],
  resolveCategory: (
    category: string | null
  ) => CategoryIllustrationFallback
): { format: number; category: number; placeholder: number; total: number } {
  let format = 0;
  let category = 0;
  let placeholder = 0;
  for (const item of items) {
    const kind = resolveProductIllustration(
      item,
      resolveCategory(item.category)
    ).kind;
    if (kind === 'format') format += 1;
    else if (kind === 'category') category += 1;
    else placeholder += 1;
  }
  return { format, category, placeholder, total: items.length };
}
