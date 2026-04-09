import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Building, Edit, Trash2, Search, LayoutGrid, List, Phone, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/app-layout';
import { Empresa } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizePlan, planIsBillable, planLabel, planLimits } from '@/lib/billing-plans';

function moneyToCents(input: string) {
  const s = String(input || '').trim().replace(/\s/g, '');
  if (!s) return null;
  const n = s.replace(/\./g, '').replace(',', '.');
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

function centsToMoney(cents: number) {
  try {
    const v = (cents || 0) / 100;
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return String((cents || 0) / 100);
  }
}
export default function AdminEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const v = localStorage.getItem('admin_empresas_view');
      return v === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    responsavel: '',
    ativa: true,
    logo_url: '',
    billing_enabled: false,
    billing_plan: 'free',
    billing_due_date: '',
    billing_grace_days: '3',
    billing_price: ''
  });
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Load empresas from Supabase
  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('empresas')
        .select('id,nome,telefone,responsavel,ativa,created_at,logo_url,billing_enabled,billing_plan,billing_due_date,billing_grace_days,billing_status,billing_price_cents,billing_currency')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map database fields to frontend interface
      const mappedEmpresas: Empresa[] = (data || []).map(empresa => ({
        id: empresa.id,
        nome: empresa.nome,
        telefone: empresa.telefone || '',
        responsavel: empresa.responsavel || '',
        ativa: empresa.ativa,
        criado_em: empresa.created_at,
        logo_url: empresa.logo_url || undefined,
        billing_enabled: empresa.billing_enabled ?? false,
        billing_plan: empresa.billing_plan ?? 'free',
        billing_due_date: empresa.billing_due_date ?? null,
        billing_grace_days: empresa.billing_grace_days ?? 3,
        billing_status: empresa.billing_status ?? 'active',
        billing_price_cents: empresa.billing_price_cents ?? null,
        billing_currency: empresa.billing_currency ?? 'BRL',
      }));
      
      setEmpresas(mappedEmpresas);
    } catch (error) {
      console.error('Error loading empresas:', error);
      toast({
        title: "Erro ao carregar empresas",
        description: "Não foi possível carregar a lista de empresas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredEmpresas = empresas.filter(empresa =>
    empresa.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    empresa.responsavel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    const total = empresas.length;
    const ativas = empresas.filter(e => e.ativa).length;
    const inativas = total - ativas;
    return { total, ativas, inativas };
  }, [empresas]);

  const handleCreate = async () => {
    if (!formData.nome.trim()) {
      setFormError('Nome da empresa é obrigatório');
      return;
    }

    if (formData.nome.trim().length < 2) {
      setFormError('Nome deve ter pelo menos 2 caracteres');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      // Development fallback for mock mode
      if (import.meta.env.VITE_USE_MOCK === 'true') {
        const plan = normalizePlan(formData.billing_plan);
        const billable = planIsBillable(plan);
        if (billable && formData.billing_enabled && !formData.billing_due_date) {
          setFormError('Defina o vencimento para planos pagos (Basic/Pro).');
          return;
        }
        const graceRawMock = Number(formData.billing_grace_days);
        const graceMock = Number.isFinite(graceRawMock) && graceRawMock >= 0 ? graceRawMock : 3;
        const mockEmpresa: Empresa = {
          id: `mock-${Date.now()}`,
          nome: formData.nome.trim(),
          telefone: formData.telefone.trim() || '',
          responsavel: formData.responsavel.trim() || '',
          ativa: formData.ativa,
          criado_em: new Date().toISOString(),
          logo_url: formData.logo_url.trim() || undefined,
          billing_enabled: billable ? Boolean(formData.billing_enabled) : false,
          billing_plan: plan,
          billing_due_date: billable && formData.billing_due_date ? formData.billing_due_date : null,
          billing_grace_days: graceMock,
          billing_status: 'active',
          billing_price_cents: billable && formData.billing_price ? moneyToCents(formData.billing_price) : null,
          billing_currency: 'BRL',
        };

        setEmpresas([mockEmpresa, ...empresas]);
        setModalOpen(false);
        setFormData({ nome: '', telefone: '', responsavel: '', ativa: true, logo_url: '', billing_enabled: false, billing_plan: 'free', billing_due_date: '', billing_grace_days: '3', billing_price: '' });
        setLogoPreview(null);
        setFormError('');
        
        toast({
          title: "Empresa criada (mock)",
          description: `${mockEmpresa.nome} foi adicionada ao sistema.`,
        });
        return;
      }

      const plan = normalizePlan(formData.billing_plan);
      const billable = planIsBillable(plan);
      if (billable && formData.billing_enabled && !formData.billing_due_date) {
        setFormError('Defina o vencimento para planos pagos (Basic/Pro).');
        setSubmitting(false);
        return;
      }
      const graceRawCreate = Number(formData.billing_grace_days);
      const graceCreate = Number.isFinite(graceRawCreate) && graceRawCreate >= 0 ? graceRawCreate : 3;
      const empresaData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        responsavel: formData.responsavel.trim() || null,
        ativa: formData.ativa,
        logo_url: formData.logo_url.trim() || null,
        billing_enabled: billable ? Boolean(formData.billing_enabled) : false,
        billing_plan: plan,
        billing_due_date: billable && formData.billing_due_date ? formData.billing_due_date : null,
        billing_grace_days: graceCreate,
        billing_price_cents: billable && formData.billing_price ? moneyToCents(formData.billing_price) : null,
        billing_currency: 'BRL',
      };

      const { data, error } = await supabase
        .from('empresas')
        .insert([empresaData])
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505' && error.message.includes('empresas_nome_unique_idx')) {
          setFormError('Já existe uma empresa com este nome');
          return;
        }
        
        throw error;
      }

      // Optimistic update - add to top of list
      const newEmpresa: Empresa = {
        id: data.id,
        nome: data.nome,
        telefone: data.telefone || '',
        responsavel: data.responsavel || '',
        ativa: data.ativa,
        criado_em: data.created_at,
        logo_url: data.logo_url || undefined,
        billing_enabled: data.billing_enabled ?? false,
        billing_plan: data.billing_plan ?? 'free',
        billing_due_date: data.billing_due_date ?? null,
        billing_grace_days: data.billing_grace_days ?? 3,
        billing_status: data.billing_status ?? 'active',
        billing_price_cents: data.billing_price_cents ?? null,
        billing_currency: data.billing_currency ?? 'BRL',
      };

      setEmpresas([newEmpresa, ...empresas]);
      setModalOpen(false);
      setFormData({ nome: '', telefone: '', responsavel: '', ativa: true, logo_url: '', billing_enabled: false, billing_plan: 'free', billing_due_date: '', billing_grace_days: '3', billing_price: '' });
      setLogoPreview(null);
      setFormError('');
      
      toast({
        title: "Empresa criada com sucesso",
        description: `${newEmpresa.nome} foi adicionada ao sistema.`,
      });

    } catch (error) {
      console.error('Error creating empresa:', error);
      setFormError('Erro ao criar empresa. Tente novamente.');
      toast({
        title: "Erro ao criar empresa",
        description: "Não foi possível criar a empresa. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingEmpresa || !formData.nome.trim()) {
      setFormError('Nome da empresa é obrigatório');
      return;
    }

    if (formData.nome.trim().length < 2) {
      setFormError('Nome deve ter pelo menos 2 caracteres');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const plan = normalizePlan(formData.billing_plan);
      const billable = planIsBillable(plan);
      if (billable && formData.billing_enabled && !formData.billing_due_date) {
        setFormError('Defina o vencimento para planos pagos (Basic/Pro).');
        setSubmitting(false);
        return;
      }

      const graceRawUpdate = Number(formData.billing_grace_days);
      const graceUpdate = Number.isFinite(graceRawUpdate) && graceRawUpdate >= 0 ? graceRawUpdate : 3;
      const empresaData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        responsavel: formData.responsavel.trim() || null,
        ativa: formData.ativa,
        logo_url: formData.logo_url.trim() || null,
        billing_enabled: billable ? Boolean(formData.billing_enabled) : false,
        billing_plan: plan,
        billing_due_date: billable && formData.billing_due_date ? formData.billing_due_date : null,
        billing_grace_days: graceUpdate,
        billing_price_cents: billable && formData.billing_price ? moneyToCents(formData.billing_price) : null,
        billing_currency: 'BRL',
      };

      const { data, error } = await supabase
        .from('empresas')
        .update(empresaData)
        .eq('id', editingEmpresa.id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && error.message.includes('empresas_nome_unique_idx')) {
          setFormError('Já existe uma empresa com este nome');
          return;
        }
        throw error;
      }

      const updatedEmpresa: Empresa = {
        id: data.id,
        nome: data.nome,
        telefone: data.telefone || '',
        responsavel: data.responsavel || '',
        ativa: data.ativa,
        criado_em: data.created_at,
        logo_url: data.logo_url || undefined,
        billing_enabled: data.billing_enabled ?? false,
        billing_plan: data.billing_plan ?? 'free',
        billing_due_date: data.billing_due_date ?? null,
        billing_grace_days: data.billing_grace_days ?? 3,
        billing_status: data.billing_status ?? 'active',
        billing_price_cents: data.billing_price_cents ?? null,
        billing_currency: data.billing_currency ?? 'BRL',
      };

      setEmpresas(empresas.map(e => e.id === updatedEmpresa.id ? updatedEmpresa : e));
      setModalOpen(false);
      setFormData({ nome: '', telefone: '', responsavel: '', ativa: true, logo_url: '', billing_enabled: false, billing_plan: 'free', billing_due_date: '', billing_grace_days: '3', billing_price: '' });
      setLogoPreview(null);
      setFormError('');
      setEditingEmpresa(null);
      
      toast({
        title: "Empresa atualizada com sucesso",
        description: `${updatedEmpresa.nome} foi atualizada.`,
      });

    } catch (error) {
      console.error('Error updating empresa:', error);
      setFormError('Erro ao atualizar empresa. Tente novamente.');
      toast({
        title: "Erro ao atualizar empresa",
        description: "Não foi possível atualizar a empresa. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    setFormData({
      nome: empresa.nome,
      telefone: empresa.telefone,
      responsavel: empresa.responsavel,
      ativa: empresa.ativa,
      logo_url: empresa.logo_url || '',
      billing_enabled: Boolean(empresa.billing_enabled),
      billing_plan: normalizePlan(empresa.billing_plan),
      billing_due_date: empresa.billing_due_date ? String(empresa.billing_due_date) : '',
      billing_grace_days: String(empresa.billing_grace_days ?? 3),
      billing_price: empresa.billing_price_cents != null ? centsToMoney(empresa.billing_price_cents) : '',
    });
    setLogoPreview(empresa.logo_url || null);
    setFormError('');
    setModalOpen(true);
  };

  const handleDelete = async (empresaId: string) => {
    if (confirm('Tem certeza que deseja excluir esta empresa?')) {
      try {
        const { error } = await supabase
          .from('empresas')
          .delete()
          .eq('id', empresaId);

        if (error) throw error;

        // Remove from local state only after successful deletion
        setEmpresas(empresas.filter(e => e.id !== empresaId));
        
        toast({
          title: "Empresa excluída",
          description: "A empresa foi excluída com sucesso.",
        });
      } catch (error) {
        console.error('Erro ao excluir empresa:', error);
        toast({
          title: "Erro ao excluir",
          description: "Não foi possível excluir a empresa. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const resetForm = () => {
    setFormData({ nome: '', telefone: '', responsavel: '', ativa: true, logo_url: '', billing_enabled: false, billing_plan: 'free', billing_due_date: '', billing_grace_days: '3', billing_price: '' });
    setFormError('');
    setEditingEmpresa(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleModalClose = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleLogoPick = async (file: File | null) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Arquivo inválido', description: 'Envie PNG ou JPG.', variant: 'destructive' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: 'Arquivo grande', description: 'A logo deve ter no máximo 3MB.', variant: 'destructive' });
      return;
    }
    setLogoUploading(true);
    try {
      const reader = new FileReader();
      const preview = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      setLogoPreview(preview);
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const targetId = editingEmpresa?.id || `tmp-${Date.now()}`;
      const path = `${targetId}/logo-${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('empresa-logos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('empresa-logos').getPublicUrl(path);
      setFormData(prev => ({ ...prev, logo_url: data.publicUrl }));
    } catch {
      setLogoPreview(null);
      toast({ title: 'Erro', description: 'Não foi possível enviar a logo.', variant: 'destructive' });
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Empresas</h1>
            <p className="text-muted-foreground">Gerencie as empresas do sistema</p>
          </div>
          
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative w-full md:w-[360px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total: <span className="text-foreground font-medium">{stats.total}</span></span>
              <span>Ativas: <span className="text-foreground font-medium">{stats.ativas}</span></span>
              <span>Inativas: <span className="text-foreground font-medium">{stats.inativas}</span></span>
            </div>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => {
                const next = v === 'table' ? 'table' : 'grid';
                setViewMode(next);
                try {
                  localStorage.setItem('admin_empresas_view', next);
                } catch {
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

        {filteredEmpresas.length === 0 ? (
          <EmptyState
            icon={<Building className="h-8 w-8" />}
            title="Nenhuma empresa encontrada"
            description="Cadastre empresas para começar a usar o sistema."
            action={{
              label: "Nova Empresa",
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
                      <TableHead>Responsável</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmpresas.map((empresa) => (
                      <TableRow key={empresa.id}>
                        <TableCell className="font-medium">{empresa.nome}</TableCell>
                        <TableCell>{empresa.telefone}</TableCell>
                        <TableCell>{empresa.responsavel}</TableCell>
                        <TableCell>{formatDate(empresa.criado_em)}</TableCell>
                        <TableCell>
                          <Badge variant={empresa.ativa ? 'success' : 'disconnected'}>
                            {empresa.ativa ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleEdit(empresa)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-danger"
                              onClick={() => handleDelete(empresa.id)}
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
                {filteredEmpresas.map((empresa) => {
                  const letter = String(empresa.nome || 'E').trim().slice(0, 1).toUpperCase();
                  return (
                    <Card key={empresa.id} className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-muted/20 hover:shadow-lg transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 overflow-hidden">
                              {empresa.logo_url ? (
                                <img src={empresa.logo_url} alt="" className="h-full w-full object-contain bg-background" />
                              ) : (
                                letter
                              )}
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">{empresa.nome}</CardTitle>
                              <CardDescription className="text-xs">
                                Criada em {formatDate(empresa.criado_em)}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant={empresa.ativa ? 'success' : 'disconnected'}>
                            {empresa.ativa ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        {empresa.billing_enabled ? (
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              Plano: {planLabel(empresa.billing_plan)} ({planLimits(empresa.billing_plan).instances} inst / {planLimits(empresa.billing_plan).users} usuários)
                            </span>
                            <span>Venc: {empresa.billing_due_date ? String(empresa.billing_due_date) : '—'}</span>
                          </div>
                        ) : null}
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="truncate">{empresa.responsavel || 'Sem responsável'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span className="truncate">{empresa.telefone || 'Sem telefone'}</span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(empresa)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" className="text-danger" onClick={() => handleDelete(empresa.id)}>
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
                {editingEmpresa ? 'Editar Empresa' : 'Nova Empresa'}
              </CardTitle>
              <CardDescription>
                {editingEmpresa 
                  ? 'Edite as informações da empresa' 
                  : 'Cadastre uma nova empresa no sistema'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <input
                ref={logoInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  e.target.value = '';
                  void handleLogoPick(f);
                }}
              />
              {formError && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  {formError}
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Nome da Empresa *</Label>
                <Input
                  placeholder="Ex: TechCorp Solutions"
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
                  placeholder="Ex: +55 11 3333-4444"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  disabled={submitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input
                  placeholder="Ex: Ana Costa"
                  value={formData.responsavel}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label>Logo (opcional)</Label>
                <div className="flex items-center justify-between gap-3 border rounded-lg p-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded bg-muted overflow-hidden flex items-center justify-center">
                      {logoPreview ? (
                        <img src={logoPreview} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <div className="text-[10px] text-muted-foreground">Sem</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 w-0">
                      <div className="text-xs text-muted-foreground truncate">{formData.logo_url || 'Nenhuma logo definida'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.logo_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, logo_url: '' }));
                          setLogoPreview(null);
                        }}
                        disabled={submitting}
                      >
                        Remover
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading || submitting}>
                      {logoUploading ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativa: checked })}
                  disabled={submitting}
                />
                <Label>Empresa Ativa</Label>
              </div>

              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Cobrança</div>
                    <div className="text-xs text-muted-foreground">
                      {planIsBillable(formData.billing_plan) ? 'Envia avisos e aplica bloqueio por vencimento.' : 'Free não recebe avisos e não é bloqueado.'}
                    </div>
                  </div>
                  <Switch
                    checked={planIsBillable(formData.billing_plan) ? formData.billing_enabled : false}
                    onCheckedChange={(checked) => setFormData({ ...formData, billing_enabled: checked })}
                    disabled={submitting || !planIsBillable(formData.billing_plan)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Plano</Label>
                    <Select
                      value={formData.billing_plan}
                      onValueChange={(v) => {
                        const plan = normalizePlan(v);
                        const billable = planIsBillable(plan);
                        setFormData(prev => ({
                          ...prev,
                          billing_plan: plan,
                          billing_enabled: billable ? prev.billing_enabled : false,
                          billing_due_date: billable ? prev.billing_due_date : '',
                        }));
                      }}
                      disabled={submitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      Limites: {planLimits(formData.billing_plan).instances} instância(s), {planLimits(formData.billing_plan).users} usuário(s).
                    </div>
                  </div>

                  {planIsBillable(formData.billing_plan) && formData.billing_enabled ? (
                    <div className="space-y-1">
                      <Label>Vencimento</Label>
                      <Input
                        type="date"
                        value={formData.billing_due_date}
                        onChange={(e) => setFormData({ ...formData, billing_due_date: e.target.value })}
                        disabled={submitting}
                      />
                    </div>
                  ) : (
                    <div />
                  )}

                  {planIsBillable(formData.billing_plan) && formData.billing_enabled ? (
                    <div className="space-y-1">
                      <Label>Carência (dias)</Label>
                      <Input
                        type="number"
                        value={formData.billing_grace_days}
                        onChange={(e) => setFormData({ ...formData, billing_grace_days: e.target.value })}
                        min={0}
                        step={1}
                        disabled={submitting}
                      />
                    </div>
                  ) : null}

                  {planIsBillable(formData.billing_plan) && formData.billing_enabled ? (
                    <div className="space-y-1">
                      <Label>Valor do plano (R$)</Label>
                      <Input
                        placeholder="Ex: 99,90"
                        value={formData.billing_price}
                        onChange={(e) => setFormData({ ...formData, billing_price: e.target.value })}
                        disabled={submitting}
                      />
                      <div className="text-xs text-muted-foreground">Deixe em branco para usar valores acordados fora do sistema.</div>
                    </div>
                  ) : null}
                </div>
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
                  onClick={editingEmpresa ? handleUpdate : handleCreate}
                  disabled={!formData.nome.trim() || submitting}
                  className={submitting ? "opacity-50" : ""}
                >
                  {submitting ? (editingEmpresa ? "Salvando..." : "Criando...") : (editingEmpresa ? 'Salvar' : 'Criar')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
