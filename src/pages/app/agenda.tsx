import React, { useCallback, useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Clock, 
  User, 
  Phone, 
  Bot,
  CheckCircle2,
  CalendarDays,
  MoreVertical,
  Settings,
  Trash2,
  Loader2,
  Check,
  X,
  Calendar as CalendarIcon
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface Agendamento {
  id: string;
  nome_cliente: string;
  contato_cliente: string;
  servico: string;
  data_hora: string;
  status: 'Pendente' | 'Confirmado' | 'Concluído' | 'Cancelado';
  origem: 'IA' | 'Manual';
  empresa_id: string;
  created_by_user_id?: string | null;
}

type AgendaSettings = {
  empresa_id: string;
  timezone: string;
  schedule: Record<string, { open: string; close: string }>;
  slot_interval_minutes: number;
  min_advance_minutes: number;
  max_advance_days: number;
  reminder_hours: number;
  confirm_template: string | null;
};

const DEFAULT_SCHEDULE: AgendaSettings['schedule'] = {
  mon: { open: '08:00', close: '18:00' },
  tue: { open: '08:00', close: '18:00' },
  wed: { open: '08:00', close: '18:00' },
  thu: { open: '08:00', close: '18:00' },
  fri: { open: '08:00', close: '18:00' },
  sat: { open: '09:00', close: '13:00' },
  sun: { open: '00:00', close: '00:00' },
};

const DAY_LABELS: Record<string, string> = {
  mon: 'SEG',
  tue: 'TER',
  wed: 'QUA',
  thu: 'QUI',
  fri: 'SEX',
  sat: 'SÁB',
  sun: 'DOM',
};

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function AgendaPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [monthSummary, setMonthSummary] = useState<Record<string, { total: number; confirmed: number }>>({});

  type NovoAgendamentoForm = {
    nome_cliente: string;
    contato_cliente: string;
    servico: string;
    hora: string;
    status: 'Confirmado' | 'Pendente';
  };
  const [formData, setFormData] = useState<NovoAgendamentoForm>({
    nome_cliente: '',
    contato_cliente: '',
    servico: '',
    hora: '09:00',
    status: 'Confirmado',
  });
  // Busca de contato integrada ao campo "Nome do Cliente"
  const [contactResults, setContactResults] = useState<Array<{ id: string; nome: string; contato: string }>>([]);
  const [contactSearching, setContactSearching] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const [settings, setSettings] = useState<AgendaSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.empresa_id) return;
      const { data } = await supabase
        .from('agenda_settings')
        .select('empresa_id,timezone,schedule,slot_interval_minutes,min_advance_minutes,max_advance_days,reminder_hours,confirm_template')
        .eq('empresa_id', user.empresa_id)
        .maybeSingle();
      if (data) {
        const s = data as unknown as AgendaSettings;
        if (!s.schedule || typeof s.schedule !== 'object') s.schedule = DEFAULT_SCHEDULE;
        setSettings(s);
      } else {
        setSettings({
          empresa_id: user.empresa_id,
          timezone: 'America/Sao_Paulo',
          schedule: DEFAULT_SCHEDULE,
          slot_interval_minutes: 30,
          min_advance_minutes: 60,
          max_advance_days: 60,
          reminder_hours: 24,
          confirm_template: null,
        });
      }
    };
    loadSettings();
  }, [user?.empresa_id]);

  const saveSettings = async () => {
    if (!user?.empresa_id || !settings) return;
    setSettingsSaving(true);
    try {
      const payload = {
        ...settings,
        empresa_id: user.empresa_id,
      };
      await supabase.from('agenda_settings').upsert(payload, { onConflict: 'empresa_id' });
      toast({ title: 'Salvo', description: 'Configurações da agenda atualizadas.' });
      setIsSettingsOpen(false);
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível salvar as configurações.', variant: 'destructive' });
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    const q = (formData.nome_cliente || '').trim();
    if (!user?.empresa_id || q.length < 2) {
      setContactResults([]);
      return;
    }
    let disposed = false;
    const run = async () => {
      setContactSearching(true);
      try {
        const onlyDigits = q.replace(/\D/g, '');
        let sel = supabase
          .from('contatos')
          .select('id,nome,contato')
          .eq('empresa_id', user.empresa_id)
          .order('updated_at', { ascending: false })
          .limit(20);
        if (onlyDigits) {
          sel = sel.or(`nome.ilike.%${q}%,contato.ilike.%${onlyDigits}%`);
        } else {
          sel = sel.or(`nome.ilike.%${q}%,contato.ilike.%${q}%`);
        }
        const { data } = await sel;
        if (!disposed) setContactResults((data || []) as Array<{ id: string; nome: string; contato: string }>);
      } finally {
        if (!disposed) setContactSearching(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => {
      disposed = true;
      clearTimeout(t);
    };
  }, [formData.nome_cliente, user?.empresa_id]);

  useEffect(() => {
    if (date) setCalendarMonth(date);
  }, [date]);

  const dateKeyInSP = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const fetchAgendamentos = useCallback(async () => {
    if (!user?.empresa_id || !date) return;
    
    try {
      setLoading(true);
      
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('empresa_id', user.empresa_id)
        .gte('data_hora', start.toISOString())
        .lt('data_hora', end.toISOString())
        .order('data_hora', { ascending: true });

      if (error) {
        console.error('Erro Supabase:', error);
        throw error;
      }

      setAgendamentos(((data as unknown) as Agendamento[]) || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os agendamentos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [date, toast, user?.empresa_id]);

  const fetchMonthSummary = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      const monthKey = dateKeyInSP(calendarMonth).slice(0, 7);
      const year = Number(monthKey.slice(0, 4));
      const monthIndex = Number(monthKey.slice(5, 7)) - 1;
      const startUtc = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
      const endUtc = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));

      const { data, error } = await supabase
        .from('agendamentos')
        .select('data_hora,status')
        .eq('empresa_id', user.empresa_id)
        .gte('data_hora', startUtc.toISOString())
        .lt('data_hora', endUtc.toISOString())
        .neq('status', 'Cancelado');

      if (error) throw error;

      const summary: Record<string, { total: number; confirmed: number }> = {};
      const rows = (data ?? []) as Array<{ data_hora: string; status: Agendamento['status'] }>;
      for (const row of rows) {
        const k = dateKeyInSP(new Date(row.data_hora));
        if (!k.startsWith(monthKey)) continue;
        const prev = summary[k] || { total: 0, confirmed: 0 };
        prev.total += 1;
        if (row.status === 'Confirmado') prev.confirmed += 1;
        summary[k] = prev;
      }

      setMonthSummary(summary);
    } catch (error) {
      console.error('Erro ao carregar resumo do mês:', error);
      setMonthSummary({});
    }
  }, [calendarMonth, user?.empresa_id]);

  useEffect(() => {
    if (!user?.empresa_id) return;
    void fetchMonthSummary();
  }, [fetchMonthSummary, user?.empresa_id]);

  useEffect(() => {
    if (!user?.empresa_id) return;
    void fetchAgendamentos();
  }, [fetchAgendamentos, user?.empresa_id]);

  useEffect(() => {
    if (!user?.empresa_id) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamentos',
          filter: `empresa_id=eq.${user.empresa_id}`,
        },
        () => {
          void fetchAgendamentos();
          void fetchMonthSummary();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAgendamentos, fetchMonthSummary, user?.empresa_id]);

  const invokeAppointments = async <T,>(payload: Record<string, unknown>): Promise<T> => {
    const token = localStorage.getItem('session_token') || '';
    const baseUrl = (supabase as unknown as { supabaseUrl?: string })?.supabaseUrl;
    const url = `${String(baseUrl || '').replace(/\/$/, '')}/functions/v1/ia-appointment-setter`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    const parsed = (() => {
      try {
        return JSON.parse(text) as { message?: unknown; error?: unknown } | null;
      } catch (e) {
        return null;
      }
    })();

    if (!res.ok) {
      const msg = String(parsed?.message ?? parsed?.error ?? '').trim() || text.trim() || `Erro (HTTP ${res.status})`;
      throw new Error(msg);
    }

    return (parsed ?? (text as unknown)) as T;
  };

  const handleCreateAgendamento = async () => {
    if (!user?.empresa_id || !date) return;
    
    try {
      setSubmitting(true);
      
      const [hours, minutes] = formData.hora.split(':');
      const dataHora = new Date(date);
      dataHora.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await invokeAppointments({
        action: 'create_manual',
        params: {
          nome_cliente: formData.nome_cliente,
          contato_cliente: formData.contato_cliente,
          servico: formData.servico,
          data_hora: dataHora.toISOString(),
          status: formData.status,
        },
      });

      toast({
        title: "Sucesso",
        description: "Agendamento criado com sucesso!"
      });
      
      setIsModalOpen(false);
      setFormData({
        nome_cliente: '',
        contato_cliente: '',
        servico: '',
        hora: '09:00',
        status: 'Confirmado',
      });
      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      const msg = String((error as { message?: unknown })?.message ?? '').trim();
      toast({
        title: "Erro",
        description: msg || "Não foi possível criar o agendamento.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAgendamento = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

    try {
      await invokeAppointments({
        action: 'delete_appointment_by_id',
        params: { id },
      });

      setAgendamentos(prev => prev.filter(a => a.id !== id));
      toast({
        title: "Sucesso",
        description: "Agendamento removido."
      });
    } catch (error) {
      console.error('Erro ao deletar:', error);
      const msg = String((error as { message?: unknown })?.message ?? '').trim();
      toast({
        title: "Erro",
        description: msg || "Não foi possível excluir.",
        variant: "destructive"
      });
    }
  };

  const updateStatus = async (id: string, newStatus: Agendamento['status']) => {
    try {
      if (newStatus === 'Cancelado') {
        await invokeAppointments({
          action: 'cancel_appointment_by_id',
          params: { id },
        });
      } else {
        await invokeAppointments({
          action: 'update_status_by_id',
          params: { id, status: newStatus },
        });
      }

      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      toast({
        title: "Status Atualizado",
        description: `Agendamento marcado como ${newStatus}.`
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      const msg = String((error as { message?: unknown })?.message ?? '').trim();
      const permissionMessage = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('não autorizado') || msg.toLowerCase().includes('sem permissão') || msg.toLowerCase().includes('apenas admin') || msg.toLowerCase().includes('só pode');
      toast({
        title: "Erro",
        description: permissionMessage ? (msg || "Sem permissão para alterar este agendamento.") : (msg || "Não foi possível atualizar o status."),
        variant: "destructive"
      });
    }
  };

  const formatTime = (isoString: string) => {
    // Forçar a exibição do horário local de Brasília para evitar confusão de fuso
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500 px-2 sm:px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agenda & Serviços</h1>
            <p className="text-muted-foreground">Gerencie seus compromissos e deixe a IA agendar por você.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setIsSettingsOpen(true)} className="w-full sm:w-auto">
              <Settings className="h-4 w-4 mr-2" /> Configurações
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Card */}
          <Card className="lg:col-span-1 shadow-md border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary font-bold">
                <CalendarDays className="h-5 w-5" />
                Selecione a Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-2 px-2">
                <Calendar
                  mode="single"
                  selected={date}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  onSelect={(d) => {
                    setDate(d);
                    if (d) setCalendarMonth(d);
                  }}
                  className="rounded-md border shadow-sm mx-auto min-w-[320px]"
                  modifiers={{
                    hasConfirmed: (d) => {
                      const k = dateKeyInSP(d);
                      return (monthSummary[k]?.confirmed ?? 0) > 0;
                    },
                    hasAppointments: (d) => {
                      const k = dateKeyInSP(d);
                      const total = monthSummary[k]?.total ?? 0;
                      const confirmed = monthSummary[k]?.confirmed ?? 0;
                      return total > 0 && confirmed === 0;
                    },
                  }}
                  modifiersClassNames={{
                    hasConfirmed: 'bg-success/15 text-success font-bold hover:bg-success/20',
                    hasAppointments: 'bg-amber-500/15 text-amber-400 font-bold hover:bg-amber-500/20',
                  }}
                />
              </div>
              
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Resumo do Dia</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-center">
                    <p className="text-3xl font-black text-primary">{agendamentos.length}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Compromissos</p>
                  </div>
                  <div className="p-4 bg-success/5 rounded-xl border border-success/10 text-center">
                    <p className="text-3xl font-black text-success">
                      {agendamentos.filter(a => a.status === 'Confirmado').length}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Confirmados</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointments List */}
          <Card className="lg:col-span-2 shadow-md border-primary/10 flex flex-col bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-3">
              <div>
                <CardTitle className="text-xl">
                  {date?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </CardTitle>
                <CardDescription>Visualização detalhada dos compromissos.</CardDescription>
              </div>
              <Badge variant="secondary" className="h-7 px-3 font-bold self-start sm:self-auto">
                {agendamentos.length} TOTAL
              </Badge>
            </CardHeader>
            
            <CardContent className="flex-1 pt-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                  <p className="font-medium">Carregando agenda...</p>
                </div>
              ) : agendamentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl border-muted-foreground/10 bg-muted/5">
                  <div className="p-4 bg-secondary/50 rounded-full mb-4">
                    <CalendarDays className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-bold text-lg">Nenhum agendamento</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mt-1">
                    Não há compromissos para esta data. Use o botão acima para adicionar manualmente.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[60vh] sm:h-[550px] pr-2 sm:pr-4">
                  <div className="space-y-4">
                    {agendamentos.map((appt) => (
                      <div
                        key={appt.id}
                        className="group relative flex flex-col sm:flex-row items-start gap-4 p-4 rounded-2xl border bg-card transition-all hover:shadow-lg hover:border-primary/30"
                      >
                        <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-0 p-3 bg-primary/10 text-primary rounded-xl w-full sm:w-auto sm:min-w-[70px] border border-primary/20">
                          <div className="flex items-center gap-2 sm:flex-col sm:gap-0">
                            <span className="text-xl font-black">{formatTime(appt.data_hora)}</span>
                            <Clock className="h-3 w-3 sm:mt-1" />
                          </div>
                          <div className="sm:hidden">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => updateStatus(appt.id, 'Confirmado')}>
                                  <Check className="h-4 w-4 mr-2 text-success" /> Confirmar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(appt.id, 'Concluído')}>
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-primary" /> Concluir
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(appt.id, 'Cancelado')} className="text-destructive">
                                  <X className="h-4 w-4 mr-2" /> Cancelar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteAgendamento(appt.id)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir permanentemente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-black text-lg break-words">{appt.nome_cliente}</h4>
                            <Badge 
                              variant={
                                appt.status === 'Confirmado' ? 'default' : 
                                appt.status === 'Cancelado' ? 'destructive' : 
                                appt.status === 'Pendente' ? 'warning' : 'success'
                              } 
                              className="text-[10px] h-5 font-bold uppercase"
                            >
                              {appt.status}
                            </Badge>
                            {appt.origem === 'IA' && (
                              <Badge variant="secondary" className="text-[10px] h-5 gap-1 font-bold bg-purple-500/10 text-purple-500 border-none">
                                <Bot className="h-3 w-3" /> IA
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-muted rounded">
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <span className="font-medium">{appt.servico}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-muted rounded">
                                <Phone className="h-3.5 w-3.5 text-success" />
                              </div>
                              <span className="font-mono">{appt.contato_cliente || '(Número não informado)'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:flex gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => updateStatus(appt.id, 'Confirmado')}
                          >
                            <Check className="h-4 w-4 mr-2 text-success" /> Confirmar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus(appt.id, 'Concluído')}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2 text-primary" /> Concluir
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus(appt.id, 'Cancelado')}
                            className="text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" /> Cancelar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteAgendamento(appt.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir permanentemente
                          </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Novo Agendamento */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Novo Agendamento</DialogTitle>
            <DialogDescription>
              Preencha os dados para reservar um horário manualmente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome" className="font-bold">Nome do Cliente</Label>
              <Input 
                id="nome" 
                placeholder="Ex: João da Silva" 
                value={formData.nome_cliente}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormData({ ...formData, nome_cliente: v });
                  setShowContactDropdown(v.trim().length >= 2);
                }}
                onFocus={() => setShowContactDropdown((formData.nome_cliente || '').trim().length >= 2)}
              />
              {showContactDropdown && contactResults.length > 0 && (
                <div className="mt-2 border rounded-md max-h-48 overflow-auto bg-background">
                  {contactResults.map(c => {
                    const phone = String(c.contato || '').replace(/\D/g, '');
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent"
                        onClick={() => {
                          setFormData({ ...formData, nome_cliente: c.nome || '', contato_cliente: phone });
                          setShowContactDropdown(false);
                        }}
                      >
                        <div className="text-sm font-medium">{c.nome || 'Sem nome'}</div>
                        <div className="text-xs text-muted-foreground">{phone}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contato" className="font-bold">WhatsApp / Telefone</Label>
              <Input 
                id="contato" 
                placeholder="Ex: 5511999999999" 
                value={formData.contato_cliente}
                onChange={(e) => setFormData({...formData, contato_cliente: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="servico" className="font-bold">Serviço</Label>
              <Input 
                id="servico" 
                placeholder="Ex: Consultoria, Corte de Cabelo..." 
                value={formData.servico}
                onChange={(e) => setFormData({...formData, servico: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hora" className="font-bold">Horário</Label>
                <Input 
                  id="hora" 
                  type="time" 
                  value={formData.hora}
                  onChange={(e) => setFormData({...formData, hora: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status" className="font-bold">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v as NovoAgendamentoForm['status'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Confirmado">Confirmado</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateAgendamento} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Configurações da Agenda</DialogTitle>
            <DialogDescription>Defina horários, intervalos e mensagens padrão.</DialogDescription>
          </DialogHeader>
          {settings && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-bold">Fuso horário</Label>
                  <Input
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    placeholder="America/Sao_Paulo"
                  />
                </div>
                <div>
                  <Label className="font-bold">Intervalo (min)</Label>
                  <Input
                    type="number"
                    value={String(settings.slot_interval_minutes)}
                    onChange={(e) => setSettings({ ...settings, slot_interval_minutes: Math.max(5, Number(e.target.value) || 30) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DAY_ORDER.map((day) => {
                  const v = settings.schedule[day];
                  return (
                  <div key={day} className="border rounded-md p-2">
                    <div className="text-xs font-bold uppercase mb-1">{DAY_LABELS[day]}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="time"
                        value={v.open}
                        onChange={(e) => setSettings({ ...settings, schedule: { ...settings.schedule, [day]: { ...v, open: e.target.value } } })}
                      />
                      <Input
                        type="time"
                        value={v.close}
                        onChange={(e) => setSettings({ ...settings, schedule: { ...settings.schedule, [day]: { ...v, close: e.target.value } } })}
                      />
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="font-bold">Antecedência mínima (min)</Label>
                  <Input
                    type="number"
                    value={String(settings.min_advance_minutes)}
                    onChange={(e) => setSettings({ ...settings, min_advance_minutes: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div>
                  <Label className="font-bold">Antecedência máxima (dias)</Label>
                  <Input
                    type="number"
                    value={String(settings.max_advance_days)}
                    onChange={(e) => setSettings({ ...settings, max_advance_days: Math.max(1, Number(e.target.value) || 60) })}
                  />
                </div>
                <div>
                  <Label className="font-bold">Lembrete (horas antes)</Label>
                  <Input
                    type="number"
                    value={String(settings.reminder_hours)}
                    onChange={(e) => setSettings({ ...settings, reminder_hours: Math.max(1, Number(e.target.value) || 24) })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="font-bold">Mensagem de confirmação (opcional)</Label>
                <Textarea
                  value={settings.confirm_template || ''}
                  onChange={(e) => setSettings({ ...settings, confirm_template: e.target.value || null })}
                  placeholder="Olá {nome}, seu horário {servico} está confirmado para {data_hora}."
                />
                <div className="text-xs text-muted-foreground">Variáveis suportadas: {'{nome}'}, {'{servico}'}, {'{data_hora}'}</div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancelar</Button>
                <Button onClick={saveSettings} disabled={settingsSaving}>{settingsSaving ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
