import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, User, Phone, Calendar, MessageSquare, Edit, Trash2, Settings, GripVertical, Move, Search, Filter, Bot, Info, TrendingUp, Kanban } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { Fase, Contato, Nota } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatContactName, cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragMoveEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Draggable Contact Card Component
function DraggableContact({ contato, onOpenContato }: { contato: Contato; onOpenContato: (contato: Contato) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contato.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group cursor-grab active:cursor-grabbing outline-none w-full",
        isDragging && "z-50"
      )}
    >
      <Card 
        className={cn(
          "border-none bg-card shadow-sm hover:shadow-md hover:ring-1 hover:ring-primary/20 transition-all duration-200 w-full",
          isDragging && "opacity-50 shadow-xl ring-2 ring-primary"
        )} 
        onClick={(e) => {
          if (isDragging) return;
          onOpenContato(contato);
        }}
      >
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0 border border-border/50">
                <AvatarImage src={contato.profile_img_url} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                  {formatContactName(contato.nome).split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h4 className="font-bold text-sm text-card-foreground group-hover:text-primary transition-colors leading-tight break-words">
                  {formatContactName(contato.nome)}
                </h4>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="break-all">{formatContactName(contato.contato)}</span>
                </div>
              </div>
            </div>

            {contato.resumo && (
              <div className="w-full min-w-0 overflow-hidden text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg leading-relaxed border border-border/50 whitespace-pre-wrap break-all">
                {contato.resumo}
              </div>
            )}

            <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/30">
              <div className="flex flex-wrap gap-1.5">
                {contato.observacoes_ia && (
                  <Badge variant="secondary" className="h-5 px-2 text-[9px] font-bold gap-1 bg-primary/10 text-primary border-none">
                    <Bot className="h-3 w-3" /> IA
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium shrink-0">
                <Calendar className="h-3 w-3" />
                {new Date(contato.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Droppable container for phases
const Droppable = ({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
};

// Phase Management Component
function PhaseManagementModal({ 
  open, 
  onOpenChange, 
  fases, 
  onUpdate,
  user 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  fases: Fase[]; 
  onUpdate: () => void;
  user: any; 
}) {
  const [editingPhase, setEditingPhase] = useState<Fase | null>(null);
  const [phaseFormData, setPhaseFormData] = useState({
    nome: '',
    cor: '#3B82F6'
  });
  const { toast } = useToast();

  const handleCreatePhase = async () => {
    if (!phaseFormData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome da fase é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const maxPosition = Math.max(...fases.map(f => f.position), 0);
      const phaseData = {
        nome: phaseFormData.nome.trim(),
        cor: phaseFormData.cor,
        position: editingPhase ? editingPhase.position : maxPosition + 1,
        empresa_id: user?.empresa_id
      };

      if (editingPhase) {
        const { error } = await supabase
          .from('fases')
          .update(phaseData)
          .eq('id', editingPhase.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Fase atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('fases')
          .insert([phaseData]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Fase criada com sucesso"
        });
      }

      setEditingPhase(null);
      setPhaseFormData({ nome: '', cor: '#3B82F6' });
      onUpdate();
    } catch (error) {
      console.error('Error saving phase:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar fase",
        variant: "destructive"
      });
    }
  };

  const handleDeletePhase = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fase? Todos os contatos vinculados serão removidos.')) return;

    try {
      const { error } = await supabase
        .from('fases')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Fase excluída com sucesso"
      });
      onUpdate();
    } catch (error) {
      console.error('Error deleting phase:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir fase",
        variant: "destructive"
      });
    }
  };

  const handleEditPhase = (phase: Fase) => {
    setEditingPhase(phase);
    setPhaseFormData({
      nome: phase.nome,
      cor: phase.cor
    });
  };

  const handleUpdatePositions = async (newFases: Fase[]) => {
    try {
      const updates = newFases.map((fase, index) => ({
        id: fase.id,
        position: index + 1
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('fases')
          .update({ position: update.position })
          .eq('id', update.id);

        if (error) throw error;
      }

      onUpdate();
      toast({
        title: "Sucesso",
        description: "Posições das fases atualizadas"
      });
    } catch (error) {
      console.error('Error updating positions:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar posições",
        variant: "destructive"
      });
    }
  };

  const movePhase = (fromIndex: number, toIndex: number) => {
    const newFases = arrayMove(fases, fromIndex, toIndex);
    handleUpdatePositions(newFases);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Fases do Pipeline</CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Create/Edit Phase Form */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-medium">{editingPhase ? 'Editar Fase' : 'Nova Fase'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phase-nome">Nome da Fase</Label>
                    <Input
                      id="phase-nome"
                      value={phaseFormData.nome}
                      onChange={(e) => setPhaseFormData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Lead, Qualificado, Proposta..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="phase-cor">Cor</Label>
                    <div className="flex gap-2">
                      <Input
                        id="phase-cor"
                        type="color"
                        value={phaseFormData.cor}
                        onChange={(e) => setPhaseFormData(prev => ({ ...prev, cor: e.target.value }))}
                        className="w-16"
                      />
                      <Input
                        value={phaseFormData.cor}
                        onChange={(e) => setPhaseFormData(prev => ({ ...prev, cor: e.target.value }))}
                        placeholder="#3B82F6"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreatePhase} className="flex-1">
                    {editingPhase ? 'Atualizar' : 'Criar'} Fase
                  </Button>
                  {editingPhase && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditingPhase(null);
                        setPhaseFormData({ nome: '', cor: '#3B82F6' });
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Existing Phases List */}
            <div className="space-y-4">
              <h3 className="font-medium">Fases Existentes ({fases.length})</h3>
              {fases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma fase criada ainda. Crie a primeira fase acima.
                </p>
              ) : (
                <div className="space-y-2">
                  {fases.map((fase, index) => (
                    <Card key={fase.id}>
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="flex items-center gap-2 cursor-move">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground w-6">#{fase.position}</span>
                        </div>
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: fase.cor }}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{fase.nome}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => movePhase(index, Math.max(0, index - 1))}
                            disabled={index === 0}
                            title="Mover para cima"
                          >
                            ↑
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => movePhase(index, Math.min(fases.length - 1, index + 1))}
                            disabled={index === fases.length - 1}
                            title="Mover para baixo"
                          >
                            ↓
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditPhase(fase)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePhase(fase.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export default function CRM() {
  const { user } = useAuth();
  const [fases, setFases] = useState<Fase[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContato, setSelectedContato] = useState<Contato | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [phaseManagementOpen, setPhaseManagementOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contato | null>(null);
  const [newNote, setNewNote] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIA, setFilterIA] = useState(false);
  const [contactFormData, setContactFormData] = useState({
    nome: '',
    contato: '',
    resumo: '',
    fase_id: ''
  });

  const { toast } = useToast();
  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (user?.empresa_id) {
      fetchData();
    }
  }, [user?.empresa_id]);

  const fetchData = async () => {
    if (!user?.empresa_id) return;
    
    try {
      setLoading(true);
      
      // Fetch phases
      const { data: fasesData, error: fasesError } = await supabase
        .from('fases')
        .select('*')
        .eq('empresa_id', user.empresa_id)
        .order('position');

      if (fasesError) throw fasesError;
      setFases(fasesData || []);

      // Fetch contacts
      const { data: contatosData, error: contatosError } = await supabase
        .from('contatos')
        .select('*')
        .eq('empresa_id', user.empresa_id)
        .order('nome');

      if (contatosError) throw contatosError;
      setContatos(contatosData || []);

      // Fetch notes
      const { data: notasData, error: notasError } = await supabase
        .from('notas')
        .select('*')
        .order('created_at', { ascending: false });

      if (notasError) throw notasError;
      setNotas(notasData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do CRM",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the contact being dragged
    const contact = contatos.find(c => c.id === activeId);
    if (!contact) return;

    // Check if dropping over a phase (by checking if overId matches any phase id)
    let targetPhase = fases.find(f => f.id === overId);
    
    // If not dropping directly on a phase, check if dropping on another contact
    // and get the phase of that contact
    if (!targetPhase) {
      const targetContact = contatos.find(c => c.id === overId);
      if (targetContact) {
        targetPhase = fases.find(f => f.id === targetContact.fase_id);
      }
    }

    if (targetPhase && contact.fase_id !== targetPhase.id) {
      try {
        const { error } = await supabase
          .from('contatos')
          .update({ fase_id: targetPhase.id })
          .eq('id', activeId);

        if (error) throw error;
        
        fetchData();
        toast({
          title: "Sucesso",
          description: `Contato movido para ${targetPhase.nome}`
        });
      } catch (error) {
        console.error('Error moving contact:', error);
        toast({
          title: "Erro",
          description: "Erro ao mover contato",
          variant: "destructive"
        });
      }
    }
  };

  const handleOpenContato = (contato: Contato) => {
    setSelectedContato(contato);
    setSheetOpen(true);
  };

  const handleCreateContact = async () => {
    if (!contactFormData.nome.trim() || !contactFormData.contato.trim() || !contactFormData.fase_id) {
      toast({
        title: "Erro",
        description: "Nome, contato e fase são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingContact) {
        const { error } = await supabase
          .from('contatos')
          .update({
            nome: contactFormData.nome.trim(),
            contato: contactFormData.contato.trim(),
            resumo: contactFormData.resumo.trim() || null,
            fase_id: contactFormData.fase_id
          })
          .eq('id', editingContact.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Contato atualizado com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('contatos')
          .insert([{
            nome: contactFormData.nome.trim(),
            contato: contactFormData.contato.trim(),
            resumo: contactFormData.resumo.trim() || null,
            fase_id: contactFormData.fase_id,
            empresa_id: user?.empresa_id
          }]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Contato criado com sucesso"
        });
      }

      setContactModalOpen(false);
      setEditingContact(null);
      setContactFormData({
        nome: '',
        contato: '',
        resumo: '',
        fase_id: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar contato",
        variant: "destructive"
      });
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Tem certeza que deseja excluir este contato? Todas as notas relacionadas também serão excluídas.')) return;

    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Contato excluído com sucesso"
      });
      
      setSheetOpen(false);
      setSelectedContato(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir contato",
        variant: "destructive"
      });
    }
  };

  const handleEditContact = (contact: Contato) => {
    setEditingContact(contact);
    setContactFormData({
      nome: contact.nome,
      contato: contact.contato,
      resumo: contact.resumo || '',
      fase_id: contact.fase_id
    });
    setContactModalOpen(true);
  };

  const handleAddNota = async () => {
    if (!newNote.trim() || !selectedContato) return;

    try {
      const { error } = await supabase
        .from('notas')
        .insert([{
          texto: newNote.trim(),
          contato_id: selectedContato.id
        }]);

      if (error) throw error;
      
      setNewNote('');
      fetchData();
      toast({
        title: "Sucesso",
        description: "Nota adicionada com sucesso"
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar nota",
        variant: "destructive"
      });
    }
  };

  const handleUpdateObservacoesIA = async (observacoes: string) => {
    if (!selectedContato) return;

    try {
      const { error } = await supabase
        .from('contatos')
        .update({ observacoes_ia: observacoes })
        .eq('id', selectedContato.id);

      if (error) throw error;
      
      // Update local state
      setSelectedContato(prev => prev ? { ...prev, observacoes_ia: observacoes } : null);
      setContatos(prev => prev.map(c => 
        c.id === selectedContato.id ? { ...c, observacoes_ia: observacoes } : c
      ));
      
      toast({
        title: "Sucesso",
        description: "Observações para IA atualizadas"
      });
    } catch (error) {
      console.error('Error updating IA observations:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar observações",
        variant: "destructive"
      });
    }
  };

  const getContatosByFase = (faseId: string) => {
    let filtered = contatos;
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.nome.toLowerCase().includes(term) || 
        c.contato.toLowerCase().includes(term)
      );
    }
    
    // IA filter
    if (filterIA) {
      filtered = filtered.filter(c => !!c.observacoes_ia);
    }

    // Phase filter
    const isFirstPhase = fases.length > 0 && fases[0].id === faseId;
    if (isFirstPhase) {
      return filtered.filter(contato => contato.fase_id === faseId || !contato.fase_id);
    }
    return filtered.filter(contato => contato.fase_id === faseId);
  };

  const getNotasByContato = (contatoId: string) => {
    return notas.filter(nota => nota.contato_id === contatoId);
  };

  const getFaseColor = (faseId: string) => {
    const fase = fases.find(f => f.id === faseId);
    return fase?.cor || '#3B82F6';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const activeContact = activeId ? contatos.find(c => c.id === activeId) : null;

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-100px)] flex flex-col gap-6 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Pipeline de Vendas</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Gerencie seus leads e oportunidades de negócio
            </p>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                className="pl-9 bg-card border-none shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
              variant={filterIA ? "default" : "outline"} 
              size="icon"
              onClick={() => setFilterIA(!filterIA)}
              className="shrink-0"
              title="Filtrar por Observações IA"
            >
              <Bot className={cn("h-4 w-4", filterIA && "animate-pulse")} />
            </Button>
            <div className="h-8 w-[1px] bg-border mx-1 hidden md:block" />
            <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0 shadow-md">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Contato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingContact ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-nome">Nome</Label>
                    <Input
                      id="contact-nome"
                      value={contactFormData.nome}
                      onChange={(e) => setContactFormData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-contato">WhatsApp / Contato</Label>
                    <Input
                      id="contact-contato"
                      value={contactFormData.contato}
                      onChange={(e) => setContactFormData(prev => ({ ...prev, contato: e.target.value }))}
                      placeholder="Ex: 5511999999999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-fase">Mover para Fase</Label>
                    <select
                      id="contact-fase"
                      value={contactFormData.fase_id}
                      onChange={(e) => setContactFormData(prev => ({ ...prev, fase_id: e.target.value }))}
                      className="w-full p-2 border border-input rounded-md bg-background text-sm"
                    >
                      <option value="">Selecione uma fase</option>
                      {fases.map(fase => (
                        <option key={fase.id} value={fase.id}>{fase.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-resumo">Resumo (opcional)</Label>
                    <Textarea
                      id="contact-resumo"
                      value={contactFormData.resumo}
                      onChange={(e) => setContactFormData(prev => ({ ...prev, resumo: e.target.value }))}
                      placeholder="Breve descrição do lead..."
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleCreateContact} className="w-full">
                    {editingContact ? 'Salvar Alterações' : 'Criar Contato'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              variant="ghost"
              size="icon"
              onClick={() => setPhaseManagementOpen(true)}
              className="shrink-0"
              title="Configurações de Fases"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {fases.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card/50 rounded-2xl border-2 border-dashed">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <Kanban className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Seu funil está vazio</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Comece criando as fases do seu pipeline de vendas para organizar seus leads.
            </p>
            <Button onClick={() => setPhaseManagementOpen(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Fase
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* Scrollable Kanban Container */}
            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
              <div className="flex gap-6 h-full min-w-full">
                {fases.map((fase) => {
                  const contatosFase = getContatosByFase(fase.id);
                  return (
                    <div 
                      key={fase.id} 
                      className="flex flex-col w-[320px] shrink-0 bg-secondary/30 rounded-2xl border border-border/50 overflow-hidden"
                    >
                      {/* Phase Header */}
                      <div 
                        className="p-4 flex items-center justify-between border-b bg-background/50"
                        style={{ borderTop: `4px solid ${fase.cor}` }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <h3 className="font-bold text-sm truncate uppercase tracking-wider">{fase.nome}</h3>
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-muted/50">
                            {contatosFase.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 hover:opacity-100">
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Droppable Column */}
                      <ScrollArea className="flex-1 p-3">
                        <Droppable id={fase.id} className="min-h-full">
                          <SortableContext id={fase.id} items={contatosFase.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-3 pb-4">
                              {contatosFase.map((contato) => (
                                <DraggableContact
                                  key={contato.id}
                                  contato={contato}
                                  onOpenContato={handleOpenContato}
                                />
                              ))}
                              
                              {contatosFase.length === 0 && !activeId && (
                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/10 rounded-xl text-muted-foreground/30">
                                  <Move className="h-8 w-8 mb-2 opacity-20" />
                                  <p className="text-[10px] font-medium uppercase tracking-widest">Vazio</p>
                                </div>
                              )}
                            </div>
                          </SortableContext>
                        </Droppable>
                      </ScrollArea>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
              {activeContact ? (
                <div className="w-[310px] transform rotate-2">
                  <DraggableContact
                    contato={activeContact}
                    onOpenContato={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Phase Management Modal */}
        <PhaseManagementModal
          open={phaseManagementOpen}
          onOpenChange={setPhaseManagementOpen}
          fases={fases}
          onUpdate={fetchData}
          user={user}
        />

        {/* Contact Details Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Detalhes do Contato</SheetTitle>
            </SheetHeader>
            
            {selectedContato && (
              <div className="space-y-6 mt-6">
                {/* Contact Info */}
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={selectedContato.profile_img_url} />
                          <AvatarFallback className="text-lg">
                            {formatContactName(selectedContato.nome).split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-xl font-semibold">{formatContactName(selectedContato.nome)}</h3>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{formatContactName(selectedContato.contato)}</span>
                          </div>
                        </div>
                     </div>
                     <div className="flex gap-2">
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => handleEditContact(selectedContato)}
                       >
                         <Edit className="h-4 w-4" />
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => handleDeleteContact(selectedContato.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                   </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Fase atual:</span>
                    <Badge style={{ backgroundColor: getFaseColor(selectedContato.fase_id) }}>
                      {fases.find(f => f.id === selectedContato.fase_id)?.nome}
                    </Badge>
                  </div>
                  
                   {selectedContato.resumo && (
                     <div>
                       <h4 className="font-medium mb-2">Resumo do Contato</h4>
                       <div className="text-sm text-muted-foreground bg-muted p-3 rounded max-h-32 overflow-y-auto">
                         <pre className="whitespace-pre-wrap font-sans">{selectedContato.resumo}</pre>
                       </div>
                     </div>
                   )}
                </div>

                {/* Tabs for Notes and IA Observations */}
                <Tabs defaultValue="notes" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="notes">Timeline de Notas</TabsTrigger>
                    <TabsTrigger value="ia-notes">Observações para IA</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="notes" className="space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Adicionar nova nota..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={3}
                      />
                      <Button 
                        onClick={handleAddNota}
                        disabled={!newNote.trim()}
                        className="w-full"
                      >
                        Adicionar Nota
                      </Button>
                    </div>
                    
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {getNotasByContato(selectedContato.id).map((nota) => (
                        <div key={nota.id} className="border-l-2 border-primary pl-4 pb-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(nota.created_at)}
                          </div>
                          <p className="text-sm">{nota.texto}</p>
                        </div>
                      ))}
                      
                      {getNotasByContato(selectedContato.id).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma nota encontrada. Adicione a primeira nota acima.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="ia-notes" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ia-observations">Observações para IA</Label>
                      <Textarea
                        id="ia-observations"
                        placeholder="Digite observações específicas para a IA usar no atendimento..."
                        value={selectedContato.observacoes_ia || ''}
                        onChange={(e) => handleUpdateObservacoesIA(e.target.value)}
                        rows={6}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Estas observações serão utilizadas pela IA durante o atendimento deste contato.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
