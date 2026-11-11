/**
 * Cálculos de pedidos de compra (importes en céntimos enteros).
 *
 * Resumen canónico:
 *   Total = Base productos + IVA productos + Transporte neto + IVA transporte
 *
 * Persistencia compatible con columnas existentes:
 *   subtotal_cents = base productos
 *   tax_cents      = IVA productos + (IVA transporte solo si shipping NO incluye IVA)
 *   shipping_cents = importe introducido (bruto si incluye IVA; neto si no)
 *   total_cents    = subtotal + tax + shipping_cents  (== Total canónico)
 *
 * Transporte multi-línea (coste unitario sin IVA c/ transporte):
 *   - Se obtiene la base del transporte (sin IVA).
 *   - Se reparte proporcionalmente al neto de cada línea.
 *   - Residual → línea de mayor neto (empate: última).
 *   - unitario = (neto_línea + share_transporte) / cantidad
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
  /** Transporte introducido (bruto si incluye IVA; neto si no). */
  shippingCents: number;
  shippingIncludesVat: boolean;
  shippingVatBps?: number;
  /** Solo borradores legacy sin líneas. */
  subtotalOverrideCents?: number | null;
  taxOverrideCents?: number | null;
};

export type PurchaseLineMoney = {
  quantity: number;
  unitPriceCents: number;
  vatBps: number;
  /** Base imponible de la línea. */
  netCents: number;
  /** Cuota IVA de la línea. */
  vatCents: number;
  /** Total línea con IVA. */
  lineTotalCents: number;
  shippingNetShareCents: number;
  unitCostExVatWithShippingCents: number;
};

export type PurchaseMoneyResult = {
  /** Base imponible productos. */
  subtotalCents: number;
  /** IVA productos. */
  productVatCents: number;
  /** tax_cents a persistir (productos + IVA transporte si shipping es neto). */
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

export function vatPercentToBps(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) return DEFAULT_VAT_BPS;
  return Math.round(percent * 100);
}

export function vatBpsToPercent(bps: number): number {
  return bps / 100;
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

  const shippingVatInTax = input.shippingIncludesVat ? 0 : shippingVatIfNet;
  const shippingVatCents = input.shippingIncludesVat
    ? shippingCents - shippingNetCents
    : shippingVatIfNet;

  if (!input.lines.length) {
    const subtotalCents =
      input.subtotalOverrideCents != null
        ? assertFiniteNonNeg(input.subtotalOverrideCents, 'subtotal')
        : 0;
    const productVatCents =
      input.taxOverrideCents != null
        ? Math.max(
            0,
            assertFiniteNonNeg(input.taxOverrideCents, 'impuestos') -
              shippingVatInTax
          )
        : 0;
    const taxCents =
      input.taxOverrideCents != null
        ? assertFiniteNonNeg(input.taxOverrideCents, 'impuestos')
        : productVatCents + shippingVatInTax;
    const totalCents =
      subtotalCents + productVatCents + shippingNetCents + shippingVatCents;
    return {
      subtotalCents,
      productVatCents,
      taxCents,
      shippingCents,
      shippingNetCents,
      shippingVatCents,
      totalCents,
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
    return {
      quantity,
      unitPriceCents,
      vatBps,
      netCents,
      vatCents,
      lineTotalCents: netCents + vatCents,
    };
  });

  const linesNetSum = prepared.reduce((a, l) => a + l.netCents, 0);
  const productVatCents = prepared.reduce((a, l) => a + l.vatCents, 0);

  const subtotalCents =
    input.subtotalOverrideCents != null
      ? assertFiniteNonNeg(input.subtotalOverrideCents, 'subtotal')
      : linesNetSum;
  const taxCents =
    input.taxOverrideCents != null
      ? assertFiniteNonNeg(input.taxOverrideCents, 'impuestos')
      : productVatCents + shippingVatInTax;

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
    return {
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      vatBps: l.vatBps,
      netCents: l.netCents,
      vatCents: l.vatCents,
      lineTotalCents: l.lineTotalCents,
      shippingNetShareCents,
      unitCostExVatWithShippingCents: roundCents(
        (l.netCents + shippingNetShareCents) / l.quantity
      ),
    };
  });

  const totalCents =
    subtotalCents + productVatCents + shippingNetCents + shippingVatCents;

  return {
    subtotalCents,
    productVatCents,
    taxCents,
    shippingCents,
    shippingNetCents,
    shippingVatCents,
    totalCents,
    lines,
  };
}

