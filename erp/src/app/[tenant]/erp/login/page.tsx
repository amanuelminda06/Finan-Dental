import LoginForm from '@/modules/auth/components/LoginForm';

/** Open login for this clinic. Tenant isolation is enforced by the URL gate. */
export default function LoginPage() {
  return <LoginForm />;
}
