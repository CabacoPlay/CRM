import { useState, useRef } from 'react';
import { Palette, Save, RotateCcw, Upload, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppLayout } from '@/components/layout/app-layout';
import { useApp } from '@/contexts/app-context';
import { BrandingConfig } from '@/types';
import { defaultBranding } from '@/lib/fixtures';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function AdminBranding() {
  const { branding, updateBranding } = useApp();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<BrandingConfig>(branding);
  const fileInputLightRef = useRef<HTMLInputElement>(null);
  const fileInputDarkRef = useRef<HTMLInputElement>(null);
  const fileInputFallbackRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setLoading(true);
    
    try {
      // Apply branding to database
      await updateBranding(formData);
      toast.success('Configurações de branding aplicadas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    }
    
    setLoading(false);
  };

  const handleLogoUpload = (field: 'logo_url_light' | 'logo_url_dark' | 'logo_url') => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 2MB');
      return;
    }

    setUploading(true);

    try {
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const fileName = `${field}_${timestamp}.${extension}`;

      const { error } = await supabase.storage
        .from('branding')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('branding')
        .getPublicUrl(fileName);

      setFormData({ ...formData, [field]: publicUrl });
      toast.success('Logo enviado com sucesso!');

      if (field === 'logo_url_light' && fileInputLightRef.current) fileInputLightRef.current.value = '';
      if (field === 'logo_url_dark' && fileInputDarkRef.current) fileInputDarkRef.current.value = '';
      if (field === 'logo_url' && fileInputFallbackRef.current) fileInputFallbackRef.current.value = '';
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao enviar logo. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = (field: 'logo_url_light' | 'logo_url_dark' | 'logo_url') => {
    setFormData({ ...formData, [field]: '' });
    toast.success('Logo removido');
  };

  const handleReset = async () => {
    setFormData(defaultBranding);
    await updateBranding(defaultBranding);
    toast.success('Configurações resetadas para o padrão');
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(branding);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Branding & Whitelabel</h1>
          <p className="text-muted-foreground">
            Personalize a aparência do sistema com sua marca
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Configurações
              </CardTitle>
              <CardDescription>
                Configure o nome, logo e cores do seu sistema
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="system_name">Nome do Sistema</Label>
                <Input
                  id="system_name"
                  placeholder="Ex: Minha Empresa IA"
                  value={formData.system_name}
                  onChange={(e) => setFormData({ ...formData, system_name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Logos do Sistema</Label>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Logo para tema claro</Label>
                    {formData.logo_url_light && (
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <img
                          src={formData.logo_url_light}
                          alt="Logo tema claro"
                          className="h-12 w-12 rounded-md object-contain bg-white"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Logo claro</p>
                          <p className="text-xs text-muted-foreground">Usada quando o tema estiver claro</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveLogo('logo_url_light')}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputLightRef.current?.click()}
                        disabled={uploading}
                        className="flex-1"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? 'Enviando...' : 'Enviar logo clara'}
                      </Button>
                    </div>
                    <input
                      ref={fileInputLightRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload('logo_url_light')}
                      className="hidden"
                    />
                    <Input
                      placeholder="https://exemplo.com/logo-clara.png"
                      value={formData.logo_url_light || ''}
                      onChange={(e) => setFormData({ ...formData, logo_url_light: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Logo para tema escuro</Label>
                    {formData.logo_url_dark && (
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <img
                          src={formData.logo_url_dark}
                          alt="Logo tema escuro"
                          className="h-12 w-12 rounded-md object-contain bg-black"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Logo escura</p>
                          <p className="text-xs text-muted-foreground">Usada quando o tema estiver escuro</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveLogo('logo_url_dark')}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputDarkRef.current?.click()}
                        disabled={uploading}
                        className="flex-1"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? 'Enviando...' : 'Enviar logo escura'}
                      </Button>
                    </div>
                    <input
                      ref={fileInputDarkRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload('logo_url_dark')}
                      className="hidden"
                    />
                    <Input
                      placeholder="https://exemplo.com/logo-escura.png"
                      value={formData.logo_url_dark || ''}
                      onChange={(e) => setFormData({ ...formData, logo_url_dark: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Logo padrão (fallback)</Label>
                    {formData.logo_url && (
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <img
                          src={formData.logo_url}
                          alt="Logo padrão"
                          className="h-12 w-12 rounded-md object-contain"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Logo padrão</p>
                          <p className="text-xs text-muted-foreground">Usada se a do tema atual não estiver definida</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveLogo('logo_url')}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputFallbackRef.current?.click()}
                        disabled={uploading}
                        className="flex-1"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? 'Enviando...' : 'Enviar logo padrão'}
                      </Button>
                    </div>
                    <input
                      ref={fileInputFallbackRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload('logo_url')}
                      className="hidden"
                    />
                    <Input
                      placeholder="https://exemplo.com/logo.png"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: JPG, PNG, GIF • Tamanho máximo: 2MB • Recomendado: imagem quadrada
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-16 h-10 p-1 border rounded-lg cursor-pointer"
                    />
                    <Input
                      placeholder="#a855f7"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary_color"
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-16 h-10 p-1 border rounded-lg cursor-pointer"
                    />
                    <Input
                      placeholder="#3b82f6"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  loading={loading}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Aplicar Configurações
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Veja como ficará a aparência do seu sistema
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 bg-white text-black">
                  <div className="flex items-center gap-3">
                    {(formData.logo_url_light || formData.logo_url) ? (
                      <img
                        src={(formData.logo_url_light || formData.logo_url) as string}
                        alt="Logo Preview (claro)"
                        className="h-8 w-8 rounded-md object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: formData.primary_color }}
                      >
                        {formData.system_name.charAt(0) || 'G'}
                      </div>
                    )}
                    <span className="font-semibold">
                      {formData.system_name || 'Nome do Sistema'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs opacity-70">Preview tema claro</div>
                </div>

                <div className="border rounded-lg p-4 bg-[#0b0b0f] text-white">
                  <div className="flex items-center gap-3">
                    {(formData.logo_url_dark || formData.logo_url) ? (
                      <img
                        src={(formData.logo_url_dark || formData.logo_url) as string}
                        alt="Logo Preview (escuro)"
                        className="h-8 w-8 rounded-md object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: formData.primary_color }}
                      >
                        {formData.system_name.charAt(0) || 'G'}
                      </div>
                    )}
                    <span className="font-semibold">
                      {formData.system_name || 'Nome do Sistema'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs opacity-70">Preview tema escuro</div>
                </div>
              </div>

              {/* Button Preview */}
              <div className="space-y-3">
                <h4 className="font-medium">Botões e Elementos</h4>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium shadow-sm transition-colors hover:opacity-90"
                    style={{ backgroundColor: formData.primary_color }}
                  >
                    Botão Primário
                  </button>
                  
                  <button
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium shadow-sm transition-colors hover:opacity-90"
                    style={{ backgroundColor: formData.secondary_color }}
                  >
                    Botão Secundário
                  </button>
                </div>

                <div className="flex gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: formData.primary_color }}
                  />
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: formData.secondary_color }}
                  />
                  <span className="text-sm text-muted-foreground">Indicadores</span>
                </div>
              </div>

              {(formData.logo_url || formData.logo_url_light || formData.logo_url_dark) && (
                <div className="space-y-2">
                  <h4 className="font-medium">Logo</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-dashed border-muted-foreground/30 rounded-lg p-6 flex justify-center bg-white">
                      <img
                        src={(formData.logo_url_light || formData.logo_url || formData.logo_url_dark) as string}
                        alt="Logo Preview Claro"
                        className="max-w-24 max-h-24 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="border border-dashed border-muted-foreground/30 rounded-lg p-6 flex justify-center bg-[#0b0b0f]">
                      <img
                        src={(formData.logo_url_dark || formData.logo_url || formData.logo_url_light) as string}
                        alt="Logo Preview Escuro"
                        className="max-w-24 max-h-24 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <p className="font-medium mb-1">💡 Dicas:</p>
                <ul className="space-y-1">
                  <li>• Use cores contrastantes para melhor legibilidade</li>
                  <li>• Logo ideal: formato quadrado, fundo transparente</li>
                  <li>• As mudanças são aplicadas imediatamente</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
