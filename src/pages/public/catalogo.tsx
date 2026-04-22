import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, MessageCircle } from 'lucide-react';

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
  empresa_id: string;
  slug: string;
  enabled: boolean;
  avatar_url: string | null;
  primary_color: string;
  background_color: string;
  card_color: string;
  headline: string | null;
  subheadline: string | null;
  cover_image_url: string | null;
  whatsapp_phone: string | null;
  cta_template: string;
};

type CatalogItem = {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  image_url: string | null;
};

type ItemAttrRow = {
  catalog_item_id: string;
  key: string;
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFlowDoc(value: unknown): FlowDocV2 | null {
  if (!isRecord(value)) return null;
  const version = Number(value.version);
  const stepsRaw = value.steps;
  if (!Array.isArray(stepsRaw)) return null;
  const steps = stepsRaw
    .map((s) => {
      if (!isRecord(s)) return null;
      const id = String(s.id || '');
      const title = String(s.title || '').trim();
      const attribute_key = slugify(String(s.attribute_key || '')).trim();
      if (!id || !attribute_key) return null;
      return { id, title, attribute_key };
    })
    .filter((s): s is AttributeStep => Boolean(s));

  if (version === 2 && steps.length) return { version: 2, steps };

  const legacySteps = stepsRaw
    .map((s) => {
      if (!isRecord(s)) return null;
      const id = String(s.id || '');
      const title = String(s.title || '').trim();
      const attribute_key = slugify(title);
      if (!id || !attribute_key) return null;
      return { id, title, attribute_key };
    })
    .filter((s): s is AttributeStep => Boolean(s));

  if (legacySteps.length) return { version: 2, steps: legacySteps };
  return null;
}

function formatBRL(value: number) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  } catch {
    return `R$ ${value}`;
  }
}

function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '');
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
  return v || '';
}

function buildWhatsappText(args: {
  template: string;
  selections: Array<{ title: string; value: string }>;
  item: CatalogItem;
}) {
  const base = String(args.template || '').trim() || 'Olá! Tenho interesse em {{item_nome}} ({{item_valor}}).';
  const selecoes = args.selections.map((s) => `${s.title}: ${s.value}`).filter(Boolean).join(' | ');
  const withItem = base
    .split('{{item_nome}}').join(args.item.nome)
    .split('{{item_valor}}').join(formatBRL(args.item.valor))
    .split('{{selecoes}}').join(selecoes);
  if (!selecoes) return withItem;
  return `${withItem}\n\nSeleção: ${selecoes}`;
}

