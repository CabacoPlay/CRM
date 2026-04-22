import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Send, 
  Paperclip, 
  Smile,
  Bot, 
  User, 
  UserCheck, 
  Phone,
  Video,
  Info,
  Tag,
  ChevronDown,
  CornerUpLeft,
  Forward,
  Copy as CopyIcon,
  SmilePlus,
  Calendar as CalendarIcon,
  FileText,
  Image as ImageIcon,
  Mic,
  Zap,
  CalendarDays,
  ListChecks,
  Clock,
  X
} from 'lucide-react';
import { cn, getBrandLogoUrl, resolveTheme } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/app-context';
import { useTheme } from '@/hooks/use-theme';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { useSearchParams } from 'react-router-dom';
const sb = supabase;

type Contato = {
  id: string;
  nome: string;
  contato: string;
  resumo?: string | null;
  profile_img_url?: string | null;
  empresa_id?: string | null;
  conexao_id?: string | null;
  oculta?: boolean | null;
  ai_session_closed_at?: string | null;
  ai_session_updated_at?: string | null;
  atendimento_mode?: 'ia' | 'humano' | null;
  conversa_status?: 'aberta' | 'resolvida' | null;
  conversa_resolvida_em?: string | null;
  conversa_resolvida_por?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Mensagem = {
  id: string;
  contato_id: string;
  empresa_id: string | null;
  direcao: 'in' | 'out';
  conteudo: string;
  external_id?: string | null;
  sender_user_id?: string | null;
  sender_name?: string | null;
  tipo?: 'text' | 'image' | 'video' | 'document' | 'audio' | null;
  media_url?: string | null;
  mimetype?: string | null;
  file_name?: string | null;
  duration_ms?: number | null;
  reply_to_message_id?: string | null;
  reply_to_external_id?: string | null;
  reply_to_preview?: string | null;
  reacao_emoji?: string | null;
  reacao_direcao?: 'in' | 'out' | null;
  reacao_em?: string | null;
  status: 'pendente' | 'enviado' | 'erro';
  created_at: string;
};

type MensagemAgendada = {
  id: string;
  contato_id: string;
  empresa_id: string;
  tipo: 'text' | 'image' | 'video' | 'document' | 'audio';
  texto: string | null;
  mimetype: string | null;
  file_name: string | null;
  scheduled_for: string;
  status: 'scheduled' | 'sent' | 'error' | 'cancelled';
  created_at: string;
};

type RespostaRapida = {
  id: string;
  empresa_id: string;
  titulo: string;
  atalho: string | null;
  mensagem: string;
  created_at: string;
  updated_at?: string | null;
};

type Etiqueta = {
  id: string;
  empresa_id: string;
  nome: string;
  cor?: string | null;
};

type ContatoEtiquetaLink = {
  etiqueta_id: string;
};

type QuickReplyPayload = {
  empresa_id: string;
  titulo: string;
  atalho: string | null;
  mensagem: string;
  created_by_user_id: string | null;
};

type MensagemInsert = {
  contato_id: string;
  empresa_id: string | null;
  direcao: 'in' | 'out';
  conteudo: string;
  status: 'pendente' | 'enviado' | 'erro';
  sender_user_id?: string | null;
  sender_name?: string | null;
  tipo?: Mensagem['tipo'];
  media_url?: string | null;
  mimetype?: string | null;
  file_name?: string | null;
  duration_ms?: number | null;
  external_id?: string | null;
  reply_to_message_id?: string | null;
  reply_to_external_id?: string | null;
  reply_to_preview?: string | null;
  conexao_id?: string | null;
};

type CatalogItem = { id: string; nome: string; descricao?: string | null; valor?: number | null; image_url?: string | null };

function renderWhatsAppText(text: string, keyPrefix: string) {
  const makeKey = (() => {
    let i = 0;
    return () => `${keyPrefix}-${i++}`;
  })();

  const applyMarker = (
    nodes: Array<string | React.ReactNode>,
    regex: RegExp,
    wrap: (content: string, key: string) => React.ReactNode
  ) => {
    const out: Array<string | React.ReactNode> = [];
    for (const n of nodes) {
      if (typeof n !== 'string') {
        out.push(n);
        continue;
      }
      let lastIndex = 0;
      for (const match of n.matchAll(regex)) {
        const idx = match.index ?? -1;
        if (idx < 0) continue;
        const full = match[0] ?? '';
        const inner = match[1] ?? '';
        if (idx > lastIndex) out.push(n.slice(lastIndex, idx));
        out.push(wrap(inner, makeKey()));
        lastIndex = idx + full.length;
      }
      if (lastIndex < n.length) out.push(n.slice(lastIndex));
    }
    return out;
  };

  let nodes: Array<string | React.ReactNode> = [text ?? ''];
  nodes = applyMarker(nodes, /`([^`]+)`/g, (c, k) => <code key={k} className="font-mono">{c}</code>);
  nodes = applyMarker(nodes, /\*([^*]+)\*/g, (c, k) => <strong key={k}>{c}</strong>);
  nodes = applyMarker(nodes, /_([^_]+)_/g, (c, k) => <em key={k}>{c}</em>);
  nodes = applyMarker(nodes, /~([^~]+)~/g, (c, k) => <s key={k}>{c}</s>);

  const withBreaks: React.ReactNode[] = [];
  for (const n of nodes) {
    if (typeof n !== 'string') {
      withBreaks.push(n);
      continue;
    }
    const parts = n.split('\n');
    parts.forEach((p, idx) => {
      if (p) withBreaks.push(<React.Fragment key={makeKey()}>{p}</React.Fragment>);
      if (idx < parts.length - 1) withBreaks.push(<br key={makeKey()} />);
    });
  }
  return withBreaks;
}

function renderWhatsAppPreview(text: string, keyPrefix: string) {
  if ((text || '').startsWith('sticker:')) return '[Figurinha]';
  const singleLine = (text || '').replace(/\s+/g, ' ').trim();
  return renderWhatsAppText(singleLine, keyPrefix);
}

type EmojiItem = { emoji: string; keywords: string[] };

const EMOJIS: Array<{ group: string; items: EmojiItem[] }> = [
  {
    group: 'Smiles e Pessoas',
    items: [
      { emoji: '😀', keywords: ['feliz', 'sorriso', 'grinning'] },
      { emoji: '😁', keywords: ['feliz', 'sorriso', 'dentes'] },
      { emoji: '😂', keywords: ['rindo', 'chorando', 'lol'] },
      { emoji: '🤣', keywords: ['rindo', 'rolando', 'lol'] },
      { emoji: '😊', keywords: ['sorriso', 'fofo', 'happy'] },
      { emoji: '😍', keywords: ['amor', 'coração', 'love'] },
      { emoji: '😘', keywords: ['beijo', 'love'] },
      { emoji: '😎', keywords: ['óculos', 'cool'] },
      { emoji: '🤔', keywords: ['pensando', 'hmm'] },
      { emoji: '😢', keywords: ['triste', 'chorar'] },
      { emoji: '😭', keywords: ['chorar', 'muito', 'triste'] },
      { emoji: '😡', keywords: ['raiva', 'bravo'] },
      { emoji: '👍', keywords: ['ok', 'joinha', 'like'] },
      { emoji: '👎', keywords: ['não', 'dislike'] },
      { emoji: '🙏', keywords: ['obrigado', 'por favor', 'rezar'] },
      { emoji: '👏', keywords: ['palmas', 'parabéns'] },
      { emoji: '🔥', keywords: ['fogo', 'top'] },
      { emoji: '💯', keywords: ['cem', '100', 'perfeito'] },
      { emoji: '❤️', keywords: ['amor', 'coração'] },
      { emoji: '✨', keywords: ['brilho', 'estrela'] },
    ],
  },
  {
    group: 'Objetos',
    items: [
      { emoji: '📎', keywords: ['anexo', 'clip'] },
      { emoji: '📅', keywords: ['agenda', 'calendário'] },
      { emoji: '📞', keywords: ['telefone', 'ligar'] },
      { emoji: '💬', keywords: ['mensagem', 'chat'] },
      { emoji: '🎉', keywords: ['festa', 'parabéns'] },
      { emoji: '🎁', keywords: ['presente'] },
      { emoji: '📍', keywords: ['local', 'pin'] },
      { emoji: '🕐', keywords: ['hora', 'relógio'] },
      { emoji: '🔔', keywords: ['notificação', 'sino'] },
      { emoji: '🧾', keywords: ['recibo', 'nota'] },
    ],
  },
];

export default function ChatPage() {
  const { user } = useAuth();
  const { branding } = useApp();
  const { toast } = useToast();
  const { theme } = useTheme();
  const brandLogoUrl = getBrandLogoUrl(branding, resolveTheme(theme));
  const [searchParams] = useSearchParams();

  const empresaId = user?.empresa_id ?? null;
  const initialContactId = searchParams.get('contato') || '';

  const [isMobile, setIsMobile] = useState(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');

  const [contacts, setContacts] = useState<Contato[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contato | null>(null);
  const [msgStatus, setMsgStatus] = useState<'IA' | 'Humano'>('IA');
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [pendingText, setPendingText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversaTab, setConversaTab] = useState<'abertas' | 'resolvidas'>('abertas');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [lastMessages, setLastMessages] = useState<Record<string, { conteudo: string; created_at: string }>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedContactIdRef = useRef<string | null>(null);
  const prevLoadingMessagesRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stickerInputRef = useRef<HTMLInputElement | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'stickers'>('emoji');
  const [emojiQuery, setEmojiQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('recent_emojis');
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 24) : [];
    } catch {
      return [];
    }
  });
  const [recentStickers, setRecentStickers] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('recent_stickers');
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    const handler = () => apply();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  const unreadStorageKey = useMemo(() => {
    if (!empresaId) return '';
    return `unread_counts_${empresaId}`;
  }, [empresaId]);

  useEffect(() => {
    if (!unreadStorageKey) return;
    try {
      const raw = localStorage.getItem(unreadStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (parsed && typeof parsed === 'object') {
        setUnreadCounts(parsed as Record<string, number>);
      } else {
        setUnreadCounts({});
      }
    } catch {
      setUnreadCounts({});
    }
  }, [unreadStorageKey]);

  useEffect(() => {
    if (!unreadStorageKey) return;
    try {
      localStorage.setItem(unreadStorageKey, JSON.stringify(unreadCounts || {}));
    } catch {
      // ignore
    }
  }, [unreadCounts, unreadStorageKey]);

  useEffect(() => {
    if (!isMobile) return;
    if (selectedContact) setMobilePane('chat');
  }, [isMobile, selectedContact?.id]);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleView, setScheduleView] = useState<'agendar' | 'agendados'>('agendar');
  const [scheduleType, setScheduleType] = useState<'text' | 'image' | 'document' | 'audio'>('text');
  const [scheduleText, setScheduleText] = useState('');
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
  const [scheduleTime, setScheduleTime] = useState('12:00');
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [scheduledItems, setScheduledItems] = useState<MensagemAgendada[]>([]);
  const [filePickContext, setFilePickContext] = useState<'schedule' | 'immediate'>('schedule');
  const [immediatePickType, setImmediatePickType] = useState<'image' | 'document' | 'audio'>('document');
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [etiquetasOpen, setEtiquetasOpen] = useState(false);
  const [etiquetasContact, setEtiquetasContact] = useState<Contato | null>(null);
  const [etiquetasLoading, setEtiquetasLoading] = useState(false);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [contatoEtiquetaIds, setContatoEtiquetaIds] = useState<string[]>([]);
  const [contatoEtiquetasMap, setContatoEtiquetasMap] = useState<Record<string, Etiqueta[]>>({});
  const [quickRepliesTab, setQuickRepliesTab] = useState<'usar' | 'configurar'>('usar');
  const [quickRepliesLoading, setQuickRepliesLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<RespostaRapida[]>([]);
  const [quickReplyEditingId, setQuickReplyEditingId] = useState<string | null>(null);
  const [quickReplyForm, setQuickReplyForm] = useState({ titulo: '', atalho: '', mensagem: '' });
  const [slashQuickOpen, setSlashQuickOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogItems, setCatalogItems] = useState<Array<{ id: string; nome: string; descricao?: string | null; valor?: number | null; image_url?: string | null }>>([]);
  const [catalogSelected, setCatalogSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!empresaId || !selectedContact?.id) return;
    window.dispatchEvent(new CustomEvent('system_notifications:mark_read', { detail: { contatoId: selectedContact.id } }));
  }, [empresaId, selectedContact?.id]);
  const [slashQuickIndex, setSlashQuickIndex] = useState(0);
  const [replyTo, setReplyTo] = useState<Mensagem | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<Mensagem | null>(null);
  const [forwardContactId, setForwardContactId] = useState('none');
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  const [contactMenuPos, setContactMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [contactMenuContact, setContactMenuContact] = useState<Contato | null>(null);
  const [contactDeleteConfirmOpen, setContactDeleteConfirmOpen] = useState(false);
  const [pendingDeleteContactId, setPendingDeleteContactId] = useState<string | null>(null);

  const setContactMode = async (contactId: string, mode: 'ia' | 'humano') => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, atendimento_mode: mode } : c));
    if (selectedContact?.id === contactId) {
      setSelectedContact(prev => prev ? { ...prev, atendimento_mode: mode } : prev);
    }
    setMsgStatus(mode === 'ia' ? 'IA' : 'Humano');
    await sb.from('contatos').update({ atendimento_mode: mode }).eq('id', contactId);
  };

  const initials = useMemo(
    () =>
      selectedContact?.nome
        ? selectedContact.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : 'CT',
    [selectedContact]
  );

  const openSchedule = () => {
    setFilePickContext('schedule');
    setScheduleType('text');
    setScheduleFile(null);
    setScheduleOpen(true);
    setScheduleView('agendar');
    setAttachmentOpen(false);
  };

  const openImmediateUpload = (type: 'image' | 'document' | 'audio') => {
    if (!selectedContact) {
      toast({ title: 'Selecione uma conversa', description: 'Abra uma conversa para enviar arquivo.', variant: 'destructive' });
      return;
    }
    setAttachmentOpen(false);
    setFilePickContext('immediate');
    setImmediatePickType(type);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const loadScheduled = async () => {
    if (!empresaId || !selectedContact?.id) return;
    setLoadingScheduled(true);
    const { data } = await sb
      .from('mensagens_agendadas')
      .select('id,contato_id,empresa_id,tipo,texto,mimetype,file_name,scheduled_for,status,created_at')
      .eq('empresa_id', empresaId)
      .eq('contato_id', selectedContact.id)
      .in('status', ['scheduled', 'error'])
      .order('scheduled_for', { ascending: true });
    setScheduledItems((data || []) as MensagemAgendada[]);
    setLoadingScheduled(false);
  };

  const loadQuickReplies = async () => {
    if (!empresaId) return;
    setQuickRepliesLoading(true);
    const { data } = await sb
      .from('respostas_rapidas')
      .select('id,empresa_id,titulo,atalho,mensagem,created_at,updated_at')
      .eq('empresa_id', empresaId)
      .order('updated_at', { ascending: false })
      .limit(200);
    setQuickReplies((data || []) as RespostaRapida[]);
    setQuickRepliesLoading(false);
  };

  const resetQuickReplyForm = () => {
    setQuickReplyEditingId(null);
    setQuickReplyForm({ titulo: '', atalho: '', mensagem: '' });
  };

  const saveQuickReply = async () => {
    if (!empresaId) return;
    const titulo = quickReplyForm.titulo.trim();
    const atalho = quickReplyForm.atalho.trim();
    const mensagem = quickReplyForm.mensagem.trim();
    if (!titulo || !mensagem) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha Título e Mensagem.', variant: 'destructive' });
      return;
    }
    const payload: QuickReplyPayload = {
      empresa_id: empresaId,
      titulo,
      atalho: atalho ? atalho : null,
      mensagem,
      created_by_user_id: user?.id ?? null,
    };
    const q = sb.from('respostas_rapidas');
    const { data, error } = quickReplyEditingId
      ? await q.update(payload).eq('id', quickReplyEditingId).select('id,empresa_id,titulo,atalho,mensagem,created_at,updated_at').single()
      : await q.insert(payload).select('id,empresa_id,titulo,atalho,mensagem,created_at,updated_at').single();
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar a resposta rápida.', variant: 'destructive' });
      return;
    }
    setQuickReplies(prev => {
      const saved = data as unknown as RespostaRapida;
      const next = prev.filter(r => r.id !== saved.id);
      return [saved, ...next];
    });
    resetQuickReplyForm();
    toast({ title: 'Salvo', description: 'Resposta rápida salva.' });
  };

  const deleteQuickReply = async (id: string) => {
    const { error } = await sb.from('respostas_rapidas').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível remover.', variant: 'destructive' });
      return;
    }
    setQuickReplies(prev => prev.filter(r => r.id !== id));
    if (quickReplyEditingId === id) resetQuickReplyForm();
  };

  const applyQuickReply = async (qr: RespostaRapida) => {
    const text = String(qr.mensagem || '').trim();
    if (!text) return;
    if (!selectedContact) {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copiado', description: 'Resposta rápida copiada.' });
      } catch {
        toast({ title: 'Selecione uma conversa', description: 'Abra uma conversa para usar a resposta rápida.', variant: 'destructive' });
      }
      return;
    }
    setPendingText(prev => (prev ? `${prev}\n${text}` : text));
    setQuickRepliesOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const loadEtiquetasForContact = async (contactId: string) => {
    if (!empresaId) return;
    setEtiquetasLoading(true);
    const [{ data: etqs }, { data: links }] = await Promise.all([
      sb
        .from('etiquetas')
        .select('id,empresa_id,nome,cor')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true }),
      sb
        .from('contato_etiquetas')
        .select('etiqueta_id')
        .eq('contato_id', contactId),
    ]);
    setEtiquetas((etqs || []) as Etiqueta[]);
    const linkRows = (links || []) as ContatoEtiquetaLink[];
    setContatoEtiquetaIds(linkRows.map((l) => String(l.etiqueta_id)));
    setEtiquetasLoading(false);
  };

  const loadEtiquetasForContacts = async (contactIds: string[]) => {
    if (!empresaId) return;
    if (contactIds.length === 0) {
      setContatoEtiquetasMap({});
      return;
    }
    const { data, error } = await sb
      .from('contato_etiquetas')
      .select('contato_id, etiqueta_id, etiquetas(id,nome,cor)')
      .in('contato_id', contactIds);

    if (!error) {
      const map: Record<string, Etiqueta[]> = {};
      const rows = (data || []) as Array<{ contato_id: string; etiquetas: { id: string; nome: string; cor: string | null } | null }>;
      rows.forEach((row) => {
        const cid = String(row.contato_id || '');
        const et = row.etiquetas;
        if (!cid || !et?.id) return;
        if (!map[cid]) map[cid] = [];
        map[cid].push({ id: String(et.id), empresa_id: empresaId, nome: String(et.nome || ''), cor: et.cor || null });
      });
      setContatoEtiquetasMap(map);
      return;
    }

    const { data: links } = await sb
      .from('contato_etiquetas')
      .select('contato_id, etiqueta_id')
      .in('contato_id', contactIds);
    const linkRows = (links || []) as Array<{ contato_id: string; etiqueta_id: string }>;
    const etiquetaIds = Array.from(new Set(linkRows.map((l) => String(l.etiqueta_id)).filter(Boolean)));
    if (etiquetaIds.length === 0) {
      setContatoEtiquetasMap({});
      return;
    }
    const { data: etqs } = await sb
      .from('etiquetas')
      .select('id,empresa_id,nome,cor')
      .eq('empresa_id', empresaId)
      .in('id', etiquetaIds);
    const etMap = new Map<string, Etiqueta>();
    (etqs || []).forEach((e) => {
      const row = e as unknown as Etiqueta;
      etMap.set(String(row.id), { id: String(row.id), empresa_id: String(row.empresa_id), nome: String(row.nome || ''), cor: row.cor || null });
    });
    const out: Record<string, Etiqueta[]> = {};
    linkRows.forEach((l) => {
      const cid = String(l.contato_id);
      const eid = String(l.etiqueta_id);
      const et = etMap.get(eid);
      if (!cid || !et) return;
      if (!out[cid]) out[cid] = [];
      out[cid].push(et);
    });
    setContatoEtiquetasMap(out);
  };

  const toggleContatoEtiqueta = async (contactId: string, etiquetaId: string, checked: boolean) => {
    if (checked) {
      const { error } = await sb
        .from('contato_etiquetas')
        .upsert({ contato_id: contactId, etiqueta_id: etiquetaId }, { onConflict: 'contato_id,etiqueta_id' });
      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível adicionar a etiqueta.', variant: 'destructive' });
        return;
      }
      setContatoEtiquetaIds(prev => (prev.includes(etiquetaId) ? prev : [...prev, etiquetaId]));
      const et = etiquetas.find(e => e.id === etiquetaId);
      if (et) {
        setContatoEtiquetasMap(prev => {
          const cur = prev[contactId] || [];
          if (cur.some(x => x.id === et.id)) return prev;
          return { ...prev, [contactId]: [...cur, et] };
        });
      }
      return;
    }

    const { error } = await sb
      .from('contato_etiquetas')
      .delete()
      .eq('contato_id', contactId)
      .eq('etiqueta_id', etiquetaId);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível remover a etiqueta.', variant: 'destructive' });
      return;
    }
    setContatoEtiquetaIds(prev => prev.filter(id => id !== etiquetaId));
    setContatoEtiquetasMap(prev => {
      const cur = prev[contactId] || [];
      const next = cur.filter(e => e.id !== etiquetaId);
      return { ...prev, [contactId]: next };
    });
  };

  const slashQuery = useMemo(() => {
    if (!selectedContact) return '';
    const src = String(pendingText || '');
    if (!src.startsWith('/')) return '';
    return src.slice(1).trim().toLowerCase();
  }, [pendingText, selectedContact]);

  const slashMatches = useMemo(() => {
    if (!selectedContact) return [];
    if (!pendingText.startsWith('/')) return [];
    const q = slashQuery;
    const list = quickReplies;
    if (!q) return list.slice(0, 8);
    const hits = list.filter(r => {
      const title = String(r.titulo || '').toLowerCase();
      const at = String(r.atalho || '').toLowerCase();
      return title.includes(q) || at.includes(q.replace(/^\/+/, ''));
    });
    return hits.slice(0, 8);
  }, [pendingText, quickReplies, selectedContact, slashQuery]);

  const chooseSlashQuick = (qr: RespostaRapida) => {
    const msg = String(qr.mensagem || '').trim();
    if (!msg) return;
    setPendingText(msg);
    setSlashQuickOpen(false);
    setSlashQuickIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!selectedContact) {
      setSlashQuickOpen(false);
      return;
    }
    const shouldOpen = pendingText.startsWith('/') && slashMatches.length > 0;
    setSlashQuickOpen(shouldOpen);
    setSlashQuickIndex(0);
  }, [pendingText, selectedContact, slashMatches.length]);

  const handleScheduleCreate = async () => {
    if (!empresaId || !selectedContact?.id) return;
    const [hh, mm] = scheduleTime.split(':');
    const base = scheduleDate ? new Date(scheduleDate) : new Date();
    base.setHours(Number(hh || 0), Number(mm || 0), 0, 0);
    const scheduledFor = base.toISOString();

    let media_base64: string | null = null;
    let mimetype: string | null = null;
    let file_name: string | null = null;
    let tipo: MensagemAgendada['tipo'] = scheduleType;
    if (scheduleType !== 'text') {
      if (!scheduleFile) {
        toast({ title: 'Arquivo obrigatório', description: 'Selecione um arquivo para agendar.', variant: 'destructive' });
        return;
      }
      mimetype = scheduleFile.type || 'application/octet-stream';
      file_name = scheduleFile.name;
      if (scheduleType === 'image') {
        if (mimetype.startsWith('video/')) tipo = 'video';
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('file read failed'));
        reader.readAsDataURL(scheduleFile);
      });
      media_base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    }

    const { data, error } = await sb
      .from('mensagens_agendadas')
      .insert({
        empresa_id: empresaId,
        contato_id: selectedContact.id,
        conexao_id: selectedContact.conexao_id || null,
        tipo,
        texto: scheduleText || null,
        media_base64,
        mimetype,
        file_name,
        scheduled_for: scheduledFor,
        status: 'scheduled'
      })
      .select('id,contato_id,empresa_id,tipo,texto,mimetype,file_name,scheduled_for,status,created_at')
      .single();
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível agendar a mensagem.', variant: 'destructive' });
      return;
    }
    const created = data as unknown as MensagemAgendada;
    setScheduledItems(prev => [...prev, created].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
    toast({ title: 'Agendado', description: 'Mensagem agendada com sucesso.' });
    setScheduleText('');
    setScheduleFile(null);
    setScheduleOpen(false);
    invokeScheduler();
  };

  const sendImmediateMedia = async (file: File, type: 'image' | 'document' | 'audio') => {
    if (!empresaId || !selectedContact?.id) return;
    const mimetype = file.type || 'application/octet-stream';
    const file_name = file.name || 'arquivo';
    const tipo = (() => {
      if (type === 'image' && mimetype.startsWith('video/')) return 'video';
      return type;
    })();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('file read failed'));
      reader.readAsDataURL(file);
    });
    const media_base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

    const { error } = await sb
      .from('mensagens_agendadas')
      .insert({
        empresa_id: empresaId,
        contato_id: selectedContact.id,
        conexao_id: selectedContact.conexao_id || null,
        tipo,
        texto: null,
        media_base64,
        mimetype,
        file_name,
        scheduled_for: new Date().toISOString(),
        status: 'scheduled'
      });

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível enviar o arquivo.', variant: 'destructive' });
      return;
    }

    invokeScheduler();
    toast({ title: 'Enviando', description: 'Arquivo enviado para processamento.' });
  };

  const cancelScheduled = async (id: string) => {
    const { error } = await sb.from('mensagens_agendadas').update({ status: 'cancelled' }).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível cancelar.', variant: 'destructive' });
      return;
    }
    setScheduledItems(prev => prev.filter(i => i.id !== id));
  };

  const closeContactMenu = () => {
    setContactMenuOpen(false);
    setContactMenuContact(null);
  };

  useEffect(() => {
    if (!contactMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContactMenu();
    };
    const onPointerDown = () => closeContactMenu();
    const onScroll = () => closeContactMenu();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [contactMenuOpen]);

  const openContactMenu = (e: React.MouseEvent, contact: Contato) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 220;
    const padding = 8;
    const maxX = window.innerWidth - menuWidth - padding;
    const maxY = window.innerHeight - menuHeight - padding;
    const x = Math.max(padding, Math.min(e.clientX, maxX));
    const y = Math.max(padding, Math.min(e.clientY, maxY));
    setContactMenuPos({ x, y });
    setContactMenuContact(contact);
    setContactMenuOpen(true);
  };

  const clearConversation = async (contactId: string) => {
    if (!empresaId) return;
    const { error } = await sb
      .from('mensagens')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('contato_id', contactId);
    if (error) throw error;
    setLastMessages(prev => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
    if (selectedContact?.id === contactId) {
      setMessages([]);
      setSelectedContact(null);
    }
  };

  const setConversationResolved = async (contactId: string, resolved: boolean) => {
    if (!empresaId) return;
    const nowIso = new Date().toISOString();
    const payload: Partial<Contato> = resolved
      ? {
          conversa_status: 'resolvida',
          conversa_resolvida_em: nowIso,
          conversa_resolvida_por: user?.id ?? null,
          atendimento_mode: 'ia',
          ai_session_closed_at: nowIso,
          ai_session_updated_at: nowIso,
        }
      : { conversa_status: 'aberta', conversa_resolvida_em: null, conversa_resolvida_por: null };
    const { error } = await sb.from('contatos').update(payload).eq('id', contactId);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o status da conversa.', variant: 'destructive' });
      return;
    }
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...payload } : c));
    if (selectedContact?.id === contactId) {
      if (resolved) {
        setMsgStatus('IA');
      }
      if (resolved && conversaTab === 'abertas') {
        setSelectedContact(null);
        setMessages([]);
      }
      if (!resolved && conversaTab === 'resolvidas') {
        setSelectedContact(null);
        setMessages([]);
      }
    }
  };

  const deleteConversationOrContact = async () => {
    if (!empresaId) return;
    const id = pendingDeleteContactId || contactMenuContact?.id || selectedContact?.id;
    if (!id) return;
    setContactDeleteConfirmOpen(false);
    closeContactMenu();
    setPendingDeleteContactId(null);

    try {
      await clearConversation(id);
      const { error: upErr } = await sb.from('contatos').update({ oculta: true, resumo: null }).eq('id', id);
      if (!upErr) {
        setContacts(prev => prev.map(c => c.id === id ? { ...c, oculta: true, resumo: null } : c));
      }
      toast({ title: 'Concluído', description: 'Conversa apagada.' });
    } catch (e) {
      const msg = String((e as { message?: unknown })?.message ?? '').trim();
      toast({ title: 'Erro', description: msg || 'Não foi possível concluir a ação.', variant: 'destructive' });
    }
  };

  const getMessageSnippet = (msg: Mensagem) => {
    const mt = (msg.mimetype || '').toLowerCase();
    if (msg.tipo === 'audio' || mt.startsWith('audio/')) return '[Áudio]';
    const parsed = parseReplyBlock(stripSignature((msg.conteudo || '').trim(), msg.sender_name));
    const raw = (parsed.body || parsed.quote || '').trim();
    if (raw.startsWith('sticker:')) return '[Figurinha]';
    return raw.replace(/\s+/g, ' ').slice(0, 80);
  };

  const isAudioMessage = (msg: Mensagem) => {
    const mt = (msg.mimetype || '').toLowerCase();
    return msg.tipo === 'audio' || mt.startsWith('audio/');
  };

  const stripSignature = (text: string, name?: string | null) => {
    const src = String(text || '');
    if (!src) return src;
    if (name) {
      const p1 = `*${name}*: `;
      const p2 = `*${name}*:\n`;
      const p3 = `*${name}*\n`;
      if (src.startsWith(p1)) return src.slice(p1.length);
      if (src.startsWith(p2)) return src.slice(p2.length);
      if (src.startsWith(p3)) return src.slice(p3.length);
    }
    const m = src.match(/^\*([^*]{1,64})\*(?::\s+|\r?\n)/);
    if (m) return src.slice(m[0].length);
    return src;
  };

  const parseReplyBlock = (text: string) => {
    const src = String(text || '');
    const marker = '*Respondendo:* ';
    if (!src.startsWith(marker)) return { quote: null as string | null, body: src };
    const sep = src.indexOf('\n\n');
    if (sep === -1) {
      const quote = src.slice(marker.length).trim();
      return { quote: quote || null, body: '' };
    }
    const quote = src.slice(marker.length, sep).trim();
    const body = src.slice(sep + 2).trimStart();
    return { quote: quote || null, body };
  };

  const copyMessageText = async (msg: Mensagem) => {
    if (!msg?.conteudo) return;
    try {
      await navigator.clipboard.writeText(stripSignature(msg.conteudo, msg.sender_name));
      toast({ title: 'Copiado', description: 'Texto copiado.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  const startReply = (msg: Mensagem) => {
    setReplyTo(msg);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const startForward = (msg: Mensagem) => {
    setForwardMsg(msg);
    setForwardContactId('none');
    setForwardOpen(true);
  };

  const setReaction = async (msgId: string, emoji: string) => {
    const nowIso = new Date().toISOString();
    setReactions(prev => ({ ...prev, [msgId]: emoji }));
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reacao_emoji: emoji, reacao_direcao: 'out', reacao_em: nowIso } : m));
    const target = messages.find(m => m.id === msgId);
    if (!target || target.status === 'pendente') return;
    const { error } = await sb
      .from('mensagens')
      .update({ reacao_emoji: emoji, reacao_direcao: 'out', reacao_em: nowIso })
      .eq('id', msgId);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar a reação.', variant: 'destructive' });
      return;
    }
    const token = localStorage.getItem('session_token') || '';
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/whatsapp-react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
      },
      body: JSON.stringify({ message_id: msgId, reaction: emoji })
    }).catch(() => null);

    if (!res) {
      toast({ title: 'Erro', description: 'Falha de rede ao enviar reação.', variant: 'destructive' });
      return;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      try {
        const parsed = JSON.parse(text || '{}');
        const details = String(parsed?.details || parsed?.error || text || '').trim();
        toast({ title: 'Erro', description: details || 'Não foi possível enviar a reação no WhatsApp.', variant: 'destructive' });
      } catch {
        toast({ title: 'Erro', description: text || 'Não foi possível enviar a reação no WhatsApp.', variant: 'destructive' });
      }
    }
  };

  const forwardSend = async () => {
    if (!empresaId || !forwardMsg || forwardContactId === 'none') return;
    const target = contacts.find(c => c.id === forwardContactId);
    if (!target) return;
    const baseFwd = stripSignature(forwardMsg.conteudo || '', forwardMsg.sender_name);
    const content = user?.nome ? `*${user.nome}*:\n${baseFwd}` : baseFwd;
    const optimistic: Mensagem = {
      id: crypto.randomUUID(),
      contato_id: target.id,
      empresa_id: empresaId,
      direcao: 'out',
      conteudo: content,
      sender_user_id: user?.id ?? null,
      sender_name: user?.nome ?? null,
      status: 'pendente',
      created_at: new Date().toISOString()
    };

    if (selectedContact?.id === target.id) {
      setMessages(prev => [...prev, optimistic]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
    setLastMessages(prev => ({ ...prev, [target.id]: { conteudo: getMessageSnippet(optimistic), created_at: optimistic.created_at } }));

    try {
      const payloadFull: MensagemInsert = {
        contato_id: target.id,
        empresa_id: empresaId,
        direcao: 'out',
        conteudo: content,
        sender_user_id: user?.id ?? null,
        sender_name: user?.nome ?? null,
        status: 'pendente'
      };
      let { data: inserted, error } = await sb.from('mensagens').insert(payloadFull).select().single();
      if (error && String(error.message || '').includes("sender_")) {
        const payloadFallback: MensagemInsert = {
          contato_id: target.id,
          empresa_id: empresaId,
          direcao: 'out',
          conteudo: content,
          status: 'pendente'
        };
        const res2 = await sb.from('mensagens').insert(payloadFallback).select().single();
        inserted = res2.data;
        error = res2.error;
      }
      if (error) throw error;
      const insertedRow = inserted as unknown as Mensagem;
      await sb.functions.invoke('whatsapp-send', { body: { message_id: insertedRow.id, sender_name: user?.nome ?? null } });
      if (selectedContact?.id === target.id) {
        setMessages(prev => {
          const hasInserted = prev.some(m => m.id === insertedRow.id);
          if (hasInserted) {
            return prev.filter(m => m.id !== optimistic.id).map(m => m.id === insertedRow.id ? { ...m, status: 'enviado' } : m);
          }
          return prev.map(m => m.id === optimistic.id ? { ...m, id: insertedRow.id, status: 'enviado' } : m);
        });
      }
      toast({ title: 'Encaminhado', description: `Mensagem enviada para ${target.nome}.` });
      setForwardOpen(false);
      setForwardMsg(null);
      setForwardContactId('none');
    } catch (e) {
      console.error(e);
      if (selectedContact?.id === target.id) {
        setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'erro' } : m));
      }
      toast({ title: 'Erro', description: 'Não foi possível encaminhar a mensagem.', variant: 'destructive' });
    }
  };

  // Carregar contatos
  useEffect(() => {
    const loadContacts = async () => {
      if (!empresaId) return;
      setLoadingContacts(true);
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error(error);
      } else {
        setContacts((data || []) as Contato[]);
      }
      setLoadingContacts(false);
    };
    loadContacts();

    if (!empresaId) return;
    const ch = supabase
      .channel('contatos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos', filter: `empresa_id=eq.${empresaId}` }, () => {
        loadContacts();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  useEffect(() => {
    if (!initialContactId) return;
    if (selectedContact?.id === initialContactId) return;
    const found = contacts.find(c => c.id === initialContactId);
    if (found) {
      setSelectedContact(found);
    }
  }, [contacts, initialContactId, selectedContact?.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (scheduleOpen || quickRepliesOpen || infoOpen || etiquetasOpen || forwardOpen || contactDeleteConfirmOpen || catalogOpen) {
          return;
        }
        if (contactMenuOpen) {
          closeContactMenu();
          return;
        }
        if (replyTo) {
          setReplyTo(null);
        }
        if (selectedContact) {
          setSelectedContact(null);
          setMessages([]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedContact, contactMenuOpen, replyTo, scheduleOpen, quickRepliesOpen, infoOpen, etiquetasOpen, forwardOpen, contactDeleteConfirmOpen, catalogOpen]);

  useEffect(() => {
    if (!selectedContact?.id) return;
    if (prevSelectedContactIdRef.current === selectedContact.id) return;
    prevSelectedContactIdRef.current = selectedContact.id;
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 0);
  }, [selectedContact?.id]);

  useEffect(() => {
    if (!selectedContact?.id) return;
    const wasLoading = prevLoadingMessagesRef.current;
    prevLoadingMessagesRef.current = loadingMessages;
    if (wasLoading && !loadingMessages) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 0);
    }
  }, [loadingMessages, selectedContact?.id]);

  const invokeScheduler = async () => {
    const token = localStorage.getItem('session_token') || '';
    const baseUrl = (supabase as unknown as { supabaseUrl?: string })?.supabaseUrl;
    const url = `${String(baseUrl || '').replace(/\/$/, '')}/functions/v1/whatsapp-scheduler`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    await fetch(url, { method: 'POST', headers, body: '{}' }).catch(() => null);
  };

  useEffect(() => {
    if (!empresaId) return;
    invokeScheduler();
    const id = window.setInterval(() => {
      invokeScheduler();
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    loadQuickReplies();
  }, [empresaId]);

  useEffect(() => {
    if (!quickRepliesOpen) return;
    loadQuickReplies();
  }, [quickRepliesOpen]);

  useEffect(() => {
    if (!etiquetasOpen || !etiquetasContact?.id) return;
    loadEtiquetasForContact(etiquetasContact.id);
  }, [etiquetasOpen, etiquetasContact?.id]);

  // Carregar últimos textos por contato para a lista
  useEffect(() => {
    const loadLastMessages = async () => {
      if (!empresaId || contacts.length === 0) return;
      const { data, error } = await sb
        .from('mensagens')
        .select('contato_id, conteudo, created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) {
        console.error(error);
        return;
      }
      const map: Record<string, { conteudo: string; created_at: string }> = {};
      const rows = (data || []) as Array<{ contato_id: string; conteudo: string; created_at: string }>;
      rows.forEach((m) => {
        const cid = m.contato_id as string;
        if (!map[cid]) {
          map[cid] = { conteudo: m.conteudo as string, created_at: m.created_at as string };
        }
      });
      setLastMessages(map);
    };
    loadLastMessages();
  }, [empresaId, JSON.stringify(contacts)]);

  // Carregar mensagens do contato selecionado
  useEffect(() => {
    const loadMessages = async () => {
      if (!empresaId || !selectedContact?.id) return;
      setLoadingMessages(true);
      const { data, error } = await sb
        .from('mensagens')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('contato_id', selectedContact.id)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) {
        console.error(error);
      } else {
        setMessages(((data || []) as unknown) as Mensagem[]);
      }
      setLoadingMessages(false);
    };
    loadMessages();
    if (selectedContact?.id) {
      setUnreadCounts((prev) => {
        if (!prev[selectedContact.id]) return prev;
        return { ...prev, [selectedContact.id]: 0 };
      });
    }

    if (!empresaId || !selectedContact?.id) return;
    const ch = sb
      .channel(`msgs-${selectedContact.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `contato_id=eq.${selectedContact.id}` }, payload => {
        const incoming = (payload.new as unknown) as Mensagem;
        setMessages(prev => {
          if (prev.some(m => m.id === incoming.id)) return prev;
          const incomingTs = Date.parse(incoming.created_at);
          const idxOptimistic = prev.findIndex(m => {
            if (m.direcao !== 'out' || m.status !== 'pendente') return false;
            if (m.conteudo !== incoming.conteudo) return false;
            const mTs = Date.parse(m.created_at);
            if (Number.isNaN(mTs) || Number.isNaN(incomingTs)) return false;
            return Math.abs(incomingTs - mTs) < 2 * 60 * 1000;
          });
          if (idxOptimistic !== -1) {
            const next = [...prev];
            next[idxOptimistic] = incoming;
            return next;
          }
          return [...prev, incoming];
        });
        // Atualiza preview
        const m = payload.new as unknown as Mensagem;
        const previewText = stripSignature(m.conteudo || '', m.sender_name || null);
        setLastMessages(prev => ({ ...prev, [m.contato_id]: { conteudo: previewText, created_at: m.created_at } }));
        // Scroll
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagens', filter: `contato_id=eq.${selectedContact.id}` }, payload => {
        const updated = (payload.new as unknown) as Mensagem;
        if (!updated?.id) return;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [empresaId, selectedContact?.id]);

  // Realtime global para atualizar a lista de conversas (preview) quando chegar mensagem nova
  useEffect(() => {
    if (!empresaId) return;
    const ch = sb
      .channel(`msgs-preview-${empresaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `empresa_id=eq.${empresaId}` }, payload => {
        const m = payload.new as unknown as Mensagem;
        if (!m?.contato_id) return;
        const previewText = stripSignature(m.conteudo || '', m.sender_name || null);
        setLastMessages(prev => ({ ...prev, [m.contato_id]: { conteudo: previewText, created_at: m.created_at } }));

        if (m.direcao === 'in') {
          const isViewing =
            selectedContact?.id === m.contato_id &&
            (!isMobile || mobilePane === 'chat') &&
            document.visibilityState === 'visible';

          if (!isViewing) {
            setUnreadCounts((prev) => {
              const cur = Number(prev[m.contato_id] || 0);
              const next = Math.min(99, cur + 1);
              return { ...prev, [m.contato_id]: next };
            });
          } else {
            setUnreadCounts((prev) => {
              if (!prev[m.contato_id]) return prev;
              return { ...prev, [m.contato_id]: 0 };
            });
          }
        }
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [empresaId, selectedContact?.id, isMobile, mobilePane]);

  useEffect(() => {
    if (!scheduleOpen || scheduleView !== 'agendados') return;
    loadScheduled();
  }, [scheduleOpen, scheduleView, selectedContact?.id]);

  const handleSend = async () => {
    if (!pendingText.trim() || !empresaId || !selectedContact) return;
    const baseText = pendingText.trim();
    const replyPreview = replyTo ? getMessageSnippet(replyTo) : null;
    const replyExternalId = replyTo ? (replyTo.external_id || null) : null;
    const replyMsgId = replyTo ? replyTo.id : null;
    const composed = baseText;
    const text = user?.nome ? `*${user.nome}*:\n${composed}` : composed;
    setPendingText('');
    setReplyTo(null);
    const optimistic: Mensagem = {
      id: crypto.randomUUID(),
      contato_id: selectedContact.id,
      empresa_id: empresaId,
      direcao: 'out',
      conteudo: text,
      reply_to_message_id: replyMsgId,
      reply_to_external_id: replyExternalId,
      reply_to_preview: replyPreview,
      sender_user_id: user?.id ?? null,
      sender_name: user?.nome ?? null,
      status: 'pendente',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimistic]);
    // Atualiza preview e rolagem
    setLastMessages(prev => ({ ...prev, [selectedContact.id]: { conteudo: text, created_at: optimistic.created_at } }));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);

    try {
      const payloadFull: MensagemInsert = {
        contato_id: selectedContact.id,
        empresa_id: empresaId,
        direcao: 'out',
        conteudo: text,
        reply_to_message_id: replyMsgId,
        reply_to_external_id: replyExternalId,
        reply_to_preview: replyPreview,
        sender_user_id: user?.id ?? null,
        sender_name: user?.nome ?? null,
        status: 'pendente'
      };
      let { data: inserted, error } = await sb.from('mensagens').insert(payloadFull).select().single();
      if (error && String(error.message || '').includes("sender_")) {
        const payloadFallback: MensagemInsert = {
          contato_id: selectedContact.id,
          empresa_id: empresaId,
          direcao: 'out',
          conteudo: text,
          status: 'pendente'
        };
        const res2 = await sb.from('mensagens').insert(payloadFallback).select().single();
        inserted = res2.data;
        error = res2.error;
      }
      if (error) throw error;
      const insertedRow = inserted as unknown as Mensagem;
      // Disparar envio com assinatura (backend pode usar sender_name override)
      await sb.functions.invoke('whatsapp-send', { body: { message_id: insertedRow.id, sender_name: user?.nome ?? null } });
      // Atualizar status localmente
      setMessages(prev => {
        const hasInserted = prev.some(m => m.id === insertedRow.id);
        if (hasInserted) {
          return prev
            .filter(m => m.id !== optimistic.id)
            .map(m => m.id === insertedRow.id ? { ...m, status: 'enviado' } : m);
        }
        return prev.map(m => m.id === optimistic.id ? { ...m, id: insertedRow.id, status: 'enviado' } : m);
      });
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'erro' } : m));
      toast({ title: 'Falha ao enviar', description: 'Não foi possível registrar a mensagem.', variant: 'destructive' });
    }
  };

  const insertEmoji = (emoji: string) => {
    if (!selectedContact) return;
    const el = inputRef.current;
    if (!el) {
      setPendingText(prev => `${prev}${emoji}`);
      return;
    }
    const start = el.selectionStart ?? pendingText.length;
    const end = el.selectionEnd ?? pendingText.length;
    const next = `${pendingText.slice(0, start)}${emoji}${pendingText.slice(end)}`;
    setPendingText(next);
    setTimeout(() => {
      el.focus();
      const caret = start + emoji.length;
      el.setSelectionRange(caret, caret);
    }, 0);

    setRecentEmojis(prev => {
      const nextList = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 24);
      try { localStorage.setItem('recent_emojis', JSON.stringify(nextList)); } catch (e) { void e; }
      return nextList;
    });
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });

  const loadCatalog = useCallback(async () => {
    if (!empresaId) return;
    setCatalogLoading(true);
    const q = (catalogQuery || '').trim();
    let sel = supabase
      .from('catalog_items')
      .select('id,nome,descricao,valor,image_url')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(50);
    if (q) sel = sel.or(`nome.ilike.%${q}%,descricao.ilike.%${q}%`);
    const { data } = await sel;
    setCatalogItems((data || []) as CatalogItem[]);
    setCatalogLoading(false);
  }, [catalogQuery, empresaId]);

  useEffect(() => {
    if (!catalogOpen) return;
    void loadCatalog();
  }, [catalogOpen, loadCatalog]);

  const guessMimeFromUrl = (url?: string | null) => {
    const raw = String(url || '').split('#')[0].split('?')[0].toLowerCase();
    if (raw.endsWith('.png')) return 'image/png';
    if (raw.endsWith('.webp')) return 'image/webp';
    if (raw.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  };

  const buildCatalogCaption = (item: { nome: string; descricao?: string | null; valor?: number | null }) => {
    const parts: string[] = [];
    parts.push(`✈️ ${item.nome}`);
    if (item.descricao) parts.push('', String(item.descricao).trim());
    if (typeof item.valor === 'number') {
      const formatted = item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      parts.push('', `💰 ${formatted}`);
    }
    return parts.join('\n');
  };

  const sendCatalogItem = async () => {
    if (!empresaId || !selectedContact?.id || !catalogSelected) return;
    const item = catalogItems.find(i => i.id === catalogSelected);
    if (!item) return;
    const caption = buildCatalogCaption(item);
    const mimetype = guessMimeFromUrl(item.image_url);
    const fileName = `${String(item.nome || 'item').slice(0, 32)}.${mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : mimetype === 'image/gif' ? 'gif' : 'jpg'}`;
    try {
      const payload: MensagemInsert = {
        empresa_id: empresaId,
        contato_id: selectedContact.id,
        direcao: 'out',
        conteudo: caption,
        status: 'pendente',
        tipo: item.image_url ? 'image' : 'text',
      };
      if (item.image_url) {
        payload.media_url = item.image_url;
        payload.mimetype = mimetype;
        payload.file_name = fileName;
      }
      let { data: inserted, error } = await sb.from('mensagens').insert(payload).select('id').single();
      if (error && String(error.message || '').includes('sender_')) {
        const fallback: MensagemInsert = {
          empresa_id: payload.empresa_id,
          contato_id: payload.contato_id,
          direcao: payload.direcao,
          conteudo: payload.conteudo,
          status: payload.status,
          tipo: payload.tipo,
          media_url: payload.media_url ?? null,
          mimetype: payload.mimetype ?? null,
          file_name: payload.file_name ?? null,
        };
        const res2 = await sb.from('mensagens').insert(fallback).select('id').single();
        inserted = res2.data;
        error = res2.error;
      }
      if (error || !inserted?.id) throw error;
      await sb.functions.invoke('whatsapp-send', { body: { message_id: inserted.id, sender_name: user?.nome ?? null } });
      toast({ title: 'Enviado', description: 'Item do catálogo enviado.' });
      setCatalogOpen(false);
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível enviar o item.', variant: 'destructive' });
    }
  };

  const sendStickerDataUrl = async (dataUrl: string) => {
    if (!empresaId || !selectedContact) return;

    const optimistic: Mensagem = {
      id: crypto.randomUUID(),
      contato_id: selectedContact.id,
      empresa_id: empresaId,
      direcao: 'out',
      conteudo: `sticker:${dataUrl}`,
      sender_user_id: user?.id ?? null,
      sender_name: user?.nome ?? null,
      status: 'pendente',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimistic]);
    setLastMessages(prev => ({ ...prev, [selectedContact.id]: { conteudo: '[Figurinha]', created_at: optimistic.created_at } }));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);

    try {
      const payloadFull: MensagemInsert = {
        contato_id: selectedContact.id,
        empresa_id: empresaId,
        direcao: 'out',
        conteudo: `sticker:${dataUrl}`,
        sender_user_id: user?.id ?? null,
        sender_name: user?.nome ?? null,
        status: 'pendente'
      };
      let { data: inserted, error } = await sb.from('mensagens').insert(payloadFull).select().single();
      if (error && String(error.message || '').includes("sender_")) {
        const payloadFallback: MensagemInsert = {
          contato_id: selectedContact.id,
          empresa_id: empresaId,
          direcao: 'out',
          conteudo: `sticker:${dataUrl}`,
          status: 'pendente'
        };
        const res2 = await sb.from('mensagens').insert(payloadFallback).select().single();
        inserted = res2.data;
        error = res2.error;
      }
      if (error) throw error;
      const insertedRow = inserted as unknown as Mensagem;
      await sb.functions.invoke('whatsapp-send', { body: { message_id: insertedRow.id, sender_name: user?.nome ?? null } });
      setMessages(prev => {
        const hasInserted = prev.some(m => m.id === insertedRow.id);
        if (hasInserted) {
          return prev.filter(m => m.id !== optimistic.id).map(m => m.id === insertedRow.id ? { ...m, status: 'enviado' } : m);
        }
        return prev.map(m => m.id === optimistic.id ? { ...m, id: insertedRow.id, status: 'enviado' } : m);
      });
      setRecentStickers(prev => {
        const nextList = [dataUrl, ...prev.filter(s => s !== dataUrl)].slice(0, 12);
        try { localStorage.setItem('recent_stickers', JSON.stringify(nextList)); } catch (e) { void e; }
        return nextList;
      });
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'erro' } : m));
      toast({ title: 'Falha ao enviar', description: 'Não foi possível enviar a figurinha.', variant: 'destructive' });
    }
  };

  const handleStickerFile = async (file: File | null) => {
    if (!file) return;
    if ((file.type || '').toLowerCase() !== 'image/webp') {
      toast({ title: 'Formato inválido', description: 'Por enquanto, envie figurinhas em .webp.', variant: 'destructive' });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await sendStickerDataUrl(dataUrl);
      setPickerOpen(false);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível ler a figurinha.', variant: 'destructive' });
    } finally {
      if (stickerInputRef.current) stickerInputRef.current.value = '';
    }
  };

  const filteredEmojis = useMemo(() => {
    const q = (emojiQuery || '').trim().toLowerCase();
    if (!q) return EMOJIS;
    return EMOJIS
      .map(g => ({
        group: g.group,
        items: g.items.filter(i => i.keywords.some(k => k.toLowerCase().includes(q)))
      }))
      .filter(g => g.items.length > 0);
  }, [emojiQuery]);

  const visibleContacts = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const list = contacts
      .filter(c => {
        const status = c.conversa_status || 'aberta';
        const isOculta = c.oculta === true;
        return conversaTab === 'resolvidas' ? (status === 'resolvida' && !isOculta) : (status !== 'resolvida' && !isOculta);
      })
      .filter(c => {
        if (!q) return true;
        const nome = String(c.nome || '').toLowerCase();
        const contato = String(c.contato || '').toLowerCase();
        const preview = String(lastMessages[c.id]?.conteudo || c.resumo || '').toLowerCase();
        const onlyDigits = (s: string) => s.replace(/\D/g, '');
        const qDigits = onlyDigits(q);
        return (
          nome.includes(q) ||
          contato.includes(q) ||
          preview.includes(q) ||
          (qDigits && onlyDigits(contato).includes(qDigits))
        );
      });
    return list.sort((a, b) => {
      const at =
        (lastMessages[a.id]?.created_at ? Date.parse(lastMessages[a.id]!.created_at) : 0) ||
        (a.updated_at ? Date.parse(a.updated_at) : 0) ||
        (a.created_at ? Date.parse(a.created_at) : 0);
      const bt =
        (lastMessages[b.id]?.created_at ? Date.parse(lastMessages[b.id]!.created_at) : 0) ||
        (b.updated_at ? Date.parse(b.updated_at) : 0) ||
        (b.created_at ? Date.parse(b.created_at) : 0);
      return bt - at;
    });
  }, [contacts, lastMessages, searchQuery, conversaTab]);

  const visibleContactIds = useMemo(() => visibleContacts.map(c => c.id), [visibleContacts]);

  useEffect(() => {
    if (!empresaId) return;
    loadEtiquetasForContacts(visibleContactIds);
  }, [empresaId, visibleContactIds.join(',')]);

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-100px)] overflow-hidden rounded-xl border bg-background shadow-lg w-full flex-col md:flex-row">
        {/* Contacts Sidebar */}
        <div
          className={cn(
            "flex-col bg-card/50 md:border-r",
            isMobile ? "w-full" : "w-80",
            isMobile && mobilePane === "chat" ? "hidden" : "flex",
          )}
        >
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold mb-4">Conversas</h2>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={conversaTab === 'abertas' ? 'default' : 'outline'}
                onClick={() => setConversaTab('abertas')}
              >
                Abertas
              </Button>
              <Button
                type="button"
                size="sm"
                variant={conversaTab === 'resolvidas' ? 'default' : 'outline'}
                onClick={() => setConversaTab('resolvidas')}
              >
                Resolvidas
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingContacts ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
            ) : visibleContacts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa</div>
            ) : visibleContacts.map((contact) => {
              const ets = contatoEtiquetasMap[contact.id] || [];
              const unread = Number(unreadCounts[contact.id] || 0);
              return (
                <div
                  key={contact.id}
                  onClick={() => {
                    setSelectedContact(contact);
                    setMsgStatus(contact.atendimento_mode === 'humano' ? 'Humano' : 'IA');
                    setUnreadCounts((prev) => {
                      if (!prev[contact.id]) return prev;
                      return { ...prev, [contact.id]: 0 };
                    });
                    if (isMobile) setMobilePane('chat');
                  }}
                  onContextMenu={(e) => openContactMenu(e, contact)}
                  className={cn(
                    "p-4 flex items-center gap-3 cursor-pointer transition-colors hover:bg-accent",
                    selectedContact?.id === contact.id && "bg-accent"
                  )}
                >
                  <Avatar>
                    <AvatarImage src={contact.profile_img_url || ''} />
                    <AvatarFallback>{(contact.nome || 'C')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold truncate">{contact.nome}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {unread > 0 ? (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                            {unread}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {lastMessages[contact.id]?.created_at
                            ? new Date(lastMessages[contact.id].created_at).toLocaleDateString('pt-BR')
                            : new Date(contact.updated_at || contact.created_at || '').toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    {ets.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ets.slice(0, 2).map((et) => (
                          <span
                            key={et.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: et.cor || '#3B82F6',
                              borderColor: et.cor || '#3B82F6',
                              color: '#fff'
                            }}
                          >
                            {et.nome}
                          </span>
                        ))}
                        {ets.length > 2 ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground">
                            +{ets.length - 2}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="text-sm text-muted-foreground truncate">
                      <span className="truncate">
                        {renderWhatsAppPreview(lastMessages[contact.id]?.conteudo || contact.resumo || contact.contato, `preview-${contact.id}`)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div
          className={cn(
            "flex-1 flex-col bg-accent/5 min-w-0",
            isMobile && mobilePane === "list" ? "hidden" : "flex",
          )}
        >
          {!selectedContact && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center opacity-80">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt="Logo"
                    className="mx-auto mb-6 max-w-[220px] opacity-70"
                  />
                ) : null}
                <div className="text-sm text-muted-foreground">Selecione uma conversa para visualizar as mensagens.</div>
              </div>
            </div>
          )}
          {selectedContact && (
          <>
          {/* Chat Header */}
          <div className="p-4 border-b flex items-center justify-between bg-background">
            <div className="flex items-center gap-3">
              {isMobile ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setMobilePane('list');
                    setSelectedContact(null);
                    setMessages([]);
                  }}
                >
                  <CornerUpLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <Avatar>
                <AvatarImage src={selectedContact?.profile_img_url || ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold">{selectedContact?.nome || 'Contato'}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant={msgStatus === 'IA' ? "default" : "secondary"} className="text-[10px] h-4">
                    {msgStatus === 'IA' ? <Bot className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                    Atendimento {msgStatus}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!selectedContact) return;
                  const status = selectedContact.conversa_status || 'aberta';
                  setConversationResolved(selectedContact.id, status !== 'resolvida');
                }}
              >
                {(selectedContact?.conversa_status || 'aberta') === 'resolvida' ? 'Reabrir' : 'Resolver'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (!selectedContact) return;
                  const next = (selectedContact.atendimento_mode === 'humano') ? 'ia' : 'humano';
                  setContactMode(selectedContact.id, next);
                }}
                className={cn(
                  "hidden sm:flex",
                  msgStatus === 'Humano' ? "bg-primary text-primary-foreground" : ""
                )}
              >
                {msgStatus === 'IA' ? (
                  <><UserCheck className="h-4 w-4 mr-2" /> Assumir Atendimento</>
                ) : (
                  <><Bot className="h-4 w-4 mr-2" /> Devolver para IA</>
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setInfoOpen(true)}>
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4 max-w-3xl mx-auto w-full">
              {loadingMessages && <div className="text-sm text-muted-foreground">Carregando mensagens...</div>}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</div>
              )}
              {messages.map((msg) => {
                const rendered = parseReplyBlock(stripSignature(msg.conteudo, msg.sender_name));
                const bodyText = rendered.body || '';
                const isAutoCaption = /^\[(Imagem|Vídeo|Documento|Áudio)\]/.test(bodyText.trim());
                const captionText = isAutoCaption ? '' : bodyText;
                const mt = (msg.mimetype || '').toLowerCase();
                const isImage = (msg.tipo === 'image' || mt.startsWith('image/')) && Boolean(msg.media_url);
                const isVideo = (msg.tipo === 'video' || mt.startsWith('video/')) && Boolean(msg.media_url);
                const isDocument = (msg.tipo === 'document' || (mt && !mt.startsWith('image/') && !mt.startsWith('video/') && !mt.startsWith('audio/'))) && Boolean(msg.media_url);
                const quoteText = rendered.quote || (msg.reply_to_preview ? String(msg.reply_to_preview) : null);
                const quoteBox = quoteText ? (
                  <div
                    className={cn(
                      "mb-2 rounded-md border-l-4 px-2 py-1",
                      msg.direcao === 'out'
                        ? "border-primary-foreground/40 bg-primary-foreground/10"
                        : "border-primary/30 bg-muted/50"
                    )}
                  >
                    <div className={cn("text-[10px] font-semibold", msg.direcao === 'out' ? "text-primary-foreground/90" : "text-foreground/80")}>
                      Respondendo
                    </div>
                    <div className={cn("text-xs whitespace-pre-wrap break-words", msg.direcao === 'out' ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {quoteText}
                    </div>
                  </div>
                ) : null;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      msg.direcao === 'out' ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div className="relative group">
                      <div
                        className={cn(
                          "p-3 rounded-2xl text-sm",
                          msg.direcao === 'out'
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-card border rounded-tl-none shadow-sm"
                        )}
                      >
                        {msg.sender_name && msg.direcao === 'out' ? (
                          <div>
                            <span className="font-bold">{msg.sender_name}</span>
                            <br />
                            {isAudioMessage(msg) ? (
                              msg.media_url ? (
                                <div className="min-w-[220px] max-w-[320px] mt-1">
                                  <audio controls preload="none" src={msg.media_url} className="w-full" />
                                </div>
                              ) : (
                                <span className="whitespace-pre-wrap break-words">[Áudio]</span>
                              )
                            ) : msg.conteudo.startsWith('sticker:data:') ? (
                              <img src={msg.conteudo.slice('sticker:'.length)} className="max-w-[220px] rounded-lg mt-1" alt="Figurinha" />
                            ) : isImage ? (
                              <div className="mt-1">
                                {quoteBox}
                                <img src={msg.media_url || ''} className="max-w-[260px] rounded-lg" alt={msg.file_name || 'Imagem'} />
                                {captionText ? (
                                  <div className="mt-1 whitespace-pre-wrap break-words">
                                    {renderWhatsAppText(captionText, `msg-${msg.id}`)}
                                  </div>
                                ) : null}
                              </div>
                            ) : isVideo ? (
                              <div className="mt-1">
                                {quoteBox}
                                <video controls preload="metadata" src={msg.media_url || ''} className="max-w-[280px] rounded-lg" />
                                {captionText ? (
                                  <div className="mt-1 whitespace-pre-wrap break-words">
                                    {renderWhatsAppText(captionText, `msg-${msg.id}`)}
                                  </div>
                                ) : null}
                              </div>
                            ) : isDocument ? (
                              <div className="mt-1">
                                {quoteBox}
                                <a
                                  href={msg.media_url || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-2", msg.direcao === 'out' ? "border-primary-foreground/30" : "")}
                                >
                                  <FileText className="h-4 w-4" />
                                  <span className="text-xs font-medium">{msg.file_name || 'Documento'}</span>
                                </a>
                                {captionText ? (
                                  <div className="mt-1 whitespace-pre-wrap break-words">
                                    {renderWhatsAppText(captionText, `msg-${msg.id}`)}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mt-1">
                                {quoteBox}
                                {captionText ? (
                                  <span className="whitespace-pre-wrap break-words inline-block">
                                    {renderWhatsAppText(captionText, `msg-${msg.id}`)}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ) : isAudioMessage(msg) ? (
                          msg.media_url ? (
                            <div className="min-w-[220px] max-w-[320px]">
                              <audio controls preload="none" src={msg.media_url} className="w-full" />
                            </div>
                          ) : (
                            <span className="whitespace-pre-wrap break-words">[Áudio]</span>
                          )
                        ) : msg.conteudo.startsWith('sticker:data:') ? (
                          <img src={msg.conteudo.slice('sticker:'.length)} className="max-w-[220px] rounded-lg" alt="Figurinha" />
                        ) : isImage ? (
                          <div>
                            {quoteBox}
                            <img src={msg.media_url || ''} className="max-w-[260px] rounded-lg" alt={msg.file_name || 'Imagem'} />
                            {captionText ? (
                              <div className="mt-1 whitespace-pre-wrap break-words">
                                {renderWhatsAppText(captionText, `msg-${msg.id}`)}
                              </div>
                            ) : null}
                          </div>
                        ) : isVideo ? (
                          <div>
                            {quoteBox}
                            <video controls preload="metadata" src={msg.media_url || ''} className="max-w-[280px] rounded-lg" />
                            {captionText ? (
                              <div className="mt-1 whitespace-pre-wrap break-words">
                                {renderWhatsAppText(captionText, `msg-${msg.id}`)}
                              </div>
                            ) : null}
                          </div>
                        ) : isDocument ? (
                          <div>
                            {quoteBox}
                            <a
                              href={msg.media_url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-md border px-3 py-2"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-xs font-medium">{msg.file_name || 'Documento'}</span>
                            </a>
                            {captionText ? (
                              <div className="mt-1 whitespace-pre-wrap break-words">
                                {renderWhatsAppText(captionText, `msg-${msg.id}`)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div>
                            {quoteBox}
                            <span className="whitespace-pre-wrap break-words">
                              {renderWhatsAppText(captionText || bodyText, `msg-${msg.id}`)}
                            </span>
                          </div>
                        )}
                      </div>
                      {(msg.reacao_emoji || reactions[msg.id]) && (
                        <div
                          className={cn(
                            "absolute -bottom-2 rounded-full border bg-background px-1.5 py-0.5 text-[11px] shadow-sm",
                            msg.direcao === 'out' ? "right-1" : "left-1"
                          )}
                        >
                          {msg.reacao_emoji || reactions[msg.id]}
                        </div>
                      )}
                      <div className={cn("absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity", msg.direcao === 'out' ? "left-1" : "right-1")}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-6 w-6 rounded-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={msg.direcao === 'out' ? 'end' : 'start'}>
                            <DropdownMenuItem onClick={() => startReply(msg)}>
                              <CornerUpLeft className="h-4 w-4 mr-2" />
                              Responder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => startForward(msg)}>
                              <Forward className="h-4 w-4 mr-2" />
                              Encaminhar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyMessageText(msg)}>
                              <CopyIcon className="h-4 w-4 mr-2" />
                              Copiar
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <SmilePlus className="h-4 w-4 mr-2" />
                                Reagir
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((e) => (
                                  <DropdownMenuItem key={`${msg.id}-${e}`} onClick={() => void setReaction(msg.id, e)}>
                                    <span className="text-base mr-2">{e}</span>
                                    {e}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      {msg.direcao === 'in' && <Bot className="h-3 w-3 text-primary" />}
                      <span className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleTimeString()}</span>
                      {msg.status !== 'enviado' && <span className="text-[10px] text-muted-foreground">({msg.status})</span>}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="p-4 bg-background border-t">
            {replyTo && (
              <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-muted-foreground">Respondendo</div>
                  <div className="text-xs truncate">{getMessageSnippet(replyTo)}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setReplyTo(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 max-w-4xl mx-auto">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={
                  filePickContext === 'schedule'
                    ? scheduleType === 'audio'
                      ? 'audio/*'
                      : scheduleType === 'document'
                        ? '*/*'
                        : 'image/*,video/*'
                    : immediatePickType === 'audio'
                      ? 'audio/*'
                      : immediatePickType === 'document'
                        ? '*/*'
                        : 'image/*,video/*'
                }
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  e.target.value = '';
                  if (!f) return;
                  if (filePickContext === 'schedule') {
                    setScheduleFile(f);
                    return;
                  }
                  sendImmediateMedia(f, immediatePickType);
                }}
              />
              <Popover open={attachmentOpen} onOpenChange={setAttachmentOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0" disabled={!selectedContact}>
                    <Paperclip className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 max-w-[calc(100vw-2rem)] p-2">
                  <div className="flex flex-col">
                    <Button variant="ghost" className="justify-start gap-3" onClick={() => openImmediateUpload('document')}>
                      <FileText className="h-5 w-5" /> Documento
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3" onClick={() => openImmediateUpload('image')}>
                      <ImageIcon className="h-5 w-5" /> Fotos e vídeos
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3" onClick={() => openImmediateUpload('audio')}>
                      <Mic className="h-5 w-5" /> Áudio
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start gap-3"
                      onClick={() => {
                        setAttachmentOpen(false);
                        setCatalogOpen(true);
                      }}
                    >
                      <ListChecks className="h-5 w-5" /> Catálogo
                    </Button>
                    <div className="h-px my-1 bg-border" />
                    <Button
                      variant="ghost"
                      className="justify-start gap-3"
                      onClick={() => {
                        setAttachmentOpen(false);
                        setQuickRepliesTab('usar');
                        setQuickRepliesOpen(true);
                        loadQuickReplies();
                      }}
                    >
                      <Zap className="h-5 w-5" /> Respostas Rápidas
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3" onClick={() => openSchedule()}>
                      <CalendarDays className="h-5 w-5" /> Agendar Mensagem
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <input
                ref={stickerInputRef}
                type="file"
                className="hidden"
                accept="image/webp"
                onChange={(e) => handleStickerFile(e.target.files?.[0] || null)}
              />
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0" disabled={!selectedContact}>
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[360px] max-w-[calc(100vw-2rem)] p-2">
                  <Tabs value={pickerTab} onValueChange={(v) => setPickerTab(v === 'stickers' ? 'stickers' : 'emoji')}>
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="emoji">Emoji</TabsTrigger>
                      <TabsTrigger value="stickers">Figurinhas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="emoji" className="space-y-2 mt-2">
                      <Input
                        value={emojiQuery}
                        onChange={(e) => setEmojiQuery(e.target.value)}
                        placeholder="Pesquisar emojis"
                      />
                      {recentEmojis.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold text-muted-foreground">Recentes</div>
                          <div className="grid grid-cols-10 gap-1">
                            {recentEmojis.map((e) => (
                              <Button key={`re-${e}`} variant="ghost" size="icon" className="h-8 w-8" onClick={() => insertEmoji(e)}>
                                <span className="text-lg">{e}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      <ScrollArea className="h-64 pr-2">
                        <div className="space-y-3">
                          {filteredEmojis.map((g) => (
                            <div key={g.group} className="space-y-1">
                              <div className="text-[10px] font-semibold text-muted-foreground">{g.group}</div>
                              <div className="grid grid-cols-10 gap-1">
                                {g.items.map((i) => (
                                  <Button
                                    key={`${g.group}-${i.emoji}`}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => insertEmoji(i.emoji)}
                                  >
                                    <span className="text-lg">{i.emoji}</span>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="stickers" className="space-y-2 mt-2">
                      <Button variant="outline" className="w-full" onClick={() => stickerInputRef.current?.click()}>
                        Selecionar figurinha (.webp)
                      </Button>
                      {recentStickers.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Nenhuma figurinha recente.</div>
                      ) : (
                        <ScrollArea className="h-64 pr-2">
                          <div className="grid grid-cols-4 gap-2">
                            {recentStickers.map((s) => (
                              <button
                                key={s.slice(0, 32)}
                                type="button"
                                className="rounded-lg border bg-card hover:bg-accent transition-colors p-2"
                                onClick={() => sendStickerDataUrl(s)}
                              >
                                <img src={s} className="w-full h-auto" alt="Figurinha" />
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
              </Popover>
              <div className="relative flex-1">
                <Textarea
                  ref={inputRef}
                  value={pendingText}
                  onChange={(e) => {
                    setPendingText(e.target.value);
                    if (selectedContact?.id && (selectedContact.atendimento_mode ?? 'ia') === 'ia') {
                      setContactMode(selectedContact.id, 'humano');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (slashQuickOpen) {
                      if (e.key === 'Escape') {
                        setSlashQuickOpen(false);
                        return;
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSlashQuickIndex((i) => {
                          const next = i + 1;
                          return next >= slashMatches.length ? 0 : next;
                        });
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSlashQuickIndex((i) => {
                          const next = i - 1;
                          return next < 0 ? Math.max(0, slashMatches.length - 1) : next;
                        });
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        const picked = slashMatches[slashQuickIndex] || slashMatches[0];
                        if (picked) {
                          e.preventDefault();
                          chooseSlashQuick(picked);
                          return;
                        }
                      }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={msgStatus === 'IA' ? "IA está respondendo... Digite para intervir" : "Digite sua mensagem..."}
                  className="w-full min-h-[44px] max-h-40 resize-none"
                  disabled={!selectedContact}
                />
                {slashQuickOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-full max-w-[640px] rounded-lg border bg-popover text-popover-foreground shadow-md">
                    <div className="p-2">
                      <div className="text-[10px] font-semibold text-muted-foreground">Respostas rápidas</div>
                    </div>
                    <div className="max-h-56 overflow-auto p-1">
                      {slashMatches.map((qr, idx) => (
                        <button
                          key={qr.id}
                          type="button"
                          className={cn(
                            "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent transition-colors",
                            idx === slashQuickIndex ? "bg-accent" : ""
                          )}
                          onMouseEnter={() => setSlashQuickIndex(idx)}
                          onClick={() => chooseSlashQuick(qr)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate">{qr.titulo}</div>
                              <div className="text-xs text-muted-foreground truncate">{qr.mensagem}</div>
                            </div>
                            {qr.atalho ? (
                              <div className="text-xs text-muted-foreground shrink-0">{qr.atalho}</div>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button size="icon" className="shrink-0 rounded-full" onClick={handleSend} disabled={!pendingText.trim() || !selectedContact}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
            {msgStatus === 'IA' && (
              <p className="text-[10px] text-center text-muted-foreground mt-2">
                A IA está ativa. Qualquer mensagem enviada por você desativará a IA para este contato.
              </p>
            )}
          </div>
          </>
          )}
        </div>
      </div>

      <Dialog
        open={forwardOpen}
        onOpenChange={(o) => {
          setForwardOpen(o);
          if (!o) {
            setForwardMsg(null);
            setForwardContactId('none');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encaminhar</DialogTitle>
            <DialogDescription>Selecione um contato para encaminhar a mensagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Mensagem</div>
              <div className="rounded-lg border bg-card p-3 text-sm">
                {forwardMsg ? getMessageSnippet(forwardMsg) : ''}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Para</div>
              <Select value={forwardContactId} onValueChange={setForwardContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setForwardOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={forwardSend} disabled={!forwardMsg || forwardContactId === 'none'}>
              Encaminhar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={quickRepliesOpen}
        onOpenChange={(o) => {
          setQuickRepliesOpen(o);
          if (!o) {
            resetQuickReplyForm();
            setQuickRepliesTab('usar');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Respostas Rápidas</DialogTitle>
            <DialogDescription>Crie respostas prontas e use no chat com 1 clique.</DialogDescription>
          </DialogHeader>

          <Tabs value={quickRepliesTab} onValueChange={(v) => setQuickRepliesTab(v === 'configurar' ? 'configurar' : 'usar')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="usar">Usar</TabsTrigger>
              <TabsTrigger value="configurar">Configurar</TabsTrigger>
            </TabsList>

            <TabsContent value="usar" className="space-y-3">
              {quickRepliesLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : quickReplies.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma resposta rápida cadastrada.</div>
              ) : (
                <ScrollArea className="h-[340px] pr-2">
                  <div className="space-y-2">
                    {quickReplies.map((qr) => (
                      <button
                        key={qr.id}
                        type="button"
                        className="w-full rounded-lg border bg-card p-3 text-left hover:bg-accent transition-colors"
                        onClick={() => applyQuickReply(qr)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{qr.titulo}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {qr.atalho ? `${qr.atalho} • ` : ''}{qr.mensagem}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => { setQuickRepliesTab('configurar'); }}>
                  Configurar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="configurar" className="space-y-4">
              <div className="grid gap-2">
                <Input
                  value={quickReplyForm.titulo}
                  onChange={(e) => setQuickReplyForm(prev => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Título (ex.: Saudação)"
                />
                <Input
                  value={quickReplyForm.atalho}
                  onChange={(e) => setQuickReplyForm(prev => ({ ...prev, atalho: e.target.value }))}
                  placeholder="Atalho opcional (ex.: /ola)"
                />
                <Textarea
                  value={quickReplyForm.mensagem}
                  onChange={(e) => setQuickReplyForm(prev => ({ ...prev, mensagem: e.target.value }))}
                  placeholder="Mensagem"
                  rows={4}
                />
                <div className="flex items-center justify-end gap-2">
                  {quickReplyEditingId ? (
                    <>
                      <Button variant="outline" onClick={resetQuickReplyForm}>Cancelar</Button>
                      <Button onClick={saveQuickReply}>Salvar</Button>
                    </>
                  ) : (
                    <Button onClick={saveQuickReply}>Adicionar</Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Cadastradas</div>
                {quickRepliesLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : quickReplies.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma resposta rápida cadastrada.</div>
                ) : (
                  <ScrollArea className="h-[220px] pr-2">
                    <div className="space-y-2">
                      {quickReplies.map((qr) => (
                        <div key={qr.id} className="rounded-lg border bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{qr.titulo}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {qr.atalho ? `${qr.atalho} • ` : ''}{qr.mensagem}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setQuickReplyEditingId(qr.id);
                                  setQuickReplyForm({ titulo: qr.titulo || '', atalho: qr.atalho || '', mensagem: qr.mensagem || '' });
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteQuickReply(qr.id)}
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Informações do contato</DialogTitle>
            <DialogDescription>Dados e ações rápidas desta conversa.</DialogDescription>
          </DialogHeader>
          {!selectedContact ? (
            <div className="text-sm text-muted-foreground">Selecione um contato.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedContact.profile_img_url || ''} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{selectedContact.nome}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {String(selectedContact.contato || '').replace('@s.whatsapp.net', '')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={msgStatus === 'IA' ? 'default' : 'secondary'}>
                  {msgStatus === 'IA' ? 'IA' : 'Humano'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Última atividade:{' '}
                  {new Date(selectedContact.updated_at || selectedContact.created_at || new Date().toISOString()).toLocaleString('pt-BR')}
                </span>
              </div>

              {selectedContact.resumo ? (
                <div className="rounded-lg border bg-card p-3 text-sm whitespace-pre-wrap">
                  {selectedContact.resumo}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(String(selectedContact.contato || '').replace('@s.whatsapp.net', ''));
                      toast({ title: 'Copiado', description: 'Número copiado.' });
                    } catch {
                      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
                    }
                  }}
                >
                  Copiar número
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await clearConversation(selectedContact.id);
                      setInfoOpen(false);
                      toast({ title: 'Concluído', description: 'Conversa apagada.' });
                    } catch (e) {
                      const msg = String((e as { message?: unknown })?.message ?? '').trim();
                      toast({ title: 'Erro', description: msg || 'Não foi possível apagar a conversa.', variant: 'destructive' });
                    }
                  }}
                >
                  Apagar conversa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={etiquetasOpen}
        onOpenChange={(o) => {
          setEtiquetasOpen(o);
          if (!o) {
            setEtiquetasContact(null);
            setContatoEtiquetaIds([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etiquetas</DialogTitle>
            <DialogDescription>Marque etiquetas para organizar este contato.</DialogDescription>
          </DialogHeader>
          {!etiquetasContact ? (
            <div className="text-sm text-muted-foreground">Selecione um contato.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={etiquetasContact.profile_img_url || ''} />
                  <AvatarFallback>{etiquetasContact.nome ? etiquetasContact.nome.slice(0, 2).toUpperCase() : 'CT'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{etiquetasContact.nome}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {String(etiquetasContact.contato || '').replace('@s.whatsapp.net', '')}
                  </div>
                </div>
              </div>

              {etiquetasLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : etiquetas.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma etiqueta cadastrada em Configurações.</div>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="space-y-2">
                    {etiquetas.map((et) => {
                      const checked = contatoEtiquetaIds.includes(et.id);
                      return (
                        <button
                          key={et.id}
                          type="button"
                          className="w-full rounded-lg border bg-card px-3 py-2 text-left hover:bg-accent transition-colors"
                          onClick={() => toggleContatoEtiqueta(etiquetasContact.id, et.id, !checked)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={checked} />
                            <span
                              className="h-2.5 w-2.5 rounded-full border"
                              style={{ backgroundColor: et.cor || 'transparent' }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{et.nome}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              <div className="flex items-center justify-end">
                <Button variant="outline" onClick={() => setEtiquetasOpen(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={(o) => { setScheduleOpen(o); if (!o) { setScheduleFile(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar Mensagem</DialogTitle>
            <DialogDescription>Agende uma mensagem para enviar automaticamente no WhatsApp.</DialogDescription>
          </DialogHeader>

          <Tabs value={scheduleView} onValueChange={(v) => setScheduleView(v === 'agendados' ? 'agendados' : 'agendar')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="agendar">Agendar</TabsTrigger>
              <TabsTrigger value="agendados">Agendados</TabsTrigger>
            </TabsList>

            <TabsContent value="agendar" className="space-y-4">
              <Tabs
                value={scheduleType}
                onValueChange={(v) =>
                  setScheduleType(v === 'image' || v === 'document' || v === 'audio' ? v : 'text')
                }
              >
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="text">Texto</TabsTrigger>
                  <TabsTrigger value="image">Imagem</TabsTrigger>
                  <TabsTrigger value="document">Doc</TabsTrigger>
                  <TabsTrigger value="audio">Áudio</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-2">
                <Textarea
                  value={scheduleText}
                  onChange={(e) => setScheduleText(e.target.value)}
                  placeholder="Digite a mensagem..."
                />
                {scheduleType !== 'text' && (
                  <div className="flex items-center justify-between gap-2 border rounded-md p-2">
                    <div className="text-sm truncate">{scheduleFile ? scheduleFile.name : 'Selecione um arquivo'}</div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setFilePickContext('schedule'); fileInputRef.current?.click(); }}>
                        Selecionar
                      </Button>
                      {scheduleFile && (
                        <Button variant="ghost" size="icon" onClick={() => setScheduleFile(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {scheduleDate ? scheduleDate.toLocaleDateString() : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduleDate}
                      onSelect={(d) => setScheduleDate(d || new Date())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2 border rounded-md px-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm py-2"
                  />
                </div>
              </div>

              <Button onClick={handleScheduleCreate} disabled={!selectedContact}>
                Agendar Mensagem
              </Button>
            </TabsContent>

            <TabsContent value="agendados" className="space-y-3">
              {loadingScheduled ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : scheduledItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma mensagem agendada.</div>
              ) : (
                <div className="space-y-2">
                  {scheduledItems.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {i.tipo === 'text' ? (i.texto || '(sem texto)') : `[${i.tipo}] ${i.file_name || ''}`.trim()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(i.scheduled_for).toLocaleString()} • {i.status}
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => cancelScheduled(i.id)}>
                        Cancelar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={catalogOpen} onOpenChange={(o) => { setCatalogOpen(o); if (!o) setCatalogSelected(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar item do catálogo</DialogTitle>
            <DialogDescription>Selecione um item para enviar ao cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome/descrição"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
              />
              <Button variant="outline" onClick={() => void loadCatalog()} disabled={catalogLoading}>
                {catalogLoading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
            <ScrollArea className="h-64 pr-2">
              <div className="space-y-2">
                {catalogItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum item encontrado.</div>
                ) : (
                  catalogItems.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className={`w-full text-left p-3 rounded-lg border hover:bg-accent transition ${catalogSelected === it.id ? 'border-primary' : ''}`}
                      onClick={() => setCatalogSelected(it.id)}
                    >
                      <div className="font-medium truncate">{it.nome}</div>
                      {it.descricao ? <div className="text-xs text-muted-foreground line-clamp-2">{it.descricao}</div> : null}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCatalogOpen(false)}>Cancelar</Button>
              <Button onClick={() => void sendCatalogItem()} disabled={!catalogSelected || !selectedContact}>
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDeleteConfirmOpen} onOpenChange={(v) => { setContactDeleteConfirmOpen(v); if (!v) setPendingDeleteContactId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apagar conversa</DialogTitle>
            <DialogDescription>
              Apaga as mensagens armazenadas para este contato. A conversa só volta a aparecer quando o cliente enviar mensagem novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setContactDeleteConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteConversationOrContact}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {contactMenuOpen && contactMenuContact && (
        <div
          className="fixed z-50 w-[220px] rounded-lg border bg-popover text-popover-foreground shadow-md p-1"
          style={{ left: contactMenuPos.x, top: contactMenuPos.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left text-sm px-2 py-2 rounded-md hover:bg-accent"
            onClick={() => {
              toast({
                title: 'Detalhes do contato',
                description: `${contactMenuContact.nome} • ${contactMenuContact.contato}`,
              });
              closeContactMenu();
            }}
          >
            Detalhes
          </button>
          <button
            type="button"
            className="w-full text-left text-sm px-2 py-2 rounded-md hover:bg-accent flex items-center gap-2"
            onClick={() => {
              setEtiquetasContact(contactMenuContact);
              setEtiquetasOpen(true);
              loadEtiquetasForContact(contactMenuContact.id);
              closeContactMenu();
            }}
          >
            <Tag className="h-4 w-4" /> Etiquetas
          </button>
          <button
            type="button"
            className="w-full text-left text-sm px-2 py-2 rounded-md hover:bg-accent"
            onClick={() => {
              const status = contactMenuContact.conversa_status || 'aberta';
              setConversationResolved(contactMenuContact.id, status !== 'resolvida');
              closeContactMenu();
            }}
          >
            {(contactMenuContact.conversa_status || 'aberta') === 'resolvida' ? 'Reabrir conversa' : 'Resolver conversa'}
          </button>
          <div className="h-px my-1 bg-border" />
          <button
            type="button"
            className="w-full text-left text-sm px-2 py-2 rounded-md hover:bg-accent text-destructive"
            onClick={() => {
              const id = contactMenuContact?.id || selectedContact?.id || null;
              setPendingDeleteContactId(id);
              setContactDeleteConfirmOpen(true);
              closeContactMenu();
            }}
          >
            Apagar conversa
          </button>
        </div>
      )}
    </AppLayout>
  );
}
