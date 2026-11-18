import TenantImage from '@/components/TenantImage';

type SiteLogoProps = {
  /** Tenant-owned brand logo URL; a neutral monogram is shown when absent. */
  src?: string | null;
  alt?: string;
  /** Initials used by the neutral fallback. */
  label?: string;
  /** Rendered height in px; width follows the square 1:1 emblem ratio. */
  height?: number;
  priority?: boolean;
  className?: string;
};

/** The current clinic's logo. Never falls back to another clinic's artwork. */
export default function SiteLogo({
  src,
  alt,
  label = 'Clinic',
  height = 36,
  priority = false,
  className = '',
}: SiteLogoProps) {
  if (src) {
    return (
      <TenantImage
        src={src}
        alt={alt || label}
        width={height}
        height={height}
        priority={priority}
        className={className}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={alt || label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-brand-800 font-semibold text-brand-primary-contrast ${className}`}
      style={{ width: height, height }}
    >
      {(label.trim()[0] ?? 'C').toUpperCase()}
    </span>
  );
}

type SiteLogoDarkProps = SiteLogoProps;

/** Brand logo variant for dark surfaces, with the same neutral fallback. */
export function SiteLogoDark({ height = 40, ...props }: SiteLogoDarkProps) {
  return <SiteLogo height={height} {...props} />;
}
