import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { CatalogItem } from '@/types';
import { Copy, Link2, Plus, Trash2 } from 'lucide-react';

type AttributeStep = {
  id: string;
  title: string;
  attribute_key: string;
};

type FlowDocV2 = {
  version: 2;
  steps: AttributeStep[];
};

type PublicSettings = {
  slug: string;
  enabled: boolean;
  primary_color: string;
  background_color: string;
  card_color: string;
  headline: string;
  subheadline: string;
  cover_image_url: string;
  avatar_url: string;
  whatsapp_phone: string | null;
  cta_template: string;
};

type ItemAttrRow = {
  catalog_item_id: string;
  key: string;
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSteps(value: unknown): AttributeStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (!isRecord(raw)) return null;
      const id = String(raw.id || newId());
      const title = String(raw.title || '').trim();
      const attribute_key = String(raw.attribute_key || '').trim();
      return { id, title, attribute_key };
    })
    .filter((s): s is AttributeStep => Boolean(s?.id));
}

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

export default function CatalogoPublicoFiltrosConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [attrs, setAttrs] = useState<Record<string, Record<string, string>>>({});

  const [settings, setSettings] = useState<PublicSettings>({
    slug: '',
    enabled: true,
    primary_color: '#22c55e',
    background_color: '#0b0f14',
    card_color: '#0f1720',
    headline: '',
    subheadline: 'Escolha e envie seu pedido no WhatsApp',
    cover_image_url: '',
    avatar_url: '',
    whatsapp_phone: '',
    cta_template: 'Olá! Tenho interesse em {{item_nome}} ({{item_valor}}).',
  });

  const [flow, setFlow] = useState<FlowDocV2>({
    version: 2,
    steps: [
      { id: newId(), title: 'Serviço', attribute_key: 'servico' },
      { id: newId(), title: 'Marca', attribute_key: 'marca' },
      { id: newId(), title: 'Modelo', attribute_key: 'modelo' },
    ],
  });

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [draftAttrs, setDraftAttrs] = useState<Record<string, string>>({});

  const publicUrl = useMemo(() => {
    const base = window.location.origin;
    const slug = String(settings.slug || '').trim();
    return slug ? `${base}/c/${slug}` : '';
  }, [settings.slug]);

  const steps = useMemo(
    () => flow.steps.filter((s) => String(s.attribute_key || '').trim()),
    [flow.steps]
  );

  const valueSuggestions = useMemo(() => {
    const byKey: Record<string, Set<string>> = {};
    Object.values(attrs).forEach((kv) => {
      Object.entries(kv).forEach(([k, v]) => {
        if (!k || !v) return;
        if (!byKey[k]) byKey[k] = new Set<string>();
        byKey[k].add(v);
      });
    });
    const out: Record<string, string[]> = {};
    Object.entries(byKey).forEach(([k, set]) => {
      out[k] = Array.from(set).sort((a, b) => a.localeCompare(b));
    });
    return out;
  }, [attrs]);

  useEffect(() => {
    const load = async () => {
      if (!user?.empresa_id) return;
      setLoading(true);
      try {
        const [{ data: s }, { data: f }, { data: listItems }, { data: listAttrs }] = await Promise.all([
          supabase
            .from('catalog_public_settings')
            .select('slug,enabled,primary_color,background_color,card_color,headline,subheadline,cover_image_url,avatar_url,whatsapp_phone,cta_template')
            .eq('empresa_id', user.empresa_id)
            .maybeSingle(),
          supabase.from('catalog_public_flow').select('flow').eq('empresa_id', user.empresa_id).maybeSingle(),
          supabase
            .from('catalog_items')
            .select('id,nome,descricao,valor,image_url,categoria_id,ativo,tipo')
            .eq('empresa_id', user.empresa_id)
            .order('nome', { ascending: true }),
          supabase
            .from('catalog_item_attributes')
            .select('catalog_item_id,key,value')
            .eq('empresa_id', user.empresa_id)
            .limit(10000),
        ]);

        const nextItems = (listItems || []) as unknown as CatalogItem[];
        setItems(nextItems);

        const map: Record<string, Record<string, string>> = {};
        (listAttrs || []).forEach((r) => {
          const row = r as unknown as ItemAttrRow;
          if (!row.catalog_item_id || !row.key) return;
          if (!map[row.catalog_item_id]) map[row.catalog_item_id] = {};
          map[row.catalog_item_id][row.key] = row.value;
        });
        setAttrs(map);

        if (s?.slug) {
          const sRow = s as unknown as {
            slug: string;
            enabled: boolean;
            primary_color: string;
            background_color: string;
            card_color: string;
            headline?: string | null;
            subheadline?: string | null;
            cover_image_url?: string | null;
            avatar_url?: string | null;
            whatsapp_phone?: string | null;
            cta_template?: string | null;
          };
          setSettings({
            slug: String(sRow.slug),
            enabled: Boolean(sRow.enabled),
            primary_color: String(sRow.primary_color || '#22c55e'),
            background_color: String(sRow.background_color || '#0b0f14'),
            card_color: String(sRow.card_color || '#0f1720'),
            headline: String(sRow.headline || ''),
            subheadline: String(sRow.subheadline || 'Escolha e envie seu pedido no WhatsApp'),
            cover_image_url: String(sRow.cover_image_url || ''),
            avatar_url: String(sRow.avatar_url || ''),
            whatsapp_phone: sRow.whatsapp_phone ? String(sRow.whatsapp_phone) : '',
            cta_template: String(sRow.cta_template || 'Olá! Tenho interesse em {{item_nome}} ({{item_valor}}).'),
          });
        } else {
          const { data: emp } = await supabase.from('empresas').select('nome,logo_url').eq('id', user.empresa_id).maybeSingle();
          const row = emp as unknown as { nome?: string | null; logo_url?: string | null } | null;
          const nome = String(row?.nome || '');
          const logoUrl = String(row?.logo_url || '');
          setSettings((prev) => ({
            ...prev,
            slug: slugify(nome || 'catalogo'),
            headline: prev.headline || nome,
            avatar_url: prev.avatar_url || logoUrl,
          }));
        }

        const rawFlow = f?.flow as unknown;
        if (isRecord(rawFlow) && Number(rawFlow.version) === 2) {
          const incoming = parseSteps(rawFlow.steps).map((s) => ({
            ...s,
            attribute_key: slugify(s.attribute_key),
          }));
          if (incoming.length > 0) setFlow({ version: 2, steps: incoming });
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
    const normalizedSteps = flow.steps
      .map((s) => ({
        id: String(s.id || newId()),
        title: String(s.title || '').trim(),
        attribute_key: slugify(String(s.attribute_key || '')),
      }))
      .filter((s) => s.attribute_key);
    if (normalizedSteps.length === 0) {
      toast({ title: 'Erro', description: 'Adicione ao menos 1 passo.', variant: 'destructive' });
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
        headline: String(settings.headline || '').trim() || null,
        subheadline: String(settings.subheadline || '').trim() || null,
        cover_image_url: String(settings.cover_image_url || '').trim() || null,
        avatar_url: String(settings.avatar_url || '').trim() || null,
        whatsapp_phone: String(settings.whatsapp_phone || '').trim() || null,
        cta_template: String(settings.cta_template || '').trim() || 'Olá! Tenho interesse em {{item_nome}} ({{item_valor}}).',
      }, { onConflict: 'empresa_id' });
      if (sErr) throw sErr;

      const flowDoc: FlowDocV2 = { version: 2, steps: normalizedSteps };
      const { error: fErr } = await supabase.from('catalog_public_flow').upsert({
        empresa_id: user.empresa_id,
        flow: flowDoc as unknown as Json,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' });
      if (fErr) throw fErr;

      setSettings((prev) => ({ ...prev, slug }));
      setFlow({ version: 2, steps: normalizedSteps });
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
    setFlow((prev) => ({
      ...prev,
      steps: [...prev.steps, { id: newId(), title: `Passo ${prev.steps.length + 1}`, attribute_key: '' }],
    }));
  };

  const deleteStep = (stepId: string) => {
    setFlow((prev) => ({ ...prev, steps: prev.steps.filter((s) => s.id !== stepId) }));
  };

  const updateStep = (stepId: string, patch: Partial<AttributeStep>) => {
    setFlow((prev) => ({ ...prev, steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }));
  };

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedItemId) || null, [items, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) {
      setDraftAttrs({});
      return;
    }
    const next: Record<string, string> = {};
    const row = attrs[selectedItemId] || {};
    steps.forEach((s) => {
      const k = slugify(s.attribute_key);
      if (!k) return;
      next[k] = row[k] || '';
    });
    setDraftAttrs(next);
  }, [attrs, selectedItemId, steps]);

  const saveItemAttrs = async () => {
    if (!user?.empresa_id || !selectedItemId) return;
    const empresaId = user.empresa_id;
    const itemId = selectedItemId;

    const keys = steps.map((s) => slugify(s.attribute_key)).filter(Boolean);
    const upserts = keys
      .map((k) => {
        const v = String(draftAttrs[k] || '').trim();
        if (!v) return null;
        return { empresa_id: empresaId, catalog_item_id: itemId, key: k, value: v };
      })
      .filter((r): r is { empresa_id: string; catalog_item_id: string; key: string; value: string } => Boolean(r));

    const deletes = keys.filter((k) => !String(draftAttrs[k] || '').trim());

    try {
      if (deletes.length) {
        const { error } = await supabase
          .from('catalog_item_attributes')
          .delete()
          .eq('empresa_id', empresaId)
          .eq('catalog_item_id', itemId)
          .in('key', deletes);
        if (error) throw error;
      }

      if (upserts.length) {
        const { error } = await supabase.from('catalog_item_attributes').upsert(upserts, { onConflict: 'catalog_item_id,key' });
        if (error) throw error;
      }

      setAttrs((prev) => {
        const next = { ...prev };
        const row = { ...(next[itemId] || {}) };
        keys.forEach((k) => {
          const v = String(draftAttrs[k] || '').trim();
          if (!v) {
            delete row[k];
          } else {
            row[k] = v;
          }
        });
        next[itemId] = row;
        return next;
      });

      toast({ title: 'Salvo', description: 'Atributos do item atualizados.' });
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err) || 'Falha ao salvar atributos.', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Link Catálogo</h1>
            <p className="text-muted-foreground">Modo filtros (Opção B): funciona em qualquer nicho usando atributos.</p>
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
            <CardDescription>Personalize cores e link por empresa. Página pública focada em celular.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Slug do link</Label>
                <Input value={settings.slug} onChange={(e) => setSettings((p) => ({ ...p, slug: e.target.value }))} />
                {publicUrl ? <div className="text-xs text-muted-foreground break-all">{publicUrl}</div> : null}
              </div>
              <div className="grid gap-2">
                <Label>Ativo</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings((p) => ({ ...p, enabled: v }))} />
                  <span className="text-sm text-muted-foreground">{settings.enabled ? 'Visível' : 'Oculto'}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Título da página</Label>
                <Input
                  value={settings.headline}
                  onChange={(e) => setSettings((p) => ({ ...p, headline: e.target.value }))}
                  placeholder="Ex: Aviora Viagens"
                />
              </div>
              <div className="grid gap-2">
                <Label>Subtítulo</Label>
                <Input
                  value={settings.subheadline}
                  onChange={(e) => setSettings((p) => ({ ...p, subheadline: e.target.value }))}
                  placeholder="Ex: Orçamentos rápidos pelo WhatsApp"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Imagem de capa (URL)</Label>
              <Input
                value={settings.cover_image_url}
                onChange={(e) => setSettings((p) => ({ ...p, cover_image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-2">
              <Label>Logo / Avatar (URL)</Label>
              <Input
                value={settings.avatar_url}
                onChange={(e) => setSettings((p) => ({ ...p, avatar_url: e.target.value }))}
                placeholder="https://..."
              />
              <div className="text-xs text-muted-foreground">
                Dica: cole a mesma URL usada no cadastro/branding da empresa.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>WhatsApp (opcional)</Label>
                <Input
                  value={String(settings.whatsapp_phone || '')}
                  onChange={(e) => setSettings((p) => ({ ...p, whatsapp_phone: e.target.value }))}
                  placeholder="Ex: 5511999999999"
                />
              </div>
              <div className="grid gap-2">
                <Label>Modelo da mensagem do WhatsApp</Label>
                <Input
                  value={settings.cta_template}
                  onChange={(e) => setSettings((p) => ({ ...p, cta_template: e.target.value }))}
                  placeholder="Use {{item_nome}}, {{item_valor}}, {{selecoes}}"
                />
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
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Etapas (atributos)</CardTitle>
              <CardDescription>Ex: serviço → marca → modelo. Você define os nomes e as chaves.</CardDescription>
            </div>
            <Button variant="outline" onClick={addStep} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo passo
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {flow.steps.map((s, idx) => (
              <div key={s.id} className="grid gap-3 rounded-xl border p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Título</Label>
                    <Input value={s.title} onChange={(e) => updateStep(s.id, { title: e.target.value })} placeholder={`Passo ${idx + 1}`} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Chave</Label>
                    <Input value={s.attribute_key} onChange={(e) => updateStep(s.id, { attribute_key: e.target.value })} placeholder="ex: marca" />
                  </div>
                  <div className="flex items-end justify-end">
                    <Button variant="destructive" onClick={() => deleteStep(s.id)} className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardHeader>
            <CardTitle>Vincular itens do catálogo</CardTitle>
            <CardDescription>Escolha um item e preencha os atributos. Isso controla como ele aparece no link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_280px]">
              <div className="grid gap-2">
                <Label>Item</Label>
                <Button variant="outline" className="justify-between rounded-2xl" onClick={() => setItemPickerOpen(true)}>
                  <span className="truncate">{selectedItem?.nome || 'Selecionar item'}</span>
                  <span className="text-muted-foreground">Selecionar</span>
                </Button>
                <div className="text-xs text-muted-foreground">
                  Selecione um item e depois preencha os atributos abaixo.
                </div>
              </div>
              <div className="flex items-end justify-end">
                <Button onClick={() => void saveItemAttrs()} disabled={!selectedItemId}>
                  Salvar atributos
                </Button>
              </div>
            </div>

            {selectedItem ? (
              <div className="rounded-2xl border p-4">
                <div className="font-bold">{selectedItem.nome}</div>
                <div className="text-xs text-muted-foreground">{selectedItem.descricao || '—'}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Selecione um item para editar os atributos.</div>
            )}

            {selectedItem ? (
              <div className="grid gap-3">
                {steps.map((s) => {
                  const k = slugify(s.attribute_key);
                  const list = valueSuggestions[k] || [];
                  const listId = `dl-${k}`;
                  return (
                    <div key={s.id} className="grid gap-2">
                      <Label>{s.title}</Label>
                      <Input
                        value={draftAttrs[k] || ''}
                        onChange={(e) => setDraftAttrs((prev) => ({ ...prev, [k]: e.target.value }))}
                        list={listId}
                        placeholder="Digite um valor..."
                      />
                      <datalist id={listId}>
                        {list.slice(0, 200).map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <CommandDialog open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
              <CommandInput placeholder="Buscar item do catálogo..." />
              <CommandList>
                <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={it.nome}
                    onSelect={() => {
                      setSelectedItemId(it.id);
                      setItemPickerOpen(false);
                    }}
                  >
                    <span className="truncate">{it.nome}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </CommandDialog>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
