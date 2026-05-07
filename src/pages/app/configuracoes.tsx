import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Upload } from 'lucide-react';
import { ConexoesContent } from '@/pages/app/conexoes';
import { normalizePlan, planLabel, planLimits } from '@/lib/billing-plans';

const sb: any = supabase;

type EmpresaRow = {
  id: string;
  nome: string;
  telefone: string | null;
  responsavel: string | null;
  ativa: boolean;
  logo_url?: string | null;
  billing_plan?: string | null;
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

type UsuarioPermRow = {
  user_id: string;
  can_view_contact_phone: boolean;
  can_access_ia: boolean;
  can_access_catalogo: boolean;
  can_access_catalogo_publico: boolean;
  can_access_orcamentos: boolean;
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
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const empresaId = user?.empresa_id || null;
  const canManagePermissions = user?.papel !== 'colaborador';

  const [empresa, setEmpresa] = useState<EmpresaRow | null>(null);
  const [settings, setSettings] = useState<EmpresaSettingsRow | null>(null);
  const [etiquetas, setEtiquetas] = useState<EtiquetaRow[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [userPerms, setUserPerms] = useState<Record<string, UsuarioPermRow>>({});

  const [newEtiquetaNome, setNewEtiquetaNome] = useState('');
  const [newEtiquetaCor, setNewEtiquetaCor] = useState('#3B82F6');
  const [menuTreeDraft, setMenuTreeDraft] = useState('');
  const [menuTreeError, setMenuTreeError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [collabSubmitting, setCollabSubmitting] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [collabForm, setCollabForm] = useState({ nome: '', email: '', telefone: '' });

  const timezones = useMemo(() => ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'UTC'], []);

  useEffect(() => {
    const load = async () => {
      if (!empresaId) return;

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('id,nome,telefone,responsavel,ativa,logo_url,billing_plan')
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

      const { data: permsData } = await sb
        .from('usuario_permissoes')
        .select('user_id,can_view_contact_phone,can_access_ia,can_access_catalogo,can_access_catalogo_publico,can_access_orcamentos')
        .eq('empresa_id', empresaId);
      const map: Record<string, UsuarioPermRow> = {};
      ((permsData || []) as UsuarioPermRow[]).forEach((p) => {
        map[String(p.user_id)] = {
          user_id: String(p.user_id),
          can_view_contact_phone: Boolean(p.can_view_contact_phone),
          can_access_ia: Boolean(p.can_access_ia),
          can_access_catalogo: Boolean(p.can_access_catalogo),
          can_access_catalogo_publico: Boolean(p.can_access_catalogo_publico),
          can_access_orcamentos: Boolean(p.can_access_orcamentos),
        };
      });
      setUserPerms(map);
    };

    load();
  }, [empresaId]);

  useEffect(() => {
    setAvatarPreview((user as any)?.avatar_url || null);
  }, [user?.id, (user as any)?.avatar_url]);

  const handleAvatarPick = async (file: File | null) => {
    if (!user?.id) return;
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Arquivo inválido', description: 'Envie PNG ou JPG.', variant: 'destructive' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: 'Arquivo grande', description: 'A foto deve ter no máximo 3MB.', variant: 'destructive' });
      return;
    }
    setAvatarUploading(true);
    try {
      const reader = new FileReader();
      const preview = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      setAvatarPreview(preview);
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('user-avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('user-avatars').getPublicUrl(path);
      const url = data.publicUrl;
      const { error: uerr } = await supabase.from('usuarios').update({ avatar_url: url }).eq('id', user.id);
      if (uerr) throw uerr;
      updateUser({ avatar_url: url } as any);
      toast({ title: 'Atualizado', description: 'Foto do usuário atualizada.' });
    } catch {
      setAvatarPreview((user as any)?.avatar_url || null);
      toast({ title: 'Erro', description: 'Não foi possível atualizar a foto.', variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user?.id) return;
    setAvatarUploading(true);
    try {
      const { error } = await supabase.from('usuarios').update({ avatar_url: null }).eq('id', user.id);
      if (error) throw error;
      updateUser({ avatar_url: null as any } as any);
      setAvatarPreview(null);
      toast({ title: 'Removido', description: 'Foto do usuário removida.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível remover a foto.', variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

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

  const fetchPlanAndUserCount = async () => {
    if (!empresaId) return { plan: normalizePlan(null), count: 0 };
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas')
      .select('billing_plan')
      .eq('id', empresaId)
      .maybeSingle();

    if (empresaError) throw empresaError;

    const { count, error: usersError } = await supabase
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .neq('papel', 'admin');

    if (usersError) throw usersError;

    return { plan: normalizePlan((empresaData as any)?.billing_plan ?? null), count: count ?? 0 };
  };

  const createColaborador = async () => {
    if (!empresaId) return;
    const nome = collabForm.nome.trim();
    const email = collabForm.email.trim();
    const telefone = collabForm.telefone.trim();

    if (!nome || !email) {
      setCollabError('Nome e email são obrigatórios.');
      return;
    }

    try {
      setCollabSubmitting(true);
      setCollabError(null);

      const fresh = await fetchPlanAndUserCount();
      const limits = planLimits(fresh.plan);
      if (fresh.count >= limits.users) {
        setCollabError(`Limite do plano ${planLabel(fresh.plan)} atingido (${limits.users} usuários).`);
        return;
      }

      const { data, error } = await supabase
        .from('usuarios')
        .insert({
          nome,
          email,
          telefone: telefone || null,
          empresa_id: empresaId,
          papel: 'colaborador',
        } as any)
        .select('id,nome,email,papel')
        .single();

      if (error) {
        if (String((error as any).code) === '23505' && String((error as any).message || '').includes('email')) {
          setCollabError('Já existe um usuário com este email.');
          return;
        }
        throw error;
      }

      setUsuarios(prev => [...prev, data as any].sort((a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || ''))));
      setUserPerms(prev => ({
        ...prev,
        [String((data as any).id)]: {
          user_id: String((data as any).id),
          can_view_contact_phone: false,
          can_access_ia: false,
          can_access_catalogo: false,
          can_access_catalogo_publico: false,
          can_access_orcamentos: false,
        }
      }));

      setCollabForm({ nome: '', email: '', telefone: '' });
      setCollabModalOpen(false);
      toast({ title: 'Criado', description: 'Colaborador adicionado à empresa.' });
    } catch {
      setCollabError('Não foi possível adicionar colaborador.');
      toast({ title: 'Erro', description: 'Não foi possível adicionar colaborador.', variant: 'destructive' });
    } finally {
      setCollabSubmitting(false);
    }
  };

  const removeColaborador = async (usuario: UsuarioRow) => {
    if (!empresaId) return;
    if (String(usuario.papel) !== 'colaborador') return;
    if (!confirm(`Remover o colaborador "${usuario.nome}" desta empresa?`)) return;

    try {
      setCollabSubmitting(true);
      setCollabError(null);
      await sb.from('usuario_permissoes').delete().eq('empresa_id', empresaId).eq('user_id', usuario.id);
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuario.id)
        .eq('empresa_id', empresaId)
        .eq('papel', 'colaborador');
      if (error) throw error;

      setUsuarios(prev => prev.filter(u => u.id !== usuario.id));
      setUserPerms(prev => {
        const next = { ...prev };
        delete next[String(usuario.id)];
        return next;
      });
      toast({ title: 'Removido', description: 'Colaborador removido.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível remover colaborador.', variant: 'destructive' });
    } finally {
      setCollabSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie atendimento, etiquetas, conexões e dados da conta.</p>
        </div>

        <Tabs defaultValue="conta" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
            <TabsTrigger value="conta">Conta</TabsTrigger>
            <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
            <TabsTrigger value="conexoes">Conexões</TabsTrigger>
            <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
            <TabsTrigger value="atribuicoes">Atribuições</TabsTrigger>
            {canManagePermissions ? <TabsTrigger value="permissoes">Permissões</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="conta">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Usuário</CardTitle>
                      <CardDescription>Informações do usuário logado.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          e.target.value = '';
                          void handleAvatarPick(f);
                        }}
                      />
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">
                            {(user?.nome || 'U').slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {avatarUploading ? 'Enviando...' : 'Foto'}
                      </Button>
                      {avatarPreview ? (
                        <Button variant="outline" size="sm" onClick={() => void removeAvatar()} disabled={avatarUploading}>
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Empresa</CardTitle>
                      <CardDescription>Dados da empresa vinculada.</CardDescription>
                    </div>
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {empresa?.logo_url ? (
                        <img src={empresa.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">
                          {(empresa?.nome || 'E').slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
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
                  <div className="grid gap-1">
                    <Label>Plano</Label>
                    <Input value={planLabel(empresa?.billing_plan ?? 'free')} disabled />
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
                        <Badge
                          variant="secondary"
                          className={`capitalize ${
                            String(u.papel) === 'admin'
                              ? 'bg-red-600 text-white hover:bg-red-600 border-red-600'
                              : String(u.papel) === 'colaborador'
                                ? 'bg-orange-500 text-white hover:bg-orange-500 border-orange-500'
                                : ''
                          }`}
                        >
                          {String(u.papel) === 'admin' ? 'Admin' : String(u.papel) === 'colaborador' ? 'Colaborador' : 'Cliente'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {canManagePermissions ? (
            <TabsContent value="permissoes">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Permissões de colaboradores</CardTitle>
                      <CardDescription>Controle o que cada colaborador pode ver e fazer.</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCollabError(null);
                        setCollabModalOpen(true);
                      }}
                      disabled={!empresaId}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar colaborador
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {usuarios.filter(u => String(u.papel) === 'colaborador').length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum colaborador encontrado para esta empresa.</div>
                  ) : (
                    usuarios
                      .filter(u => String(u.papel) === 'colaborador')
                      .map((u) => {
                        const perm = userPerms[u.id] || {
                          user_id: u.id,
                          can_view_contact_phone: false,
                          can_access_ia: false,
                          can_access_catalogo: false,
                          can_access_catalogo_publico: false,
                          can_access_orcamentos: false,
                        };
                        const save = async (patch: Partial<UsuarioPermRow>) => {
                          if (!empresaId) return;
                          const next = { ...perm, ...patch };
                          setUserPerms(prev => ({ ...prev, [u.id]: next }));
                          const { error } = await sb
                            .from('usuario_permissoes')
                            .upsert(
                              { empresa_id: empresaId, ...next } as any,
                              { onConflict: 'empresa_id,user_id' }
                            );
                          if (error) {
                            setUserPerms(prev => ({ ...prev, [u.id]: perm }));
                            toast({ title: 'Erro', description: 'Não foi possível salvar permissões.', variant: 'destructive' });
                          } else {
                            toast({ title: 'Salvo', description: 'Permissões atualizadas.' });
                          }
                        };
                        return (
                        <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{u.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 items-center">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-muted-foreground whitespace-nowrap">Ver telefone</div>
                                <Switch checked={perm.can_view_contact_phone} onCheckedChange={(checked) => void save({ can_view_contact_phone: checked })} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-muted-foreground whitespace-nowrap">Minha IA</div>
                                <Switch checked={perm.can_access_ia} onCheckedChange={(checked) => void save({ can_access_ia: checked })} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-muted-foreground whitespace-nowrap">Catálogo</div>
                                <Switch checked={perm.can_access_catalogo} onCheckedChange={(checked) => void save({ can_access_catalogo: checked })} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-muted-foreground whitespace-nowrap">Link Catálogo</div>
                                <Switch checked={perm.can_access_catalogo_publico} onCheckedChange={(checked) => void save({ can_access_catalogo_publico: checked })} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-muted-foreground whitespace-nowrap">Orçamentos</div>
                                <Switch checked={perm.can_access_orcamentos} onCheckedChange={(checked) => void save({ can_access_orcamentos: checked })} />
                              </div>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void removeColaborador(u)}
                              disabled={collabSubmitting}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      );
                      })
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>
      </div>

      <Dialog
        open={collabModalOpen}
        onOpenChange={(open) => {
          setCollabModalOpen(open);
          if (!open) {
            setCollabForm({ nome: '', email: '', telefone: '' });
            setCollabError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar colaborador</DialogTitle>
            <DialogDescription>Cria um usuário colaborador nesta empresa.</DialogDescription>
          </DialogHeader>

          {collabError ? (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {collabError}
            </div>
          ) : null}

          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Nome *</Label>
              <Input
                value={collabForm.nome}
                onChange={(e) => setCollabForm(prev => ({ ...prev, nome: e.target.value }))}
                disabled={collabSubmitting}
              />
            </div>
            <div className="grid gap-1">
              <Label>Email *</Label>
              <Input
                type="email"
                value={collabForm.email}
                onChange={(e) => setCollabForm(prev => ({ ...prev, email: e.target.value }))}
                disabled={collabSubmitting}
              />
            </div>
            <div className="grid gap-1">
              <Label>Telefone (opcional)</Label>
              <Input
                value={collabForm.telefone}
                onChange={(e) => setCollabForm(prev => ({ ...prev, telefone: e.target.value }))}
                disabled={collabSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCollabModalOpen(false)} disabled={collabSubmitting}>
              Cancelar
            </Button>
            <Button onClick={() => void createColaborador()} disabled={collabSubmitting}>
              {collabSubmitting ? 'Criando...' : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
