import { ImageResponse } from 'next/og';
import { getTenantBrand } from '@/modules/tenant-brand/queries';

/** File-convention alts are static; the generated image itself is per tenant. */
export const alt = 'Clinic branding';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Default social share image. Colours, clinic name, tagline and location come
 * from the current tenant's editable brand, so two clinics never share art.
 */
export default async function OpengraphImage() {
  const brand = await getTenantBrand();
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: `linear-gradient(135deg, ${brand.colors.primary} 0%, ${brand.colors.secondary} 100%)`,
        padding: '72px',
        color: brand.colors.accent,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
          }}
        >
          {(brand.shortName.trim()[0] ?? 'C').toUpperCase()}
        </div>
        <div style={{ fontSize: 34, fontWeight: 600 }}>{brand.clinicName}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05 }}>
          {brand.tagline || 'Dental care for every smile'}
        </div>
        <div style={{ fontSize: 30, opacity: 0.92 }}>
          Consultations · Cleaning · Restorative and specialist dental care
        </div>
      </div>
      <div style={{ fontSize: 26, opacity: 0.9 }}>{brand.address || 'Ethiopia'}</div>
    </div>,
    size,
  );
}
