import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';

type Trend = number | null;

type DashboardStats = {
  totalLeads: number;
  totalLeadsTrend: Trend;
  atendimentosIa24h: number;
  atendimentosIa24hTrend: Trend;
  agendamentosSemana: number;
  agendamentosSemanaTrend: Trend;
  conversao30dPct: number;
  conversao30dTrend: Trend;
  resolvidosIa7d: number;
  aguardandoHumano: number;
  erros7d: number;
  eficienciaPct: number;
};

type ChartPoint = { name: string; atendimentos: number; leads: number };

type StatCardProps = {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  trend?: number | null;
};

const StatCard = ({ title, value, icon: Icon, description, trend }: StatCardProps) => (
  <Card className="overflow-hidden transition-all hover:shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="p-2 bg-primary/10 rounded-full">
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
        {trend !== null && trend !== undefined && (
          <span className={trend > 0 ? "text-success font-medium" : "text-destructive font-medium"}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        )}
        {description}
      </p>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const { user } = useAuth();
  const empresaId = user?.empresa_id ?? null;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    totalLeadsTrend: null,
    atendimentosIa24h: 0,
    atendimentosIa24hTrend: null,
    agendamentosSemana: 0,
    agendamentosSemanaTrend: null,
    conversao30dPct: 0,
    conversao30dTrend: null,
    resolvidosIa7d: 0,
    aguardandoHumano: 0,
    erros7d: 0,
    eficienciaPct: 0
  });

  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  const formatTrend = (trend: Trend) => {
    if (trend === null) return null;
    const rounded = Math.round(trend * 10) / 10;
    return Number.isFinite(rounded) ? rounded : null;
  };

  const formatNumber = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

  const calcTrend = (current: number, previous: number): Trend => {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    if (previous <= 0) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  };

  const isAbortError = (e: unknown) => {
    if (!e) return false;
    if (e instanceof DOMException && e.name === 'AbortError') return true;
    if (e instanceof Error && e.name === 'AbortError') return true;
    if (e instanceof Error && /aborted/i.test(e.message)) return true;
    return false;
  };

  const toDayKey = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const weekdayLabel = (d: Date) => {
    const raw = d.toLocaleDateString('pt-BR', { weekday: 'short' });
    return raw.replace('.', '').replace(/^\w/, (c) => c.toUpperCase());
  };

  const getPeriods = () => {
    const now = new Date();

    const start24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const prev24Start = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const start7 = new Date(now);
    start7.setDate(now.getDate() - 6);
    start7.setHours(0, 0, 0, 0);

    const start30 = new Date(now);
    start30.setDate(now.getDate() - 29);
    start30.setHours(0, 0, 0, 0);

    const prev30Start = new Date(start30);
    prev30Start.setDate(start30.getDate() - 30);

    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    const prevWeekStart = new Date(now);
    prevWeekStart.setDate(now.getDate() - 7);
    const prevWeekEnd = new Date(now);

    return { now, start24, prev24Start, start7, start30, prev30Start, weekEnd, prevWeekStart, prevWeekEnd };
  };

  type MsgRow = { created_at: string; direcao: 'in' | 'out' };
  type LeadRow = { created_at: string };

  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const scheduledRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scheduledRef.current) {
        window.clearTimeout(scheduledRef.current);
        scheduledRef.current = null;
      }
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!mountedRef.current) return;
    if (!empresaId) return;

    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;

    const { now, start24, prev24Start, start7, start30, prev30Start, weekEnd, prevWeekStart, prevWeekEnd } = getPeriods();

    try {
      if (mountedRef.current) setLoading(true);

      const [
        leadsTotalRes,
        leads30Res,
        leadsPrev30Res,
        ia24Res,
        iaPrev24Res,
        apptWeekRes,
        apptPrevWeekRes,
        convAppt30Res,
        convApptPrev30Res,
        contatosHumanoRes,
        ia7Res,
        erros7Res,
        totalMsgs7Res,
        msgs7Res,
        leads7Res
      ] = await Promise.all([
        supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).gte('created_at', start30.toISOString()),
        supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).gte('created_at', prev30Start.toISOString()).lt('created_at', start30.toISOString()),

        supabase
          .from('mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .not('ai_dispatched_at', 'is', null)
          .gte('created_at', start24.toISOString()),
        supabase
          .from('mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .not('ai_dispatched_at', 'is', null)
          .gte('created_at', prev24Start.toISOString())
          .lt('created_at', start24.toISOString()),

        supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .gte('data_hora', now.toISOString())
          .lt('data_hora', weekEnd.toISOString())
          .neq('status', 'Cancelado'),
        supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .gte('data_hora', prevWeekStart.toISOString())
          .lt('data_hora', prevWeekEnd.toISOString())
          .neq('status', 'Cancelado'),

        supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .gte('data_hora', start30.toISOString())
          .in('status', ['Confirmado', 'Concluído']),
        supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .gte('data_hora', prev30Start.toISOString())
          .lt('data_hora', start30.toISOString())
          .in('status', ['Confirmado', 'Concluído']),

        supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('atendimento_mode', 'humano'),
        supabase
          .from('mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .not('ai_dispatched_at', 'is', null)
          .gte('created_at', start7.toISOString()),
        supabase
          .from('mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('status', 'erro')
          .gte('created_at', start7.toISOString()),
        supabase.from('mensagens').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).gte('created_at', start7.toISOString()),

        supabase.from('mensagens').select('created_at,direcao').eq('empresa_id', empresaId).gte('created_at', start7.toISOString()),
        supabase.from('contatos').select('created_at').eq('empresa_id', empresaId).gte('created_at', start7.toISOString())
      ]);

      const totalLeads = leadsTotalRes.count || 0;
      const leads30 = leads30Res.count || 0;
      const leadsPrev30 = leadsPrev30Res.count || 0;

      const atendimentosIa24h = ia24Res.count || 0;
      const atendimentosIaPrev24h = iaPrev24Res.count || 0;

      const agendamentosSemana = apptWeekRes.count || 0;
      const agendamentosPrevSemana = apptPrevWeekRes.count || 0;

      const appt30 = convAppt30Res.count || 0;
      const apptPrev30 = convApptPrev30Res.count || 0;

      const conversao30dPct = leads30 > 0 ? (appt30 / leads30) * 100 : 0;
      const conversaoPrev30dPct = leadsPrev30 > 0 ? (apptPrev30 / leadsPrev30) * 100 : 0;

      const aguardandoHumano = contatosHumanoRes.count || 0;
      const resolvidosIa7d = ia7Res.count || 0;
      const erros7d = erros7Res.count || 0;
      const totalMsgs7d = totalMsgs7Res.count || 0;
      const eficienciaPct = totalMsgs7d > 0 ? Math.max(0, Math.min(100, (1 - erros7d / totalMsgs7d) * 100)) : 0;

      const msgs = ((msgs7Res.data as unknown) as MsgRow[] | null) || [];
      const leads = ((leads7Res.data as unknown) as LeadRow[] | null) || [];

      const dayMap = new Map<string, { atendimentos: number; leads: number }>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(start7);
        d.setDate(start7.getDate() + i);
        dayMap.set(toDayKey(d), { atendimentos: 0, leads: 0 });
      }

      for (const m of msgs) {
        const d = new Date(m.created_at);
        const key = toDayKey(d);
        const entry = dayMap.get(key);
        if (!entry) continue;
        if (m.direcao === 'in') entry.atendimentos += 1;
      }

      for (const c of leads) {
        const d = new Date(c.created_at);
        const key = toDayKey(d);
        const entry = dayMap.get(key);
        if (!entry) continue;
        entry.leads += 1;
      }

      const nextChartData: ChartPoint[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start7);
        d.setDate(start7.getDate() + i);
        const key = toDayKey(d);
        const entry = dayMap.get(key) || { atendimentos: 0, leads: 0 };
        nextChartData.push({ name: weekdayLabel(d), atendimentos: entry.atendimentos, leads: entry.leads });
      }

      if (!mountedRef.current) return;

      setStats({
        totalLeads,
        totalLeadsTrend: calcTrend(leads30, leadsPrev30),
        atendimentosIa24h,
        atendimentosIa24hTrend: calcTrend(atendimentosIa24h, atendimentosIaPrev24h),
        agendamentosSemana,
        agendamentosSemanaTrend: calcTrend(agendamentosSemana, agendamentosPrevSemana),
        conversao30dPct,
        conversao30dTrend: conversaoPrev30dPct > 0 ? ((conversao30dPct - conversaoPrev30dPct) / conversaoPrev30dPct) * 100 : null,
        resolvidosIa7d,
        aguardandoHumano,
        erros7d,
        eficienciaPct
      });

      setChartData(nextChartData);
      setLoading(false);
    } catch (e) {
      if (isAbortError(e)) return;
      if (!mountedRef.current) return;
      setLoading(false);
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        queueMicrotask(() => {
          if (!mountedRef.current) return;
          loadDashboard();
        });
      }
    }
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;

    loadDashboard();

    const scheduleReload = () => {
      if (scheduledRef.current) return;
      scheduledRef.current = window.setTimeout(() => {
        scheduledRef.current = null;
        loadDashboard();
      }, 250);
    };

    const channel = supabase
      .channel(`dashboard:${empresaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos', filter: `empresa_id=eq.${empresaId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', filter: `empresa_id=eq.${empresaId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: `empresa_id=eq.${empresaId}` }, scheduleReload)
      .subscribe();

    return () => {
      if (scheduledRef.current) {
        window.clearTimeout(scheduledRef.current);
        scheduledRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [empresaId, loadDashboard]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo ao seu Super CRM. Aqui está o resumo do seu negócio.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total de Leads" 
            value={loading ? '—' : formatNumber(stats.totalLeads)} 
            icon={Users} 
            description="últimos 30 dias vs anterior"
            trend={formatTrend(stats.totalLeadsTrend)}
          />
          <StatCard 
            title="Atendimentos IA" 
            value={loading ? '—' : formatNumber(stats.atendimentosIa24h)} 
            icon={Zap} 
            description="nas últimas 24h"
            trend={formatTrend(stats.atendimentosIa24hTrend)}
          />
          <StatCard 
            title="Agendamentos" 
            value={loading ? '—' : formatNumber(stats.agendamentosSemana)} 
            icon={CalendarIcon} 
            description="para esta semana"
            trend={formatTrend(stats.agendamentosSemanaTrend)}
          />
          <StatCard 
            title="Conversão" 
            value={loading ? '—' : `${(Math.round(stats.conversao30dPct * 10) / 10).toFixed(1)}%`} 
            icon={TrendingUp} 
            description="últimos 30 dias"
            trend={formatTrend(stats.conversao30dTrend)}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Volume de Atendimentos vs Leads</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pl-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAtend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Area type="monotone" dataKey="atendimentos" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorAtend)" strokeWidth={2} />
                  <Area type="monotone" dataKey="leads" stroke="hsl(var(--success))" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Status dos Atendimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-success/10 rounded-full">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">Resolvidos pela IA</p>
                    <p className="text-xs text-muted-foreground">últimos 7 dias</p>
                  </div>
                  <div className="font-medium text-sm">{loading ? '—' : formatNumber(stats.resolvidosIa7d)}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-warning/10 rounded-full">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">Aguardando Humano</p>
                    <p className="text-xs text-muted-foreground">conversas em modo humano</p>
                  </div>
                  <div className="font-medium text-sm">{loading ? '—' : formatNumber(stats.aguardandoHumano)}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-destructive/10 rounded-full">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">Falhas/Erros</p>
                    <p className="text-xs text-muted-foreground">mensagens com erro (7 dias)</p>
                  </div>
                  <div className="font-medium text-sm">{loading ? '—' : formatNumber(stats.erros7d)}</div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t">
                <h4 className="text-sm font-medium mb-4">Eficiência da IA</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Taxa de Acerto</span>
                    <span className="font-bold">{loading ? '—' : `${Math.round(stats.eficienciaPct)}%`}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.round(stats.eficienciaPct)}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
