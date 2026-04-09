import { Link, useLocation } from 'react-router-dom';
import { 
  QrCode, 
  Sparkles, 
  Package, 
  Kanban,
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Users2,
  FileText,
  Building, 
  Users, 
  Plug, 
  Palette,
  Settings
} from 'lucide-react';
import { useApp } from '@/contexts/app-context';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

const clientNavItems = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Chat WhatsApp', href: '/app/chat', icon: MessageSquare },
  { label: 'Contatos', href: '/app/contatos', icon: Users2 },
  { label: 'Agenda & Serviços', href: '/app/agenda', icon: Calendar },
  { label: 'Leads & CRM', href: '/app/crm', icon: Kanban },
  { label: 'Minha IA', href: '/app/ia', icon: Sparkles },
  { label: 'Catálogo', href: '/app/catalogo', icon: Package },
  { label: 'Orçamentos', href: '/app/orcamentos', icon: FileText },
  { label: 'Configurações', href: '/app/configuracoes', icon: Settings },
];

const adminNavItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Empresas', href: '/admin/empresas', icon: Building },
  { label: 'Usuários', href: '/admin/usuarios', icon: Users },
  { label: 'Conexões', href: '/admin/conexoes', icon: Plug },
  { label: 'Planos & Faturas', href: '/admin/planos-faturas', icon: FileText },
  { label: 'Pagamentos (Mercado Pago)', href: '/admin/pagamentos-config', icon: Settings },
  { label: 'Branding', href: '/admin/branding', icon: Palette },
];

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { user } = useAuth();
  const location = useLocation();
  
  const navItems = user?.papel === 'admin' ? adminNavItems : clientNavItems;

  return (
    <>
      {/* Mobile Overlay */}
      {!sidebarCollapsed && (
        <div 
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      
      <aside className={cn(
        "fixed left-0 top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] bg-sidebar border-r border-sidebar-border transition-all duration-300 z-40",
        // Mobile: slide in from left, full overlay
        "lg:translate-x-0",
        sidebarCollapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "translate-x-0 w-64 lg:w-64"
      )}>
        <div className="p-3 sm:p-4">
          <nav className="space-y-1 sm:space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => {
                    // Auto-close sidebar on mobile after navigation
                    if (window.innerWidth < 1024) {
                      setSidebarCollapsed(true);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-colors hover:bg-secondary/80",
                    isActive && "bg-primary text-white shadow-md border-l-4 border-secondary font-semibold",
                    !isActive && "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-secondary/50",
                    sidebarCollapsed && "lg:justify-center lg:px-2"
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", sidebarCollapsed && "lg:h-6 lg:w-6")} />
                  {(!sidebarCollapsed || window.innerWidth < 1024) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
