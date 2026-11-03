import { redirect } from 'next/navigation';

/**
 * Appointment management is no longer part of the ERP display. The public
 * website and its booking flow are untouched; this route just sends anyone
 * with an old bookmark back to the dashboard.
 */
export default function AppointmentsPage() {
  redirect('/dashboard');
}
