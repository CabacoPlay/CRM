import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Bot, MessageCircle, Download, Upload, Trash2, Edit, HelpCircle, Image as ImageIcon, Mic, FileText, Zap, CalendarCheck, Check, RefreshCw, Copy } from 'lucide-react';
import { IA, FAQ, Connection } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
const SkeletonCard = () => <Card>
    <CardHeader>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-20 w-full mb-4" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-16" />
      </div>
    </CardContent>
  </Card>;
const PROMPT_TEMPLATES = {
  vendas: `Você é uma assistente de vendas altamente persuasiva e empática.
Seu objetivo é entender a dor do cliente, qualificar o lead e levar para o fechamento ou agendamento.
Use uma linguagem natural, evite textos longos e sempre termine com uma pergunta que estimule a resposta.`,
  suporte: `Você é uma assistente de suporte técnico paciente e resolutiva.
Seu objetivo é ajudar o cliente a resolver problemas de forma rápida e clara.
Se não souber a resposta, peça desculpas e informe que vai encaminhar para um especialista humano.`,
  agendamento: `Você é uma secretária eficiente focada em organização de agenda.
Seu objetivo é consultar os horários disponíveis e realizar o agendamento de serviços.
Seja direta, educada e confirme todos os dados antes de finalizar o agendamento.`
};

