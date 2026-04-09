import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { BrandingConfig } from '@/types';
import { defaultBranding } from '@/lib/fixtures';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type BrandingRow = {
  id: string;
  system_name: string;
  logo_url: string | null;
  logo_url_light?: string | null;
  logo_url_dark?: string | null;
  primary_color: string;
  secondary_color: string;
};

interface AppState {
  sidebarCollapsed: boolean;
  branding: BrandingConfig;
  loading: boolean;
}

interface AppContextType extends AppState {
  setSidebarCollapsed: (collapsed: boolean) => void;
  setBranding: (branding: BrandingConfig) => void;
  setLoading: (loading: boolean) => void;
  updateBranding: (updates: Partial<BrandingConfig>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);
  const [loading, setLoading] = useState(false);
  const [brandingId, setBrandingId] = useState<string | null>(null);
  const { toast } = useToast();

  const createDefaultBranding = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('branding_configs')
        .insert([{
          system_name: defaultBranding.system_name,
          logo_url: defaultBranding.logo_url,
          logo_url_light: defaultBranding.logo_url_light || null,
          logo_url_dark: defaultBranding.logo_url_dark || null,
          primary_color: defaultBranding.primary_color,
          secondary_color: defaultBranding.secondary_color,
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const row = data as unknown as BrandingRow;
        setBrandingId(row.id);
      }
    } catch (error) {
      console.error('Error creating default branding:', error);
    }
  }, []);

  const loadBrandingFromDatabase = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('branding_configs')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading branding from database:', error);
        return;
      }

      if (data) {
        const row = data as unknown as BrandingRow;
        setBrandingId(row.id);
        setBranding({
          system_name: row.system_name,
          logo_url: row.logo_url || '',
          logo_url_light: row.logo_url_light || '',
          logo_url_dark: row.logo_url_dark || '',
          primary_color: row.primary_color,
          secondary_color: row.secondary_color
        });
      } else {
        await createDefaultBranding();
      }
    } catch (error) {
      console.error('Error loading branding from database:', error);
      const savedBranding = localStorage.getItem('branding');
      if (savedBranding) {
        try {
          setBranding(JSON.parse(savedBranding) as BrandingConfig);
        } catch (parseError) {
          console.error('Error parsing saved branding:', parseError);
        }
      }
    }
  }, [createDefaultBranding]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => {
      if (mq.matches) setSidebarCollapsed(true);
    };
    apply();
    const handler = () => apply();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  // Load initial data from database
  useEffect(() => {
    void loadBrandingFromDatabase();
  }, [loadBrandingFromDatabase]);

  // Set up real-time subscription for branding changes
  useEffect(() => {
    const channel = supabase
      .channel('branding-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branding_configs'
        },
        (payload) => {
          console.log('Branding change detected:', payload);
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as unknown as Partial<BrandingRow>;
            setBranding({
              system_name: String(newData.system_name || branding.system_name),
              logo_url: String(newData.logo_url || branding.logo_url || ''),
              logo_url_light: String(newData.logo_url_light || branding.logo_url_light || ''),
              logo_url_dark: String(newData.logo_url_dark || branding.logo_url_dark || ''),
              primary_color: String(newData.primary_color || branding.primary_color),
              secondary_color: String(newData.secondary_color || branding.secondary_color)
            });
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const newData = payload.new as unknown as Partial<BrandingRow>;
            if (newData.id) setBrandingId(String(newData.id));
            setBranding({
              system_name: String(newData.system_name || branding.system_name),
              logo_url: String(newData.logo_url || branding.logo_url || ''),
              logo_url_light: String(newData.logo_url_light || branding.logo_url_light || ''),
              logo_url_dark: String(newData.logo_url_dark || branding.logo_url_dark || ''),
              primary_color: String(newData.primary_color || branding.primary_color),
              secondary_color: String(newData.secondary_color || branding.secondary_color)
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  // Apply branding to CSS variables
  useEffect(() => {
    const hexToHsl = (hex: string) => {
      // Remove # if present
      hex = hex.replace('#', '');
      
      // Convert hex to RGB
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      // Convert RGB to HSL
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h: number;
      let s: number;
      
      if (max === min) {
        h = 0;
        s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
          default: h = 0;
        }
        h /= 6;
      }
      
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    const applyBranding = () => {
      const root = document.documentElement;
      
      // Convert colors to HSL and apply
      const primaryHsl = hexToHsl(branding.primary_color);
      const secondaryHsl = hexToHsl(branding.secondary_color);
      
      root.style.setProperty('--primary', primaryHsl);
      root.style.setProperty('--secondary', secondaryHsl);
      root.style.setProperty('--whitelabel-primary', primaryHsl);
      root.style.setProperty('--whitelabel-secondary', secondaryHsl);
      
      // Apply system name and logo
      root.style.setProperty('--brand-name', `"${branding.system_name}"`);
      root.style.setProperty('--brand-logo-url', branding.logo_url ? `url("${branding.logo_url}")` : 'none');
    };

    applyBranding();
  }, [branding]);

  const updateBranding = async (updates: Partial<BrandingConfig>) => {
    const updatedBranding = { ...branding, ...updates };
    
    // Update local state immediately for responsiveness
    setBranding(updatedBranding);
    
    // Save to database
    try {
      if (brandingId) {
        const { error } = await supabase
          .from('branding_configs')
          .update({
            system_name: updatedBranding.system_name,
            logo_url: updatedBranding.logo_url,
            logo_url_light: updatedBranding.logo_url_light || null,
            logo_url_dark: updatedBranding.logo_url_dark || null,
            primary_color: updatedBranding.primary_color,
            secondary_color: updatedBranding.secondary_color
          })
          .eq('id', brandingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('branding_configs')
          .insert([{
            system_name: updatedBranding.system_name,
            logo_url: updatedBranding.logo_url,
            logo_url_light: updatedBranding.logo_url_light || null,
            logo_url_dark: updatedBranding.logo_url_dark || null,
            primary_color: updatedBranding.primary_color,
            secondary_color: updatedBranding.secondary_color
          }])
          .select()
          .single();

        if (error) throw error;
        if (data) setBrandingId(data.id);
      }

      // Also save to localStorage as backup
      localStorage.setItem('branding', JSON.stringify(updatedBranding));
    } catch (error) {
      console.error('Error saving branding to database:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações de branding",
        variant: "destructive"
      });
      // Fallback to localStorage only
      localStorage.setItem('branding', JSON.stringify(updatedBranding));
    }
  };

  const value = {
    sidebarCollapsed,
    branding,
    loading,
    setSidebarCollapsed,
    setBranding,
    setLoading,
    updateBranding,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
