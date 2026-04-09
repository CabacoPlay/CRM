import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPABASE_URL } from '@/integrations/supabase/client';

type MpSettings = {
  id: string;
  env: string;
  access_token: string;
  webhook_secret: string;
};

type StoredMpSettings = {
  env?: string | null;
  has_access_token?: boolean;
  has_webhook_secret?: boolean;
  access_token_preview?: string | null;
  webhook_secret_preview?: string | null;
  updated_at?: string | null;
};

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const anyErr = err as { message?: unknown };
    const msg = String(anyErr.message ?? '').trim();
    if (msg) return msg;
  }
  return String(err || '').trim();
}

export default function AdminPagamentosConfig() {
  const [form, setForm] = useState<MpSettings>({
    id: 'default',
    env: 'prod',
    access_token: '',
    webhook_secret: '',
  });
  const [loading, setLoading] = useState(false);
  const [stored, setStored] = useState<StoredMpSettings | null>(null);
  const { toast } = useToast();

  const mpLink = useMemo(() => 'https://www.mercadopago.com.br/developers/pt/docs', []);
  const webhookUrl = useMemo(() => `${SUPABASE_URL}/functions/v1/mp-webhook`, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.functions.invoke('mp-settings', { body: { action: 'get' } });
      if (!data?.ok) return;
      const s = (data as { settings?: StoredMpSettings | null })?.settings ?? null;
      if (!s) return;
      setStored(s);
      if (s.env) setForm(prev => ({ ...prev, env: String(s.env) }));
    };
    load();
  }, []);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: 'Copiado para a área de transferência.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  const generateSecret = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const s = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    setForm(f => ({ ...f, webhook_secret: s }));
    toast({ title: 'Gerado', description: 'Chave gerada. Clique em Salvar.' });
  };

  const save = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mp-settings', { body: { action: 'set', ...form } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'failed');
      setStored(prev => ({
        ...(prev || {}),
        env: form.env,
        has_access_token: Boolean(form.access_token) || Boolean(prev?.has_access_token),
        has_webhook_secret: Boolean(form.webhook_secret) || Boolean(prev?.has_webhook_secret),
      }));
      toast({ title: 'Salvo', description: 'Configurações atualizadas.' });
    } catch (err) {
      const msg = getErrorMessage(err);
      toast({ title: 'Erro', description: msg || 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const testPix = async () => {
    setLoading(true);
    try {
      const empresaId = prompt('Empresa ID para teste (uuid):') || '';
      if (!empresaId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke('mp-pix-create', { body: { empresa_id: empresaId, amount_cents: 500 } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'failed');
      const txid = String((data as { invoice?: { provider_txid?: unknown } })?.invoice?.provider_txid || '');
      toast({ title: 'OK', description: `Cobrança criada. Payment: ${txid.slice(0, 12)}…` });
    } catch (err) {
      const msg = getErrorMessage(err);
      toast({ title: 'Erro', description: msg || 'Falha ao testar Pix.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>Pagamentos (Mercado Pago)</CardTitle>
                <div className="text-sm text-muted-foreground">Configure o Pix do Mercado Pago para renovar automaticamente o vencimento</div>
              </div>
              <Button variant="outline" onClick={() => window.open(mpLink, '_blank')} className="shrink-0">
                Docs Mercado Pago
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1">
                <Label>Ambiente</Label>
                <Select value={form.env} onValueChange={(v) => setForm(f => ({ ...f, env: v }))} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Teste</SelectItem>
                    <SelectItem value="prod">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Access Token</Label>
                <Input
                  type="password"
                  value={form.access_token}
                  onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                  placeholder={stored?.has_access_token ? `Configurado (${stored.access_token_preview || '••••••••'})` : ''}
                />
                {stored?.has_access_token && !form.access_token ? (
                  <div className="text-xs text-muted-foreground">Deixe em branco para manter o valor já configurado.</div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-1">
              <Label>Webhook Secret</Label>
              <Input
                type="password"
                value={form.webhook_secret}
                onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))}
                placeholder={stored?.has_webhook_secret ? 'Configurado (••••••••)' : ''}
              />
              {stored?.has_webhook_secret && !form.webhook_secret ? (
                <div className="text-xs text-muted-foreground">Deixe em branco para manter o valor já configurado.</div>
              ) : null}
              <div className="flex justify-end">
                <Button variant="outline" onClick={generateSecret} disabled={loading}>
                  Gerar chave
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>URL do Webhook</Label>
              <div className="flex items-center gap-2">
                <Input value={webhookUrl} readOnly />
                <Button variant="outline" onClick={() => void copy(webhookUrl)} disabled={loading}>
                  Copiar
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">Cole essa URL em Webhooks do Mercado Pago (evento: Payments) e depois salve o Webhook Secret aqui.</div>
            </div>

            <div className="flex flex-col md:flex-row md:justify-between gap-2">
              <Button variant="outline" onClick={() => void testPix()} disabled={loading}>
                Testar PIX (R$ 5,00)
              </Button>
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
