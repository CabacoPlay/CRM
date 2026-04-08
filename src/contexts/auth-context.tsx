import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Usuario } from '@/types';

interface AuthContextType {
  user: Usuario | null;
  isLoading: boolean;
  login: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  sendAuthToken: (email: string) => Promise<{ success: boolean; error?: string }>;
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

  const value = {
    user,
    isLoading,
    login,
    logout,
    sendAuthToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};