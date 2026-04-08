import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { FileDown, Plus, Trash2, Upload } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

type CatalogItem = {
  id: string;
  tipo: 'Produto' | 'Serviço';
  nome: string;
  descricao: string | null;
  valor: number;
};

type Contato = {
  id: string;
  nome: string;
  contato: string;
};

type Orcamento = {
  id: string;
  empresa_id: string;
  contato_id: string | null;
  titulo: string;
  descricao: string | null;
  status: 'Pendente' | 'Aprovado' | 'Cancelado';
  logo_url: string | null;
  pdf_url: string | null;
  total: number;
  created_at: string;
};

type OrcamentoItemDraft = {
  key: string;
  catalog_item_id: string | null;
  tipo: 'Produto' | 'Serviço';
  nome: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const toNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

async function fetchAsUint8(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch failed');
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

export default function OrcamentosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const empresaId = user?.empresa_id ?? null;

  const [loading, setLoading] = useState(true);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    contato_id: 'none',
    status: 'Pendente' as Orcamento['status'],
  });

  const [items, setItems] = useState<OrcamentoItemDraft[]>([
    { key: crypto.randomUUID(), catalog_item_id: null, tipo: 'Produto', nome: '', descricao: '', quantidade: 1, valor_unitario: 0 },
  ]);

  const total = useMemo(
    () => items.reduce((acc, i) => acc + toNumber(i.quantidade) * toNumber(i.valor_unitario), 0),
    [items]
  );

  const resetModal = () => {
    setForm({ titulo: '', descricao: '', contato_id: 'none', status: 'Pendente' });
    setItems([{ key: crypto.randomUUID(), catalog_item_id: null, tipo: 'Produto', nome: '', descricao: '', quantidade: 1, valor_unitario: 0 }]);
    setLogoPreview(null);
    setLogoUrl(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const loadData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const [orcRes, catRes, contRes] = await Promise.all([
      supabase
        .from('orcamentos')
        .select('id,empresa_id,contato_id,titulo,descricao,status,logo_url,pdf_url,total,created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false }),
      supabase
        .from('catalog_items')
        .select('id,tipo,nome,descricao,valor')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('contatos')
        .select('id,nome,contato')
        .eq('empresa_id', empresaId)
        .order('updated_at', { ascending: false }),
    ]);

    const nextOrcamentos = (orcRes.data || []).map((o) => ({
      ...(o as unknown as Orcamento),
      total: toNumber((o as unknown as { total: unknown }).total),
    }));
    const nextCatalog = (catRes.data || []).map((i) => ({
      ...(i as unknown as CatalogItem),
      valor: toNumber((i as unknown as { valor: unknown }).valor),
    }));
    const nextContatos = (contRes.data || []).map((c) => c as unknown as Contato);
    setOrcamentos(nextOrcamentos);
    setCatalogItems(nextCatalog);
    setContatos(nextContatos);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addItem = () => {
    setItems(prev => [...prev, { key: crypto.randomUUID(), catalog_item_id: null, tipo: 'Produto', nome: '', descricao: '', quantidade: 1, valor_unitario: 0 }]);
  };

  const removeItem = (key: string) => {
    setItems(prev => (prev.length <= 1 ? prev : prev.filter(i => i.key !== key)));
  };

  const updateItem = (key: string, patch: Partial<OrcamentoItemDraft>) => {
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));
  };

  const onSelectCatalog = (key: string, catalogId: string) => {
    const item = catalogItems.find(c => c.id === catalogId);
    if (!item) return;
    updateItem(key, {
      catalog_item_id: item.id,
      tipo: item.tipo,
      nome: item.nome,
      descricao: item.descricao || '',
      valor_unitario: Number(item.valor || 0),
    });
  };

  const handleLogoPick = async (file: File | null) => {
    if (!empresaId) return;
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem PNG ou JPG.', variant: 'destructive' });
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
      const path = `${empresaId}/logos/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('orcamentos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('orcamentos').getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (e) {
      console.error(e);
      setLogoPreview(null);
      setLogoUrl(null);
      toast({ title: 'Erro', description: 'Não foi possível enviar a logo.', variant: 'destructive' });
    } finally {
      setLogoUploading(false);
    }
  };

  const createOrcamento = async () => {
    if (!empresaId) return;
    if (!form.titulo.trim()) {
      toast({ title: 'Título obrigatório', description: 'Informe um título para o orçamento.', variant: 'destructive' });
      return;
    }

    const normalizedItems = items
      .map((i, idx) => ({
        position: idx,
        catalog_item_id: i.catalog_item_id,
        tipo: i.tipo,
        nome: i.nome.trim(),
        descricao: (i.descricao || '').trim() || null,
        quantidade: toNumber(i.quantidade),
        valor_unitario: toNumber(i.valor_unitario),
        total: toNumber(i.quantidade) * toNumber(i.valor_unitario),
      }))
      .filter(i => i.nome);

    if (normalizedItems.length === 0) {
      toast({ title: 'Itens obrigatórios', description: 'Adicione ao menos 1 produto/serviço.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const contatoId = form.contato_id === 'none' ? null : form.contato_id;
      const { data: created, error } = await supabase
        .from('orcamentos')
        .insert({
          empresa_id: empresaId,
          contato_id: contatoId,
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim() || null,
          status: form.status,
          logo_url: logoUrl,
          total,
        })
        .select('id,empresa_id,contato_id,titulo,descricao,status,logo_url,pdf_url,total,created_at')
        .single();
      if (error) throw error;

      const { error: eItens } = await supabase.from('orcamento_itens').insert(
        normalizedItems.map(i => ({ ...i, orcamento_id: created.id }))
      );
      if (eItens) throw eItens;

      setOrcamentos(prev => [created as unknown as Orcamento, ...prev]);
      setModalOpen(false);
      resetModal();
      toast({ title: 'Criado', description: 'Orçamento criado com sucesso.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível criar o orçamento.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const generatePdf = async (orcamentoId: string) => {
    if (!empresaId) return;
    setGenerating(orcamentoId);
    try {
      const { data: orc } = await supabase
        .from('orcamentos')
        .select('id,empresa_id,contato_id,titulo,descricao,status,logo_url,pdf_url,total,created_at')
        .eq('id', orcamentoId)
        .maybeSingle();
      if (!orc) throw new Error('not found');

      const { data: itens } = await supabase
        .from('orcamento_itens')
        .select('tipo,nome,descricao,quantidade,valor_unitario,total,position')
        .eq('orcamento_id', orcamentoId)
        .order('position', { ascending: true });

      const contatoName = orc.contato_id
        ? (contatos.find(c => c.id === orc.contato_id)?.nome || 'Cliente')
        : 'Cliente';

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const margin = 48;
      const width = page.getWidth() - margin * 2;
      let y = page.getHeight() - margin;

      if (orc.logo_url) {
        const bytes = await fetchAsUint8(orc.logo_url);
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const maxW = 120;
        const maxH = 60;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        page.drawImage(img, { x: margin, y: y - img.height * scale, width: img.width * scale, height: img.height * scale });
      }

      page.drawText('ORÇAMENTO', { x: margin, y: y - 80, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(String(orc.titulo || ''), { x: margin, y: y - 105, size: 12, font: font, color: rgb(0.2, 0.2, 0.2) });

      const dateStr = new Date(orc.created_at).toLocaleDateString('pt-BR');
      page.drawText(`Cliente: ${contatoName}`, { x: margin, y: y - 135, size: 10, font });
      page.drawText(`Data: ${dateStr}`, { x: margin, y: y - 150, size: 10, font });
      page.drawText(`Status: ${orc.status}`, { x: margin, y: y - 165, size: 10, font });

      y = y - 200;

      page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 18;

      const colQtd = 48;
      const colUnit = 90;
      const colTotal = 90;
      const colName = width - colQtd - colUnit - colTotal;

      page.drawText('Item', { x: margin, y, size: 10, font: fontBold });
      page.drawText('Qtd', { x: margin + colName, y, size: 10, font: fontBold });
      page.drawText('V. Unit', { x: margin + colName + colQtd, y, size: 10, font: fontBold });
      page.drawText('Total', { x: margin + colName + colQtd + colUnit, y, size: 10, font: fontBold });

      y -= 10;
      page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 16;

      const safeItens = (itens || []).map((i) => ({
        nome: String((i as unknown as { nome?: unknown }).nome || ''),
        quantidade: toNumber((i as unknown as { quantidade?: unknown }).quantidade),
        valor_unitario: toNumber((i as unknown as { valor_unitario?: unknown }).valor_unitario),
        total: toNumber((i as unknown as { total?: unknown }).total),
      }));

      for (const it of safeItens) {
        if (y < margin + 120) break;
        page.drawText(it.nome.slice(0, 60), { x: margin, y, size: 10, font });
        page.drawText(String(it.quantidade), { x: margin + colName, y, size: 10, font });
        page.drawText(formatCurrency(it.valor_unitario), { x: margin + colName + colQtd, y, size: 10, font });
        page.drawText(formatCurrency(it.total), { x: margin + colName + colQtd + colUnit, y, size: 10, font });
        y -= 16;
      }

      y -= 8;
      page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 20;

      page.drawText(`Valor total: ${formatCurrency(toNumber(orc.total))}`, { x: margin + width - 220, y, size: 12, font: fontBold });

      if (orc.descricao) {
        y -= 40;
        page.drawText('Observações:', { x: margin, y, size: 10, font: fontBold });
        y -= 14;
        const text = String(orc.descricao);
        const lines = text.match(/.{1,90}/g) || [];
        for (const l of lines.slice(0, 6)) {
          page.drawText(l, { x: margin, y, size: 10, font });
          y -= 14;
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
      const fileName = `orcamento-${orc.id}.pdf`;

      const path = `${empresaId}/pdf/${orc.id}.pdf`;
      const { error: upErr } = await supabase.storage.from('orcamentos').upload(path, blob, { upsert: true, contentType: 'application/pdf' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('orcamentos').getPublicUrl(path);

      await supabase.from('orcamentos').update({ pdf_url: pub.publicUrl }).eq('id', orc.id);
      setOrcamentos(prev => prev.map(o => (o.id === orc.id ? { ...o, pdf_url: pub.publicUrl } : o)));

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'PDF gerado', description: 'O arquivo foi baixado e salvo no sistema.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const statusBadge = (status: Orcamento['status']) => {
    if (status === 'Aprovado') return <Badge className="bg-success/15 text-success border-success/20">Aprovado</Badge>;
    if (status === 'Cancelado') return <Badge className="bg-destructive/15 text-destructive border-destructive/20">Cancelado</Badge>;
    return <Badge className="bg-warning/15 text-warning border-warning/20">Pendente</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
            <p className="text-muted-foreground">Crie orçamentos, gere PDF com logo e baixe para enviar ao cliente.</p>
          </div>
          <Button onClick={() => { resetModal(); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : orcamentos.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum orçamento criado ainda.</div>
            ) : (
              <div className="space-y-3">
                {orcamentos.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-4 border rounded-xl p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold truncate">{o.titulo}</div>
                        {statusBadge(o.status)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {new Date(o.created_at).toLocaleString('pt-BR')} • {formatCurrency(toNumber(o.total))}
                      </div>
                      {o.pdf_url && (
                        <a className="text-xs text-primary underline" href={o.pdf_url} target="_blank" rel="noreferrer">
                          Ver PDF salvo
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        onClick={() => generatePdf(o.id)}
                        disabled={generating === o.id}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        {generating === o.id ? 'Gerando...' : 'Gerar PDF'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) resetModal(); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Novo Orçamento</DialogTitle>
              <DialogDescription>Adicione os itens, faça upload da logo e depois gere o PDF.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Título *</div>
                <Input value={form.titulo} onChange={(e) => setForm(prev => ({ ...prev, titulo: e.target.value }))} placeholder="Ex: Orçamento de serviços" />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Cliente (Lead)</div>
                <Select value={form.contato_id} onValueChange={(v) => setForm(prev => ({ ...prev, contato_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {contatos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Descrição</div>
              <Textarea value={form.descricao} onChange={(e) => setForm(prev => ({ ...prev, descricao: e.target.value }))} placeholder="Descreva o orçamento..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Status</div>
                <Select
                  value={form.status}
                  onValueChange={(v) => {
                    const next = (v === 'Pendente' || v === 'Aprovado' || v === 'Cancelado') ? v : 'Pendente';
                    setForm(prev => ({ ...prev, status: next }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Logo (opcional)</div>
                <input
                  ref={logoInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg"
                  onChange={(e) => handleLogoPick(e.target.files?.[0] || null)}
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                    <Upload className="h-4 w-4 mr-2" />
                    {logoUploading ? 'Enviando...' : 'Enviar logo'}
                  </Button>
                  {logoPreview && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setLogoPreview(null);
                        setLogoUrl(null);
                        if (logoInputRef.current) logoInputRef.current.value = '';
                      }}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                {logoPreview && (
                  <div className="border rounded-xl p-3 flex items-center gap-3">
                    <img src={logoPreview} alt="Logo" className="h-10 w-10 rounded object-cover" />
                    <div className="text-xs text-muted-foreground truncate">{logoUrl || ''}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">Produtos/Serviços</div>
              <Button variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            <div className="border rounded-xl">
              <ScrollArea className="max-h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[260px]">Produto/Serviço</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[110px]">Qtd</TableHead>
                      <TableHead className="w-[140px]">Valor Unitário</TableHead>
                      <TableHead className="w-[140px]">Total</TableHead>
                      <TableHead className="w-[56px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => {
                      const lineTotal = toNumber(it.quantidade) * toNumber(it.valor_unitario);
                      return (
                        <TableRow key={it.key}>
                          <TableCell>
                            <Select value={it.catalog_item_id || 'none'} onValueChange={(v) => (v === 'none' ? updateItem(it.key, { catalog_item_id: null }) : onSelectCatalog(it.key, v))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um produto" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {catalogItems.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <Input value={it.nome} onChange={(e) => updateItem(it.key, { nome: e.target.value })} placeholder="Nome" />
                              <Select
                                value={it.tipo}
                                onValueChange={(v) => {
                                  const next = v === 'Produto' || v === 'Serviço' ? v : 'Produto';
                                  updateItem(it.key, { tipo: next });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Produto">Produto</SelectItem>
                                  <SelectItem value="Serviço">Serviço</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input value={it.descricao} onChange={(e) => updateItem(it.key, { descricao: e.target.value })} placeholder="Descrição" />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={String(it.quantidade)}
                              onChange={(e) => updateItem(it.key, { quantidade: toNumber(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={String(it.valor_unitario)}
                              onChange={(e) => updateItem(it.key, { valor_unitario: toNumber(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(lineTotal)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeItem(it.key)} disabled={items.length <= 1}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Valor Total</div>
              <div className="text-lg font-black text-primary">{formatCurrency(total)}</div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={createOrcamento} disabled={submitting}>
                {submitting ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
