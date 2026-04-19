import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { CatalogItem } from '@/types';
import { Copy, Link2, Plus, Trash2 } from 'lucide-react';

type FlowOption = {
  id: string;
  label: string;
  next_step_id?: string | null;
  catalog_item_id?: string | null;
};

type FlowStep = {
  id: string;
  title: string;
  options: FlowOption[];
};

type FlowDoc = {
  version: 1;
  start_step_id: string;
  steps: FlowStep[];
};

type PublicSettings = {
  slug: string;
  enabled: boolean;
  primary_color: string;
  background_color: string;
  card_color: string;
  whatsapp_phone: string | null;
  cta_template: string;
};

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err || '').trim();
}

function slugify(input: string) {
  const v = String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 48);
  return v || 'catalogo';
}

function newId() {
  return crypto.randomUUID();
}

export default function CatalogoPublicoConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);

  const [settings, setSettings] = useState<PublicSettings>({
    slug: '',
    enabled: true,
    primary_color: '#22c55e',
    background_color: '#0b0f14',
    card_color: '#0f1720',
    whatsapp_phone: '',
    cta_template: 'Olá! Tenho interesse em {{item_nome}} ({{item_valor}}).',
  });

  const [flow, setFlow] = useState<FlowDoc>({
    version: 1,
    start_step_id: '',
    steps: [],
  });

  const publicUrl = useMemo(() => {
    const base = window.location.origin;
    const slug = String(settings.slug || '').trim();
    return slug ? `${base}/c/${slug}` : '';
  }, [settings.slug]);

  useEffect(() => {
    const load = async () => {
      if (!user?.empresa_id) return;
      setLoading(true);
      try {
        const [{ data: s }, { data: f }, { data: listItems }] = await Promise.all([
          supabase
            .from('catalog_public_settings')
            .select('slug,enabled,primary_color,background_color,card_color,whatsapp_phone,cta_template')
            .eq('empresa_id', user.empresa_id)
            .maybeSingle(),
          supabase.from('catalog_public_flow').select('flow').eq('empresa_id', user.empresa_id).maybeSingle(),
          supabase
            .from('catalog_items')
            .select('id,nome,descricao,valor,image_url,categoria_id,ativo,tipo')
            .eq('empresa_id', user.empresa_id)
            .order('nome', { ascending: true }),
        ]);

        const nextItems = (listItems || []) as unknown as CatalogItem[];
        setItems(nextItems);

        if (s?.slug) {
          setSettings({
            slug: String(s.slug),
            enabled: Boolean(s.enabled),
            primary_color: String(s.primary_color || '#22c55e'),
            background_color: String(s.background_color || '#0b0f14'),
            card_color: String(s.card_color || '#0f1720'),
            whatsapp_phone: s.whatsapp_phone ? String(s.whatsapp_phone) : '',
            cta_template: String(s.cta_template || 'Olá! Tenho interesse em {{item_nome}} ({{item_valor}}).'),
          });
        } else {
          const { data: emp } = await supabase.from('empresas').select('nome').eq('id', user.empresa_id).maybeSingle();
          const nome = String((emp as unknown as { nome?: string | null } | null)?.nome || '');
          setSettings((prev) => ({ ...prev, slug: slugify(nome || 'catalogo') }));
        }

        if (f?.flow) {
          setFlow(f.flow as unknown as FlowDoc);
        } else {
          const stepId = newId();
          setFlow({ version: 1, start_step_id: stepId, steps: [{ id: stepId, title: 'O que você procura?', options: [] }] });
        }
      } catch (err) {
        toast({ title: 'Erro', description: getErrorMessage(err) || 'Falha ao carregar.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [toast, user?.empresa_id]);

  const saveAll = async () => {
    if (!user?.empresa_id) return;
    const slug = slugify(settings.slug);
    if (!slug) {
      toast({ title: 'Erro', description: 'Slug inválido.', variant: 'destructive' });
      return;
    }
    if (!flow.start_step_id) {
      toast({ title: 'Erro', description: 'Defina o passo inicial.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error: sErr } = await supabase.from('catalog_public_settings').upsert({
        empresa_id: user.empresa_id,
        slug,
        enabled: settings.enabled,
        primary_color: settings.primary_color,
        background_color: settings.background_color,
        card_color: settings.card_color,
        whatsapp_phone: String(settings.whatsapp_phone || '').trim() || null,
        cta_template: String(settings.cta_template || '').trim() || 'Olá! Tenho interesse em {{item_nome}} ({{item_valor}}).',
      }, { onConflict: 'empresa_id' });
      if (sErr) throw sErr;

      const { error: fErr } = await supabase.from('catalog_public_flow').upsert({
        empresa_id: user.empresa_id,
        flow: flow as unknown as Json,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' });
      if (fErr) throw fErr;

      setSettings((prev) => ({ ...prev, slug }));
      toast({ title: 'Salvo', description: 'Catálogo público atualizado.' });
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err) || 'Falha ao salvar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: 'Copiado', description: 'Link copiado.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  const addStep = () => {
    const id = newId();
    setFlow((prev) => ({
      ...prev,
      start_step_id: prev.start_step_id || id,
      steps: [...prev.steps, { id, title: `Passo ${prev.steps.length + 1}`, options: [] }],
    }));
  };

  const deleteStep = (stepId: string) => {
    setFlow((prev) => {
      const steps = prev.steps.filter((s) => s.id !== stepId);
      const cleaned = steps.map((s) => ({
        ...s,
        options: s.options.map((o) => ({
          ...o,
          next_step_id: o.next_step_id === stepId ? null : o.next_step_id,
        })),
      }));
      const start = prev.start_step_id === stepId ? (cleaned[0]?.id || '') : prev.start_step_id;
      return { ...prev, steps: cleaned, start_step_id: start };
    });
  };

  const updateStep = (stepId: string, patch: Partial<FlowStep>) => {
    setFlow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    }));
  };

  const addOption = (stepId: string) => {
    const id = newId();
    setFlow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId
          ? { ...s, options: [...s.options, { id, label: 'Opção', next_step_id: null, catalog_item_id: null }] }
          : s
      ),
    }));
  };

  const deleteOption = (stepId: string, optionId: string) => {
    setFlow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, options: s.options.filter((o) => o.id !== optionId) } : s)),
    }));
  };

  const updateOption = (stepId: string, optionId: string, patch: Partial<FlowOption>) => {
    setFlow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId
          ? { ...s, options: s.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
          : s
      ),
    }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Catálogo Público</h1>
            <p className="text-muted-foreground">Crie um link para seus clientes navegarem e pedirem pelo WhatsApp.</p>
          </div>
          <div className="flex gap-2">
            {publicUrl ? (
              <Button variant="outline" onClick={() => void copyLink()} className="gap-2">
                <Copy className="h-4 w-4" />
                Copiar link
              </Button>
            ) : null}
            <Button onClick={() => void saveAll()} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Link e Aparência
            </CardTitle>
            <CardDescription>Personalize cores e link por empresa. Focado em celular.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Slug do link</Label>
                <Input value={settings.slug} onChange={(e) => setSettings((p) => ({ ...p, slug: e.target.value }))} />
                {publicUrl ? (
                  <div className="text-xs text-muted-foreground break-all">{publicUrl}</div>
                ) : null}
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="grid gap-2">
                  <Label>Ativo</Label>
                  <div className="flex items-center gap-2">
                    <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings((p) => ({ ...p, enabled: v }))} />
                    <span className="text-sm text-muted-foreground">{settings.enabled ? 'Visível' : 'Oculto'}</span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>WhatsApp (opcional)</Label>
                  <Input
                    value={String(settings.whatsapp_phone || '')}
                    onChange={(e) => setSettings((p) => ({ ...p, whatsapp_phone: e.target.value }))}
                    placeholder="Ex: 5511999999999"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Cor principal</Label>
                <Input type="color" value={settings.primary_color} onChange={(e) => setSettings((p) => ({ ...p, primary_color: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Fundo</Label>
                <Input type="color" value={settings.background_color} onChange={(e) => setSettings((p) => ({ ...p, background_color: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Card</Label>
                <Input type="color" value={settings.card_color} onChange={(e) => setSettings((p) => ({ ...p, card_color: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Modelo da mensagem do WhatsApp</Label>
              <Input
                value={settings.cta_template}
                onChange={(e) => setSettings((p) => ({ ...p, cta_template: e.target.value }))}
                placeholder="Use {{item_nome}} e {{item_valor}}"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Fluxo do Catálogo</CardTitle>
              <CardDescription>Monte as etapas e opções que o cliente vai seguir.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={addStep} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo passo
              </Button>
              <div className="min-w-[220px]">
                <Select value={flow.start_step_id || ''} onValueChange={(v) => setFlow((p) => ({ ...p, start_step_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Passo inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    {flow.steps.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title || s.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {flow.steps.length === 0 ? (
              <div className="text-sm text-muted-foreground">Crie o primeiro passo para começar.</div>
            ) : null}

            <div className="grid gap-4">
              {flow.steps.map((step) => (
                <Card key={step.id} className="border-primary/10">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="grid gap-2 flex-1">
                      <Label>Título do passo</Label>
                      <Input value={step.title} onChange={(e) => updateStep(step.id, { title: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => addOption(step.id)}>
                        Adicionar opção
                      </Button>
                      <Button variant="destructive" onClick={() => deleteStep(step.id)} className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {step.options.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sem opções neste passo.</div>
                    ) : null}
                    {step.options.map((opt) => (
                      <div key={opt.id} className="grid gap-2 rounded-xl border p-3">
                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="grid gap-2">
                            <Label>Texto</Label>
                            <Input value={opt.label} onChange={(e) => updateOption(step.id, opt.id, { label: e.target.value })} />
                          </div>
                          <div className="grid gap-2">
                            <Label>Vai para</Label>
                            <Select
                              value={opt.next_step_id ? `step:${opt.next_step_id}` : opt.catalog_item_id ? `item:${opt.catalog_item_id}` : ''}
                              onValueChange={(v) => {
                                if (!v) {
                                  updateOption(step.id, opt.id, { next_step_id: null, catalog_item_id: null });
                                  return;
                                }
                                if (v.startsWith('step:')) {
                                  updateOption(step.id, opt.id, { next_step_id: v.slice(5), catalog_item_id: null });
                                  return;
                                }
                                if (v.startsWith('item:')) {
                                  updateOption(step.id, opt.id, { catalog_item_id: v.slice(5), next_step_id: null });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {flow.steps
                                  .filter((s) => s.id !== step.id)
                                  .map((s) => (
                                    <SelectItem key={s.id} value={`step:${s.id}`}>
                                      Passo: {s.title || s.id}
                                    </SelectItem>
                                  ))}
                                {items.map((it) => (
                                  <SelectItem key={it.id} value={`item:${it.id}`}>
                                    Item: {it.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end justify-end">
                            <Button variant="destructive" onClick={() => deleteOption(step.id, opt.id)} className="gap-2">
                              <Trash2 className="h-4 w-4" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
