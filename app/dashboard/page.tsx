import { DashboardPageContent } from '@/features/dashboard/components/DashboardPageContent';

export const metadata = {
  title: '단타코치 — 대시보드',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600">단타코치</span>
            <span className="hidden text-sm text-gray-400 sm:inline">·</span>
            <span className="hidden text-sm text-gray-500 sm:inline">단기매매 리스크 분석</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">이 앱은 리스크 참고용입니다. 매매 추천이 아닙니다.</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <DashboardPageContent />
      </main>
    </div>
  );
}