export default function IAPage() {
  const {
    user
  } = useAuth();
  const [ias, setIas] = useState<IA[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connLoading, setConnLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [selectedIA, setSelectedIA] = useState<IA | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [iaToDelete, setIAToDelete] = useState<IA | null>(null);
  const [faqToDelete, setFaqToDelete] = useState<FAQ | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    personalidade: 'Formal' as 'Formal' | 'Informal' | 'Casual',
    prompt: '',
    sexo: 'Masculino' as 'Masculino' | 'Feminino',
    ativa: true,
    vision_ativo: true,
    whisper_ativo: true,
    rag_ativo: false,
    openia_key: ''
  });
  const [faqFormData, setFaqFormData] = useState({
    pergunta: '',
    resposta: ''
  });
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    toast
  } = useToast();
  const fetchIAs = async () => {
    if (!user?.empresa_id) return;
    try {
      const {
        data,
        error
      } = await supabase.from('ias').select('*').eq('empresa_id', user.empresa_id).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setIas((data || []) as IA[]);
    } catch (error) {
      console.error('Error fetching IAs:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar IAs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchFAQs = async (iaId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('faqs').select('*').eq('ia_id', iaId).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar FAQs",
        variant: "destructive"
      });
    }
  };
  const fetchConnections = async () => {
    if (!user?.empresa_id) return;
    try {
      const { data, error } = await supabase
        .from('conexoes')
        .select('*')
        .eq('empresa_id', user.empresa_id);
      
      if (error) throw error;
      setConnections((data || []) as Connection[]);
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const handleToggleConnection = async (connection: Connection, isLinked: boolean) => {
    if (!selectedIA) return;
    
    setConnLoading(true);
    try {
      const iaIdForWebhook = isLinked ? null : selectedIA.id;
      const tipo = isLinked ? "remoção" : "cadastro";

      // Send webhook
      const { error: webhookError } = await supabase.functions.invoke('whatsapp-webhook', {
        body: {
          whatsapp_id: connection.id,
          ia_id: iaIdForWebhook,
          tipo: tipo
        }
      });
      
      if (webhookError) throw webhookError;

      // Update database
      const { error: updateError } = await supabase
        .from('conexoes')
        .update({ id_ia: iaIdForWebhook } as any)
        .eq('id', connection.id);
      
      if (updateError) throw updateError;
      
      // Update local state
      setConnections(prev => prev.map(conn => 
        conn.id === connection.id 
          ? { ...conn, id_ia: iaIdForWebhook } as Connection
          : conn
      ));

      toast({
        title: isLinked ? "Conexão Removida" : "Conexão Vinculada",
        description: `IA ${isLinked ? 'removida de' : 'vinculada a'} ${connection.nome_api} com sucesso.`
      });
    } catch (error) {
      console.error('Error toggling connection:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar vínculo da conexão.",
        variant: "destructive"
      });
    } finally {
      setConnLoading(false);
    }
  };

  useEffect(() => {
    if (user?.empresa_id) {
      fetchIAs();
      fetchConnections();
    }
  }, [user?.empresa_id]);
  useEffect(() => {
    if (selectedIA) {
      fetchFAQs(selectedIA.id);
    }
  }, [selectedIA]);
  const generateRandomImage = (sexo: string) => {
    const maleImages = ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face'];
    const femaleImages = ['https://images.unsplash.com/photo-1494790108755-2616b45c0c1e?w=400&h=400&fit=crop&crop=face', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face', 'https://images.unsplash.com/photo-1531123414780-f74242c2b052?w=400&h=400&fit=crop&crop=face'];
    const images = sexo === 'Masculino' ? maleImages : femaleImages;
    return images[Math.floor(Math.random() * images.length)];
  };
  const handleCreateIA = async () => {
    if (!formData.nome.trim() || !formData.prompt.trim() || !formData.openia_key.trim()) {
      setFormError('Nome, prompt e OpenIA Key são obrigatórios');
      return;
    }
    if (!user?.empresa_id) {
      setFormError('Usuário deve ter uma empresa associada');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const profile_img_url = generateRandomImage(formData.sexo);
      const {
        data,
        error
      } = await supabase.from('ias').insert([{
        nome: formData.nome.trim(),
        personalidade: formData.personalidade,
        prompt: formData.prompt.trim(),
        sexo: formData.sexo,
        profile_img_url,
        ativa: formData.ativa,
        vision_ativo: formData.vision_ativo,
        whisper_ativo: formData.whisper_ativo,
        rag_ativo: formData.rag_ativo,
        openia_key: formData.openia_key.trim(),
        empresa_id: user.empresa_id
      }]).select().single();
      if (error) throw error;
      setIas([data as IA, ...ias]);
      setCreateModalOpen(false);
      setFormData({
        nome: '',
        personalidade: 'Formal',
        prompt: '',
        sexo: 'Masculino',
        ativa: true,
        vision_ativo: true,
        whisper_ativo: true,
        rag_ativo: false,
        openia_key: ''
      });
      toast({
        title: "Sucesso",
        description: "IA criada com sucesso"
      });
    } catch (error) {
      console.error('Error creating IA:', error);
      setFormError('Erro ao criar IA. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };
  const handleUpdateIA = async (updatedIA: Partial<IA>) => {
    if (!selectedIA) return;
    try {
      const {
        data,
        error
      } = await supabase.from('ias').update(updatedIA).eq('id', selectedIA.id).select().single();
      if (error) throw error;
      setIas(ias.map(ia => ia.id === selectedIA.id ? data as IA : ia));
      setSelectedIA(data as IA);
      toast({
        title: "Sucesso",
        description: "IA atualizada com sucesso"
      });
    } catch (error) {
      console.error('Error updating IA:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar IA",
        variant: "destructive"
      });
    }
  };
  const handleDeleteIA = async () => {
    if (!iaToDelete) return;
    try {
      const {
        error
      } = await supabase.from('ias').delete().eq('id', iaToDelete.id);
      if (error) throw error;
      setIas(ias.filter(ia => ia.id !== iaToDelete.id));
      setDeleteDialogOpen(false);
      setIAToDelete(null);
      if (selectedIA?.id === iaToDelete.id) {
        setDetailsSheetOpen(false);
        setSelectedIA(null);
      }
      toast({
        title: "Sucesso",
        description: "IA excluída com sucesso"
      });
    } catch (error) {
      console.error('Error deleting IA:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir IA",
        variant: "destructive"
      });
    }
  };
  const handleCreateFAQ = async () => {
    if (!selectedIA || !faqFormData.pergunta.trim() || !faqFormData.resposta.trim()) {
      return;
    }
    try {
      const {
        data,
        error
      } = await supabase.from('faqs').insert([{
        pergunta: faqFormData.pergunta.trim(),
        resposta: faqFormData.resposta.trim(),
        ia_id: selectedIA.id
      }]).select().single();
      if (error) throw error;
      setFaqs([data, ...faqs]);
      setFaqFormData({
        pergunta: '',
        resposta: ''
      });
      toast({
        title: "Sucesso",
        description: "FAQ adicionada com sucesso"
      });
    } catch (error) {
      console.error('Error creating FAQ:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar FAQ",
        variant: "destructive"
      });
    }
  };
  const handleUpdateFAQ = async () => {
    if (!editingFaq || !faqFormData.pergunta.trim() || !faqFormData.resposta.trim()) {
      return;
    }
    try {
      const {
        data,
        error
      } = await supabase.from('faqs').update({
        pergunta: faqFormData.pergunta.trim(),
        resposta: faqFormData.resposta.trim()
      }).eq('id', editingFaq.id).select().single();
      if (error) throw error;
      setFaqs(faqs.map(faq => faq.id === editingFaq.id ? data : faq));
      setEditingFaq(null);
      setFaqFormData({
        pergunta: '',
        resposta: ''
      });
      toast({
        title: "Sucesso",
        description: "FAQ atualizada com sucesso"
      });
    } catch (error) {
      console.error('Error updating FAQ:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar FAQ",
        variant: "destructive"
      });
    }
  };
  const handleDeleteFAQ = async () => {
    if (!faqToDelete) return;
    try {
      const {
        error
      } = await supabase.from('faqs').delete().eq('id', faqToDelete.id);
      if (error) throw error;
      setFaqs(faqs.filter(faq => faq.id !== faqToDelete.id));
      setFaqToDelete(null);
      toast({
        title: "Sucesso",
        description: "FAQ excluída com sucesso"
      });
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir FAQ",
        variant: "destructive"
      });
    }
  };
  const handleOpenDetails = (ia: IA) => {
    setSelectedIA(ia);
    setDetailsSheetOpen(true);
  };
  const startEditFaq = (faq: FAQ) => {
    setEditingFaq(faq);
    setFaqFormData({
      pergunta: faq.pergunta,
      resposta: faq.resposta
    });
  };
  const cancelEditFaq = () => {
    setEditingFaq(null);
    setFaqFormData({
      pergunta: '',
      resposta: ''
    });
  };
  const handleExportCSV = () => {
    if (!selectedIA || faqs.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há FAQs para exportar",
        variant: "destructive"
      });
      return;
    }
    const headers = ['Pergunta', 'Resposta'];
    const csvContent = [headers.join(','), ...faqs.map(faq => [`"${faq.pergunta.replace(/"/g, '""')}"`, `"${faq.resposta.replace(/"/g, '""')}"`].join(','))].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `faqs_${selectedIA.nome.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Sucesso",
      description: "FAQs exportadas com sucesso"
    });
  };
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedIA) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          toast({
            title: "Erro",
            description: "Arquivo CSV deve ter pelo menos uma linha de dados além do cabeçalho",
            variant: "destructive"
          });
          return;
        }

        // Skip header line
        const dataLines = lines.slice(1);
        const importedFaqs = [];
        for (const line of dataLines) {
          const matches = line.match(/^"([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)"/);
          if (matches) {
            const pergunta = matches[1].replace(/""/g, '"').trim();
            const resposta = matches[2].replace(/""/g, '"').trim();
            if (pergunta && resposta) {
              importedFaqs.push({
                pergunta,
                resposta,
                ia_id: selectedIA.id
              });
            }
          }
        }
        if (importedFaqs.length === 0) {
          toast({
            title: "Erro",
            description: "Nenhuma FAQ válida encontrada no arquivo",
            variant: "destructive"
          });
          return;
        }
        const {
          data,
          error
        } = await supabase.from('faqs').insert(importedFaqs).select();
        if (error) throw error;
        setFaqs([...data, ...faqs]);
        toast({
          title: "Sucesso",
          description: `${importedFaqs.length} FAQs importadas com sucesso`
        });

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast({
          title: "Erro",
          description: "Erro ao importar arquivo CSV",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };
  const isFormValid = formData.nome.trim() && formData.prompt.trim() && formData.openia_key.trim();
  const isFaqFormValid = faqFormData.pergunta.trim() && faqFormData.resposta.trim();
  return <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">IA & Prompts</h1>
            <p className="text-muted-foreground">Gerencie assistentes de IA e seus prompts</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova IA
          </Button>
        </div>

        {loading && ias.length === 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div> : ias.length === 0 ? <div className="text-center py-12">
            <Bot className="mx-auto h-16 w-16 mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma IA cadastrada</h3>
            <p className="text-muted-foreground mb-6">Comece criando sua primeira IA para automatizar atendimentos</p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira IA
            </Button>
          </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {ias.map(ia => <Card key={ia.id} className="group overflow-hidden border-muted/40 hover:border-primary/30 hover:shadow-xl transition-all duration-300">
                <div className="h-1.5 w-full bg-gradient-to-r from-primary/80 to-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="relative group/avatar">
                        {ia.profile_img_url ? (
                          <div className="relative h-16 w-16 rounded-2xl overflow-hidden ring-2 ring-background shadow-md">
                            <img src={ia.profile_img_url} alt={`${ia.nome} profile`} className="h-full w-full object-cover transition-transform group-hover/avatar:scale-110" />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md ring-2 ring-background">
                            <Bot className="h-8 w-8 text-primary-foreground" />
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background shadow-sm ${ia.ativa ? 'bg-success' : 'bg-muted'}`} />
                      </div>
                      
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">
                          {ia.nome}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-muted/50 text-[10px] uppercase font-bold tracking-wider py-0 px-2 h-5 border-none">
                            {ia.personalidade}
                          </Badge>
                          <Badge variant="secondary" className="bg-muted/50 text-[10px] uppercase font-bold tracking-wider py-0 px-2 h-5 border-none">
                            {ia.sexo}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant={ia.ativa ? "success" : "secondary"} className="shadow-sm">
                        {ia.ativa ? "Ativa" : "Inativa"}
                      </Badge>
                      {!ia.openia_key && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="animate-pulse py-0 px-1.5 text-[10px] h-5">
                                Sem API Key
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Configuração obrigatória pendente</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="relative">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 italic min-h-[2.5rem]">
                      "{ia.prompt}"
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background to-transparent" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-muted/30">
                    <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${ia.whisper_ativo !== false ? 'bg-green-500/5 text-green-600' : 'bg-muted/20 text-muted-foreground opacity-40'}`}>
                      <Mic className="h-4 w-4 mb-1" />
                      <span className="text-[9px] font-bold uppercase">Voz</span>
                    </div>
                    <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${ia.vision_ativo !== false ? 'bg-blue-500/5 text-blue-600' : 'bg-muted/20 text-muted-foreground opacity-40'}`}>
                      <ImageIcon className="h-4 w-4 mb-1" />
                      <span className="text-[9px] font-bold uppercase">Visão</span>
                    </div>
                    <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${ia.prompt?.includes('[AGENDAMENTO_AUTO]') ? 'bg-primary/5 text-primary' : 'bg-muted/20 text-muted-foreground opacity-40'}`}>
                      <CalendarCheck className="h-4 w-4 mb-1" />
                      <span className="text-[9px] font-bold uppercase">Agenda</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all" onClick={() => {
                              navigator.clipboard.writeText(ia.prompt);
                              toast({ title: "Prompt copiado", description: "O prompt foi copiado para a área de transferência." });
                            }}>
                              <Copy className="h-4.5 w-4.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copiar Prompt</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all" onClick={() => {
                              setIAToDelete(ia);
                              setDeleteDialogOpen(true);
                            }}>
                              <Trash2 className="h-4.5 w-4.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir IA</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <Button onClick={() => handleOpenDetails(ia)} className="h-9 px-6 rounded-xl font-bold shadow-sm transition-transform active:scale-95">
                      Gerenciar
                      <Edit className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>)}
          </div>}
      </div>

      {/* Create IA Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Criar Nova IA</DialogTitle>
            <DialogDescription>
              Configure uma nova IA para automatizar atendimentos
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome da IA</Label>
              <Input id="nome" value={formData.nome} onChange={e => setFormData({
              ...formData,
              nome: e.target.value
            })} placeholder="Ex: Assistente de Vendas" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="personalidade">Personalidade</Label>
              <Select value={formData.personalidade} onValueChange={value => setFormData({
              ...formData,
              personalidade: value as 'Formal' | 'Informal' | 'Casual'
            })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Formal">Formal</SelectItem>
                  <SelectItem value="Informal">Informal</SelectItem>
                  <SelectItem value="Casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sexo">Sexo</Label>
              <Select value={formData.sexo} onValueChange={value => setFormData({
              ...formData,
              sexo: value as 'Masculino' | 'Feminino'
            })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="openia_key">OpenIA Key</Label>
              <Input id="openia_key" type="password" value={formData.openia_key} onChange={e => setFormData({
              ...formData,
              openia_key: e.target.value
            })} placeholder="sk-..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prompt">Prompt da IA</Label>
              <Textarea id="prompt" value={formData.prompt} onChange={e => setFormData({
              ...formData,
              prompt: e.target.value
            })} placeholder="Descreva como a IA deve se comportar..." rows={4} className="resize-y min-h-[100px] max-h-[200px]" />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="ativa" checked={formData.ativa} onCheckedChange={checked => setFormData({
              ...formData,
              ativa: checked
            })} />
              <Label htmlFor="ativa">IA ativa</Label>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateIA} disabled={!isFormValid || submitting}>
              {submitting ? "Criando..." : "Criar IA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IA Details Sheet */}
      <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
        <SheetContent className="sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>{selectedIA?.nome}</SheetTitle>
            <SheetDescription>
              Gerencie as configurações e FAQs desta IA
            </SheetDescription>
          </SheetHeader>
          
          {selectedIA && <Tabs defaultValue="info" className="mt-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="prompt">Prompt</TabsTrigger>
                <TabsTrigger value="faqs">FAQs</TabsTrigger>
                <TabsTrigger value="multimodal">Multimodal</TabsTrigger>
                <TabsTrigger value="connections">Conexões</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4">
                <TooltipProvider>
                  <div className="grid gap-4">
                    <div>
                      <Label>Nome da IA</Label>
                      <Input value={selectedIA.nome} onChange={e => handleUpdateIA({
                    nome: e.target.value
                  })} />
                    </div>
                    <div>
                      <Label>Personalidade</Label>
                      <Select value={selectedIA.personalidade} onValueChange={(value: 'Formal' | 'Informal' | 'Casual') => handleUpdateIA({
                    personalidade: value
                  })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Formal">Formal</SelectItem>
                          <SelectItem value="Informal">Informal</SelectItem>
                          <SelectItem value="Casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sexo</Label>
                      <Select value={selectedIA.sexo} onValueChange={(value: 'Masculino' | 'Feminino') => {
                    const newImg = generateRandomImage(value);
                    handleUpdateIA({
                      sexo: value,
                      profile_img_url: newImg
                    });
                  }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Masculino">Masculino</SelectItem>
                          <SelectItem value="Feminino">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>OpenIA Key</Label>
                      <Input type="password" value={selectedIA.openia_key || ''} onChange={e => handleUpdateIA({
                    openia_key: e.target.value
                  })} placeholder="sk-..." />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Label>Mensagem de Reativação</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Mensagem chave enviada por você no atendimento que reativa a IA</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Textarea value={selectedIA.msg_reativacao || ''} onChange={e => handleUpdateIA({
                    msg_reativacao: e.target.value
                  })} placeholder="Digite a mensagem que reativa a IA..." rows={3} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch checked={selectedIA.ativa} onCheckedChange={checked => handleUpdateIA({
                    ativa: checked
                  })} />
                      <Label>IA ativa</Label>
                    </div>
                  </div>
                </TooltipProvider>
              </TabsContent>
              
              <TabsContent value="prompt" className="space-y-4">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <Label>Prompt da IA</Label>
                  <Select onValueChange={(value) => {
                    if (value && PROMPT_TEMPLATES[value as keyof typeof PROMPT_TEMPLATES]) {
                      handleUpdateIA({ prompt: PROMPT_TEMPLATES[value as keyof typeof PROMPT_TEMPLATES] });
                    }
                  }}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Usar um modelo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendas">Modelo: Vendas</SelectItem>
                      <SelectItem value="suporte">Modelo: Suporte</SelectItem>
                      <SelectItem value="agendamento">Modelo: Agendamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea value={selectedIA.prompt} onChange={e => handleUpdateIA({
                prompt: e.target.value
              })} rows={10} className="resize-y min-h-[400px] max-h-[400px]" />
              </TabsContent>
              
              <TabsContent value="faqs" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">FAQs ({faqs.length})</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                      <Download className="mr-2 h-4 w-4" />
                      Exportar CSV
                    </Button>
                    <div className="relative">
                      <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportCSV} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <Button variant="outline" size="sm">
                        <Upload className="mr-2 h-4 w-4" />
                        Importar CSV
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {editingFaq ? 'Editar FAQ' : 'Nova FAQ'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Pergunta</Label>
                        <Input value={faqFormData.pergunta} onChange={e => setFaqFormData({
                      ...faqFormData,
                      pergunta: e.target.value
                    })} placeholder="Digite a pergunta..." />
                      </div>
                      <div>
                        <Label>Resposta</Label>
                        <Textarea value={faqFormData.resposta} onChange={e => setFaqFormData({
                      ...faqFormData,
                      resposta: e.target.value
                    })} placeholder="Digite a resposta..." rows={3} />
                      </div>
                      <div className="flex gap-2">
                        {editingFaq ? <>
                            <Button onClick={handleUpdateFAQ} disabled={!isFaqFormValid} size="sm">
                              Salvar alterações
                            </Button>
                            <Button variant="outline" onClick={cancelEditFaq} size="sm">
                              Cancelar
                            </Button>
                          </> : <Button onClick={handleCreateFAQ} disabled={!isFaqFormValid} size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar FAQ
                          </Button>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {faqs.map(faq => <Card key={faq.id} className="shrink-0">
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium">{faq.pergunta}</h4>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => startEditFaq(faq)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setFaqToDelete(faq)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground max-h-20 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-sans">{faq.resposta}</pre>
                          </div>
                        </div>
                      </CardContent>
                    </Card>)}
                  
                  {faqs.length === 0 && <div className="text-center py-8 text-muted-foreground">
                      <MessageCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Nenhuma FAQ cadastrada</h3>
                      <p>Adicione perguntas frequentes para esta IA</p>
                    </div>}
                </div>
              </TabsContent>
              
              <TabsContent value="multimodal" className="space-y-6">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Capacidades Multimodais
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ative recursos avançados para que sua IA processe diferentes tipos de mídia.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-full">
                        <ImageIcon className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium">Processamento de Imagens</p>
                        <p className="text-xs text-muted-foreground">Analisa fotos, prints e documentos visuais.</p>
                      </div>
                    </div>
                    <Switch 
                      checked={selectedIA?.vision_ativo ?? true} 
                      onCheckedChange={(checked) => handleUpdateIA({ vision_ativo: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-full">
                        <Mic className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">Transcrição de Áudio (Whisper)</p>
                        <p className="text-xs text-muted-foreground">Ouve e responde mensagens de voz no WhatsApp.</p>
                      </div>
                    </div>
                    <Switch 
                      checked={selectedIA?.whisper_ativo ?? true} 
                      onCheckedChange={(checked) => handleUpdateIA({ whisper_ativo: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/10 rounded-full">
                        <FileText className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium">Leitura de Documentos (RAG)</p>
                        <p className="text-xs text-muted-foreground">Consulta PDFs e arquivos para dar respostas precisas.</p>
                      </div>
                    </div>
                    <Switch 
                      checked={selectedIA?.rag_ativo ?? false} 
                      onCheckedChange={(checked) => handleUpdateIA({ rag_ativo: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <CalendarCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold">Agendamento Automático</p>
                        <p className="text-xs text-muted-foreground">Permite que a IA consulte e marque horários na sua agenda.</p>
                      </div>
                    </div>
                    <Switch 
                      checked={selectedIA?.prompt?.includes('[AGENDAMENTO_AUTO]')} 
                      onCheckedChange={async (checked) => {
                        const today = new Date().toLocaleDateString('pt-BR', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                        
                        const tag = '[AGENDAMENTO_AUTO]';
                        const agendaInstruction = `\n\n${tag}\n[PRODUTO FINAL - SDR LARA]
