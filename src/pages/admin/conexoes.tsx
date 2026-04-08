import { useState, useEffect } from 'react';
import { Plus, Plug, Edit, Trash2, Search, Eye, EyeOff } from 'lucide-react';
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
import { SkeletonTableRow } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
        .select('*')
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

  const resetForm = () => {
    setFormData({ empresa_id: 'global', nome_api: '', api_url: '', telefone: '', apikey: '', globalkey: '' });
    setFormError('');
    setEditingConexao(null);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    resetForm();
  };

  if (loading && conexoes.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Conexões</h1>
              <p className="text-muted-foreground">Gerencie as conexões WhatsApp do sistema</p>
            </div>
          </div>
          
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
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
            </TableBody>
          </Table>
        </div>
      </AppLayout>
    );
  }

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
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conexões..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
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
                      <TableCell className="max-w-xs truncate">{conexao.globalkey || '—'}</TableCell>
                      <TableCell className="max-w-xs truncate">{conexao.apikey || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(conexao.status)}>
                          {conexao.status}
                        </Badge>
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