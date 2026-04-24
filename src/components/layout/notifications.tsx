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
import { useToast } from '@/hooks/use-toast';

type NotificationType = 'message' | 'alert' | 'success' | 'ia';

interface SystemNotification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  type: NotificationType;
  persisted?: boolean;
  meta?: {
    contatoId?: string;
  };
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
  const { toast } = useToast();

  const storageKey = useMemo(() => (empresaId ? `system_notifications:${empresaId}` : 'system_notifications'), [empresaId]);

  const [localNotifications, setLocalNotifications] = useState<SystemNotification[]>(() => {
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

  const [dbNotifications, setDbNotifications] = useState<SystemNotification[]>([]);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contactNameCache = useRef<Map<string, string>>(new Map());
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as SystemNotification[]) : [];
      setLocalNotifications(Array.isArray(parsed) ? parsed.slice(0, 50) : []);
      contactNameCache.current = new Map();
      notifiedIds.current = new Set((Array.isArray(parsed) ? parsed : []).map(n => n.id));
    } catch {
      setLocalNotifications([]);
      contactNameCache.current = new Map();
      notifiedIds.current = new Set();
    }
  }, [storageKey]);

  useEffect(() => {
    const loadDb = async () => {
      if (!user?.id) {
        setDbNotifications([]);
        return;
      }
      const { data } = await supabase
        .from('user_notifications')
        .select('id,title,description,type,created_at,read_at,meta')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      const rows = (data || []) as any[];
      const mapped = rows.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          createdAt: r.created_at,
          read: Boolean(r.read_at),
          type: (r.type as NotificationType) || 'alert',
          persisted: true,
          meta: r.meta || undefined,
        }));

      const latestUnread = mapped.find(n => !n.read) || null;
      if (latestUnread && document.visibilityState === 'visible') {
        const key = `user_notifications:last_toast:${user.id}`;
        try {
          const last = localStorage.getItem(key);
          if (last !== latestUnread.id) {
            localStorage.setItem(key, latestUnread.id);
            toast({ title: latestUnread.title, description: latestUnread.description });
          }
        } catch {
          //
        }
      }

      setDbNotifications(mapped);
    };
    loadDb();
  }, [toast, user?.id]);

  useEffect(() => {
    const handler = (evt: Event) => {
      const e = evt as CustomEvent<{ contatoId?: string }>;
      const contatoId = String(e.detail?.contatoId || '').trim();
      if (!contatoId) return;
      setLocalNotifications(prev =>
        prev.map(n => {
          if (n.read) return n;
          if (n.type !== 'message') return n;
          if (n.meta?.contatoId && n.meta.contatoId !== contatoId) return n;
          return { ...n, read: true };
        })
      );
    };
    window.addEventListener('system_notifications:mark_read', handler as EventListener);
    return () => window.removeEventListener('system_notifications:mark_read', handler as EventListener);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(localNotifications.slice(0, 50)));
    } catch {
      return;
    }
  }, [localNotifications, storageKey]);

  const notifications = useMemo(() => {
    const merged = [...dbNotifications, ...localNotifications];
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return merged.slice(0, 50);
  }, [dbNotifications, localNotifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

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
      const shouldNotify = document.visibilityState !== 'visible' || !document.hasFocus();
      if (!shouldNotify) return;
      if (Notification.permission === 'default') {
        void Notification.requestPermission().catch(() => null);
      }
      if (Notification.permission !== 'granted') return;
      new Notification(title, { body: description });
    } catch {
      return;
    }
  }, []);

  const addNotification = useCallback((notification: SystemNotification, showToast: boolean) => {
    if (notifiedIds.current.has(notification.id)) return;
    notifiedIds.current.add(notification.id);

    if (notification.persisted) {
      setDbNotifications(prev => [notification, ...prev].slice(0, 50));
    } else {
      setLocalNotifications(prev => [notification, ...prev].slice(0, 50));
    }
    playNotificationSound();
    showBrowserNotification(notification.title, notification.description);
    if (showToast && document.visibilityState === 'visible') {
      toast({ title: notification.title, description: notification.description });
    }
  }, [playNotificationSound, showBrowserNotification, toast]);

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
            type: 'message',
            meta: { contatoId: msg.contato_id }
          }, false);
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
          }, true);
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
          }, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification, empresaId, resolveContactName]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any;
          addNotification({
            id: row.id,
            title: row.title,
            description: row.description,
            createdAt: row.created_at || new Date().toISOString(),
            read: Boolean(row.read_at),
            type: (row.type as NotificationType) || 'alert',
            persisted: true,
            meta: row.meta || undefined,
          }, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification, user?.id]);

  const markAsRead = async (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target || target.read) return;
    if (target.persisted && user?.id) {
      await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
      setDbNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      return;
    }
    setLocalNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = async () => {
    if (user?.id) {
      await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
      setDbNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
    setLocalNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
                onClick={() => void markAsRead(n.id)}
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