- VOCÊ É UMA SDR DE ALTA PERFORMANCE.
- **IDENTIFICAÇÃO**: O sistema já capturou o número do cliente. Use o campo 'contato_cliente' apenas para registrar no banco.
- **AÇÃO**: Confirmou? Agende imediatamente usando 'agendar_servico'.
- **DADOS TÉCNICOS**:
  1. nome_cliente: (Nome capturado)
  2. contato_cliente: (Injetado pelo n8n)
  3. servico: (Desejo do cliente)
  4. data_hora: (ISO: YYYY-MM-DDTHH:mm:ss-03:00)
  5. empresa_id: ${selectedIA?.empresa_id}

- Data de Hoje: ${today}.
- Regra: Seja humana, breve e eficiente.`;
                        
                        let newPrompt = selectedIA?.prompt || '';
                        
                        // Limpeza robusta: Remove tudo que estiver entre a TAG e a próxima TAG ou bloco antigo
                        if (newPrompt.includes(tag)) {
                          const parts = newPrompt.split(tag);
                          // Mantém apenas o que NÃO contém instruções de agendamento conhecidas
                          newPrompt = parts.filter(p => !p.includes('agendar_servico') && !p.includes('data_hora')).join('\n').trim();
                        }

                        if (checked) {
                          // Inserir no INÍCIO para prioridade absoluta
                          newPrompt = `${agendaInstruction}\n\n${newPrompt}`.trim();
                        }

                        // Atualiza localmente primeiro para o botão "sentir" o clique
                        setSelectedIA({ ...selectedIA!, prompt: newPrompt });
                        
                        // Depois sincroniza com o banco
                        await handleUpdateIA({ prompt: newPrompt });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Modelo de IA Recomendado</Label>
                  <Select defaultValue="gpt-4o">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o (Multimodal Nativo)</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Modelos multimodais consomem mais tokens por requisição.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="connections" className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    Instâncias WhatsApp
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vincule esta IA às suas instâncias do WhatsApp para começar o atendimento.
                  </p>
                </div>

                <div className="space-y-3">
                  {connections.map(connection => {
                    const isLinked = connection.id_ia === selectedIA.id;
                    const isOtherIA = connection.id_ia && connection.id_ia !== selectedIA.id;
                    
                    return (
                      <div 
                        key={connection.id} 
                        className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                          isLinked ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${isLinked ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <MessageCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-sm sm:text-base">{connection.nome_api}</p>
                            <p className="text-xs text-muted-foreground">
                              {connection.telefone || 'Sem número configurado'}
                            </p>
                            {isOtherIA && (
                              <p className="text-[10px] text-orange-500 font-medium mt-1">
                                Vinculada a outra IA
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant={connection.status === 'conectado' ? 'success' : 'secondary'} className="hidden sm:flex">
                            {connection.status === 'conectado' ? 'Conectado' : 'Desconectado'}
                          </Badge>
                          <Switch 
                            checked={isLinked} 
                            disabled={connLoading}
                            onCheckedChange={() => handleToggleConnection(connection, isLinked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                  
                  {connections.length === 0 && (
                    <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed">
                      <Zap className="mx-auto h-12 w-12 mb-4 text-muted-foreground opacity-30" />
                      <h3 className="text-lg font-medium mb-1">Nenhuma conexão encontrada</h3>
                      <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
                        Configure uma instância na página de Conexões primeiro.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>}
        </SheetContent>
      </Sheet>

      {/* Delete IA Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir IA</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a IA "{iaToDelete?.nome}"? Esta ação não pode ser desfeita e todas as FAQs associadas também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteIA}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete FAQ Confirmation */}
      <AlertDialog open={!!faqToDelete} onOpenChange={() => setFaqToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta FAQ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFAQ}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>;
}