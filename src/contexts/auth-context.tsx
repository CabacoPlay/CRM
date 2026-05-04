import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Usuario } from '@/types';

interface AuthContextType {
  user: Usuario | null;
  isLoading: boolean;
  login: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  sendAuthToken: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (patch: Partial<Usuario>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      try {
        const sessionData = JSON.parse(atob(sessionToken));
        const expiryTime = new Date(sessionData.expires_at).getTime();
        const now = new Date().getTime();
        
        if (expiryTime > now) {
          setUser(sessionData);
        } else {
          localStorage.removeItem('session_token');
        }
      } catch (error) {
        console.error('Invalid session token:', error);
        localStorage.removeItem('session_token');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const fillMissingAvatar = async () => {
      if (!user?.id) return;
      // if session has no avatar_url, try to load from DB to keep header consistent
      // do not block UI; best-effort only
      if ((user as any).avatar_url === undefined || (user as any).avatar_url === null) {
        try {
          const { data } = await supabase.from('usuarios').select('avatar_url').eq('id', user.id).maybeSingle();
          const url = (data as any)?.avatar_url || null;
          if (url) {
            const raw = localStorage.getItem('session_token');
            if (raw) {
              try {
                const parsed = JSON.parse(atob(raw));
                parsed.avatar_url = url;
                localStorage.setItem('session_token', btoa(JSON.stringify(parsed)));
              } catch {
                // ignore
              }
            }
            setUser(prev => (prev ? ({ ...prev, avatar_url: url } as any) : prev));
          }
        } catch {
          // ignore
        }
      }
    };
    void fillMissingAvatar();
  }, [user?.id]);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user?.id) return;
      if (!user?.empresa_id) return;
      if (user.papel !== 'colaborador') {
        if (user.can_view_contact_phone === undefined) updateUser({ can_view_contact_phone: true });
        if (user.can_access_ia === undefined) updateUser({ can_access_ia: true });
        if (user.can_access_catalogo === undefined) updateUser({ can_access_catalogo: true });
        if (user.can_access_catalogo_publico === undefined) updateUser({ can_access_catalogo_publico: true });
        if (user.can_access_orcamentos === undefined) updateUser({ can_access_orcamentos: true });
        return;
      }
      if (
        user.can_view_contact_phone !== undefined &&
        user.can_access_ia !== undefined &&
        user.can_access_catalogo !== undefined &&
        user.can_access_catalogo_publico !== undefined &&
        user.can_access_orcamentos !== undefined
      ) return;
      try {
        const { data } = await supabase
          .from('usuario_permissoes')
          .select('can_view_contact_phone,can_access_ia,can_access_catalogo,can_access_catalogo_publico,can_access_orcamentos')
          .eq('empresa_id', user.empresa_id)
          .eq('user_id', user.id)
          .maybeSingle();
        updateUser({
          can_view_contact_phone: Boolean(data?.can_view_contact_phone),
          can_access_ia: Boolean(data?.can_access_ia),
          can_access_catalogo: Boolean(data?.can_access_catalogo),
          can_access_catalogo_publico: Boolean(data?.can_access_catalogo_publico),
          can_access_orcamentos: Boolean(data?.can_access_orcamentos),
        });
      } catch {
        updateUser({
          can_view_contact_phone: false,
          can_access_ia: false,
          can_access_catalogo: false,
          can_access_catalogo_publico: false,
          can_access_orcamentos: false,
        });
      }
    };
    void loadPermissions();
  }, [user?.id, user?.empresa_id, user?.papel]);

  const sendAuthToken = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-auth-token', {
        body: { email }
      });

      if (error) {
        console.error('Error sending auth token:', error);
        return { success: false, error: error.message || 'Erro ao enviar token' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending auth token:', error);
      return { success: false, error: 'Erro interno do servidor' };
    }
  };

  const login = async (email: string, token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-auth-token', {
        body: { email, token }
      });

      if (error) {
        console.error('Error verifying token:', error);
        return { success: false, error: error.message || 'Token inválido' };
      }

      if (data?.user && data?.session_token) {
        setUser(data.user);
        localStorage.setItem('session_token', data.session_token);
        return { success: true };
      }

      return { success: false, error: 'Token inválido' };
    } catch (error) {
      console.error('Error during login:', error);
      return { success: false, error: 'Erro interno do servidor' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('session_token');
  };

  const updateUser = (patch: Partial<Usuario>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        const raw = localStorage.getItem('session_token');
        if (raw) {
          const parsed = JSON.parse(atob(raw));
          const merged = { ...parsed, ...patch };
          localStorage.setItem('session_token', btoa(JSON.stringify(merged)));
        }
      } catch {
        //
      }
      return next;
    });
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    sendAuthToken,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
