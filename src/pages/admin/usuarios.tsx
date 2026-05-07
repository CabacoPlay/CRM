import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, Edit, Trash2, Search, LayoutGrid, List, Mail, Phone, Building2, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { planLimits, planLabel, normalizePlan } from '@/lib/billing-plans';

// Types for database integration
interface Usuario {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  empresa_id?: string;
  papel: 'admin' | 'cliente' | 'colaborador';
  avatar_url?: string | null;
  created_at?: string;
}

interface Empresa {
  id: string;
  nome: string;
  telefone?: string;
  responsavel?: string;
  ativa: boolean;
  billing_plan?: string | null;
  created_at?: string;
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fixingEmpresaPlan, setFixingEmpresaPlan] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const v = localStorage.getItem('admin_usuarios_view');
      return v === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });
  
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    empresa_id: '',
    papel: 'cliente' as Usuario['papel']
  });

  // Load data from Supabase
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load empresas
      const { data: empresasData, error: empresasError } = await supabase
        .from('empresas')
        .select('id,nome,telefone,responsavel,ativa,created_at,billing_plan')
        .order('created_at', { ascending: false });

      if (empresasError) throw empresasError;
      
      const mappedEmpresas: Empresa[] = (empresasData || []).map(empresa => ({
        id: empresa.id,
        nome: empresa.nome,
        telefone: empresa.telefone || '',
        responsavel: empresa.responsavel || '',
        ativa: empresa.ativa,
        created_at: empresa.created_at,
        billing_plan: empresa.billing_plan ?? null,
      }));
      
      setEmpresas(mappedEmpresas);

      // Load usuarios
      const { data: usuariosData, error: usuariosError } = await supabase
        .from('usuarios')
        .select('id,nome,telefone,email,empresa_id,papel,created_at,avatar_url')
        .order('created_at', { ascending: false });

      if (usuariosError) throw usuariosError;
      
      const mappedUsuarios: Usuario[] = (usuariosData || []).map(usuario => ({
        id: usuario.id,
        nome: usuario.nome,
        telefone: usuario.telefone || '',
        email: usuario.email,
        empresa_id: usuario.empresa_id,
        papel: usuario.papel,
        created_at: usuario.created_at,
        avatar_url: usuario.avatar_url,
      }));
      
      setUsuarios(mappedUsuarios);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar usuários e empresas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsuarios = usuarios.filter(usuario =>
    usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    const total = usuarios.length;
    const admins = usuarios.filter(u => u.papel === 'admin').length;
    const clientes = usuarios.filter(u => u.papel === 'cliente').length;
    const colaboradores = usuarios.filter(u => u.papel === 'colaborador').length;
    return { total, admins, clientes, colaboradores };
  }, [usuarios]);

  const selectedEmpresa = useMemo(() => {
    if (!formData.empresa_id) return null;
    return empresas.find(e => e.id === formData.empresa_id) || null;
  }, [empresas, formData.empresa_id]);

  const updateEmpresaPlan = async (nextPlan: 'free' | 'basic' | 'pro') => {
    if (!formData.empresa_id) return;
    try {
      setFixingEmpresaPlan(true);
      const { error } = await supabase
        .from('empresas')
        .update({ billing_plan: nextPlan } as any)
        .eq('id', formData.empresa_id);
      if (error) throw error;
      setEmpresas(prev => prev.map(e => e.id === formData.empresa_id ? { ...e, billing_plan: nextPlan } : e));
      setFormError('');
      toast({ title: 'Atualizado', description: `Plano da empresa definido como ${planLabel(nextPlan)}.` });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o plano da empresa.', variant: 'destructive' });
    } finally {
      setFixingEmpresaPlan(false);
    }
  };

  const fetchEmpresaPlanAndUserCount = async (empresaId: string, excludeUserId?: string) => {
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas')
      .select('billing_plan')
      .eq('id', empresaId)
      .maybeSingle();

    if (empresaError) throw empresaError;

    let usersQuery = supabase
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .neq('papel', 'admin');

    if (excludeUserId) {
      usersQuery = usersQuery.neq('id', excludeUserId);
    }

    const { count, error: usersError } = await usersQuery;
    if (usersError) throw usersError;

    return { plan: normalizePlan(empresaData?.billing_plan ?? null), count: count ?? 0 };
  };

  const handleCreate = async () => {
    if (!formData.nome.trim() || !formData.email.trim()) {
      setFormError('Nome e email são obrigatórios');
      return;
    }

    // Admins don't need empresa_id, but non-admins do
    if (formData.papel !== 'admin' && !formData.empresa_id) {
      setFormError('Usuários não-admin devem estar associados a uma empresa');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      if (formData.papel !== 'admin' && formData.empresa_id) {
        let plan = normalizePlan(null);
        let countLocal = usuarios.filter(u => u.empresa_id === formData.empresa_id && u.papel !== 'admin').length;
        try {
          const fresh = await fetchEmpresaPlanAndUserCount(formData.empresa_id);
          plan = fresh.plan;
          countLocal = fresh.count;
        } catch {
          const empresa = empresas.find(e => e.id === formData.empresa_id) || null;
          plan = normalizePlan(empresa?.billing_plan ?? null);
        }

        const limits = planLimits(plan);
        if (countLocal >= limits.users) {
          setFormError(`Limite do plano ${planLabel(plan)} atingido (${limits.users} usuários).`);
          setSubmitting(false);
          return;
        }
      }

      const usuarioData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        email: formData.email.trim(),
        empresa_id: formData.papel === 'admin' ? null : formData.empresa_id || null,
        papel: formData.papel,
      };

      const { data, error } = await supabase
        .from('usuarios')
        .insert([usuarioData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && error.message.includes('email')) {
          setFormError('Já existe um usuário com este email');
          return;
        }
        throw error;
      }

      // Optimistic update
      const newUsuario: Usuario = {
        id: data.id,
        nome: data.nome,
        telefone: data.telefone || '',
        email: data.email,
        empresa_id: data.empresa_id,
        papel: data.papel,
        created_at: data.created_at,
      };

      setUsuarios([newUsuario, ...usuarios]);
      setModalOpen(false);
      setFormData({ nome: '', telefone: '', email: '', empresa_id: '', papel: 'cliente' });
      setFormError('');
      
      toast({
        title: "Usuário criado com sucesso",
        description: `${newUsuario.nome} foi adicionado ao sistema.`,
      });

    } catch (error) {
      console.error('Error creating usuario:', error);
      setFormError('Erro ao criar usuário. Tente novamente.');
      toast({
        title: "Erro ao criar usuário",
        description: "Não foi possível criar o usuário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUsuario || !formData.nome.trim() || !formData.email.trim()) {
      setFormError('Nome e email são obrigatórios');
      return;
    }

    // Admins don't need empresa_id, but non-admins do
    if (formData.papel !== 'admin' && !formData.empresa_id) {
      setFormError('Usuários não-admin devem estar associados a uma empresa');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const nextEmpresaId = formData.papel === 'admin' ? null : formData.empresa_id || null;
      const prevEmpresaId = editingUsuario.empresa_id || null;
      const empresaChanged = nextEmpresaId !== prevEmpresaId;
      if (formData.papel !== 'admin' && nextEmpresaId && (empresaChanged || editingUsuario.papel === 'admin')) {
        let plan = normalizePlan(null);
        let countLocal = usuarios.filter(u => u.empresa_id === nextEmpresaId && u.papel !== 'admin' && u.id !== editingUsuario.id).length;
        try {
          const fresh = await fetchEmpresaPlanAndUserCount(nextEmpresaId, editingUsuario.id);
          plan = fresh.plan;
          countLocal = fresh.count;
        } catch {
          const empresa = empresas.find(e => e.id === nextEmpresaId) || null;
          plan = normalizePlan(empresa?.billing_plan ?? null);
        }

        const limits = planLimits(plan);
        if (countLocal >= limits.users) {
          setFormError(`Limite do plano ${planLabel(plan)} atingido (${limits.users} usuários).`);
          setSubmitting(false);
          return;
        }
      }

      const usuarioData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        email: formData.email.trim(),
        empresa_id: nextEmpresaId,
        papel: formData.papel,
      };

      const { data, error } = await supabase
        .from('usuarios')
        .update(usuarioData)
        .eq('id', editingUsuario.id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && error.message.includes('email')) {
          setFormError('Já existe um usuário com este email');
          return;
        }
        throw error;
      }

      // Update local state
      const updatedUsuario: Usuario = {
        id: data.id,
        nome: data.nome,
        telefone: data.telefone || '',
        email: data.email,
        empresa_id: data.empresa_id,
        papel: data.papel,
        created_at: data.created_at,
      };

      setUsuarios(usuarios.map(u => u.id === updatedUsuario.id ? updatedUsuario : u));
      setModalOpen(false);
      setFormData({ nome: '', telefone: '', email: '', empresa_id: '', papel: 'cliente' });
      setFormError('');
      setEditingUsuario(null);
      
      toast({
        title: "Usuário atualizado com sucesso",
        description: `${updatedUsuario.nome} foi atualizado.`,
      });

    } catch (error) {
      console.error('Error updating usuario:', error);
      setFormError('Erro ao atualizar usuário. Tente novamente.');
      toast({
        title: "Erro ao atualizar usuário",
        description: "Não foi possível atualizar o usuário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setFormData({
      nome: usuario.nome,
      telefone: usuario.telefone,
      email: usuario.email,
      empresa_id: usuario.empresa_id || '',
      papel: usuario.papel
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleDelete = async (usuarioId: string) => {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        const { error } = await supabase
          .from('usuarios')
          .delete()
          .eq('id', usuarioId);

        if (error) throw error;

        setUsuarios(usuarios.filter(u => u.id !== usuarioId));
        
        toast({
          title: "Usuário excluído",
          description: "Usuário foi removido do sistema.",
        });
      } catch (error) {
        console.error('Error deleting usuario:', error);
        toast({
          title: "Erro ao excluir",
          description: "Não foi possível excluir o usuário.",
          variant: "destructive",
        });
      }
    }
  };

  const getEmpresaName = (empresaId?: string) => {
    if (!empresaId) return '—';
    return empresas.find(e => e.id === empresaId)?.nome || 'Empresa não encontrada';
  };

  const getPapelBadge = (papel: Usuario['papel']) => {
    const variants = {
      admin: 'default' as const,
      cliente: 'secondary' as const,
      colaborador: 'outline' as const
    };
    
    const labels = {
      admin: 'Admin',
      cliente: 'Cliente',
      colaborador: 'Colaborador'
    };
    
    const color =
      papel === 'admin'
        ? 'bg-red-600 text-white hover:bg-red-600 border-red-600'
        : papel === 'colaborador'
          ? 'bg-orange-500 text-white hover:bg-orange-500 border-orange-500'
          : '';

    return <Badge variant={variants[papel]} className={color}>{labels[papel]}</Badge>;
  };

  const resetForm = () => {
    setFormData({ nome: '', telefone: '', email: '', empresa_id: '', papel: 'cliente' });
    setFormError('');
    setEditingUsuario(null);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    resetForm();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Usuários</h1>
            <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
          </div>
          
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative w-full md:w-[360px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total: <span className="text-foreground font-medium">{stats.total}</span></span>
              <span>Admins: <span className="text-foreground font-medium">{stats.admins}</span></span>
              <span>Clientes: <span className="text-foreground font-medium">{stats.clientes}</span></span>
              <span>Colaboradores: <span className="text-foreground font-medium">{stats.colaboradores}</span></span>
            </div>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => {
                const next = v === 'table' ? 'table' : 'grid';
                setViewMode(next);
                try {
                  localStorage.setItem('admin_usuarios_view', next);
                } catch {
                  //
                }
              }}
            >
              <ToggleGroupItem value="grid" aria-label="Grade">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Tabela">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {filteredUsuarios.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Nenhum usuário encontrado"
            description="Cadastre usuários para começar a usar o sistema."
            action={{
              label: "Novo Usuário",
              onClick: () => { resetForm(); setModalOpen(true); },
              variant: "hero"
            }}
          />
        ) : (
          <>
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : viewMode === 'table' ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell className="font-medium">{usuario.nome}</TableCell>
                        <TableCell>{usuario.telefone}</TableCell>
                        <TableCell>{usuario.email}</TableCell>
                        <TableCell>{getEmpresaName(usuario.empresa_id)}</TableCell>
                        <TableCell>{getPapelBadge(usuario.papel)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleEdit(usuario)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-danger"
                              onClick={() => handleDelete(usuario.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredUsuarios.map((u) => {
                  const letter = String(u.nome || 'U').trim().slice(0, 1).toUpperCase();
                  return (
                    <Card key={u.id} className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-muted/20 hover:shadow-lg transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 overflow-hidden">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="h-full w-full object-cover bg-background" />
                              ) : (
                                letter
                              )}
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">{u.nome}</CardTitle>
                              <CardDescription className="text-xs truncate">{u.email}</CardDescription>
                            </div>
                          </div>
                          {getPapelBadge(u.papel)}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span className="truncate">{u.telefone || 'Sem telefone'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            <span className="truncate">{getEmpresaName(u.empresa_id)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span className="truncate">{u.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="truncate">{u.papel === 'admin' ? 'Admin' : u.papel === 'colaborador' ? 'Colaborador' : 'Cliente'}</span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(u)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" className="text-danger" onClick={() => handleDelete(u.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={handleModalClose}>
        <DialogContent>
          <Card>
            <CardHeader>
              <CardTitle>
                {editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
              </CardTitle>
              <CardDescription>
                {editingUsuario 
                  ? 'Edite as informações do usuário' 
                  : 'Cadastre um novo usuário no sistema'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {formError && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  {formError}
                  {formData.papel !== 'admin' && formData.empresa_id && normalizePlan(selectedEmpresa?.billing_plan ?? null) === 'free' ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void updateEmpresaPlan('basic')}
                        disabled={submitting || fixingEmpresaPlan}
                      >
                        Definir Basic
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void updateEmpresaPlan('pro')}
                        disabled={submitting || fixingEmpresaPlan}
                      >
                        Definir Pro
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  placeholder="Ex: João Silva"
                  value={formData.nome}
                  onChange={(e) => {
                    setFormData({ ...formData, nome: e.target.value });
                    if (formError) setFormError('');
                  }}
                  disabled={submitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="Ex: +55 11 99999-0001"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  disabled={submitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="Ex: joao@empresa.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (formError) setFormError('');
                  }}
                  disabled={submitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Papel *</Label>
                <Select 
                  value={formData.papel} 
                  onValueChange={(value: Usuario['papel']) => {
                    setFormData({ ...formData, papel: value, empresa_id: value === 'admin' ? '' : formData.empresa_id });
                    if (formError) setFormError('');
                  }}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Empresa {formData.papel !== 'admin' && '*'}</Label>
                <Select 
                  value={formData.empresa_id} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, empresa_id: value });
                    if (formError) setFormError('');
                  }}
                  disabled={submitting || formData.papel === 'admin'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.papel === 'admin' ? "Admins não precisam de empresa" : "Selecione uma empresa..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleModalClose}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={editingUsuario ? handleUpdate : handleCreate}
                  disabled={!formData.nome.trim() || !formData.email.trim() || submitting}
                  className={submitting ? "opacity-50" : ""}
                >
                  {submitting ? (editingUsuario ? "Salvando..." : "Criando...") : (editingUsuario ? 'Salvar' : 'Criar')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
