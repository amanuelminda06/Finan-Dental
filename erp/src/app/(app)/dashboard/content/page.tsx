import { redirect } from 'next/navigation';

/**
 * Website-content editing is no longer part of the ERP display. The public
 * website keeps serving the content already stored in the database; this route
 * just sends anyone with an old bookmark back to the dashboard.
 */
export default function WebsiteContentPage() {
  redirect('/dashboard');
}
