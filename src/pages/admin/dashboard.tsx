import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Building2, 
  Users, 
  Server, 
  DollarSign, 
  TrendingUp,
  Activity,
  Globe,
  Settings
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

const empresaData = [
  { name: 'Empresa A', faturamento: 4500 },
  { name: 'Empresa B', faturamento: 5200 },
  { name: 'Empresa C', faturamento: 3800 },
  { name: 'Empresa D', faturamento: 6100 },
  { name: 'Empresa E', faturamento: 2500 },
];

const planoData = [
  { name: 'Free', value: 400 },
  { name: 'Basic', value: 300 },
  { name: 'Pro', value: 300 },
  { name: 'Ultra', value: 200 },
];

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

export default function AdminDashboard() {
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
            value="156" 
            icon={Building2} 
            description="desde o mês passado"
            trend={12.5}
          />
          <StatCard 
            title="Usuários Totais" 
            value="1,452" 
            icon={Users} 
            description="nas últimas 24h"
            trend={8.2}
          />
          <StatCard 
            title="Instâncias WhatsApp" 
            value="242" 
            icon={Server} 
            description="em funcionamento"
            trend={5.4}
          />
          <StatCard 
            title="MRR (Faturamento)" 
            value="R$ 15.420" 
            icon={DollarSign} 
            description="recorrência mensal"
            trend={4.1}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Crescimento por Empresa</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pl-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={empresaData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--secondary))', opacity: 0.1}}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Bar dataKey="faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Distribuição de Planos</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {planoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {planoData.map((entry, index) => (
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
              <Activity className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Online</div>
              <p className="text-xs text-muted-foreground">Uptime: 99.98%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Servidores</CardTitle>
              <Globe className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4 Ativos</div>
              <p className="text-xs text-muted-foreground">Latência média: 45ms</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Configurações</CardTitle>
              <Settings className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Sistema</div>
              <p className="text-xs text-muted-foreground">Versão: 2.5.0-PRO</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
