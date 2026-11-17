import TenantImage from '@/components/TenantImage';

type SiteLogoProps = {
  /** Rendered height in px; width follows the square 1:1 emblem ratio. */
  height?: number;
  priority?: boolean;
  className?: string;
};

/** Official Finan Speciality Dental Clinic logo (square emblem, transparent background). */
export default function SiteLogo({
  height = 36,
  priority = false,
  className = '',
}: SiteLogoProps) {
  return (
    <TenantImage
      src="/static/finan-logo.png"
      alt="Finan Speciality Dental Clinic"
      width={height}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

type SiteLogoDarkProps = {
  /** Rendered height in px; width follows the square 1:1 emblem ratio. */
  height?: number;
  className?: string;
};

/** Official Finan Speciality Dental Clinic logo (transparent background, safe on dark surfaces). */
export function SiteLogoDark({ height = 40, className = '' }: SiteLogoDarkProps) {
  return (
    <TenantImage
      src="/static/finan-logo-dark.png"
      alt="Finan Speciality Dental Clinic"
      width={height}
      height={height}
      className={className}
    />
  );
}