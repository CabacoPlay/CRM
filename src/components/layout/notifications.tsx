import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Bell, MessageSquare, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';

type NotificationType = 'message' | 'alert' | 'success' | 'ia';

interface SystemNotification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  type: NotificationType;
}

type MensagemRow = {
  id: string;
  contato_id: string;
  direcao: 'in' | 'out';
  conteudo: string;
  created_at: string;
};

type ContatoRow = {
  id: string;
  nome: string;
  atendimento_mode?: string;
  updated_at?: string;
};

type AgendamentoRow = {
  id: string;
  nome_cliente?: string;
  data_hora?: string;
  status?: string;
  updated_at?: string;
};

export function SystemNotifications() {
  const { user } = useAuth();
  const empresaId = user?.empresa_id ?? null;

  const storageKey = useMemo(() => (empresaId ? `system_notifications:${empresaId}` : 'system_notifications'), [empresaId]);

  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SystemNotification[];
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, 50);
    } catch {
      return [];
    }
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contactNameCache = useRef<Map<string, string>>(new Map());
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as SystemNotification[]) : [];
      setNotifications(Array.isArray(parsed) ? parsed.slice(0, 50) : []);
      contactNameCache.current = new Map();
      notifiedIds.current = new Set((Array.isArray(parsed) ? parsed : []).map(n => n.id));
    } catch {
      setNotifications([]);
      contactNameCache.current = new Map();
      notifiedIds.current = new Set();
    }
  }, [storageKey]);

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, 50)));
    } catch {
      return;
    }
  }, [notifications, storageKey]);

  useEffect(() => {
    notifiedIds.current = new Set(notifications.map(n => n.id));
  }, [notifications]);

  const formatRelativeTime = (iso: string) => {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (diffSec < 20) return 'Agora';
    if (diffSec < 60) return `${diffSec}s atrás`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min atrás`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} h atrás`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} d atrás`;
  };

  const playNotificationSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    }
    audioRef.current.play().catch(() => {});
  }, []);

  const showBrowserNotification = useCallback((title: string, description: string) => {
    try {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      if (document.visibilityState === 'visible') return;
      new Notification(title, { body: description });
    } catch {
      return;
    }
  }, []);

  const addNotification = useCallback((notification: SystemNotification) => {
    if (notifiedIds.current.has(notification.id)) return;
    notifiedIds.current.add(notification.id);

    setNotifications(prev => [notification, ...prev].slice(0, 50));
    playNotificationSound();
    showBrowserNotification(notification.title, notification.description);
  }, [playNotificationSound, showBrowserNotification]);

  const resolveContactName = useCallback(async (contactId: string) => {
    const cached = contactNameCache.current.get(contactId);
    if (cached) return cached;
    const { data } = await supabase.from('contatos').select('nome').eq('id', contactId).maybeSingle();
    const name = (data as { nome?: string } | null)?.nome || 'Contato';
    contactNameCache.current.set(contactId, name);
    return name;
  }, []);

  useEffect(() => {
    if (!empresaId) return;

    const channel = supabase
      .channel(`system-notifications:${empresaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `empresa_id=eq.${empresaId}` },
        async (payload) => {
          const msg = payload.new as unknown as MensagemRow;
          if (!msg || msg.direcao !== 'in') return;
          const contactName = await resolveContactName(msg.contato_id);
          const preview = (msg.conteudo || '').replace(/\s+/g, ' ').trim().slice(0, 120);
          addNotification({
            id: `msg:${msg.id}`,
            title: 'Nova mensagem',
            description: `${contactName}: ${preview || 'Mensagem recebida.'}`,
            createdAt: msg.created_at || new Date().toISOString(),
            read: false,
            type: 'message'
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contatos', filter: `empresa_id=eq.${empresaId}` },
        async (payload) => {
          const oldRow = payload.old as unknown as ContatoRow;
          const newRow = payload.new as unknown as ContatoRow;
          if (!oldRow || !newRow) return;
          if (oldRow.atendimento_mode === newRow.atendimento_mode) return;
          const contactName = newRow.nome || (await resolveContactName(newRow.id));
          addNotification({
            id: `mode:${newRow.id}:${newRow.updated_at || Date.now()}`,
            title: newRow.atendimento_mode === 'ia' ? 'IA Ativa' : 'Humano Assumiu',
            description:
              newRow.atendimento_mode === 'ia'
                ? `A IA assumiu o atendimento de ${contactName}.`
                : `${contactName} mudou para atendimento humano.`,
            createdAt: newRow.updated_at || new Date().toISOString(),
            read: false,
            type: newRow.atendimento_mode === 'ia' ? 'ia' : 'alert'
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos', filter: `empresa_id=eq.${empresaId}` },
        async (payload) => {
          const row = ((payload.new as unknown) as AgendamentoRow) || ((payload.old as unknown) as AgendamentoRow);
          if (!row) return;
          const title =
            payload.eventType === 'INSERT'
              ? 'Novo agendamento'
              : row.status === 'Cancelado'
                ? 'Agendamento cancelado'
                : 'Agendamento atualizado';
          const nome = row.nome_cliente || 'Cliente';
          const when = row.data_hora ? new Date(row.data_hora).toLocaleString('pt-BR') : '';
          addNotification({
            id: `appt:${payload.eventType}:${row.id}:${row.updated_at || row.data_hora || Date.now()}`,
            title,
            description: `${nome}${when ? ` • ${when}` : ''}`,
            createdAt: row.updated_at || new Date().toISOString(),
            read: false,
            type: row.status === 'Cancelado' ? 'alert' : 'success'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification, empresaId, resolveContactName]);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'ia': return <Zap className="h-4 w-4 text-purple-500" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={async (nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) return;
        try {
          if (typeof Notification === 'undefined') return;
          if (Notification.permission !== 'default') return;
          await Notification.requestPermission();
        } catch {
          return;
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground border-2 border-background animate-pulse"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-[10px] h-7 px-2"
              onClick={markAllAsRead}
            >
              Ler todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              Nenhuma notificação por enquanto.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                className={cn(
                  "p-4 border-b last:border-0 cursor-pointer transition-colors hover:bg-accent/50 flex gap-3",
                  !n.read && "bg-primary/5"
                )}
              >
                <div className="mt-1 shrink-0">{getIcon(n.type)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <p className={cn("text-xs font-semibold", !n.read && "text-primary")}>{n.title}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(n.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">{n.description}</p>
                </div>
                {!n.read && (
                  <div className="mt-2 shrink-0 h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            ))
          )}
        </ScrollArea>
        <div className="p-2 border-t text-center">
          <Button variant="ghost" size="sm" className="w-full text-[10px] h-8">
            Ver todo o histórico
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
