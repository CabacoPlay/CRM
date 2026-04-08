import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';
import { ConexoesContent } from '@/pages/app/conexoes';

const sb: any = supabase;

type EmpresaRow = {
  id: string;
  nome: string;
  telefone: string | null;
  responsavel: string | null;
  ativa: boolean;
};

type EmpresaSettingsRow = {
  empresa_id: string;
  timezone: string;
  business_hours: any;
  assignment_mode: 'manual' | 'round_robin';
  after_hours_message: string;
  menu_enabled?: boolean;
  menu_greeting?: string;
  menu_tree?: any;
  menu_timeout_minutes?: number;
};

type EtiquetaRow = {
  id: string;
  empresa_id: string | null;
  nome: string;
  cor: string;
};

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  papel: string;
};

const weekdayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const weekdayLabels: Record<(typeof weekdayKeys)[number], string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

const defaultBusinessHours = weekdayKeys.reduce((acc, k) => {
  (acc as any)[k] = { enabled: k !== 'sun', start: '09:00', end: '18:00' };
  return acc;
}, {} as Record<string, { enabled: boolean; start: string; end: string }>);

const menuTreePlaceholder = `[
  {
    "code": "01",
    "label": "Orçamentos",
    "type": "submenu",
    "children": [
      { "code": "01", "label": "Urubici", "type": "catalog", "term": "Urubici" },
      { "code": "02", "label": "Piratuba", "type": "catalog", "term": "Piratuba" }
    ]
  },
  { "code": "02", "label": "Falar com IA", "type": "ia" }
]`;

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const empresaId = user?.empresa_id || null;

  const [empresa, setEmpresa] = useState<EmpresaRow | null>(null);
  const [settings, setSettings] = useState<EmpresaSettingsRow | null>(null);
  const [etiquetas, setEtiquetas] = useState<EtiquetaRow[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);

  const [newEtiquetaNome, setNewEtiquetaNome] = useState('');
  const [newEtiquetaCor, setNewEtiquetaCor] = useState('#3B82F6');
  const [menuTreeDraft, setMenuTreeDraft] = useState('');
  const [menuTreeError, setMenuTreeError] = useState<string | null>(null);

  const timezones = useMemo(() => ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'UTC'], []);

  useEffect(() => {
    const load = async () => {
      if (!empresaId) return;

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('id,nome,telefone,responsavel,ativa')
        .eq('id', empresaId)
        .maybeSingle();
      setEmpresa((empresaData || null) as any);

      const { data: settingsData } = await sb
        .from('empresa_settings')
        .select('empresa_id,timezone,business_hours,assignment_mode,after_hours_message,menu_enabled,menu_greeting,menu_tree,menu_timeout_minutes')
        .eq('empresa_id', empresaId)
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData as any);
      } else {
        const created: EmpresaSettingsRow = {
          empresa_id: empresaId,
          timezone: 'America/Sao_Paulo',
          business_hours: defaultBusinessHours,
          assignment_mode: 'manual',
          after_hours_message: 'Olá! No momento estamos fora do horário de atendimento. Assim que possível retornaremos sua mensagem.',
          menu_enabled: false,
          menu_greeting: '',
          menu_tree: [],
          menu_timeout_minutes: 30
        };
        await sb.from('empresa_settings').insert(created as any);
        setSettings(created);
      }

      const { data: etiquetasData } = await sb
        .from('etiquetas')
        .select('id,empresa_id,nome,cor')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true });
      setEtiquetas((etiquetasData || []) as any);

      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id,nome,email,papel')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true });
      setUsuarios((usuariosData || []) as any);
    };

    load();
  }, [empresaId]);

  useEffect(() => {
    if (!settings) return;
    try {
      const raw = settings.menu_tree ?? [];
      setMenuTreeDraft(JSON.stringify(raw, null, 2));
      setMenuTreeError(null);
    } catch {
      setMenuTreeDraft('[]');
      setMenuTreeError(null);
    }
  }, [settings?.empresa_id]);

  const saveMenuTree = async () => {
    if (!settings) return;
    try {
      const parsed = JSON.parse(menuTreeDraft || '[]');
      if (!Array.isArray(parsed)) {
        setMenuTreeError('O menu_tree precisa ser um JSON em formato de lista (array).');
        return;
      }
      setMenuTreeError(null);
      await saveSettings({ ...settings, menu_tree: parsed });
    } catch {
      setMenuTreeError('JSON inválido. Verifique aspas e vírgulas.');
    }
  };

  const saveSettings = async (next: EmpresaSettingsRow) => {
    setSettings(next);
    const { error } = await sb
      .from('empresa_settings')
      .upsert(next as any, { onConflict: 'empresa_id' });
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar configurações.', variant: 'destructive' });
    } else {
      toast({ title: 'Salvo', description: 'Configurações atualizadas.' });
    }
  };

  const createEtiqueta = async () => {
    if (!empresaId) return;
    const nome = newEtiquetaNome.trim();
    if (!nome) return;
    const { data, error } = await sb
      .from('etiquetas')
      .insert({ empresa_id: empresaId, nome, cor: newEtiquetaCor } as any)
      .select('id,empresa_id,nome,cor')
      .single();
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível criar etiqueta.', variant: 'destructive' });
      return;
    }
    setEtiquetas(prev => [...prev, data as any].sort((a: any, b: any) => a.nome.localeCompare(b.nome)));
    setNewEtiquetaNome('');
    toast({ title: 'Criado', description: 'Etiqueta criada.' });
  };

  const deleteEtiqueta = async (id: string) => {
    const { error } = await sb.from('etiquetas').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível remover etiqueta.', variant: 'destructive' });
      return;
    }
    setEtiquetas(prev => prev.filter(e => e.id !== id));
  };

  const updateEtiqueta = async (id: string, updates: Partial<EtiquetaRow>) => {
    const { error } = await sb.from('etiquetas').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar etiqueta.', variant: 'destructive' });
      return;
    }
    setEtiquetas(prev => prev.map(e => e.id === id ? { ...e, ...updates } as any : e));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie atendimento, etiquetas, conexões e dados da conta.</p>
        </div>

        <Tabs defaultValue="conta" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
            <TabsTrigger value="conta">Conta</TabsTrigger>
            <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
            <TabsTrigger value="conexoes">Conexões</TabsTrigger>
            <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
            <TabsTrigger value="atribuicoes">Atribuições</TabsTrigger>
          </TabsList>

          <TabsContent value="conta">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Usuário</CardTitle>
                  <CardDescription>Informações do usuário logado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-1">
                    <Label>Nome</Label>
                    <Input value={user?.nome || ''} disabled />
                  </div>
                  <div className="grid gap-1">
                    <Label>Email</Label>
                    <Input value={user?.email || ''} disabled />
                  </div>
                  <div className="grid gap-1">
                    <Label>Tipo</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{user?.papel || '—'}</Badge>
                      <span className="text-xs text-muted-foreground">ID: {user?.id || '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Empresa</CardTitle>
                  <CardDescription>Dados da empresa vinculada.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-1">
                    <Label>Nome</Label>
                    <Input value={empresa?.nome || ''} disabled />
                  </div>
                  <div className="grid gap-1">
                    <Label>Telefone</Label>
                    <Input value={empresa?.telefone || ''} disabled />
                  </div>
                  <div className="grid gap-1">
                    <Label>Responsável</Label>
                    <Input value={empresa?.responsavel || ''} disabled />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="atendimento">
            <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Horários de atendimento</CardTitle>
                <CardDescription>Controla quando a IA pode responder automaticamente.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 max-w-sm">
                  <Label>Fuso horário</Label>
                  <Select
                    value={settings?.timezone || 'America/Sao_Paulo'}
                    onValueChange={(v) => settings && saveSettings({ ...settings, timezone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3">
                  {weekdayKeys.map((k) => {
                    const cfg = (settings?.business_hours?.[k] || defaultBusinessHours[k]) as any;
                    return (
                      <div key={k} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border">
                        <div className="flex items-center justify-between md:w-56">
                          <span className="font-medium">{weekdayLabels[k]}</span>
                          <Switch
                            checked={cfg.enabled !== false}
                            onCheckedChange={(checked) => {
                              if (!settings) return;
                              const next = {
                                ...settings,
                                business_hours: {
                                  ...(settings.business_hours || {}),
                                  [k]: { ...cfg, enabled: checked }
                                }
                              };
                              saveSettings(next);
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={cfg.start || '09:00'}
                            disabled={cfg.enabled === false}
                            onChange={(e) => {
                              if (!settings) return;
                              const next = {
                                ...settings,
                                business_hours: {
                                  ...(settings.business_hours || {}),
                                  [k]: { ...cfg, start: e.target.value }
                                }
                              };
                              saveSettings(next);
                            }}
                            className="w-36"
                          />
                          <span className="text-sm text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={cfg.end || '18:00'}
                            disabled={cfg.enabled === false}
                            onChange={(e) => {
                              if (!settings) return;
                              const next = {
                                ...settings,
                                business_hours: {
                                  ...(settings.business_hours || {}),
                                  [k]: { ...cfg, end: e.target.value }
                                }
                              };
                              saveSettings(next);
                            }}
                            className="w-36"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-2">
                  <Label>Mensagem fora do horário</Label>
                  <Textarea
                    value={settings?.after_hours_message || ''}
                    onChange={(e) => {
                      if (!settings) return;
                      saveSettings({ ...settings, after_hours_message: e.target.value });
                    }}
                    placeholder="Ex: Olá! Estamos fora do horário de atendimento. Retornaremos assim que possível."
                  />
                  <p className="text-xs text-muted-foreground">
                    Esta mensagem é enviada automaticamente quando o cliente mandar mensagem fora do expediente.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Menu do WhatsApp</CardTitle>
                <CardDescription>Mostra um menu antes de encaminhar para a IA. Configuração por empresa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-medium">Ativar menu</div>
                    <div className="text-xs text-muted-foreground">Quando ativo, o cliente precisa escolher opções do menu antes de falar com a IA.</div>
                  </div>
                  <Switch
                    checked={Boolean(settings?.menu_enabled)}
                    onCheckedChange={(checked) => settings && saveSettings({ ...settings, menu_enabled: checked })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Mensagem de boas-vindas (opcional)</Label>
                  <Textarea
                    value={settings?.menu_greeting || ''}
                    onChange={(e) => settings && saveSettings({ ...settings, menu_greeting: e.target.value })}
                    placeholder={'Olá {{nome}}, seja bem-vindo(a) 👋\n\nDigite a opção desejada:'}
                  />
                </div>

                <div className="grid gap-2 max-w-xs">
                  <Label>Timeout do menu (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={Number(settings?.menu_timeout_minutes ?? 30)}
                    onChange={(e) => settings && saveSettings({ ...settings, menu_timeout_minutes: Number(e.target.value || 30) })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Estrutura do menu (JSON)</Label>
                  <Textarea
                    value={menuTreeDraft}
                    onChange={(e) => setMenuTreeDraft(e.target.value)}
                    rows={12}
                    placeholder={menuTreePlaceholder}
                  />
                  {menuTreeError ? (
                    <div className="text-sm text-destructive">{menuTreeError}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Tipos: submenu | catalog | ia. Use MENU para voltar ao início e 0 para voltar no submenu.
                    </div>
                  )}
                  <div>
                    <Button variant="secondary" onClick={saveMenuTree}>Salvar menu</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          <TabsContent value="conexoes">
            <ConexoesContent showHeader={false} />
          </TabsContent>

          <TabsContent value="etiquetas">
            <Card>
              <CardHeader>
                <CardTitle>Etiquetas</CardTitle>
                <CardDescription>Crie e gerencie etiquetas da empresa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-2 md:items-end">
                  <div className="grid gap-1 flex-1">
                    <Label>Nome</Label>
                    <Input value={newEtiquetaNome} onChange={(e) => setNewEtiquetaNome(e.target.value)} placeholder="Ex: Prioridade" />
                  </div>
                  <div className="grid gap-1">
                    <Label>Cor</Label>
                    <Input type="color" value={newEtiquetaCor} onChange={(e) => setNewEtiquetaCor(e.target.value)} className="w-20 h-10 p-1" />
                  </div>
                  <Button onClick={createEtiqueta}><Plus className="h-4 w-4 mr-2" />Criar</Button>
                </div>

                <div className="space-y-2">
                  {etiquetas.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhuma etiqueta cadastrada.</div>
                  ) : (
                    etiquetas.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-3 w-3 rounded-full" style={{ background: e.cor }} />
                          <Input
                            value={e.nome}
                            onChange={(ev) => updateEtiqueta(e.id, { nome: ev.target.value })}
                            className="max-w-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={e.cor}
                            onChange={(ev) => updateEtiqueta(e.id, { cor: ev.target.value })}
                            className="w-16 h-10 p-1"
                          />
                          <Button variant="destructive" size="icon" onClick={() => deleteEtiqueta(e.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="atribuicoes">
            <Card>
              <CardHeader>
                <CardTitle>Atribuições</CardTitle>
                <CardDescription>Em breve: atribuição por usuário e por setor, com filtros no chat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Em breve</Badge>
                  <div className="text-sm text-muted-foreground">Esta área será ativada na próxima atualização.</div>
                </div>
                <div className="space-y-2">
                  {usuarios.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum usuário encontrado para esta empresa.</div>
                  ) : (
                    usuarios.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{u.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        <Badge variant="secondary" className="capitalize">{u.papel}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