/** Coste unitario agregado (todas las líneas) sin IVA c/ transporte. */
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

export type PurchaseDraftIssue = {
  field: string;
  message: string;
  blockingForConfirm: boolean;
};

/** Valida borrador/confirmación sin lanzar (para UI). */
export function validatePurchaseDraft(input: {
  supplierId: string;
  title: string;
  /** Fecha pedido YYYY-MM-DD; obligatoria al confirmar. */
  orderedAt?: string | null;
  lines: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    vatBps: number;
  }>;
  shippingCents: number;
  shippingIncludesVat: boolean;
  shippingVatBps?: number;
  /** Si true, exige transporte informado (0 € válido). */
  requireShippingInformed?: boolean;
  shippingInformed?: boolean;
}): {
  issues: PurchaseDraftIssue[];
  money: PurchaseMoneyResult | null;
} {
  const issues: PurchaseDraftIssue[] = [];
  if (!input.supplierId.trim()) {
    issues.push({
      field: 'supplierId',
      message: 'Selecciona proveedor',
      blockingForConfirm: true,
    });
  }
  if (!input.title.trim()) {
    issues.push({
      field: 'title',
      message: 'Indica un título',
      blockingForConfirm: true,
    });
  }
  if (!input.orderedAt?.trim()) {
    issues.push({
      field: 'orderedAt',
      message: 'Indica la fecha de pedido',
      blockingForConfirm: true,
    });
  }
  const usable = input.lines.filter(
    (l) => l.description.trim() || l.unitPriceCents > 0 || l.quantity > 0
  );
  if (usable.length === 0) {
    issues.push({
      field: 'lines',
      message: 'Añade al menos una línea',
      blockingForConfirm: true,
    });
  }
  for (let i = 0; i < usable.length; i++) {
    const l = usable[i]!;
    if (!l.description.trim()) {
      issues.push({
        field: `line.${i}.description`,
        message: `Línea ${i + 1}: falta descripción`,
        blockingForConfirm: true,
      });
    }
    if (!(l.quantity > 0)) {
      issues.push({
        field: `line.${i}.quantity`,
        message: `Línea ${i + 1}: cantidad > 0`,
        blockingForConfirm: true,
      });
    }
    if (!(l.unitPriceCents >= 0) || !Number.isFinite(l.unitPriceCents)) {
      issues.push({
        field: `line.${i}.unitPrice`,
        message: `Línea ${i + 1}: precio no válido`,
        blockingForConfirm: true,
      });
    }
    if (!(l.vatBps >= 0) || !Number.isFinite(l.vatBps)) {
      issues.push({
        field: `line.${i}.vat`,
        message: `Línea ${i + 1}: IVA no válido (0 % permitido)`,
        blockingForConfirm: true,
      });
    }
  }
  if (
    input.requireShippingInformed &&
    input.shippingInformed === false
  ) {
    issues.push({
      field: 'shipping',
      message: 'Indica el transporte (0 € si no aplica)',
      blockingForConfirm: true,
    });
  }
  if (!(input.shippingCents >= 0) || !Number.isFinite(input.shippingCents)) {
    issues.push({
      field: 'shipping',
      message: 'Transporte no válido',
      blockingForConfirm: true,
    });
  }

  const completeLines = usable.filter(
    (l) => l.description.trim() && l.quantity > 0 && l.unitPriceCents >= 0
  );
  let money: PurchaseMoneyResult | null = null;
  if (completeLines.length > 0) {
    try {
      money = computePurchaseMoney({
        lines: completeLines.map((l) => ({
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          vatBps: l.vatBps,
        })),
        shippingCents: Math.max(0, input.shippingCents || 0),
        shippingIncludesVat: input.shippingIncludesVat,
        shippingVatBps: input.shippingVatBps,
      });
    } catch (e) {
      issues.push({
        field: 'money',
        message: e instanceof Error ? e.message : 'Cálculo no válido',
        blockingForConfirm: true,
      });
    }
  }

  return { issues, money };
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
