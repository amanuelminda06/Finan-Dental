import { redirect } from 'next/navigation';
import { SUPERADMIN_PATH } from '@/lib/superadmin-constants';

/** Fallback for visitors that bypass the proxy: the root is the platform login. */
export default function RootPage() {
  redirect(SUPERADMIN_PATH);
}
