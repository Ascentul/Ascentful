import { CohortosHeader } from '@/components/cohortos/layout/cohortos-header';
import { CohortosNav } from '@/components/cohortos/layout/cohortos-nav';

export default function CohortosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <CohortosHeader />
      <CohortosNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
