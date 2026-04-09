import { useEffect, useMemo, useState } from 'react';
import { Plus, Plug, Edit, Trash2, Search, Eye, EyeOff, LayoutGrid, List, RefreshCw, Link2, AlertTriangle, Phone, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard, SkeletonTableRow } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Types for database integration
interface Connection {
  id: string;
  nome_api: string;
  api_url: string;
  telefone?: string;
  apikey?: string;
  globalkey?: string;
  status: 'desconectado' | 'pendente' | 'conectado';
  empresa_id?: string;
  created_at?: string;
  last_status_checked_at?: string | null;
  last_status_error?: string | null;
  last_status_raw?: string | null;
}

interface Empresa {
  id: string;
  nome: string;
  telefone?: string;
  responsavel?: string;
  ativa: boolean;
  created_at?: string;
}

export default function AdminConexoes() {
  const [conexoes, setConexoes] = useState<Connection[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConexao, setEditingConexao] = useState<Connection | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conexaoToDelete, setConexaoToDelete] = useState<Connection | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const v = localStorage.getItem('admin_conexoes_view');
      return v === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  const [formData, setFormData] = useState({
    empresa_id: '',
    nome_api: '',
    api_url: '',
    telefone: '',
    apikey: '',
    globalkey: ''
  });

  // Load data from Supabase
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      await Promise.race([
        supabase.functions.invoke('whatsapp-sync-status', { body: { force: false } }),
        new Promise((r) => setTimeout(r, 1200)),
      ]);
      
      // Load empresas
      const { data: empresasData, error: empresasError } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false });

      if (empresasError) throw empresasError;
      
      const mappedEmpresas: Empresa[] = (empresasData || []).map(empresa => ({
        id: empresa.id,
        nome: empresa.nome,
        telefone: empresa.telefone || '',
        responsavel: empresa.responsavel || '',
        ativa: empresa.ativa,
        created_at: empresa.created_at,
      }));
      
      setEmpresas(mappedEmpresas);

      // Load conexoes
      const { data: conexoesData, error: conexoesError } = await supabase
        .from('conexoes')
        .select('id,nome_api,api_url,telefone,apikey,globalkey,status,empresa_id,created_at,last_status_checked_at,last_status_raw,last_status_error')
        .order('created_at', { ascending: false });

      if (conexoesError) throw conexoesError;
      
      const mappedConexoes: Connection[] = (conexoesData || []).map(conexao => ({
        id: conexao.id,
        nome_api: conexao.nome_api,
        api_url: conexao.api_url,
        telefone: conexao.telefone,
        apikey: conexao.apikey,
        globalkey: conexao.globalkey,
        status: conexao.status as Connection['status'],
        empresa_id: conexao.empresa_id,
        created_at: conexao.created_at,
        last_status_checked_at: conexao.last_status_checked_at ?? null,
        last_status_error: conexao.last_status_error ?? null,
        last_status_raw: conexao.last_status_raw ?? null,
      }));
      
      setConexoes(mappedConexoes);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar conexões e empresas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredConexoes = conexoes.filter(conexao =>
    conexao.nome_api.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conexao.api_url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    const total = conexoes.length;
    const conectadas = conexoes.filter(c => c.status === 'conectado').length;
    const pendentes = conexoes.filter(c => c.status === 'pendente').length;
    const desconectadas = total - conectadas - pendentes;
    return { total, conectadas, pendentes, desconectadas };
  }, [conexoes]);

  const syncNow = async () => {
    try {
      setSyncing(true);
      await supabase.functions.invoke('whatsapp-sync-status', { body: { force: true } });
      await loadData();
      toast({ title: 'Sincronizado', description: 'Status das conexões atualizado.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível sincronizar status.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome_api.trim() || !formData.api_url.trim() || !formData.apikey.trim() || !formData.globalkey.trim()) {
      setFormError('Nome da API, URL, API Key e Global Key são obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const conexaoData = {
        nome_api: formData.nome_api.trim(),
        api_url: formData.api_url.trim(),
        telefone: formData.telefone.trim() || null,
        apikey: formData.apikey.trim(),
        globalkey: formData.globalkey.trim(),
        status: editingConexao ? editingConexao.status : 'desconectado',
        empresa_id: formData.empresa_id === 'global' ? null : formData.empresa_id || null,
      };

      if (editingConexao) {
        // Update existing connection
        const { data, error } = await supabase
          .from('conexoes')
          .update(conexaoData)
          .eq('id', editingConexao.id)
          .select()
          .single();

        if (error) throw error;

        const updatedConexao: Connection = {
          id: data.id,
          nome_api: data.nome_api,
          api_url: data.api_url,
          telefone: data.telefone,
          apikey: data.apikey,
          globalkey: data.globalkey,
          status: data.status as Connection['status'],
          empresa_id: data.empresa_id,
          created_at: data.created_at,
        };

        setConexoes(conexoes.map(c => c.id === editingConexao.id ? updatedConexao : c));
        
        toast({
          title: "Conexão atualizada",
          description: `${updatedConexao.nome_api} foi atualizada.`,
        });
      } else {
        // Create new connection
        const { data, error } = await supabase
          .from('conexoes')
          .insert([conexaoData])
          .select()
          .single();

        if (error) throw error;

        const newConexao: Connection = {
          id: data.id,
          nome_api: data.nome_api,
          api_url: data.api_url,
          telefone: data.telefone,
          apikey: data.apikey,
          globalkey: data.globalkey,
          status: data.status as Connection['status'],
          empresa_id: data.empresa_id,
          created_at: data.created_at,
        };

        setConexoes([newConexao, ...conexoes]);
        
        toast({
          title: "Conexão criada com sucesso",
          description: `${newConexao.nome_api} foi adicionada ao sistema.`,
        });
      }

      setModalOpen(false);
      resetForm();

    } catch (error) {
      console.error('Error saving conexao:', error);
      if (error.code === '23505') {
        setFormError('Já existe uma conexão com esse nome para esta empresa.');
      } else {
        setFormError('Erro ao salvar conexão. Tente novamente.');
      }
      toast({
        title: "Erro ao salvar conexão",
        description: "Não foi possível salvar a conexão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (conexao: Connection) => {
    setEditingConexao(conexao);
    setFormData({
      empresa_id: conexao.empresa_id || 'global',
      nome_api: conexao.nome_api,
      api_url: conexao.api_url,
      telefone: conexao.telefone || '',
      apikey: conexao.apikey || '',
      globalkey: conexao.globalkey || ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleDeleteClick = (conexao: Connection) => {
    setConexaoToDelete(conexao);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!conexaoToDelete) return;
    
    try {
      const { error } = await supabase
        .from('conexoes')
        .delete()
        .eq('id', conexaoToDelete.id);

      if (error) throw error;

      setConexoes(conexoes.filter(c => c.id !== conexaoToDelete.id));
      setDeleteDialogOpen(false);
      setConexaoToDelete(null);
      
      toast({
        title: "Conexão excluída",
        description: "Conexão foi removida do sistema.",
      });
    } catch (error) {
      console.error('Error deleting conexao:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a conexão.",
        variant: "destructive",
      });
    }
  };

  const getEmpresaName = (empresaId?: string) => {
    if (!empresaId) return 'Global';
    return empresas.find(e => e.id === empresaId)?.nome || 'Empresa não encontrada';
  };

  const getStatusVariant = (status: Connection['status']) => {
    switch (status) {
      case 'conectado': return 'connected';
      case 'pendente': return 'pending';
      case 'desconectado': return 'disconnected';
    }
  };

  const formatKey = (value?: string) => {
    const v = String(value || '');
    if (!v) return '—';
    if (showSecrets) return v;
    if (v.length <= 8) return '••••••••';
    return `${v.slice(0, 3)}••••••${v.slice(-3)}`;
  };

  const resetForm = () => {
    setFormData({ empresa_id: 'global', nome_api: '', api_url: '', telefone: '', apikey: '', globalkey: '' });
    setFormError('');
    setEditingConexao(null);
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
            <h1 className="text-3xl font-bold">Conexões</h1>
            <p className="text-muted-foreground">Gerencie as conexões WhatsApp do sistema</p>
          </div>
          
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conexão
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative w-full md:w-[360px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conexões..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total: <span className="text-foreground font-medium">{stats.total}</span></span>
              <span>Conectadas: <span className="text-foreground font-medium">{stats.conectadas}</span></span>
              <span>Pendentes: <span className="text-foreground font-medium">{stats.pendentes}</span></span>
              <span>Desconectadas: <span className="text-foreground font-medium">{stats.desconectadas}</span></span>
            </div>
            <Button variant="outline" onClick={() => void syncNow()} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Button variant="outline" onClick={() => setShowSecrets(v => !v)}>
              {showSecrets ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showSecrets ? 'Ocultar chaves' : 'Mostrar chaves'}
            </Button>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => {
                const next = v === 'table' ? 'table' : 'grid';
                setViewMode(next);
                try {
                  localStorage.setItem('admin_conexoes_view', next);
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

        {filteredConexoes.length === 0 ? (
          <EmptyState
            icon={<Plug className="h-8 w-8" />}
            title="Nenhuma conexão encontrada"
            description="Configure conexões WhatsApp para as empresas."
            action={{
              label: "Nova Conexão",
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Nome API</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Global Key</TableHead>
                        <TableHead>API Key</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="w-24">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredConexoes.map((conexao) => (
                        <TableRow key={conexao.id}>
                          <TableCell className="font-medium">{getEmpresaName(conexao.empresa_id)}</TableCell>
                          <TableCell>{conexao.nome_api}</TableCell>
                          <TableCell className="max-w-xs truncate">{conexao.api_url}</TableCell>
                          <TableCell className="max-w-xs truncate">{formatKey(conexao.globalkey)}</TableCell>
                          <TableCell className="max-w-xs truncate">{formatKey(conexao.apikey)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={getStatusVariant(conexao.status)}>
                                {conexao.status}
                              </Badge>
                              {conexao.last_status_error ? <AlertTriangle className="h-4 w-4 text-warning" /> : null}
                            </div>
                          </TableCell>
                          <TableCell>{conexao.telefone || '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleEdit(conexao)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-danger"
                                onClick={() => handleDeleteClick(conexao)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredConexoes.map((c) => (
                  <Card key={c.id} className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-muted/20 hover:shadow-lg transition-all p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold truncate">{c.nome_api}</div>
                          <Badge variant={getStatusVariant(c.status)}>{c.status}</Badge>
                          {c.last_status_error ? <Badge variant="secondary">erro</Badge> : null}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="truncate">{getEmpresaName(c.empresa_id)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(c)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-danger" onClick={() => handleDeleteClick(c)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Link2 className="h-4 w-4" />
                        <span className="truncate">{c.api_url}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span className="truncate">{c.telefone || '—'}</span>
                      </div>
                      <div className="grid gap-1">
                        <div className="text-xs text-muted-foreground">Global Key</div>
                        <div className="font-mono text-xs truncate">{formatKey(c.globalkey)}</div>
                      </div>
                      <div className="grid gap-1">
                        <div className="text-xs text-muted-foreground">API Key</div>
                        <div className="font-mono text-xs truncate">{formatKey(c.apikey)}</div>
                      </div>
                      {c.last_status_error ? (
                        <div className="text-xs text-warning truncate flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="truncate">{c.last_status_error}</span>
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingConexao ? 'Editar Conexão' : 'Nova Conexão'}
            </DialogTitle>
            <DialogDescription>
              {editingConexao 
                ? 'Edite as informações da conexão WhatsApp' 
                : 'Configure uma nova conexão WhatsApp'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {formError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {formError}
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select 
                value={formData.empresa_id} 
                onValueChange={(value) => {
                  setFormData({ ...formData, empresa_id: value });
                  if (formError) setFormError('');
                }}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (Todas)</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nome da API *</Label>
              <Input
                placeholder="Ex: WhatsApp Business API"
                value={formData.nome_api}
                onChange={(e) => {
                  setFormData({ ...formData, nome_api: e.target.value });
                  if (formError) setFormError('');
                }}
                disabled={submitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label>URL da API *</Label>
              <Input
                placeholder="Ex: https://api.whatsapp.com/v1"
                value={formData.api_url}
                onChange={(e) => {
                  setFormData({ ...formData, api_url: e.target.value });
                  if (formError) setFormError('');
                }}
                disabled={submitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Global Key *</Label>
              <Input
                type="password"
                placeholder="Chave global da API"
                value={formData.globalkey}
                onChange={(e) => {
                  setFormData({ ...formData, globalkey: e.target.value });
                  if (formError) setFormError('');
                }}
                disabled={submitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label>API Key *</Label>
              <Input
                type="password"
                placeholder="Chave específica da API"
                value={formData.apikey}
                onChange={(e) => {
                  setFormData({ ...formData, apikey: e.target.value });
                  if (formError) setFormError('');
                }}
                disabled={submitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Telefone (Opcional)</Label>
              <Input
                placeholder="Ex: +55 11 99999-9999"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                disabled={submitting}
              />
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
                onClick={handleSave}
                disabled={!formData.nome_api.trim() || !formData.api_url.trim() || !formData.apikey.trim() || !formData.globalkey.trim() || submitting}
                className={submitting ? "opacity-50" : ""}
              >
                {submitting ? (editingConexao ? "Salvando..." : "Criando...") : (editingConexao ? 'Salvar' : 'Criar')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conexão "{conexaoToDelete?.nome_api}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
