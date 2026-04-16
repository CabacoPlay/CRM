import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';

type ResendSettingsForm = {
  id: string;
  sender_title: string;
  api_token: string;
};

type ResendSettingsStored = {
  sender_title?: string | null;
  has_api_token?: boolean;
  api_token_preview?: string | null;
};

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err || '').trim();
}

export default function AdminConfiguracoesResend() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stored, setStored] = useState<ResendSettingsStored | null>(null);
  const [form, setForm] = useState<ResendSettingsForm>({
    id: 'default',
    sender_title: '',
    api_token: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.functions.invoke('resend-settings', { body: { action: 'get' } });
      if (error || !data?.ok) return;
      const s = (data as { settings?: ResendSettingsStored | null }).settings ?? null;
      if (!s) return;
      setStored(s);
      if (s.sender_title) {
        setForm(prev => ({ ...prev, sender_title: String(s.sender_title) }));
      }
    };
    void load();
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-settings', {
        body: {
          action: 'set',
          ...form,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'failed');
      setStored(prev => ({
        ...(prev || {}),
        sender_title: form.sender_title,
        has_api_token: Boolean(form.api_token) || Boolean(prev?.has_api_token),
      }));
      setForm(prev => ({ ...prev, api_token: '' }));
      toast({ title: 'Salvo', description: 'Configuração do Resend atualizada.' });
    } catch (err) {
      const msg = getErrorMessage(err);
      toast({ title: 'Erro', description: msg || 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Configurações do Resend</h1>
            <p className="text-muted-foreground">Defina o título/remetente e token da API para envio de e-mails.</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin/configuracoes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Integração Resend</CardTitle>
            <CardDescription>O token é salvo no servidor e não é exposto no painel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <Label>Título / Remetente</Label>
              <Input
                value={form.sender_title}
                onChange={(e) => setForm(prev => ({ ...prev, sender_title: e.target.value }))}
                placeholder="Ex: F5 CRM - Acesso"
              />
            </div>

            <div className="grid gap-1">
              <Label>API Token</Label>
              <Input
                type="password"
                value={form.api_token}
                onChange={(e) => setForm(prev => ({ ...prev, api_token: e.target.value }))}
                placeholder={stored?.has_api_token ? `Configurado (${stored.api_token_preview || '••••••••'})` : 're_...'}
              />
              {stored?.has_api_token && !form.api_token ? (
                <div className="text-xs text-muted-foreground">
                  Deixe em branco para manter o token já configurado.
                </div>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void save()} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
