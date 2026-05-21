'use client';

import type { ReactNode } from 'react';

interface DashboardSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  /** When true, title is rendered inside children (e.g. paired with status badges). */
  hideTitle?: boolean;
}

export function DashboardSection({ id, title, children, hideTitle = false }: DashboardSectionProps) {
  return (
    <section id={id} className="scroll-mt-20" aria-labelledby={`${id}-title`}>
      {!hideTitle && (
        <h2 id={`${id}-title`} className="mb-4 text-lg font-bold text-gray-900">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