export default function PublicCatalogPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [flow, setFlow] = useState<FlowDocV2 | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [attrs, setAttrs] = useState<Record<string, Record<string, string>>>({});
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [stepSearch, setStepSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<Array<{ key: string; title: string; value: string }>>([]);
  const [resultsLimit, setResultsLimit] = useState(12);

  useEffect(() => {
    const load = async () => {
      const s = String(slug || '').trim();
      if (!s) return;
      setLoading(true);
      try {
        const { data: sRow } = await supabase
          .from('catalog_public_settings')
          .select('empresa_id,slug,enabled,avatar_url,primary_color,background_color,card_color,headline,subheadline,cover_image_url,whatsapp_phone,cta_template')
          .ilike('slug', s)
          .maybeSingle();
        const settingsRow = (sRow as unknown as PublicSettings | null) ?? null;
        if (!settingsRow?.empresa_id || !settingsRow.enabled) {
          setSettings(null);
          setFlow(null);
          return;
        }
        setSettings(settingsRow);

        const [{ data: fRow }, { data: listItems }, { data: listAttrs }] = await Promise.all([
          supabase.from('catalog_public_flow').select('flow').eq('empresa_id', settingsRow.empresa_id).maybeSingle(),
          supabase
            .from('catalog_items')
            .select('id,nome,descricao,valor,image_url')
            .eq('empresa_id', settingsRow.empresa_id)
            .eq('ativo', true)
            .order('nome', { ascending: true }),
          supabase
            .from('catalog_item_attributes')
            .select('catalog_item_id,key,value')
            .eq('empresa_id', settingsRow.empresa_id)
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

        setFlow(parseFlowDoc(fRow?.flow as unknown));

        setStepIndex(0);
        setSelections([]);
        setSelectedItem(null);
        setStepSearch('');
        setResultSearch('');
        setResultsLimit(12);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  const steps = flow?.steps || [];
  const current = steps[stepIndex] || null;

  const eligibleItems = useMemo(() => {
    const sels = selections;
    if (sels.length === 0) return items;
    return items.filter((it) => {
      const kv = attrs[it.id] || {};
      return sels.every((s) => String(kv[s.key] || '') === s.value);
    });
  }, [attrs, items, selections]);

  const valueOptions = useMemo(() => {
    const key = String(current?.attribute_key || '').trim();
    if (!key) return [];
    const set = new Set<string>();
    eligibleItems.forEach((it) => {
      const v = String(attrs[it.id]?.[key] || '').trim();
      if (v) set.add(v);
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    const q = String(stepSearch || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) => v.toLowerCase().includes(q));
  }, [attrs, current?.attribute_key, eligibleItems, stepSearch]);

  const visibleItems = useMemo(() => {
    const q = String(resultSearch || '').trim().toLowerCase();
    const list = q
      ? eligibleItems.filter((it) => String(it.nome || '').toLowerCase().includes(q))
      : eligibleItems;
    return list.slice(0, resultsLimit);
  }, [eligibleItems, resultSearch, resultsLimit]);

  const themeStyle = useMemo(() => {
    const s = settings;
    if (!s) return undefined;
    const style: React.CSSProperties & Record<string, string> = {
      background: s.background_color,
      minHeight: '100dvh',
      '--catalog-primary': s.primary_color,
      '--catalog-card': s.card_color,
    };
    return style;
  }, [settings]);

  const titleTrail = useMemo(() => selections.map((s) => `${s.title}: ${s.value}`), [selections]);

  const back = () => {
    setStepSearch('');
    setResultSearch('');
    if (selectedItem) {
      setSelectedItem(null);
      setStepIndex(steps.length);
      return;
    }
    setSelections((prev) => prev.slice(0, -1));
    setStepIndex((prev) => Math.max(0, prev - 1));
    setResultsLimit(12);
  };

  const pickValue = (value: string) => {
    const step = current;
    if (!step) return;
    const key = slugify(step.attribute_key);
    const title = String(step.title || '').trim() || key;
    const v = String(value || '').trim();
    if (!key || !v) return;
    setStepSearch('');
    setResultSearch('');
    setSelections((prev) => [...prev, { key, title, value: v }]);
    if (stepIndex + 1 < steps.length) {
      setStepIndex((i) => i + 1);
    } else {
      setStepIndex(steps.length);
    }
    setResultsLimit(12);
  };

  const resetAll = () => {
    setSelectedItem(null);
    setSelections([]);
    setStepIndex(0);
    setStepSearch('');
    setResultSearch('');
    setResultsLimit(12);
  };

  const openWhatsApp = () => {
    if (!settings || !selectedItem) return;
    const phone = normalizePhone(settings.whatsapp_phone || '');
    if (!phone) return;
    const text = buildWhatsappText({ template: settings.cta_template, selections, item: selectedItem });
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div style={{ background: '#0b0f14', minHeight: '100dvh' }} className="flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!settings || !flow?.steps?.length) {
    return (
      <div style={{ background: '#0b0f14', minHeight: '100dvh' }} className="flex items-center justify-center text-muted-foreground px-6">
        Catálogo indisponível.
      </div>
    );
  }

  const headline = String(settings.headline || '').trim() || 'Catálogo';
  const subheadline = String(settings.subheadline || '').trim() || 'Escolha e envie seu pedido no WhatsApp';
  const logoUrl = String(settings.avatar_url || '').trim();
  const coverUrl = String(settings.cover_image_url || '').trim();
  const whatsappPhone = normalizePhone(settings.whatsapp_phone || '');
  const pageStyle: React.CSSProperties & Record<string, string> = {
    '--catalog-primary': String(settings.primary_color || '#22c55e'),
    '--catalog-bg': String(settings.background_color || '#0b0f14'),
    '--catalog-card': String(settings.card_color || '#0f1720'),
  };

  return (
    <div className="min-h-[100dvh]" style={pageStyle}>
      <div
        className="relative"
        style={{
          background: `radial-gradient(900px 500px at 20% 0%, color-mix(in srgb, var(--catalog-primary) 35%, transparent), transparent 55%),
            radial-gradient(700px 380px at 100% 20%, color-mix(in srgb, var(--catalog-primary) 22%, transparent), transparent 55%),
            linear-gradient(135deg, var(--catalog-bg) 0%, color-mix(in srgb, var(--catalog-bg) 70%, #000000) 60%, #000000 100%)`,
        }}
      >
        {coverUrl ? (
          <div className="absolute inset-0">
            <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-55" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/80" />
          </div>
        ) : null}

        <div className="relative max-w-md mx-auto px-4 pt-10 pb-16">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.18em] text-white/70">Catálogo</div>
              <div className="text-2xl font-black truncate mt-1 text-white">{headline}</div>
              <div className="text-white/75 text-sm truncate mt-1">{subheadline}</div>
            </div>
            {logoUrl ? (
              <div
                className="h-14 w-14 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center shrink-0"
                style={{ boxShadow: '0 0 22px color-mix(in srgb, var(--catalog-primary) 30%, transparent)' }}
              >
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain bg-white" />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {selections.length > 0 || selectedItem ? (
              <Button
                variant="outline"
                className="rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-white"
                onClick={back}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            ) : null}
            {selections.length > 0 ? (
              <Button
                variant="outline"
                className="rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-white"
                onClick={resetAll}
              >
                Recomeçar
              </Button>
            ) : null}
            {whatsappPhone ? (
              <Button
                className="rounded-full font-bold"
                style={{ background: '#25D366', color: '#0b0f14' }}
                onClick={() => window.open(`https://wa.me/${whatsappPhone}`, '_blank')}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-2 pb-10 relative">
        <Card
          className="rounded-3xl border backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
          style={{
            borderColor: 'color-mix(in srgb, var(--catalog-primary) 22%, rgba(255,255,255,0.18))',
            background: 'color-mix(in srgb, var(--catalog-card) 55%, rgba(255,255,255,0.06))',
          }}
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-white text-2xl font-extrabold tracking-tight">
              {selectedItem
                ? selectedItem.nome
                : stepIndex >= steps.length
                  ? `Resultados (${eligibleItems.length})`
                  : current?.title || 'Escolha uma opção'}
            </CardTitle>
            <CardDescription className="text-white/70">
              {selectedItem
                ? 'Confira os detalhes e envie no WhatsApp.'
                : stepIndex >= steps.length
                  ? 'Escolha um item para ver detalhes.'
                  : `Passo ${Math.min(stepIndex + 1, steps.length)} de ${steps.length}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedItem ? (
              <>
                {selections.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selections.map((s, idx) => (
                      <div
                        key={`${s.key}-${idx}`}
                        className="rounded-full border px-3 py-1 text-xs text-white/85"
                        style={{
                          borderColor: 'color-mix(in srgb, var(--catalog-primary) 22%, rgba(255,255,255,0.18))',
                          background: 'rgba(255,255,255,0.06)',
                        }}
                      >
                        {s.title}: {s.value}
                      </div>
                    ))}
                  </div>
                ) : null}

                {stepIndex < steps.length ? (
                  <Input
                    value={stepSearch}
                    onChange={(e) => setStepSearch(e.target.value)}
                    placeholder={`Buscar em ${current?.title || 'opções'}…`}
                    className="rounded-2xl h-11 bg-black/20 text-white placeholder:text-white/50"
                    style={{ borderColor: 'rgba(255,255,255,0.18)' }}
                  />
                ) : (
                  <Input
                    value={resultSearch}
                    onChange={(e) => setResultSearch(e.target.value)}
                    placeholder="Buscar item pelo nome…"
                    className="rounded-2xl h-11 bg-black/20 text-white placeholder:text-white/50"
                    style={{ borderColor: 'rgba(255,255,255,0.18)' }}
                  />
                )}
                <div className="grid gap-2">
                  {stepIndex < steps.length ? (
                    <>
                      <div className={valueOptions.length <= 12 ? 'grid grid-cols-2 gap-2' : 'grid gap-2'}>
                        {valueOptions.map((v) => (
                          <Button
                            key={v}
                            onClick={() => pickValue(v)}
                            variant="outline"
                            className="w-full rounded-2xl justify-between text-white h-auto py-3 overflow-hidden"
                            style={{
                              borderColor: 'color-mix(in srgb, var(--catalog-primary) 18%, rgba(255,255,255,0.18))',
                              background: 'rgba(255,255,255,0.06)',
                            }}
                          >
                            <span className="truncate">{v}</span>
                            <span className="text-xs opacity-60">›</span>
                          </Button>
                        ))}
                      </div>
                      {valueOptions.length === 0 ? <div className="text-sm text-white/60">Nenhum resultado.</div> : null}
                    </>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        {visibleItems.map((it) => (
                          <Button
                            key={it.id}
                            onClick={() => setSelectedItem(it)}
                            variant="outline"
                            className="w-full rounded-2xl justify-between h-auto py-3 text-white overflow-hidden"
                            style={{
                              borderColor: 'rgba(255,255,255,0.18)',
                              background: 'rgba(255,255,255,0.06)',
                            }}
                          >
                            <span className="flex-1 min-w-0 text-left">
                              <span className="block truncate font-semibold">{it.nome}</span>
                              <span className="block text-xs text-white/60 truncate">{it.descricao || ''}</span>
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-xs text-white/80 ml-3">{formatBRL(it.valor)}</span>
                          </Button>
                        ))}
                      </div>
                      {eligibleItems.length === 0 ? <div className="text-sm text-white/60">Nenhum item encontrado.</div> : null}
                      {eligibleItems.length > visibleItems.length ? (
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => setResultsLimit((n) => n + 12)}
                        >
                          Mostrar mais
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                {selectedItem.image_url ? (
                  <div className="rounded-2xl overflow-hidden border border-white/15">
                    <img src={selectedItem.image_url} alt={selectedItem.nome} className="w-full h-44 object-cover" />
                  </div>
                ) : null}
                <div
                  className="rounded-2xl border p-4 space-y-2"
                  style={{
                    borderColor: 'rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="text-2xl font-black"
                    style={{ color: 'var(--catalog-primary)' }}
                  >
                    {formatBRL(selectedItem.valor)}
                  </div>
                  {selectedItem.descricao ? <div className="text-sm text-white/85">{selectedItem.descricao}</div> : null}
                  {titleTrail.length > 0 ? <div className="text-xs text-white/60">Seleção: {titleTrail.join(' > ')}</div> : null}
                </div>
                <Button
                  onClick={openWhatsApp}
                  className="w-full rounded-full font-bold h-12 text-base"
                  style={{ background: '#25D366', color: '#0b0f14' }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Enviar no WhatsApp
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
