import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  Users, 
  Server, 
  Activity,
  CalendarDays,
  FileText
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const StatCard = ({ title, value, icon: Icon, description, trend }: any) => (
  <Card className="overflow-hidden transition-all hover:shadow-lg bg-card/50 backdrop-blur-sm border-primary/10">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="p-2 bg-primary/10 rounded-full">
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
        {trend && (
          <span className={trend > 0 ? "text-success font-medium" : "text-destructive font-medium"}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        )}
        {description}
      </p>
    </CardContent>
  </Card>
);

type AdminStats = {
  empresasAtivas: number;
  empresasNovas30d: number;
  empresasTrend: number | null;
  usuariosTotais: number;
  usuariosNovos7d: number;
  usuariosTrend: number | null;
  conexoesConectadas: number;
  conexoesTotal: number;
  conexoesTrend: number | null;
  mensagens24h: number;
  mensagensErro24h: number;
  mensagensTrend: number | null;
  agendamentosHoje: number;
  orcamentosPendentes: number;
  apiMs: number | null;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value > 999) return 999;
  if (value < -999) return -999;
  return Math.round(value * 10) / 10;
}

function pctChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return current > 0 ? 100 : 0;
  return clampPercent(((current - previous) / previous) * 100);
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [apiOnline, setApiOnline] = useState(true);
  const [empresas6m, setEmpresas6m] = useState<Array<{ created_at: string }>>([]);
  const [conexoesStatus, setConexoesStatus] = useState<Array<{ status: string | null }>>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const now = new Date();
      const msStart = performance.now();
      try {
        const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
        const start60d = new Date(now.getTime() - 60 * 24 * 60 * 60_000).toISOString();
        const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
        const start14d = new Date(now.getTime() - 14 * 24 * 60 * 60_000).toISOString();
        const start24h = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
        const start48h = new Date(now.getTime() - 48 * 60 * 60_000).toISOString();

        const start6m = new Date(now);
        start6m.setMonth(start6m.getMonth() - 5);
        start6m.setDate(1);
        start6m.setHours(0, 0, 0, 0);
        const start6mIso = start6m.toISOString();

        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);
        const endToday = new Date(startToday);
        endToday.setDate(endToday.getDate() + 1);

        const [
          empresasAtivasRes,
          empresasNovas30Res,
          empresasNovasPrev30Res,
          usuariosTotalRes,
          usuariosNovos7Res,
          usuariosNovosPrev7Res,
          conexoesTotalRes,
          conexoesConectadasRes,
          conexoesConectadasPrevRes,
          mensagens24Res,
          mensagensPrev24Res,
          mensagensErro24Res,
          agHojeRes,
          orcPendRes,
          empresas6mRes,
          conexoesStatusRes
        ] = await Promise.all([
          supabase.from('empresas').select('id', { count: 'exact', head: true }).eq('ativa', true),
          supabase.from('empresas').select('id', { count: 'exact', head: true }).gte('created_at', start30d),
          supabase.from('empresas').select('id', { count: 'exact', head: true }).gte('created_at', start60d).lt('created_at', start30d),
          supabase.from('usuarios').select('id', { count: 'exact', head: true }),
          supabase.from('usuarios').select('id', { count: 'exact', head: true }).gte('created_at', start7d),
          supabase.from('usuarios').select('id', { count: 'exact', head: true }).gte('created_at', start14d).lt('created_at', start7d),
          supabase.from('conexoes').select('id', { count: 'exact', head: true }),
          supabase.from('conexoes').select('id', { count: 'exact', head: true }).eq('status', 'conectado'),
          supabase.from('conexoes').select('id', { count: 'exact', head: true }).eq('status', 'conectado').lte('created_at', start24h),
          supabase.from('mensagens').select('id', { count: 'exact', head: true }).gte('created_at', start24h).eq('direcao', 'in'),
          supabase.from('mensagens').select('id', { count: 'exact', head: true }).gte('created_at', start48h).lt('created_at', start24h).eq('direcao', 'in'),
          supabase.from('mensagens').select('id', { count: 'exact', head: true }).gte('created_at', start24h).eq('status', 'erro'),
          supabase.from('agendamentos').select('id', { count: 'exact', head: true }).gte('data_hora', startToday.toISOString()).lt('data_hora', endToday.toISOString()),
          supabase.from('orcamentos').select('id', { count: 'exact', head: true }).eq('status', 'Pendente'),
          supabase.from('empresas').select('created_at').gte('created_at', start6mIso).order('created_at', { ascending: true }),
          supabase.from('conexoes').select('status')
        ]);

        const msElapsed = Math.round(performance.now() - msStart);

        const empresasAtivas = empresasAtivasRes.count || 0;
        const empresasNovas30d = empresasNovas30Res.count || 0;
        const empresasPrev30d = empresasNovasPrev30Res.count || 0;

        const usuariosTotais = usuariosTotalRes.count || 0;
        const usuariosNovos7d = usuariosNovos7Res.count || 0;
        const usuariosPrev7d = usuariosNovosPrev7Res.count || 0;

        const conexoesTotal = conexoesTotalRes.count || 0;
        const conexoesConectadas = conexoesConectadasRes.count || 0;
        const conexoesPrev = conexoesConectadasPrevRes.count || 0;

        const mensagens24h = mensagens24Res.count || 0;
        const mensagensPrev24h = mensagensPrev24Res.count || 0;
        const mensagensErro24h = mensagensErro24Res.count || 0;

        const agendamentosHoje = agHojeRes.count || 0;
        const orcamentosPendentes = orcPendRes.count || 0;

        if (!mounted) return;
        setApiOnline(true);
        setStats({
          empresasAtivas,
          empresasNovas30d,
          empresasTrend: pctChange(empresasNovas30d, empresasPrev30d),
          usuariosTotais,
          usuariosNovos7d,
          usuariosTrend: pctChange(usuariosNovos7d, usuariosPrev7d),
          conexoesConectadas,
          conexoesTotal,
          conexoesTrend: pctChange(conexoesConectadas, conexoesPrev),
          mensagens24h,
          mensagensErro24h,
          mensagensTrend: pctChange(mensagens24h, mensagensPrev24h),
          agendamentosHoje,
          orcamentosPendentes,
          apiMs: msElapsed,
        });
        setEmpresas6m((empresas6mRes.data || []) as any);
        setConexoesStatus((conexoesStatusRes.data || []) as any);
      } catch {
        if (!mounted) return;
        setApiOnline(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const empresasChartData = useMemo(() => {
    const now = new Date();
    const months: Array<{ key: string; label: string; value: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      months.push({ key, label, value: 0 });
    }
    const index = new Map(months.map(m => [m.key, m]));
    for (const e of empresas6m) {
      const dt = new Date(e.created_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const ref = index.get(key);
      if (ref) ref.value += 1;
    }
    return months.map(m => ({ name: m.label, empresas: m.value }));
  }, [empresas6m]);

  const conexoesPieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of conexoesStatus) {
      const key = String(c.status || 'desconhecido');
      map.set(key, (map.get(key) || 0) + 1);
    }
    const entries = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    entries.sort((a, b) => b.value - a.value);
    return entries;
  }, [conexoesStatus]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
          <p className="text-muted-foreground">Visão geral do ecossistema Super CRM.</p>
        </div>

        {/* Admin Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Empresas Ativas" 
            value={stats ? String(stats.empresasAtivas) : '—'} 
            icon={Building2} 
            description={stats ? `novas 30d: ${stats.empresasNovas30d}` : 'carregando...'}
            trend={stats?.empresasTrend}
          />
          <StatCard 
            title="Usuários Totais" 
            value={stats ? stats.usuariosTotais.toLocaleString('pt-BR') : '—'} 
            icon={Users} 
            description={stats ? `novos 7d: ${stats.usuariosNovos7d}` : 'carregando...'}
            trend={stats?.usuariosTrend}
          />
          <StatCard 
            title="Instâncias WhatsApp" 
            value={stats ? `${stats.conexoesConectadas}/${stats.conexoesTotal}` : '—'} 
            icon={Server} 
            description="conectadas"
            trend={stats?.conexoesTrend}
          />
          <StatCard 
            title="Mensagens (24h)" 
            value={stats ? stats.mensagens24h.toLocaleString('pt-BR') : '—'} 
            icon={Activity} 
            description={stats ? `erros: ${stats.mensagensErro24h}` : 'carregando...'}
            trend={stats?.mensagensTrend}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Novas Empresas (6 meses)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pl-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={empresasChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--secondary))', opacity: 0.1}}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Bar dataKey="empresas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Conexões por Status</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conexoesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {conexoesPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {conexoesPieData.slice(0, 5).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Status da API</CardTitle>
              <Activity className={`h-4 w-4 ${apiOnline ? 'text-success' : 'text-destructive'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{apiOnline ? 'Online' : 'Offline'}</div>
              <p className="text-xs text-muted-foreground">{stats?.apiMs ? `Latência: ${stats.apiMs}ms` : '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
              <CalendarDays className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats ? stats.agendamentosHoje.toLocaleString('pt-BR') : '—'}</div>
              <p className="text-xs text-muted-foreground">total em todas as empresas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Orçamentos Pendentes</CardTitle>
              <FileText className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats ? stats.orcamentosPendentes.toLocaleString('pt-BR') : '—'}</div>
              <p className="text-xs text-muted-foreground">status Pendente</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
