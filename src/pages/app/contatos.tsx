import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageSquare, Send, Loader2, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatContactName } from '@/lib/utils';

type ContatoRow = {
  id: string;
  nome: string;
  contato: string;
  resumo?: string | null;
  profile_img_url?: string | null;
  conexao_id?: string | null;
  conversa_status?: 'aberta' | 'resolvida' | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export default function ContatosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const empresaId = user?.empresa_id ?? null;

  const [loading, setLoading] = useState(true);
  const [contatos, setContatos] = useState<ContatoRow[]>([]);
  const [search, setSearch] = useState('');

  const [startOpen, setStartOpen] = useState(false);
  const [startContato, setStartContato] = useState<ContatoRow | null>(null);
  const [startText, setStartText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!empresaId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('contatos')
        .select('id,nome,contato,resumo,profile_img_url,conexao_id,conversa_status,updated_at,created_at')
        .eq('empresa_id', empresaId)
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível carregar os contatos.', variant: 'destructive' });
      } else {
        setContatos((data || []) as any);
      }
      setLoading(false);
    };
    load();
  }, [empresaId, toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const onlyDigits = (s: string) => s.replace(/\D/g, '');
    const qDigits = onlyDigits(q);
    const list = contatos.filter((c) => {
      if (!q) return true;
      const nome = String(c.nome || '').toLowerCase();
      const contato = String(c.contato || '').toLowerCase();
      const resumo = String(c.resumo || '').toLowerCase();
      return (
        nome.includes(q) ||
        contato.includes(q) ||
        resumo.includes(q) ||
        (qDigits && onlyDigits(contato).includes(qDigits))
      );
    });
    return list;
  }, [contatos, search]);

  const openChat = (c: ContatoRow) => {
    navigate(`/app/chat?contato=${encodeURIComponent(c.id)}`);
  };

  const openStart = (c: ContatoRow) => {
    setStartContato(c);
    setStartText('');
    setStartOpen(true);
  };

  const sendFirst = async () => {
    if (!empresaId || !startContato?.id) return;
    const text = startText.trim();
    if (!text) return;
    setSending(true);
    try {
      const payloadFull: any = {
        contato_id: startContato.id,
        empresa_id: empresaId,
        direcao: 'out',
        conteudo: text,
        sender_user_id: user?.id ?? null,
        sender_name: user?.nome ?? null,
        status: 'pendente',
        conexao_id: startContato.conexao_id || null,
      };
      let { data: inserted, error } = await supabase.from('mensagens').insert(payloadFull).select('id').single();
      if (error && String(error.message || '').includes('sender_')) {
        const payloadFallback: any = {
          contato_id: startContato.id,
          empresa_id: empresaId,
          direcao: 'out',
          conteudo: text,
          status: 'pendente',
          conexao_id: startContato.conexao_id || null,
        };
        const res2 = await supabase.from('mensagens').insert(payloadFallback).select('id').single();
        inserted = res2.data;
        error = res2.error;
      }
      if (error || !inserted?.id) throw error;
      const { error: sendError } = await supabase.functions.invoke('whatsapp-send', { body: { message_id: inserted.id, sender_name: user?.nome ?? null } });
      if (sendError) throw sendError;
      toast({ title: 'Enviado', description: `Mensagem enviada para ${formatContactName(startContato.nome)}.` });
      setStartOpen(false);
      navigate(`/app/chat?contato=${encodeURIComponent(startContato.id)}`);
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível enviar a mensagem.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Contatos</h1>
            <p className="text-muted-foreground">Todos os contatos salvos do WhatsApp.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone..."
              className="pl-9 bg-card border-none shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="shadow-md border-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lista de contatos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="divide-y divide-border/40">
                {loading && (
                  <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                )}
                {!loading && filtered.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">Nenhum contato encontrado.</div>
                )}
                {!loading && filtered.map((c) => {
                  const initials = (c.nome || 'Contato')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(s => s[0]?.toUpperCase())
                    .join('');
                  const status = c.conversa_status || 'aberta';
                  return (
                    <div key={c.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={c.profile_img_url || ''} />
                          <AvatarFallback>{initials || 'C'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="font-bold truncate">{formatContactName(c.nome)}</div>
                            <Badge variant={status === 'resolvida' ? 'secondary' : 'default'} className="h-5">
                              {status === 'resolvida' ? 'Resolvida' : 'Aberta'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span className="break-all">{formatContactName(c.contato)}</span>
                          </div>
                          {c.resumo && (
                            <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                              {c.resumo}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => openChat(c)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Abrir chat
                        </Button>
                        <Button size="sm" onClick={() => openStart(c)}>
                          <Send className="h-4 w-4 mr-2" />
                          Iniciar conversa
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={startOpen} onOpenChange={(o) => { setStartOpen(o); if (!o) setStartContato(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Para: <span className="font-medium text-foreground">{formatContactName(startContato?.nome || '')}</span>
            </div>
            <Textarea
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={4}
              className="resize-y min-h-[120px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStartOpen(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={sendFirst} disabled={sending || !startText.trim()}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

