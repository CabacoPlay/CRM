import { useEffect, useMemo, useRef, useState } from 'react';
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
import { formatContactDisplay, formatContactDisplayName, formatContactName } from '@/lib/utils';

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

type ImportContatoRow = {
  nome: string;
  contato: string;
  resumo?: string | null;
};

function detectCsvDelimiter(firstLine: string) {
  const comma = (firstLine.match(/,/g) || []).length;
  const semi = (firstLine.match(/;/g) || []).length;
  const tab = (firstLine.match(/\t/g) || []).length;
  if (semi > comma && semi >= tab) return ';';
  if (tab > comma && tab > semi) return '\t';
  return ',';
}

function parseCsv(text: string) {
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = src.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [] as string[], rows: [] as string[][] };
  const delimiter = detectCsvDelimiter(lines[0] || '');

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && ch === delimiter) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => String(s || '').trim());
  };

  const header = parseLine(lines[0] || '').map((h) => h.toLowerCase().replace(/\s+/g, '').trim());
  const rows = lines.slice(1).map(parseLine);
  return { header, rows };
}

function normalizeContatoForDb(input: string) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  return `${digits}@s.whatsapp.net`;
}

function escapeCsvCell(value: unknown) {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function ContatosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const empresaId = user?.empresa_id ?? null;
  const canViewContactPhone = user?.papel !== 'colaborador' || Boolean(user?.can_view_contact_phone);

  const [loading, setLoading] = useState(true);
  const [contatos, setContatos] = useState<ContatoRow[]>([]);
  const [search, setSearch] = useState('');

  const [startOpen, setStartOpen] = useState(false);
  const [startContato, setStartContato] = useState<ContatoRow | null>(null);
  const [startText, setStartText] = useState('');
  const [sending, setSending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ImportContatoRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const loadContacts = async () => {
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

  useEffect(() => {
    void loadContacts();
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
      if (!canViewContactPhone) {
        return nome.includes(q) || resumo.includes(q);
      }
      return (
        nome.includes(q) ||
        contato.includes(q) ||
        resumo.includes(q) ||
        (qDigits && onlyDigits(contato).includes(qDigits))
      );
    });
    return list;
  }, [canViewContactPhone, contatos, search]);

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

  const exportContacts = () => {
    const rows = contatos;
    const header = ['nome', 'contato', 'resumo', 'conexao_id', 'conversa_status'];
    const csv = [
      header.join(','),
      ...rows.map((c) => ([
        escapeCsvCell(c.nome),
        escapeCsvCell(c.contato),
        escapeCsvCell(c.resumo ?? ''),
        escapeCsvCell(c.conexao_id ?? ''),
        escapeCsvCell(c.conversa_status ?? ''),
      ]).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onPickImportFile = async (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    setImportErrors([]);
    setImportRows([]);

    const text = await file.text().catch(() => '');
    const { header, rows } = parseCsv(text);
    if (!header.length) {
      setImportErrors(['Arquivo vazio.']);
      return;
    }

    const idxNome = header.findIndex((h) => ['nome', 'name'].includes(h));
    const idxContato = header.findIndex((h) => ['contato', 'telefone', 'phone', 'number', 'celular'].includes(h));
    const idxResumo = header.findIndex((h) => ['resumo', 'summary', 'obs', 'observacao', 'observações', 'observacoes'].includes(h));

    const errors: string[] = [];
    if (idxNome < 0) errors.push('Coluna obrigatória "nome" não encontrada no CSV.');
    if (idxContato < 0) errors.push('Coluna obrigatória "contato" não encontrada no CSV.');
    if (errors.length) {
      setImportErrors(errors);
      return;
    }

    const map = new Map<string, ImportContatoRow>();
    rows.forEach((cols, i) => {
      const nome = String(cols[idxNome] || '').trim();
      const contatoRaw = String(cols[idxContato] || '').trim();
      const contato = normalizeContatoForDb(contatoRaw);
      const resumo = idxResumo >= 0 ? String(cols[idxResumo] || '').trim() : '';
      if (!nome || !contato) {
        errors.push(`Linha ${i + 2}: nome/contato vazio.`);
        return;
      }
      map.set(contato, { nome, contato, resumo: resumo ? resumo : null });
    });

    setImportErrors(errors.slice(0, 20));
    setImportRows(Array.from(map.values()));
  };

  const runImport = async () => {
    if (!empresaId) return;
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const uniqueContatos = Array.from(new Set(importRows.map((r) => r.contato)));
      const existing = new Map<string, { id: string; nome: string; resumo: string | null; contato: string }>();

      for (let i = 0; i < uniqueContatos.length; i += 200) {
        const chunk = uniqueContatos.slice(i, i + 200);
        const { data, error } = await supabase
          .from('contatos')
          .select('id,contato,nome,resumo')
          .eq('empresa_id', empresaId)
          .in('contato', chunk);
        if (error) throw error;
        (data || []).forEach((row: any) => {
          existing.set(String(row.contato), {
            id: String(row.id),
            contato: String(row.contato),
            nome: String(row.nome || ''),
            resumo: row.resumo ? String(row.resumo) : null,
          });
        });
      }

      const nowIso = new Date().toISOString();
      const toInsert: any[] = [];
      const toUpsert: any[] = [];

      for (const r of importRows) {
        const ex = existing.get(r.contato) || null;
        if (!ex) {
          toInsert.push({
            empresa_id: empresaId,
            nome: r.nome,
            contato: r.contato,
            resumo: r.resumo ?? null,
            updated_at: nowIso,
          });
          continue;
        }
        const nextNome = r.nome ? r.nome : ex.nome;
        const nextResumo = r.resumo ? r.resumo : ex.resumo;
        toUpsert.push({
          id: ex.id,
          empresa_id: empresaId,
          nome: nextNome,
          contato: ex.contato,
          resumo: nextResumo ?? null,
          updated_at: nowIso,
        });
      }

      for (let i = 0; i < toInsert.length; i += 200) {
        const chunk = toInsert.slice(i, i + 200);
        const { error } = await supabase.from('contatos').insert(chunk);
        if (error) throw error;
      }
      for (let i = 0; i < toUpsert.length; i += 200) {
        const chunk = toUpsert.slice(i, i + 200);
        const { error } = await supabase.from('contatos').upsert(chunk, { onConflict: 'id' });
        if (error) throw error;
      }

      toast({ title: 'Importado', description: `${toInsert.length} novos, ${toUpsert.length} atualizados.` });
      setImportOpen(false);
      setImportFileName(null);
      setImportRows([]);
      setImportErrors([]);
      await loadContacts();
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Não foi possível importar os contatos.', variant: 'destructive' });
    } finally {
      setImporting(false);
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
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone..."
                className="pl-9 bg-card border-none shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={exportContacts} className="shrink-0">
              Exportar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setImportOpen(true);
                setImportErrors([]);
                setImportRows([]);
                setImportFileName(null);
                setTimeout(() => fileInputRef.current?.click(), 0);
              }}
              className="shrink-0"
            >
              Importar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void onPickImportFile(file);
              }}
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
                            <div className="font-bold truncate">{formatContactDisplayName(c.nome, c.contato, canViewContactPhone)}</div>
                            <Badge variant={status === 'resolvida' ? 'secondary' : 'default'} className="h-5">
                              {status === 'resolvida' ? 'Resolvida' : 'Aberta'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span className="break-all">{formatContactDisplay(c.contato, canViewContactPhone)}</span>
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

      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportErrors([]); setImportRows([]); setImportFileName(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar contatos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Arquivo: <span className="font-medium text-foreground">{importFileName || '—'}</span>
            </div>
            {importErrors.length > 0 ? (
              <div className="rounded-md border p-3 text-sm text-destructive whitespace-pre-wrap">
                {importErrors.join('\n')}
              </div>
            ) : null}
            <div className="text-sm">
              Registros prontos: <span className="font-semibold">{importRows.length}</span>
            </div>
            {importRows.length > 0 ? (
              <div className="rounded-md border p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {importRows.slice(0, 5).map((r) => `${r.nome} • ${r.contato}`).join('\n')}
                {importRows.length > 5 ? `\n... +${importRows.length - 5}` : ''}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Selecione um CSV com colunas: nome, contato, resumo (opcional).
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                disabled={importing}
              >
                Trocar arquivo
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                Cancelar
              </Button>
              <Button onClick={runImport} disabled={importing || importRows.length === 0 || importErrors.length > 0}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
