/** Path público estable para entrypoints (reutiliza public_id de BD). */
export function pharmacyEntrypointPath(publicId: string): string {
  const id = publicId.trim().toLowerCase();
  return `/e/${encodeURIComponent(id)}`;
}
