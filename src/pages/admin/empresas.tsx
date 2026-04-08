import { useState, useEffect } from 'react';
import { Plus, Building, Edit, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTableRow } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/app-layout';
import { Empresa } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AdminEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    responsavel: '',
    ativa: true
  });

  // Load empresas from Supabase
  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
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
        const mockEmpresa: Empresa = {
          id: `mock-${Date.now()}`,
          nome: formData.nome.trim(),
          telefone: formData.telefone.trim() || '',
          responsavel: formData.responsavel.trim() || '',
          ativa: formData.ativa,
          criado_em: new Date().toISOString(),
        };

        setEmpresas([mockEmpresa, ...empresas]);
        setModalOpen(false);
        setFormData({ nome: '', telefone: '', responsavel: '', ativa: true });
        setFormError('');
        
        toast({
          title: "Empresa criada (mock)",
          description: `${mockEmpresa.nome} foi adicionada ao sistema.`,
        });
        return;
      }

      const empresaData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        responsavel: formData.responsavel.trim() || null,
        ativa: formData.ativa,
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
      };

      setEmpresas([newEmpresa, ...empresas]);
      setModalOpen(false);
      setFormData({ nome: '', telefone: '', responsavel: '', ativa: true });
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

      const empresaData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        responsavel: formData.responsavel.trim() || null,
        ativa: formData.ativa,
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
      };

      setEmpresas(empresas.map(e => e.id === updatedEmpresa.id ? updatedEmpresa : e));
      setModalOpen(false);
      setFormData({ nome: '', telefone: '', responsavel: '', ativa: true });
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
      ativa: empresa.ativa
    });
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
    setFormData({ nome: '', telefone: '', responsavel: '', ativa: true });
    setFormError('');
    setEditingEmpresa(null);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    resetForm();
  };

  if (loading && empresas.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Empresas</h1>
              <p className="text-muted-foreground">Gerencie as empresas do sistema</p>
            </div>
          </div>
          
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
            <h1 className="text-3xl font-bold">Empresas</h1>
            <p className="text-muted-foreground">Gerencie as empresas do sistema</p>
          </div>
          
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
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
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativa: checked })}
                  disabled={submitting}
                />
                <Label>Empresa Ativa</Label>
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