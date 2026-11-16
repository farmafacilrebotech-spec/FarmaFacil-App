import { BrandLogo } from '@/components/brand';

/**
 * Identidad pública: logo FarmaFácil + logo/nombre de farmacia.
 * El nombre interno de farmacia se usa como etiqueta visible (único dato
 * disponible en resolve 044 cuando no hay visible_name en staging).
 */
export function PharmacyPublicIdentity({
  pharmacyName,
  logoUrl,
  size = 'md',
  align = 'center',
  showFarmaFacilMark = true,
}: {
  pharmacyName: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  align?: 'center' | 'start';
  showFarmaFacilMark?: boolean;
}) {
  const logoPx = size === 'lg' ? 72 : size === 'sm' ? 40 : 56;
  const brandPx = size === 'lg' ? 72 : size === 'sm' ? 40 : 56;
  const alignCls = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <div className={`flex flex-col gap-3 ${alignCls}`}>
      {showFarmaFacilMark ? <BrandLogo size={brandPx} /> : null}
      <div
        className={`flex gap-3 ${
          align === 'center' ? 'flex-col items-center' : 'flex-row items-center'
        }`}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
          <img
            src={logoUrl}
            alt=""
            width={logoPx}
            height={logoPx}
            className="rounded-2xl bg-white object-contain shadow-sm ring-1 ring-slate-100"
            style={{ width: logoPx, height: logoPx }}
          />
        ) : null}
        <div className={align === 'center' ? '' : 'min-w-0'}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            FarmaFácil
          </p>
          <p
            className={`font-semibold text-[#0F2A2E] ${
              size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl'
            } ${align === 'start' ? 'truncate' : ''}`}
          >
            {pharmacyName}
          </p>
        </div>
      </div>
    </div>
  );
}
