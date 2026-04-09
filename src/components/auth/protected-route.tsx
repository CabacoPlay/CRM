import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'owner';
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [billingChecked, setBillingChecked] = useState(true);
  const [billingBlocked, setBillingBlocked] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (isLoading) return;
      if (!user) return;
      const bypass =
        user.papel === 'admin' ||
        user.papel === 'owner' ||
        !user.empresa_id ||
        location.pathname.startsWith('/app/pagamento');
      if (bypass) {
        setBillingBlocked(false);
        setBillingChecked(true);
        return;
      }
      try {
        setBillingChecked(false);
        const { data } = await supabase
          .from('empresas')
          .select('billing_enabled,billing_plan,billing_due_date,billing_grace_days,billing_status')
          .eq('id', user.empresa_id)
          .maybeSingle();

        const plan = String((data as any)?.billing_plan || 'free').toLowerCase();
        if (plan === 'free') {
          setBillingBlocked(false);
          setBillingChecked(true);
          return;
        }

        const enabled = Boolean((data as any)?.billing_enabled);
        if (!enabled) {
          setBillingBlocked(false);
          setBillingChecked(true);
          return;
        }

        const status = String((data as any)?.billing_status || 'active').toLowerCase();
        const dueRaw = (data as any)?.billing_due_date as string | null | undefined;
        const grace = Number((data as any)?.billing_grace_days ?? 3);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let expired = false;
        if (dueRaw) {
          const due = new Date(dueRaw);
          due.setHours(0, 0, 0, 0);
          const end = new Date(due);
          end.setDate(end.getDate() + (Number.isFinite(grace) ? grace : 3));
          expired = today.getTime() > end.getTime();
        }

        setBillingBlocked(status === 'suspended' || expired);
        setBillingChecked(true);
      } catch {
        setBillingBlocked(false);
        setBillingChecked(true);
      }
    };
    void run();
  }, [isLoading, location.pathname, user?.empresa_id, user?.papel]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && user.papel !== requiredRole && user.papel !== 'owner') {
    return <Navigate to="/app/chat" replace />;
  }

  if (!billingChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (billingBlocked && !location.pathname.startsWith('/app/pagamento')) {
    return <Navigate to="/app/pagamento" replace />;
  }

  return <>{children}</>;
};
