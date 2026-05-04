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
import { Navigate } from 'react-router-dom';

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

type OrcamentoSettings = {
  empresa_id: string;
  logo_url: string | null;
  email: string | null;
  instagram: string | null;
  whatsapp: string | null;
  pix_chave: string | null;
  pix_nome: string | null;
  pix_banco: string | null;
  validade_dias: number;
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
  if (user?.papel === 'colaborador' && !user.can_access_orcamentos) {
    return <Navigate to="/app/chat" replace />;
  }
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [orcSettings, setOrcSettings] = useState<OrcamentoSettings | null>(null);
  const settingsLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [settingsLogoUploading, setSettingsLogoUploading] = useState(false);
  const [settingsLogoPreview, setSettingsLogoPreview] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    logo_url: '',
    email: '',
    instagram: '',
    whatsapp: '',
    pix_chave: '',
    pix_nome: '',
    pix_banco: '',
    validade_dias: '7',
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: 'Link da logo copiado.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar o link.', variant: 'destructive' });
    }
  };

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
    const [orcRes, catRes, contRes, setRes] = await Promise.all([
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
      supabase
        .from('orcamento_settings')
        .select('empresa_id,logo_url,email,instagram,whatsapp,pix_chave,pix_nome,pix_banco,validade_dias')
        .eq('empresa_id', empresaId)
        .maybeSingle(),
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
    const nextSettings = (setRes.data || null) as unknown as OrcamentoSettings | null;
    setOrcSettings(nextSettings);
    if (nextSettings) {
      setSettingsLogoPreview(nextSettings.logo_url || null);
      setSettingsForm({
        logo_url: nextSettings.logo_url || '',
        email: nextSettings.email || '',
        instagram: nextSettings.instagram || '',
        whatsapp: nextSettings.whatsapp || '',
        pix_chave: nextSettings.pix_chave || '',
        pix_nome: nextSettings.pix_nome || '',
        pix_banco: nextSettings.pix_banco || '',
        validade_dias: String(nextSettings.validade_dias || 7),
      });
    }
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

  const handleSettingsLogoPick = async (file: File | null) => {
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
    setSettingsLogoUploading(true);
    try {
      const reader = new FileReader();
      const preview = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      setSettingsLogoPreview(preview);
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${empresaId}/orcamento-settings/logo-${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('orcamentos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('orcamentos').getPublicUrl(path);
      setSettingsForm((p) => ({ ...p, logo_url: data.publicUrl }));
    } catch (e) {
      setSettingsLogoPreview(null);
      toast({ title: 'Erro', description: 'Não foi possível enviar a logo.', variant: 'destructive' });
    } finally {
      setSettingsLogoUploading(false);
    }
  };

  const saveSettings = async () => {
    if (!empresaId) return;
    setSettingsSaving(true);
    try {
      const validade = Number(String(settingsForm.validade_dias || '7').trim());
      const payload = {
        empresa_id: empresaId,
        logo_url: settingsForm.logo_url.trim() || null,
        email: settingsForm.email.trim() || null,
        instagram: settingsForm.instagram.trim() || null,
        whatsapp: settingsForm.whatsapp.trim() || null,
        pix_chave: settingsForm.pix_chave.trim() || null,
        pix_nome: settingsForm.pix_nome.trim() || null,
        pix_banco: settingsForm.pix_banco.trim() || null,
        validade_dias: Number.isFinite(validade) && validade > 0 ? validade : 7,
      };
      const { data, error } = await supabase.from('orcamento_settings').upsert(payload, { onConflict: 'empresa_id' }).select().single();
      if (error) throw error;
      setOrcSettings(data as any);
      toast({ title: 'Salvo', description: 'Configurações do orçamento atualizadas.' });
      setSettingsOpen(false);
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível salvar as configurações.', variant: 'destructive' });
    } finally {
      setSettingsSaving(false);
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
          logo_url: logoUrl || orcSettings?.logo_url || null,
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

      const brandPrimary = rgb(0.07, 0.42, 0.84);
      const brandMuted = rgb(0.94, 0.96, 0.98);
      const textDark = rgb(0.12, 0.12, 0.12);
      const textMuted = rgb(0.35, 0.35, 0.35);

      const wrapText = (txt: string, maxWidth: number, size: number, f = font) => {
        const words = String(txt || '').split(/\s+/g);
        const lines: string[] = [];
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (f.widthOfTextAtSize(test, size) <= maxWidth) {
            line = test;
          } else {
            if (line) lines.push(line);
            line = w;
          }
        }
        if (line) lines.push(line);
        return lines;
      };

      const settings = orcSettings;
      const headerLogo = (orc.logo_url || settings?.logo_url || null) as string | null;
      const headerHeight = 76;
      const headerTop = page.getHeight();
      const headerBottom = headerTop - headerHeight;
      page.drawRectangle({ x: 0, y: headerBottom, width: page.getWidth(), height: headerHeight, color: brandPrimary });

      if (headerLogo) {
        try {
          const bytes = await fetchAsUint8(headerLogo);
          const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
          const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          const maxW = 96;
          const maxH = 52;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          page.drawImage(img, { x: margin, y: headerBottom + (headerHeight - img.height * scale) / 2, width: img.width * scale, height: img.height * scale });
        } catch (e) {
          console.error(e);
        }
      }

      const headerLines: string[] = [];
      if (settings?.email) headerLines.push(settings.email);
      if (settings?.whatsapp) headerLines.push(settings.whatsapp);
      if (settings?.instagram) headerLines.push(`Instagram: ${settings.instagram}`);

      const headerTextMaxWidth = 210;
      const headerTextX = page.getWidth() - margin - headerTextMaxWidth;
      let hy = headerTop - 22;
      for (const line of headerLines.slice(0, 3)) {
        const wrapped = wrapText(line, headerTextMaxWidth, 9, font);
        for (const l of wrapped.slice(0, 2)) {
          page.drawText(l, { x: headerTextX, y: hy, size: 9, font, color: rgb(1, 1, 1) });
          hy -= 11;
        }
      }

      const title = 'ORÇAMENTO';
      const titleSize = 22;
      const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
      const titleX = (page.getWidth() - titleWidth) / 2;
      y = headerBottom - 28;
      page.drawText(title, { x: titleX, y: y, size: titleSize, font: fontBold, color: textDark });
      y -= 18;

      page.drawRectangle({ x: margin, y: y - 56, width: width, height: 56, color: brandMuted });
      page.drawText(String(orc.titulo || ''), { x: margin + 12, y: y - 20, size: 14, font: fontBold, color: textDark });

      const dateStr = new Date(orc.created_at).toLocaleDateString('pt-BR');
      const metaY = y - 36;
      const colW = width / 4;
      const col1 = margin + 12;
      const col2 = margin + colW + 12;
      const col3 = margin + colW * 2 + 12;
      const col4 = margin + colW * 3 + 12;
      page.drawText(wrapText(`Cliente: ${contatoName}`, colW - 16, 10, font)[0] || `Cliente: ${contatoName}`, { x: col1, y: metaY, size: 10, font, color: textMuted });
      page.drawText(`Data: ${dateStr}`, { x: col2, y: metaY, size: 10, font, color: textMuted });
      page.drawText(`Status: ${orc.status}`, { x: col3, y: metaY, size: 10, font, color: textMuted });
      if (settings?.validade_dias) {
        const vtxt = `Validade: ${settings.validade_dias} dias`;
        page.drawText(wrapText(vtxt, colW - 16, 10, font)[0] || vtxt, { x: col4, y: metaY, size: 10, font, color: textMuted });
      }

      y = y - 80;

      page.drawRectangle({ x: margin, y: y - 28, width: width, height: 28, color: rgb(0.92, 0.95, 0.98) });
      y -= 6;

      const colQtd = 48;
      const colUnit = 90;
      const colTotal = 90;
      const colName = width - colQtd - colUnit - colTotal;

      page.drawText('Item', { x: margin, y, size: 10, font: fontBold });
      page.drawText('Qtd', { x: margin + colName, y, size: 10, font: fontBold });
      page.drawText('V. Unit', { x: margin + colName + colQtd, y, size: 10, font: fontBold });
      page.drawText('Total', { x: margin + colName + colQtd + colUnit, y, size: 10, font: fontBold });

      y -= 12;

      const safeItens = (itens || []).map((i) => ({
        nome: String((i as unknown as { nome?: unknown }).nome || ''),
        quantidade: toNumber((i as unknown as { quantidade?: unknown }).quantidade),
        valor_unitario: toNumber((i as unknown as { valor_unitario?: unknown }).valor_unitario),
        total: toNumber((i as unknown as { total?: unknown }).total),
      }));

      let zebra = false;
      for (const it of safeItens) {
        if (y < margin + 160) break;
        if (zebra) page.drawRectangle({ x: margin, y: y - 12, width, height: 14, color: rgb(0.98, 0.98, 0.98) });
        zebra = !zebra;
        const lineName = wrapText(it.nome, colName - 6, 10, font);
        const lineCount = Math.max(1, lineName.length);
        page.drawText(lineName[0] || '', { x: margin + 2, y, size: 10, font, color: textDark });
        if (lineName.length > 1) {
          for (let k = 1; k < lineName.length; k++) {
            y -= 12;
            page.drawText(lineName[k], { x: margin + 2, y, size: 10, font, color: textDark });
          }
        }
        page.drawText(String(it.quantidade), { x: margin + colName + 6, y, size: 10, font, color: textDark });
        page.drawText(formatCurrency(it.valor_unitario), { x: margin + colName + colQtd + 6, y, size: 10, font, color: textDark });
        page.drawText(formatCurrency(it.total), { x: margin + colName + colQtd + colUnit + 6, y, size: 10, font: fontBold, color: textDark });
        y -= 16;
      }

      y -= 12;

      page.drawRectangle({ x: margin + width - 240, y: y - 34, width: 240, height: 34, color: rgb(0.97, 0.98, 0.99) });
      page.drawText(`Valor total: ${formatCurrency(toNumber(orc.total))}`, { x: margin + width - 228, y: y - 12, size: 12, font: fontBold, color: textDark });

      if (orc.descricao) {
        y -= 60;
        page.drawRectangle({ x: margin, y: y - 80, width, height: 80, color: rgb(0.98, 0.98, 0.98) });
        page.drawText('Observações', { x: margin + 10, y: y - 16, size: 10, font: fontBold, color: textDark });
        const lines = wrapText(String(orc.descricao), width - 20, 10, font).slice(0, 6);
        let oy = y - 32;
        for (const l of lines) {
          page.drawText(l, { x: margin + 10, y: oy, size: 10, font, color: textMuted });
          oy -= 14;
        }
      }

      if (settings?.pix_chave) {
        const py = margin + 90;
        page.drawRectangle({ x: margin, y: py - 70, width, height: 70, color: rgb(0.98, 0.98, 0.98) });
        page.drawText('Pagamento (PIX)', { x: margin + 10, y: py - 18, size: 10, font: fontBold, color: textDark });
        page.drawText(`Chave: ${settings.pix_chave}`, { x: margin + 10, y: py - 34, size: 10, font, color: textMuted });
        if (settings.pix_nome) page.drawText(`Nome: ${settings.pix_nome}`, { x: margin + 10, y: py - 48, size: 10, font, color: textMuted });
        if (settings.pix_banco) page.drawText(`Banco: ${settings.pix_banco}`, { x: margin + 10, y: py - 62, size: 10, font, color: textMuted });
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
      const fileName = `orcamento-${orc.id}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      try {
        const path = `${empresaId}/pdf/${orc.id}.pdf`;
        const { error: upErr } = await supabase.storage.from('orcamentos').upload(path, blob, { upsert: true, contentType: 'application/pdf' });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('orcamentos').getPublicUrl(path);
        await supabase.from('orcamentos').update({ pdf_url: pub.publicUrl }).eq('id', orc.id);
        setOrcamentos(prev => prev.map(o => (o.id === orc.id ? { ...o, pdf_url: pub.publicUrl } : o)));
        toast({ title: 'PDF gerado', description: 'O arquivo foi baixado e salvo no sistema.' });
      } catch (e) {
        console.error(e);
        const msg = String((e as any)?.message || e || '').trim();
        toast({ title: 'PDF gerado', description: msg ? `Baixado, mas não foi possível salvar no sistema: ${msg}` : 'Baixado, mas não foi possível salvar no sistema.' });
      }
    } catch (e) {
      console.error(e);
      const msg = String((e as any)?.message || e || '').trim();
      toast({ title: 'Erro', description: msg || 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const statusBadge = (status: Orcamento['status']) => {
    if (status === 'Aprovado') return <Badge className="bg-success/15 text-success border-success/20">Aprovado</Badge>;
    if (status === 'Cancelado') return <Badge className="bg-destructive/15 text-destructive border-destructive/20">Cancelado</Badge>;
    return <Badge className="bg-warning/15 text-warning border-warning/20">Pendente</Badge>;
  };

  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const updateStatus = async (id: string, status: Orcamento['status']) => {
    setSavingStatusId(id);
    try {
      const { error } = await supabase.from('orcamentos').update({ status }).eq('id', id);
      if (error) throw error;
      setOrcamentos(prev => prev.map(o => (o.id === id ? { ...o, status } : o)));
      toast({ title: 'Atualizado', description: 'Status do orçamento atualizado.' });
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o status.', variant: 'destructive' });
    } finally {
      setSavingStatusId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
            <p className="text-muted-foreground">Crie orçamentos, gere PDF com logo e baixe para enviar ao cliente.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              Configurações
            </Button>
            <Button onClick={() => { resetModal(); setModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </div>
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
                      <Select
                        value={o.status}
                        onValueChange={(v) => updateStatus(o.id, v as Orcamento['status'])}
                        disabled={savingStatusId === o.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="Aprovado">Aprovado</SelectItem>
                          <SelectItem value="Cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
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
              {/* Logo opcional removida: a criação usa a logo padrão das configurações */}
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

        <Dialog open={settingsOpen} onOpenChange={(o) => { setSettingsOpen(o); if (!o) { if (settingsLogoInputRef.current) settingsLogoInputRef.current.value = ''; } }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurações do Orçamento</DialogTitle>
              <DialogDescription>Esses dados serão usados como padrão nos PDFs.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <input
                ref={settingsLogoInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  e.target.value = '';
                  void handleSettingsLogoPick(f);
                }}
              />
              <div className="flex items-center justify-between gap-3 border rounded-lg p-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center h-10 w-10 rounded bg-muted overflow-hidden">
                    {settingsLogoPreview || settingsForm.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={settingsLogoPreview || settingsForm.logo_url} alt="logo" className="max-h-10 max-w-10 object-contain" />
                    ) : (
                      <div className="text-[10px] text-muted-foreground">Sem logo</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Logo padrão</div>
                    <div className="text-xs text-muted-foreground">
                      {settingsForm.logo_url ? 'Logo configurada' : 'Nenhuma logo configurada'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {settingsForm.logo_url && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => window.open(settingsForm.logo_url, '_blank')}>
                        Abrir
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(settingsForm.logo_url)}>
                        Copiar
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => settingsLogoInputRef.current?.click()} disabled={settingsLogoUploading}>
                    <Upload className="h-4 w-4 mr-2" />
                    {settingsLogoUploading ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Email</div>
                  <Input value={settingsForm.email} onChange={(e) => setSettingsForm(p => ({ ...p, email: e.target.value }))} placeholder="contato@..." />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">WhatsApp</div>
                  <Input value={settingsForm.whatsapp} onChange={(e) => setSettingsForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(DD) 9...." />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Instagram</div>
                  <Input value={settingsForm.instagram} onChange={(e) => setSettingsForm(p => ({ ...p, instagram: e.target.value }))} placeholder="@usuario" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Validade (dias)</div>
                  <Input value={settingsForm.validade_dias} onChange={(e) => setSettingsForm(p => ({ ...p, validade_dias: e.target.value }))} placeholder="7" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Chave Pix</div>
                  <Input value={settingsForm.pix_chave} onChange={(e) => setSettingsForm(p => ({ ...p, pix_chave: e.target.value }))} placeholder="CPF/CNPJ/email/aleatória" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Nome Pix</div>
                  <Input value={settingsForm.pix_nome} onChange={(e) => setSettingsForm(p => ({ ...p, pix_nome: e.target.value }))} placeholder="Nome do recebedor" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="text-sm font-medium">Banco Pix</div>
                  <Input value={settingsForm.pix_banco} onChange={(e) => setSettingsForm(p => ({ ...p, pix_banco: e.target.value }))} placeholder="Banco/Instituição" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
                <Button onClick={() => void saveSettings()} disabled={settingsSaving || settingsLoading}>
                  {settingsSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
