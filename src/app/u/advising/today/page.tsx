/**
 * University Workspace - Today
 *
 * Redirect to Home to avoid duplicate "Today" vs "Home" destinations.
 */

import { redirect } from 'next/navigation';

export default function TodayRedirectPage() {
  redirect('/u/home');
}
