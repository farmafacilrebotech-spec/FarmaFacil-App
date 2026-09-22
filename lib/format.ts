export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function initials(name: string): string {
  const value = name.trim();
  if (!value) return '?';

  // Email → iniciales del local-part (antes de @)
  if (value.includes('@')) {
    const local = value.split('@')[0] ?? value;
    return local.slice(0, 2).toUpperCase();
  }

  return value
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Nombre visible: full_name, o local-part del email si no hay nombre. */
export function displayNameFromIdentity(
  fullName: string | null | undefined,
  email: string
): string {
  const name = fullName?.trim();
  if (name) return name;
  if (email.includes('@')) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
  }
  return email || 'Usuario';
}
