import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Settings, Edit, Trash2, Tag, Upload, X, Image as ImageIcon, Filter, Check, MoreVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { CatalogItem, Categoria } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

export default function Catalogo() {
  const { user } = useAuth();
  if (user?.papel === 'colaborador' && !user.can_access_catalogo) {
    return <Navigate to="/app/chat" replace />;
  }
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({
    tipo: 'Produto' as 'Produto' | 'Serviço',
    nome: '',
    descricao: '',
    valor: '',
    categoria_id: '',
    ativo: true,
    image_url: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    nome: '',
    cor: '#3B82F6'
  });

  const { toast } = useToast();

  useEffect(() => {
    if (user?.empresa_id) {
      fetchData();
    }
  }, [user?.empresa_id]);

  const fetchData = async () => {
    if (!user?.empresa_id) return;
    
    try {
      setLoading(true);
      
      // Fetch categories
      const { data: categoriasData, error: categoriasError } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', user.empresa_id)
        .order('nome');

      if (categoriasError) throw categoriasError;
      setCategorias(categoriasData || []);

      // Fetch catalog items with categories
      const { data: itemsData, error: itemsError } = await supabase
        .from('catalog_items')
        .select(`
          *,
          categoria:categorias(nome, cor)
        `)
        .eq('empresa_id', user.empresa_id)
        .order('nome');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do catálogo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user?.empresa_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da imagem",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image_url: '' }));
  };

  const handleCreateItem = async () => {
    if (!formData.nome || !formData.categoria_id || !formData.valor) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploadingImage(true);
      
      let imageUrl = formData.image_url;
      
      // Upload new image if file is selected
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const itemData = {
        tipo: formData.tipo,
        nome: formData.nome,
        descricao: formData.descricao || null,
        valor: parseFloat(formData.valor),
        categoria_id: formData.categoria_id,
        ativo: formData.ativo,
        image_url: imageUrl || null,
        empresa_id: user?.empresa_id
      };

      if (editingItem) {
        const { error } = await supabase
          .from('catalog_items')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Item atualizado com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('catalog_items')
          .insert([itemData]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Item criado com sucesso"
        });
      }

      setItemModalOpen(false);
      setEditingItem(null);
      setFormData({
        tipo: 'Produto',
        nome: '',
        descricao: '',
        valor: '',
        categoria_id: '',
        ativo: true,
        image_url: ''
      });
      setImageFile(null);
      setImagePreview(null);
      fetchData();
    } catch (error) {
      console.error('Error saving item:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar item",
        variant: "destructive"
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    try {
      const { error } = await supabase
        .from('catalog_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Item excluído com sucesso"
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir item",
        variant: "destructive"
      });
    }
  };

  const handleCreateCategoria = async () => {
    if (!categoryFormData.nome) {
      toast({
        title: "Erro",
        description: "Nome da categoria é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const categoryData = {
        nome: categoryFormData.nome,
        cor: categoryFormData.cor,
        empresa_id: user?.empresa_id
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('categorias')
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Categoria atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert([categoryData]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Categoria criada com sucesso"
        });
      }

      setCategoryModalOpen(false);
      setEditingCategory(null);
      setCategoryFormData({
        nome: '',
        cor: '#3B82F6'
      });
      fetchData();
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar categoria",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Todos os itens vinculados serão removidos.')) return;

    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso"
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria",
        variant: "destructive"
      });
    }
  };

  const handleEditItem = (item: CatalogItem) => {
    setEditingItem(item);
    setFormData({
      tipo: item.tipo,
      nome: item.nome,
      descricao: item.descricao || '',
      valor: item.valor.toString(),
      categoria_id: item.categoria_id,
      ativo: item.ativo,
      image_url: item.image_url || ''
    });
    setImageFile(null);
    setImagePreview(item.image_url || null);
    setItemModalOpen(true);
  };

  const handleEditCategory = (category: Categoria) => {
    setEditingCategory(category);
    setCategoryFormData({
      nome: category.nome,
      cor: category.cor
    });
    setCategoryModalOpen(true);
  };

  const handleToggleStatus = async (item: CatalogItem) => {
    try {
      const { error } = await supabase
        .from('catalog_items')
        .update({ ativo: !item.ativo })
        .eq('id', item.id);

      if (error) throw error;
      
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ativo: !item.ativo } : i));
      
      toast({
        title: "Status atualizado",
        description: `O item ${item.nome} agora está ${!item.ativo ? 'ativo' : 'inativo'}.`
      });
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar status do item",
        variant: "destructive"
      });
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !activeCategory || item.categoria_id === activeCategory;
    const matchesType = !activeType || item.tipo === activeType;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Catálogo</h1>
          <p className="text-muted-foreground">
            Gerencie seus produtos e serviços
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingItem(null);
                    setFormData({
                      tipo: 'Produto',
                      nome: '',
                      descricao: '',
                      valor: '',
                      categoria_id: '',
                      ativo: true,
                      image_url: ''
                    });
                    setImageFile(null);
                    setImagePreview(null);
                  }} className="rounded-xl shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent">
                  <Card className="border-none shadow-none">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-bold">{editingItem ? 'Editar Item' : 'Novo Item'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[calc(90vh-10rem)] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="tipo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</Label>
                          <Select value={formData.tipo} onValueChange={(value: 'Produto' | 'Serviço') => setFormData(prev => ({ ...prev, tipo: value }))}>
                            <SelectTrigger className="rounded-xl h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Produto">Produto</SelectItem>
                              <SelectItem value="Serviço">Serviço</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="valor" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                          <Input
                            id="valor"
                            type="number"
                            step="0.01"
                            value={formData.valor}
                            onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                            placeholder="0,00"
                            className="rounded-xl h-11"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nome" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                          placeholder="Ex: Consultoria Premium"
                          className="rounded-xl h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="categoria" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                        <Select value={formData.categoria_id} onValueChange={(value) => setFormData(prev => ({ ...prev, categoria_id: value }))}>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {categorias.map((categoria) => (
                              <SelectItem key={categoria.id} value={categoria.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoria.cor }} />
                                  {categoria.nome}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="descricao" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</Label>
                        <Textarea
                          id="descricao"
                          value={formData.descricao}
                          onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                          placeholder="Descreva as principais características..."
                          rows={3}
                          className="resize-none rounded-xl"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Imagem do Item</Label>
                        <div className="space-y-2">
                          {imagePreview ? (
                            <div className="relative w-full h-32 border-2 border-muted/30 rounded-2xl overflow-hidden group">
                              <img 
                                src={imagePreview} 
                                alt="Preview" 
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={removeImage}
                                  className="rounded-xl h-8 px-3"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Remover
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative group">
                              <input
                                type="file"
                                id="image"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className="w-full h-32 border-2 border-dashed border-muted-foreground/20 rounded-2xl flex flex-col items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/5 transition-all">
                                <div className="p-2 bg-muted rounded-full mb-2 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                  <Upload className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground group-hover:text-primary">Clique ou arraste uma imagem</span>
                                <span className="text-[10px] text-muted-foreground/60 mt-1">JPG 1024×576 (recomendado)</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold">Item Visível</Label>
                          <p className="text-[10px] text-muted-foreground">Define se o item aparece no catálogo público</p>
                        </div>
                        <Switch
                          checked={formData.ativo}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-muted/30">
                        <Button 
                          variant="ghost" 
                          onClick={() => setItemModalOpen(false)}
                          disabled={uploadingImage}
                          className="rounded-xl"
                        >
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleCreateItem}
                          disabled={uploadingImage || !formData.nome || !formData.categoria_id || !formData.valor}
                          className="rounded-xl px-8 shadow-md"
                        >
                          {uploadingImage ? "Salvando..." : (editingItem ? 'Salvar Alterações' : 'Criar Item')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </DialogContent>
              </Dialog>

              <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => {
                    setEditingCategory(null);
                    setCategoryFormData({ nome: '', cor: '#3B82F6' });
                  }} className="rounded-xl shadow-sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Categorias
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md p-0 border-none bg-transparent">
                  <Card className="border-none shadow-none">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold">Gerenciar Categorias</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-3 p-4 bg-muted/30 rounded-2xl">
                        <Label htmlFor="categoria-nome" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="categoria-nome"
                            value={categoryFormData.nome}
                            onChange={(e) => setCategoryFormData(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Nome..."
                            className="flex-1 rounded-xl h-10"
                          />
                          <div className="relative group">
                            <Input
                              type="color"
                              value={categoryFormData.cor}
                              onChange={(e) => setCategoryFormData(prev => ({ ...prev, cor: e.target.value }))}
                              className="w-10 h-10 p-1 rounded-xl border-none cursor-pointer overflow-hidden"
                            />
                          </div>
                          <Button onClick={handleCreateCategoria} size="sm" className="rounded-xl h-10 px-4">
                            {editingCategory ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </Button>
                          {editingCategory && (
                            <Button variant="ghost" onClick={() => {
                              setEditingCategory(null);
                              setCategoryFormData({ nome: '', cor: '#3B82F6' });
                            }} size="sm" className="rounded-xl h-10">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categorias Existentes</Label>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {categorias.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-2xl">
                              <Tag className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                              <p className="text-xs text-muted-foreground">Nenhuma categoria</p>
                            </div>
                          ) : (
                            categorias.map((categoria) => (
                              <div key={categoria.id} className="group flex items-center justify-between p-3 border border-muted/40 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-3 h-3 rounded-full shadow-sm" 
                                    style={{ backgroundColor: categoria.cor }}
                                  />
                                  <span className="text-sm font-medium">{categoria.nome}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEditCategory(categoria)}
                                    className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteCategory(categoria.id)}
                                    className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </DialogContent>
              </Dialog>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar no catálogo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl h-10 border-muted/40 shadow-sm focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
            <div className="flex items-center gap-1.5 pr-4 border-r border-muted/40 mr-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtros</span>
            </div>
            
            <Badge 
              variant={!activeCategory && !activeType ? 'default' : 'outline'}
              className={`cursor-pointer h-7 px-3 rounded-full text-[11px] transition-all whitespace-nowrap ${
                !activeCategory && !activeType ? 'shadow-md' : 'hover:bg-muted text-muted-foreground border-muted/40'
              }`}
              onClick={() => {
                setActiveCategory(null);
                setActiveType(null);
              }}
            >
              Todos
            </Badge>

            <div className="flex items-center gap-1.5 px-2">
              <Badge 
                variant={activeType === 'Produto' ? 'default' : 'outline'}
                className={`cursor-pointer h-7 px-3 rounded-full text-[11px] transition-all whitespace-nowrap ${
                  activeType === 'Produto' ? 'bg-blue-600 hover:bg-blue-700 shadow-md border-none' : 'hover:bg-muted text-muted-foreground border-muted/40'
                }`}
                onClick={() => setActiveType(activeType === 'Produto' ? null : 'Produto')}
              >
                Produtos
              </Badge>
              <Badge 
                variant={activeType === 'Serviço' ? 'default' : 'outline'}
                className={`cursor-pointer h-7 px-3 rounded-full text-[11px] transition-all whitespace-nowrap ${
                  activeType === 'Serviço' ? 'bg-orange-600 hover:bg-orange-700 shadow-md border-none' : 'hover:bg-muted text-muted-foreground border-muted/40'
                }`}
                onClick={() => setActiveType(activeType === 'Serviço' ? null : 'Serviço')}
              >
                Serviços
              </Badge>
            </div>

            <div className="h-4 w-px bg-muted/40 mx-1" />

            {categorias.map((cat) => (
              <Badge 
                key={cat.id}
                variant={activeCategory === cat.id ? 'default' : 'outline'}
                style={activeCategory === cat.id ? { backgroundColor: cat.cor, borderColor: 'transparent' } : {}}
                className={`cursor-pointer h-7 px-3 rounded-full text-[11px] transition-all whitespace-nowrap ${
                  activeCategory === cat.id ? 'shadow-md text-white' : 'hover:bg-muted text-muted-foreground border-muted/40'
                }`}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              >
                {cat.nome}
              </Badge>
            ))}
          </div>
        </div>

        {/* Catalog Items Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="rounded-2xl overflow-hidden border-muted/40">
                <Skeleton className="h-44 w-full" />
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-5 w-2/3 rounded-lg" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full rounded-lg" />
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-6 w-20 rounded-lg" />
                    <Skeleton className="h-4 w-16 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-24 bg-muted/10 rounded-3xl border-2 border-dashed border-muted/30">
            <div className="p-4 bg-muted/20 rounded-full w-fit mx-auto mb-4">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold mb-2">Nenhum item encontrado</h3>
            <p className="text-muted-foreground max-w-xs mx-auto mb-8">
              {searchTerm || activeCategory || activeType 
                ? 'Os filtros aplicados não retornaram resultados. Tente limpar os filtros.' 
                : 'Seu catálogo está vazio. Comece adicionando seu primeiro produto ou serviço.'}
            </p>
            {(searchTerm || activeCategory || activeType) && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setActiveCategory(null);
                  setActiveType(null);
                }}
                className="rounded-xl"
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <Card key={item.id} className="group overflow-hidden rounded-2xl border-muted/40 hover:border-primary/30 hover:shadow-xl transition-all duration-300">
                <div className="relative">
                  {item.image_url ? (
                    <div className="h-44 w-full overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.nome}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-44 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                      <div className="p-3 bg-background/50 rounded-2xl backdrop-blur-sm shadow-sm">
                        <ImageIcon className="h-10 w-12 text-muted-foreground/40" />
                      </div>
                    </div>
                  )}
                  
                  {/* Floating Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    <Badge className={`h-6 rounded-lg text-[10px] font-bold shadow-sm border-none ${
                      item.tipo === 'Produto' ? 'bg-blue-600' : 'bg-orange-600'
                    }`}>
                      {item.tipo === 'Produto' ? 'PRODUTO' : 'SERVIÇO'}
                    </Badge>
                  </div>

                  <div className="absolute top-3 right-3 flex gap-1.5 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => handleEditItem(item)}
                            className="h-8 w-8 rounded-xl bg-background/90 backdrop-blur-sm shadow-md hover:bg-primary hover:text-white transition-all"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => handleDeleteItem(item.id)}
                            className="h-8 w-8 rounded-xl bg-background/90 backdrop-blur-sm shadow-md hover:bg-destructive hover:text-white transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Status Toggle overlay */}
                  <div className="absolute bottom-3 right-3 translate-y-[10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="bg-background/90 backdrop-blur-sm p-1.5 rounded-xl shadow-md flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1">{item.ativo ? 'ATIVO' : 'INATIVO'}</span>
                      <Switch 
                        checked={item.ativo} 
                        onCheckedChange={() => handleToggleStatus(item)}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </div>

                <CardContent className="p-4 pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors leading-none mb-1">
                        {item.nome}
                      </h3>
                      {item.categoria && (
                        <div className="flex items-center gap-1.5">
                          <div 
                            className="w-2 h-2 rounded-full shadow-sm"
                            style={{ backgroundColor: item.categoria.cor }}
                          />
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {item.categoria.nome}
                          </span>
                        </div>
                      )}
                    </div>
                    {!item.ativo && (
                      <Badge variant="secondary" className="text-[9px] h-5 px-1.5 rounded-md font-bold border-none opacity-60">
                        OFFLINE
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2 italic mb-4 min-h-[2rem]">
                    {item.descricao || 'Sem descrição cadastrada...'}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-muted/30">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Preço</span>
                      <span className="text-lg font-black text-primary tracking-tight">
                        {formatCurrency(item.valor)}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-primary/5 hover:text-primary"
                      onClick={() => handleEditItem(item)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
