import { redirect } from 'next/navigation';

// Root redirect: / → /en (default locale)
export default function RootPage() {
  redirect('/en');
}
