import { TenantLink as Link } from '@/components/tenant-navigation';
import { getTranslations } from 'next-intl/server';
import { requirePageRole } from '@/lib/require-role';
import { MESSAGE_OWNER_ROLES } from '@/modules/messaging';
import { listTemplates } from '@/modules/messaging/queries';
import { getTenantBrand } from '@/modules/tenant-brand/queries';
import TemplateEditor from '@/modules/messaging/components/TemplateEditor';

export default async function MessageTemplatesPage() {
  await requirePageRole(MESSAGE_OWNER_ROLES);
  const t = await getTranslations('messages');
  const [templates, brand] = await Promise.all([listTemplates(), getTenantBrand()]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{t('templatesTitle')}</h1>
        <Link href="/messages" className="btn-secondary">
          {t('backToOutbox')}
        </Link>
      </div>
      <TemplateEditor templates={templates} clinicName={brand.clinicName} />
    </div>
  );
}
