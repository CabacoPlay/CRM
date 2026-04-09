import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Loader2, QrCode, RefreshCcw } from 'lucide-react';

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

function formatSecondsLeft(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

function isBillingUnblocked(data: EmpresaBilling | null) {
  const plan = String(data?.billing_plan || 'free').toLowerCase();
  if (plan === 'free') return true;
  const enabled = Boolean(data?.billing_enabled);
  if (!enabled) return true;
  const status = String(data?.billing_status || 'active').toLowerCase();
  const dueRaw = data?.billing_due_date || null;
  const grace = Number(data?.billing_grace_days ?? 3);

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

  return status !== 'suspended' && !expired;
}

export default function PagamentoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<EmpresaBilling | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const pollRef = useRef<number | null>(null);
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

  const expiresInText = useMemo(() => {
    const exp = invoice?.expires_at ? Date.parse(invoice.expires_at) : NaN;
    if (!Number.isFinite(exp)) return null;
    const sec = Math.max(0, Math.floor((exp - Date.now()) / 1000));
    return formatSecondsLeft(sec);
  }, [invoice?.expires_at]);

  const reloadEmpresa = async () => {
    if (!user?.empresa_id) return null;
    const { data } = await supabase
      .from('empresas')
      .select('id,nome,telefone,responsavel,billing_enabled,billing_plan,billing_due_date,billing_grace_days,billing_status,billing_price_cents,billing_currency')
      .eq('id', user.empresa_id)
      .maybeSingle();
    const row = (data as EmpresaBilling | null) ?? null;
    setEmpresa(row);
    return row;
  };

  const reloadInvoice = async () => {
    if (!user?.empresa_id) return null;
    const { data } = await supabase
      .from('billing_invoices')
      .select('id,empresa_id,provider,provider_txid,amount_cents,currency,status,expires_at,pix_copy_paste,pix_qr_image,created_at')
      .eq('empresa_id', user.empresa_id)
      .eq('provider', 'mercadopago')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = (data as Invoice | null) ?? null;
    setInvoice(row);
    return row;
  };

  const checkPayment = async (opts?: { silent?: boolean }) => {
    if (!user?.empresa_id) return;
    setChecking(true);
    try {
      const nextEmpresa = await reloadEmpresa();
      await reloadInvoice();
      if (isBillingUnblocked(nextEmpresa)) {
        setPaid(true);
        setRedirecting(true);
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        if (!opts?.silent) {
          toast({ title: 'Pagamento confirmado', description: 'Acesso liberado. Redirecionando…' });
        }
        window.setTimeout(() => {
          navigate('/app/dashboard', { replace: true });
        }, 1400);
      } else {
        if (!opts?.silent) {
          toast({
            title: 'Ainda não confirmou',
            description: 'Assim que o pagamento for confirmado, o acesso será liberado automaticamente.',
          });
        }
      }
    } catch (e) {
      const message = getErrorMessage(e);
      if (!opts?.silent) {
        toast({ title: 'Erro', description: message || 'Não foi possível verificar o pagamento.', variant: 'destructive' });
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!user?.empresa_id) return;
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      void checkPayment({ silent: true });
    }, 8000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empresa_id]);

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
      <div className="max-w-3xl mx-auto space-y-4 px-2 sm:px-0">
        <Card className="overflow-hidden border-primary/10">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  {paid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <QrCode className="h-5 w-5" />}
                  {paid ? 'Pagamento confirmado' : 'Renove seu plano'}
                </CardTitle>
                <CardDescription>
                  {paid
                    ? 'Acesso liberado. Você será redirecionado automaticamente.'
                    : 'Pague com Pix para liberar o acesso automaticamente.'}
                </CardDescription>
              </div>
              {redirecting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecionando…
                </div>
              ) : null}
            </div>
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

            {paid ? (
              <div className="rounded-lg border bg-emerald-500/5 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">Tudo certo!</div>
                    <div className="text-sm text-muted-foreground">
                      Se não redirecionar automaticamente, clique em “Já paguei”.
                    </div>
                  </div>
                </div>
              </div>
            ) : invoice?.pix_copy_paste ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">QR Code</div>
                      {expiresInText ? <div className="text-xs text-muted-foreground">Expira em {expiresInText}</div> : null}
                    </div>
                    <div className="mt-3 flex justify-center">
                      {qrSrc ? (
                        <img src={qrSrc} alt="QR Code Pix" className="h-56 w-56 rounded-lg bg-white p-2 shadow-sm" />
                      ) : (
                        <div className="h-56 w-56 rounded-lg border bg-background flex items-center justify-center text-sm text-muted-foreground">
                          QR indisponível
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-4 flex flex-col">
                    <div className="text-sm font-medium">Pix Copia e Cola</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Copie e cole no seu banco para pagar.
                    </div>
                    <div className="mt-3 flex-1">
                      <Textarea value={invoice.pix_copy_paste} readOnly className="font-mono text-xs min-h-[196px]" />
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="outline" onClick={() => void copyPix()} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Gere um Pix para pagar e liberar o acesso automaticamente.
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => void createPix()} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    {loading ? 'Gerando...' : 'Gerar Pix'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
              <Button
                onClick={() => void checkPayment()}
                disabled={checking || loading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Já paguei
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
