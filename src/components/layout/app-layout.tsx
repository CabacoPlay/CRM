import { ReactNode } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { useApp } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed } = useApp();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      
      <main className={cn(
        "pt-4 transition-all duration-300 min-h-[calc(100vh-4rem)]",
        // Desktop sidebar spacing
        "xl:ml-64 xl:data-[collapsed=true]:ml-16",
        // Mobile: full width, sidebar overlay
        "ml-0"
      )}
      data-collapsed={sidebarCollapsed}
      >
        <div className="w-full px-3 sm:px-4 lg:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
