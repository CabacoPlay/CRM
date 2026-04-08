import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { SystemNotifications } from './notifications';
import { UserMenu } from '@/components/auth/user-menu';
import { useApp } from '@/contexts/app-context';
import { useTheme } from '@/hooks/use-theme';
import { getBrandLogoUrl, resolveTheme } from '@/lib/utils';

export function Header() {
  const { sidebarCollapsed, setSidebarCollapsed, branding } = useApp();
  const [searchFocused, setSearchFocused] = useState(false);
  const { theme } = useTheme();
  const logoUrl = getBrandLogoUrl(branding, resolveTheme(theme));

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 sm:h-16 items-center px-3 sm:px-4 gap-2 sm:gap-4">
        {/* Left side - Menu + Logo + System Name */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8 shrink-0"
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-md object-cover shrink-0"
              />
            ) : (
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-gradient-primary flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary-foreground">
                  {branding.system_name.charAt(0)}
                </span>
              </div>
            )}
            
            <span className="hidden sm:block font-semibold text-foreground text-sm lg:text-base truncate">
              {branding.system_name}
            </span>
          </div>
        </div>

        {/* Center - Spacer */}
        <div className="flex-1"></div>

        {/* Right side - Notifications + Dark Mode + Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <SystemNotifications />
          <DarkModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
