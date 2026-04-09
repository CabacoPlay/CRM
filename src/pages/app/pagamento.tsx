import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type EmpresaBilling = {
  id: string;
  nome: string;
  telefone: string | null;
  responsavel: string | null;
  billing_enabled: boolean;
  billing_plan: string;
  billing_due_date: string | null;
  billing_grace_days: number;
  billing_status: string;
  billing_price_cents?: number | null;
  billing_currency?: string | null;
};

type Invoice = {
  id: string;
  empresa_id: string;
  provider: string;
  provider_txid: string;
  amount_cents: number;
  currency: string;
  status: string;
  expires_at: string | null;
  pix_copy_paste: string | null;
  pix_qr_image: string | null;
  created_at: string;
};

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const anyErr = err as { message?: unknown; error_description?: unknown };
    const msg = String(anyErr.message ?? '').trim();
    if (msg) return msg;
    const desc = String(anyErr.error_description ?? '').trim();
    if (desc) return desc;
  }
  return String(err || '').trim();
}

export default function PagamentoPage() {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<EmpresaBilling | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      if (!user?.empresa_id) return;
      const { data } = await supabase
        .from('empresas')
        .select('id,nome,telefone,responsavel,billing_enabled,billing_plan,billing_due_date,billing_grace_days,billing_status,billing_price_cents,billing_currency')
        .eq('id', user.empresa_id)
        .maybeSingle();
      setEmpresa((data as EmpresaBilling | null) ?? null);
    };
    load();
  }, [user?.empresa_id]);

  const due = empresa?.billing_due_date ? new Date(empresa.billing_due_date).toLocaleDateString('pt-BR') : '—';

  const priceText = useMemo(() => {
    const cents = empresa?.billing_price_cents ?? null;
    if (!cents || cents <= 0) return null;
    const cur = empresa?.billing_currency || 'BRL';
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: cur });
  }, [empresa?.billing_currency, empresa?.billing_price_cents]);

  useEffect(() => {
    const loadInvoice = async () => {
      if (!user?.empresa_id) return;
      const { data } = await supabase
        .from('billing_invoices')
        .select('id,empresa_id,provider,provider_txid,amount_cents,currency,status,expires_at,pix_copy_paste,pix_qr_image,created_at')
        .eq('empresa_id', user.empresa_id)
        .eq('provider', 'mercadopago')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setInvoice((data as Invoice | null) ?? null);
    };
    loadInvoice();
  }, [user?.empresa_id]);

  const qrSrc = useMemo(() => {
    const raw = String(invoice?.pix_qr_image || '').trim();
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;
    return `data:image/png;base64,${raw}`;
  }, [invoice?.pix_qr_image]);

  const createPix = async () => {
    if (!user?.empresa_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mp-pix-create', {
        body: { empresa_id: user.empresa_id, payer_email: user.email },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'failed');
      setInvoice(((data as { invoice?: Invoice | null })?.invoice as Invoice | null) ?? null);
    } catch (e) {
      const message = getErrorMessage(e);
      const desc = message ? `Não foi possível gerar o Pix: ${message}` : 'Não foi possível gerar o Pix.';
      toast({ title: 'Erro', description: desc, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyPix = async () => {
    const text = String(invoice?.pix_copy_paste || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: 'Pix Copia e Cola copiado.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardHeader>
            <CardTitle>Acesso suspenso</CardTitle>
            <CardDescription>Seu plano precisa ser renovado para continuar usando o sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium">{empresa?.nome || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium capitalize">{empresa?.billing_plan || 'free'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vencimento</span>
                <span className="font-medium">{due}</span>
              </div>
              {priceText ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">{priceText}</span>
                </div>
              ) : null}
            </div>

            {invoice?.pix_copy_paste ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Pague com Pix para liberar o acesso automaticamente.
                </div>
                {qrSrc ? (
                  <div className="flex justify-center">
                    <img src={qrSrc} alt="QR Code Pix" className="h-56 w-56 rounded-lg bg-white p-2" />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Pix Copia e Cola</div>
                  <Textarea value={invoice.pix_copy_paste} readOnly className="font-mono text-xs" />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => void copyPix()}>
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Gere um Pix para pagar e liberar o acesso automaticamente.
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => void createPix()} disabled={loading}>
                    {loading ? 'Gerando...' : 'Gerar Pix'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
              {empresa?.telefone ? (
                <Button
                  onClick={() => window.open(`https://wa.me/${String(empresa.telefone).replace(/\D/g, '')}`, '_blank')}
                >
                  Falar no WhatsApp
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => window.location.reload()}>
                Já paguei
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
