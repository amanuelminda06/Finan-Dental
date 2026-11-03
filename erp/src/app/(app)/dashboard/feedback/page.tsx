import { redirect } from 'next/navigation';

/**
 * Feedback management is no longer part of the ERP display. The public website
 * and its feedback form are untouched; this route just sends anyone with an old
 * bookmark back to the dashboard.
 */
export default function FeedbackPage() {
  redirect('/dashboard');
}
