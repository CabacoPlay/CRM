import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, BellRing, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { planLabel } from '@/lib/billing-plans';

type EmpresaRow = {
  id: string;
  nome: string;
  responsavel: string | null;
  telefone: string | null;
  billing_enabled: boolean;
  billing_plan: string | null;
  billing_due_date: string | null;
  billing_grace_days: number | null;
  billing_status: string | null;
  billing_price_cents: number | null;
  billing_currency: string | null;
};

type EventRow = {
  id: string;
  empresa_id: string;
  type: string;
  detail: string | null;
  created_at: string;
  empresa_nome?: string;
};

function priceToText(cents: number | null | undefined, currency: string | null | undefined) {
  if (!cents || cents <= 0) return '—';
  const v = (cents || 0) / 100;
  const cur = currency || 'BRL';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: cur });
}

export default function AdminPlanosFaturas() {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const [emp, ev] = await Promise.all([
        supabase.from('empresas').select('id,nome,responsavel,telefone,billing_enabled,billing_plan,billing_due_date,billing_grace_days,billing_status,billing_price_cents,billing_currency').order('nome', { ascending: true }),
        supabase.from('billing_events').select('id,empresa_id,type,detail,created_at').order('created_at', { ascending: false }).limit(50),
      ]);
      const empresas = (emp.data || []) as EmpresaRow[];
      const events = (ev.data || []) as EventRow[];
      const nameMap = new Map(empresas.map(e => [e.id, e.nome]));
      setEmpresas(empresas);
      setEvents(events.map(x => ({ ...x, empresa_nome: nameMap.get(x.empresa_id) })));
      setLoading(false);
    };
    run();
  }, []);

  const filteredEmpresas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter(e => e.nome.toLowerCase().includes(q));
  }, [empresas, search]);

  const resend = async (empresaId: string) => {
    try {
      setActionLoading(empresaId + ':notify');
      await supabase.functions.invoke('billing-ops', { body: { action: 'notify', empresa_id: empresaId } });
    } finally {
      setActionLoading(null);
    }
  };

  const reactivate = async (empresaId: string) => {
    try {
      setActionLoading(empresaId + ':reactivate');
      await supabase.functions.invoke('billing-ops', { body: { action: 'reactivate', empresa_id: empresaId } });
      await supabase.functions.invoke('whatsapp-sync-status', { body: { force: true } }).catch(() => {});
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold">Planos & Faturas</div>
            <div className="text-muted-foreground">Status, próximos vencimentos e ações rápidas</div>
          </div>
          <div className="relative w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa..." className="pl-9" />
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Carência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="w-48">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && filteredEmpresas.map(e => {
                const due = e.billing_due_date ? new Date(e.billing_due_date).toLocaleDateString('pt-BR') : '—';
                const status = String(e.billing_status || 'active');
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell>{e.billing_enabled ? planLabel(e.billing_plan) : '—'}</TableCell>
                    <TableCell>{e.billing_enabled ? due : '—'}</TableCell>
                    <TableCell>{e.billing_enabled ? String(e.billing_grace_days ?? '—') : '—'}</TableCell>
                    <TableCell>
                      {e.billing_enabled ? (
                        <Badge variant={status === 'suspended' ? 'disconnected' : 'success'}>
                          {status}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{priceToText(e.billing_price_cents, e.billing_currency)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => resend(e.id)} disabled={actionLoading === e.id + ':notify' || !e.billing_enabled}>
                          <BellRing className="h-4 w-4 mr-1" />
                          Reenviar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reactivate(e.id)} disabled={actionLoading === e.id + ':reactivate' || !e.billing_enabled}>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reativar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eventos recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(ev => (
                  <TableRow key={ev.id}>
                    <TableCell>{new Date(ev.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{ev.empresa_nome || ev.empresa_id}</TableCell>
                    <TableCell>{ev.type}</TableCell>
                    <TableCell>{ev.detail || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
