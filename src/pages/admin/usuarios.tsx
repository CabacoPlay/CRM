import { useState, useEffect } from 'react';
import { Plus, Users, Edit, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTableRow } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types for database integration
interface Usuario {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  empresa_id?: string;
  papel: 'admin' | 'cliente';
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

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');
  const { toast } = useToast();
  
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

      // Load usuarios
      const { data: usuariosData, error: usuariosError } = await supabase
        .from('usuarios')
        .select('*')
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

  const handleCreate = async () => {
    if (!formData.nome.trim() || !formData.email.trim()) {
      setFormError('Nome e email são obrigatórios');
      return;
    }

    // Admins don't need empresa_id, but clientes do
    if (formData.papel === 'cliente' && !formData.empresa_id) {
      setFormError('Clientes devem estar associados a uma empresa');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

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

    // Admins don't need empresa_id, but clientes do
    if (formData.papel === 'cliente' && !formData.empresa_id) {
      setFormError('Clientes devem estar associados a uma empresa');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const usuarioData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        email: formData.email.trim(),
        empresa_id: formData.papel === 'admin' ? null : formData.empresa_id || null,
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
      cliente: 'secondary' as const
    };
    
    const labels = {
      admin: 'Admin',
      cliente: 'Cliente'
    };
    
    return <Badge variant={variants[papel]}>{labels[papel]}</Badge>;
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

  if (loading && usuarios.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Usuários</h1>
              <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
            </div>
          </div>
          
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
            <h1 className="text-3xl font-bold">Usuários</h1>
            <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
          </div>
          
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
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
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Empresa {formData.papel === 'cliente' && '*'}</Label>
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