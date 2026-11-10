/**
 * Cálculos de pedidos generales (importes en céntimos enteros).
 *
 * Criterio de transporte multi-línea:
 * - Se convierte el transporte a base imponible (sin IVA) según `shippingIncludesVat`.
 * - Esa base se reparte entre líneas en proporción a su neto (qty × precio u. sin IVA).
 * - Los céntimos residuales del reparto se asignan a la línea de mayor neto
 *   (empate → la última), para que la suma coincida exactamente.
 * - El coste unitario mostrado sin IVA e incluye el transporte proporcional:
 *     (neto_línea + transporte_neto_asignado) / cantidad
 *
 * Total del pedido (siempre):
 *   subtotal_sin_IVA + impuestos + transporte_tal_como_se_introduce
 * No se suma el transporte dos veces: si incluye IVA, ese IVA viaja dentro
 * del campo transporte y no se añade otra vez a impuestos.
 */

export const DEFAULT_PO_UNIT_PRICE_NOTE =
  'El precio unitario se muestra sin IVA e incluye el transporte proporcional correspondiente.';

export const DEFAULT_VAT_BPS = 2100;

export type PurchaseLineInput = {
  quantity: number;
  unitPriceCents: number;
  vatBps?: number;
};

export type PurchaseMoneyInput = {
  lines: PurchaseLineInput[];
  /** Transporte introducido en el formulario (bruto si incluye IVA; neto si no). */
  shippingCents: number;
  shippingIncludesVat: boolean;
  /** Tipo IVA del transporte cuando hay que separar base/cuota. */
  shippingVatBps?: number;
  /**
   * Si se informa, prevalece sobre el neto calculado desde líneas
   * (formulario con subtotal editable).
   */
  subtotalOverrideCents?: number | null;
  /**
   * Si se informa, prevalece sobre el IVA de líneas (+ transporte neto).
   */
  taxOverrideCents?: number | null;
};

export type PurchaseLineMoney = {
  quantity: number;
  netCents: number;
  vatCents: number;
  shippingNetShareCents: number;
  /** Coste unitario sin IVA con transporte proporcional (céntimos, redondeo half-up). */
  unitCostExVatWithShippingCents: number;
};

export type PurchaseMoneyResult = {
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  shippingNetCents: number;
  shippingVatCents: number;
  totalCents: number;
  lines: PurchaseLineMoney[];
};

