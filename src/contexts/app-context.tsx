import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BrandingConfig } from '@/types';
import { defaultBranding } from '@/lib/fixtures';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  // Load initial data from database
  useEffect(() => {
    loadBrandingFromDatabase();
  }, []);

  // Load branding from database
  const loadBrandingFromDatabase = async () => {
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
        setBrandingId(data.id);
        setBranding({
          system_name: data.system_name,
          logo_url: data.logo_url || '',
          logo_url_light: (data as any).logo_url_light || '',
          logo_url_dark: (data as any).logo_url_dark || '',
          primary_color: data.primary_color,
          secondary_color: data.secondary_color
        });
      } else {
        // No branding config exists, create default one
        await createDefaultBranding();
      }
    } catch (error) {
      console.error('Error loading branding from database:', error);
      // Fallback to localStorage
      const savedBranding = localStorage.getItem('branding');
      if (savedBranding) {
        try {
          setBranding(JSON.parse(savedBranding));
        } catch (parseError) {
          console.error('Error parsing saved branding:', parseError);
        }
      }
    }
  };

  // Create default branding config in database
  const createDefaultBranding = async () => {
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
        setBrandingId(data.id);
      }
    } catch (error) {
      console.error('Error creating default branding:', error);
    }
  };

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
            const newData = payload.new as any;
            setBranding({
              system_name: newData.system_name,
              logo_url: newData.logo_url || '',
              logo_url_light: newData.logo_url_light || '',
              logo_url_dark: newData.logo_url_dark || '',
              primary_color: newData.primary_color,
              secondary_color: newData.secondary_color
            });
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const newData = payload.new as any;
            setBrandingId(newData.id);
            setBranding({
              system_name: newData.system_name,
              logo_url: newData.logo_url || '',
              logo_url_light: newData.logo_url_light || '',
              logo_url_dark: newData.logo_url_dark || '',
              primary_color: newData.primary_color,
              secondary_color: newData.secondary_color
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
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0; // achromatic
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
