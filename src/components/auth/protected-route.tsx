import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'owner';
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();

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

  return <>{children}</>;
};
