import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/require-role';
import ChangePasswordForm from '@/modules/auth/components/ChangePasswordForm';

/** Voluntary password change; authenticated users can open it at any time. */
export default async function ChangePasswordPage() {
  await requireAuth();
  const t = await getTranslations('changePassword');

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
      <p className="text-sm text-slate-600">{t('subtitle')}</p>
      <div className="card p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