function assertFiniteNonNeg(n: number, label: string): number {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} inválido`);
  }
  return n;
}

/** Redondeo half-up a céntimo entero. */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Separa base y cuota IVA de un importe que puede ir con IVA incluido. */
export function splitGrossVat(
  amountCents: number,
  vatBps: number,
  includesVat: boolean
): { netCents: number; vatCents: number } {
  const amount = assertFiniteNonNeg(amountCents, 'importe');
  const bps = assertFiniteNonNeg(vatBps, 'vatBps');
  if (!includesVat || amount === 0 || bps === 0) {
    const vat = includesVat ? 0 : roundCents((amount * bps) / 10000);
    return { netCents: amount, vatCents: vat };
  }
  const net = roundCents((amount * 10000) / (10000 + bps));
  return { netCents: net, vatCents: amount - net };
}

/**
 * Reparte `shippingNetCents` en proporción a `lineNetCents`.
 * Residual → línea de mayor neto (empate: última).
 */
export function allocateShippingNetProportional(
  shippingNetCents: number,
  lineNetCents: readonly number[]
): number[] {
  const shipping = assertFiniteNonNeg(shippingNetCents, 'transporte neto');
  if (lineNetCents.length === 0) return [];
  const nets = lineNetCents.map((n) => assertFiniteNonNeg(n, 'neto línea'));
  const totalNet = nets.reduce((a, b) => a + b, 0);
  if (shipping === 0) return nets.map(() => 0);
  if (totalNet <= 0) {
    // Sin base: todo el transporte a la última línea.
    const out = nets.map(() => 0);
    out[out.length - 1] = shipping;
    return out;
  }
  const shares = nets.map((n) => roundCents((shipping * n) / totalNet));
  let diff = shipping - shares.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let idx = 0;
    for (let i = 1; i < nets.length; i++) {
      if (nets[i]! >= nets[idx]!) idx = i;
    }
    shares[idx] = shares[idx]! + diff;
  }
  return shares;
}

export function lineNetCents(quantity: number, unitPriceCents: number): number {
  if (!(quantity > 0)) {
    throw new Error('La cantidad debe ser mayor que cero');
  }
  return roundCents(quantity * assertFiniteNonNeg(unitPriceCents, 'precio'));
}

export function computePurchaseMoney(
  input: PurchaseMoneyInput
): PurchaseMoneyResult {
  const shippingCents = assertFiniteNonNeg(
    input.shippingCents || 0,
    'transporte'
  );
  const shippingVatBps = input.shippingVatBps ?? DEFAULT_VAT_BPS;
  const { netCents: shippingNetCents, vatCents: shippingVatIfNet } =
    splitGrossVat(shippingCents, shippingVatBps, input.shippingIncludesVat);

  // Si el transporte incluye IVA, esa cuota viaja en el campo transporte:
  // no se añade a impuestos (evita sumar el transporte dos veces).
  const shippingVatInTax = input.shippingIncludesVat ? 0 : shippingVatIfNet;
  const shippingVatCents = input.shippingIncludesVat
    ? shippingCents - shippingNetCents
    : shippingVatIfNet;

  if (!input.lines.length) {
    const subtotalCents =
      input.subtotalOverrideCents != null
        ? assertFiniteNonNeg(input.subtotalOverrideCents, 'subtotal')
        : 0;
    const taxCents =
      input.taxOverrideCents != null
        ? assertFiniteNonNeg(input.taxOverrideCents, 'impuestos')
        : shippingVatInTax;
    return {
      subtotalCents,
      taxCents,
      shippingCents,
      shippingNetCents,
      shippingVatCents,
      totalCents: subtotalCents + taxCents + shippingCents,
      lines: [],
    };
  }

  const prepared = input.lines.map((l) => {
    const quantity = l.quantity;
    if (!(quantity > 0)) {
      throw new Error('La cantidad debe ser mayor que cero');
    }
    const unitPriceCents = assertFiniteNonNeg(l.unitPriceCents, 'precio');
    const vatBps = l.vatBps ?? DEFAULT_VAT_BPS;
    const netCents = lineNetCents(quantity, unitPriceCents);
    const vatCents = roundCents((netCents * vatBps) / 10000);
    return { quantity, unitPriceCents, vatBps, netCents, vatCents };
  });

  const linesNetSum = prepared.reduce((a, l) => a + l.netCents, 0);
  const linesVatSum = prepared.reduce((a, l) => a + l.vatCents, 0);

  const subtotalCents =
    input.subtotalOverrideCents != null
      ? assertFiniteNonNeg(input.subtotalOverrideCents, 'subtotal')
      : linesNetSum;
  const taxCents =
    input.taxOverrideCents != null
      ? assertFiniteNonNeg(input.taxOverrideCents, 'impuestos')
      : linesVatSum + shippingVatInTax;

  // Reparto del transporte neto: si hay override de subtotal (formulario
  // agregado), se usa una sola “línea virtual” proporcional a qty/precio
  // de cada línea; si el neto de líneas es 0, se reparte por cantidad.
  const allocationBase =
    linesNetSum > 0
      ? prepared.map((l) => l.netCents)
      : prepared.map((l) => roundCents(l.quantity * 1000));
  const shippingShares = allocateShippingNetProportional(
    shippingNetCents,
    allocationBase
  );

  const lines: PurchaseLineMoney[] = prepared.map((l, i) => {
    const shippingNetShareCents = shippingShares[i] ?? 0;
    const unitCostExVatWithShippingCents = roundCents(
      (l.netCents + shippingNetShareCents) / l.quantity
    );
    return {
      quantity: l.quantity,
      netCents: l.netCents,
      vatCents: l.vatCents,
      shippingNetShareCents,
      unitCostExVatWithShippingCents,
    };
  });

  return {
    subtotalCents,
    taxCents,
    shippingCents,
    shippingNetCents,
    shippingVatCents,
    totalCents: subtotalCents + taxCents + shippingCents,
    lines,
  };
}

/** Coste unitario mostrado para un pedido de una sola línea (o agregado). */
export function unitCostExVatWithShipping(input: {
  subtotalCents: number;
  shippingCents: number;
  shippingIncludesVat: boolean;
  quantity: number;
  shippingVatBps?: number;
}): number {
  if (!(input.quantity > 0)) {
    throw new Error('La cantidad debe ser mayor que cero');
  }
  const { netCents } = splitGrossVat(
    assertFiniteNonNeg(input.shippingCents || 0, 'transporte'),
    input.shippingVatBps ?? DEFAULT_VAT_BPS,
    input.shippingIncludesVat
  );
  return roundCents(
    (assertFiniteNonNeg(input.subtotalCents, 'subtotal') + netCents) /
      input.quantity
  );
}

export function ensureDefaultPoNote(notes: string | null | undefined): string {
  const current = (notes ?? '').trim();
  if (!current) return DEFAULT_PO_UNIT_PRICE_NOTE;
  if (current.includes(DEFAULT_PO_UNIT_PRICE_NOTE)) return current;
  return current;
}

export function withDefaultPoNoteOnCreate(
  notes: string | null | undefined
): string {
  const current = (notes ?? '').trim();
  if (!current) return DEFAULT_PO_UNIT_PRICE_NOTE;
  if (current.includes(DEFAULT_PO_UNIT_PRICE_NOTE)) return current;
  return `${current}\n${DEFAULT_PO_UNIT_PRICE_NOTE}`;
}
