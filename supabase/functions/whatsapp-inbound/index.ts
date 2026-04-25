/// <reference path="../types.d.ts" />
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeNumber(raw: string) {
  return raw.split("@")[0].replace(/\D/g, "");
}

type MenuItem = {
  code?: string;
  label?: string;
  type?: "submenu" | "catalog" | "ia" | "human";
  term?: string;
  children?: MenuItem[];
};

function applyGreetingTemplate(greeting: string, pushName: string) {
  const name = String(pushName || "Cliente").trim() || "Cliente";
  return String(greeting || "")
    .replace(/\{\{\s*nome\s*\}\}/gi, name)
    .replace(/\{\s*nome\s*\}/gi, name)
    .replace(/\[nome\]/gi, name)
    .replace(/\*?nome do cliente\*?/gi, name);
}

function normalizeDisplayName(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function deriveContatoNome(args: {
  rjid: string;
  fromMe: boolean;
  pushName?: string | null;
  bodyNomeContato?: string | null;
}) {
  const phone = digitsOnly(args.rjid) || "Sem nome";
  if (args.fromMe) return phone;

  const push = normalizeDisplayName(args.pushName || "");
  if (push && push.toLowerCase() !== "contato" && push.toLowerCase() !== "cliente") return push;

  const bodyNome = normalizeDisplayName(args.bodyNomeContato || "");
  if (bodyNome && bodyNome.toLowerCase() !== "contato" && bodyNome.toLowerCase() !== "cliente") return bodyNome;

  return phone;
}

function shouldUpdateContatoNome(args: {
  currentNome: string | null | undefined;
  newNome: string;
  rjid: string;
  bodyNomeContato?: string | null;
}) {
  const cur = normalizeDisplayName(args.currentNome || "");
  const next = normalizeDisplayName(args.newNome || "");
  if (!next) return false;
  if (cur === next) return false;

  const phone = digitsOnly(args.rjid);
  const bodyNome = normalizeDisplayName(args.bodyNomeContato || "");

  const curLower = cur.toLowerCase();
  const bodyLower = bodyNome.toLowerCase();

  const looksAuto =
    !cur ||
    curLower === "contato" ||
    curLower === "cliente" ||
    (phone && cur === phone) ||
    (bodyLower && curLower === bodyLower);

  return looksAuto;
}

function parseDataUrlBase64(input: string) {
  const src = String(input || "");
  if (!src.startsWith("data:")) return { mimetype: null as string | null, base64: src };
  const comma = src.indexOf(",");
  if (comma === -1) return { mimetype: null as string | null, base64: src };
  const meta = src.slice(5, comma);
  const mimetype = meta.split(";")[0] || null;
  const base64 = src.slice(comma + 1);
  return { mimetype, base64 };
}

function decodeBase64ToBytes(base64: string) {
  const cleaned = String(base64 || "").trim();
  if (!cleaned) return null;
  try {
    const bin = atob(cleaned);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function extensionFromMime(mimetype: string | null | undefined) {
  const mt = String(mimetype || "").toLowerCase();
  if (!mt) return "bin";
  if (mt.includes("image/webp")) return "webp";
  if (mt.includes("audio/ogg")) return "ogg";
  if (mt.includes("audio/opus")) return "opus";
  if (mt.includes("audio/mpeg") || mt.includes("audio/mp3")) return "mp3";
  if (mt.includes("audio/mp4") || mt.includes("audio/m4a")) return "m4a";
  if (mt.includes("audio/wav")) return "wav";
  if (mt.includes("audio/webm")) return "webm";
  if (mt.includes("audio/aac")) return "aac";
  return "bin";
}

async function fetchBytes(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers }).catch(() => null);
  if (!res || !res.ok) return null;
  const ab = await res.arrayBuffer().catch(() => null);
  if (!ab) return null;
  return new Uint8Array(ab);
}

async function sendText(conexao: { api_url?: string | null; nome_api?: string | null; apikey?: string | null; globalkey?: string | null }, number: string, text: string) {
  const apiUrl = (conexao.api_url || "").toString().replace(/\/+$/, "");
  const instance = (conexao.nome_api || "").toString();
  const apikey = (conexao.apikey || conexao.globalkey || "").toString();
  if (!apiUrl || !instance || !apikey) return { ok: false, body: "" };
  const url = `${apiUrl}/message/sendText/${encodeURIComponent(instance)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apikey },
    body: JSON.stringify({ number, text })
  }).catch(() => null);
  if (!res) return { ok: false, body: "" };
  const body = await res.text().catch(() => "");
  return { ok: res.ok, body };
}

async function sendMedia(
  conexao: { api_url?: string | null; nome_api?: string | null; apikey?: string | null; globalkey?: string | null },
  number: string,
  params: { mediatype: "image" | "video" | "document" | "audio" | "sticker"; media: string; caption?: string; mimetype?: string; fileName?: string }
) {
  const apiUrl = (conexao.api_url || "").toString().replace(/\/+$/, "");
  const instance = (conexao.nome_api || "").toString();
  const apikey = (conexao.apikey || conexao.globalkey || "").toString();
  if (!apiUrl || !instance || !apikey) return { ok: false, body: "" };
  const url = `${apiUrl}/message/sendMedia/${encodeURIComponent(instance)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apikey },
    body: JSON.stringify({
      number,
      mediatype: params.mediatype,
      media: params.media,
      caption: params.caption || "",
      mimetype: params.mimetype || "application/octet-stream",
      fileName: params.fileName || "file"
    })
  }).catch(() => null);
  if (!res) return { ok: false, body: "" };
  const body = await res.text().catch(() => "");
  return { ok: res.ok, body };
}

function clampInt(value: number, min: number, max: number) {
  const v = Math.floor(Number.isFinite(value) ? value : min);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function computeResponseDelayMs(args: { text?: string; kind: "text" | "media"; minMs?: number; maxMs?: number }) {
  const minEnv = clampInt(Number(Deno.env.get("RESPONSE_DELAY_MIN_MS") || "900"), 0, 30_000);
  const maxEnv = clampInt(Number(Deno.env.get("RESPONSE_DELAY_MAX_MS") || "2800"), 0, 30_000);
  const minMs = clampInt(Number(args.minMs ?? minEnv), 0, 30_000);
  const maxMs = clampInt(Number(args.maxMs ?? maxEnv), 0, 30_000);
  const min = Math.min(minMs, maxMs);
  const max = Math.max(minMs, maxMs);
  if (max === 0) return 0;

  const txt = String(args.text || "");
  const len = txt.trim().length;
  const base = min + (max - min) * Math.min(1, len / 320);
  const jitter = (Math.random() - 0.5) * 0.35 * (max - min);
  const extra = args.kind === "media" ? 450 : 0;
  return clampInt(base + jitter + extra, 0, 30_000);
}

async function sleep(ms: number) {
  const t = clampInt(ms, 0, 30_000);
  if (!t) return;
  await new Promise((r) => setTimeout(r, t));
}

async function sendTextDelayed(
  conexao: { api_url?: string | null; nome_api?: string | null; apikey?: string | null; globalkey?: string | null },
  number: string,
  text: string,
  delay?: { minMs?: number; maxMs?: number }
) {
  await sleep(computeResponseDelayMs({ kind: "text", text, minMs: delay?.minMs, maxMs: delay?.maxMs }));
  return await sendText(conexao, number, text);
}

async function sendMediaDelayed(
  conexao: { api_url?: string | null; nome_api?: string | null; apikey?: string | null; globalkey?: string | null },
  number: string,
  params: { mediatype: "image" | "video" | "document" | "audio" | "sticker"; media: string; caption?: string; mimetype?: string; fileName?: string },
  delay?: { minMs?: number; maxMs?: number }
) {
  await sleep(computeResponseDelayMs({ kind: "media", text: params.caption || "", minMs: delay?.minMs, maxMs: delay?.maxMs }));
  return await sendMedia(conexao, number, params);
}

function extractExternalIdFromEvolutionResponse(bodyText: string) {
  try {
    const parsed = JSON.parse(bodyText || "{}");
    return parsed?.key?.id || parsed?.message?.key?.id || parsed?.message?.keyId || null;
  } catch {
    return null;
  }
}

function guessImageMimeFromUrl(url: string) {
  const raw = String(url || "");
  const cleaned = raw.split("#")[0].split("?")[0].toLowerCase();
  const m = cleaned.match(/\.([a-z0-9]+)$/);
  const ext = m?.[1] || "";
  if (ext === "png") return { mimetype: "image/png", ext: "png" };
  if (ext === "webp") return { mimetype: "image/webp", ext: "webp" };
  if (ext === "gif") return { mimetype: "image/gif", ext: "gif" };
  if (ext === "jpg" || ext === "jpeg") return { mimetype: "image/jpeg", ext: "jpg" };
  return { mimetype: "image/jpeg", ext: "jpg" };
}

function buildMediaProxyUrl(imageUrl: string) {
  const secret = Deno.env.get("MEDIA_PROXY_SECRET") || "";
  if (!secret) return null;
  const raw = String(imageUrl || "");
  if (!raw) return null;
  if (!raw.startsWith(`${supabaseUrl}/storage/v1/object/`)) return null;
  const m = raw.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const bucket = m[1];
  const path = m[2];
  if (bucket !== "product-images") return null;
  return { bucket, path };
}

async function openAiChat(args: { apiKey: string; prompt: string; messages: Array<{ role: "system" | "user" | "assistant"; content: string }> }) {
  const apiKey = String(args.apiKey || "").trim();
  const prompt = String(args.prompt || "").trim();
  if (!apiKey || !prompt) return null;
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  const systemRules = [
    prompt,
    "",
    "Regras importantes:",
    "- Responda normalmente seguindo o prompt da empresa.",
    "- Só acione catálogo quando o cliente pedir produtos/serviços/catálogo/preços/valores/datas/pacotes/passeios ou mandar apenas o nome do destino/serviço.",
    "- Quando precisar acionar catálogo, responda EXCLUSIVAMENTE com: CATALOGO_CARDS[termo].",
    "- Exemplo: CATALOGO_CARDS[Piratuba] ou CATALOGO_CARDS[all].",
    "- Não use CATALOGO_CARDS em saudações (oi/olá/bom dia/boa tarde/boa noite)."
  ].join("\n");

  const payload = {
    model,
    temperature: 0.4,
    messages: [{ role: "system", content: systemRules }, ...args.messages.filter((m) => m.role !== "system")],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  }).catch(() => null);
  if (!res) return null;
  const json = await res.json().catch(() => null);
  const text = String(json?.choices?.[0]?.message?.content || "").trim();
  return text || null;
}

function normalizeChoice(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (raw === "*") return "*";
  if (/^\d+$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits || null;
}

function stripLeadingZeros(s: string) {
  const t = String(s || "");
  const out = t.replace(/^0+/, "");
  return out ? out : "0";
}

function sameCode(a: string, b: string) {
  return stripLeadingZeros(a) === stripLeadingZeros(b);
}

function getNodeByPath(tree: MenuItem[], path: string[]) {
  let current: { label?: string; children?: MenuItem[] } = { label: "", children: tree };
  for (const p of path) {
    const children = Array.isArray(current.children) ? current.children : [];
    const next = children.find((c) => c?.code && sameCode(String(c.code), String(p)));
    if (!next) return { label: current.label, children: children };
    current = { label: next.label, children: next.children };
  }
  return { label: current.label, children: Array.isArray(current.children) ? current.children : [] };
}

function renderMenuMessage(greeting: string, nodeLabel: string | undefined, children: MenuItem[], path: string[]) {
  const lines: string[] = [];
  const g = String(greeting || "").trim();
  if (g && path.length === 0) {
    lines.push(g);
    lines.push("");
  }
  const title = String(nodeLabel || "").trim();
  if (title && path.length > 0) {
    lines.push(title);
    lines.push("");
  }
  lines.push("Digite a opção desejada:");
  lines.push("");
  for (const c of children) {
    const code = String(c?.code || "").trim();
    const label = String(c?.label || "").trim();
    if (!code || !label) continue;
    lines.push(`*${code}* ${label}`);
  }
  if (path.length > 0) {
    lines.push("");
    lines.push("*0* Voltar");
  }
  lines.push("");
  lines.push("Digite MENU para voltar ao início.");
  return lines.join("\n").trim();
}

function toBRL(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${n.toFixed(2).replace(".", ",")}`;
  }
}

function buildCatalogCaption(item: any) {
  const tipo = String(item?.tipo || "").trim();
  const emoji = tipo === "Serviço" ? "🛠️" : "🛒";
  const nome = String(item?.nome || "").trim();
  const descricao = String(item?.descricao || "").trim();
  const preco = toBRL(item?.valor);
  const parts: string[] = [];
  if (nome) parts.push(`${emoji} ${nome}`.trim());
  if (descricao) parts.push("", descricao);
  if (preco) parts.push("", `💰 ${preco}`);
  return parts.join("\n").trim();
}

function pickCatalogImageUrl(item: any) {
  return (
    (item?.image_url as string | undefined) ||
    (item?.imagem_url as string | undefined) ||
    (item?.foto_url as string | undefined) ||
    (item?.image_Url as string | undefined) ||
    ""
  );
}

async function sendCatalogCards(args: {
  empresaId: string;
  contatoId: string;
  conexaoId: string | null;
  conexaoInfo: any;
  rjid: string;
  term: string;
  suppressNotFoundMessage?: boolean;
}) {
  const termRaw = String(args.term || "").trim() || "all";
  const isAll = termRaw.toLowerCase() === "all";
  const cleaned = termRaw
    .replace(/\/sc\b/gi, "")
    .replace(/\/\w{2,}\b/gi, "")
    .replace(/[–—-].*$/, "")
    .trim();
  const patterns = isAll ? [] : Array.from(new Set([termRaw, cleaned].filter(Boolean))).map((t) => `%${t}%`);

  const baseQ = supabase
    .from("catalog_items")
    .select("id, tipo, nome, descricao, valor, image_url")
    .eq("empresa_id", args.empresaId)
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(isAll ? 10 : 3);

  const { data: itemsEmpresa } = isAll
    ? await baseQ
    : await baseQ.or(patterns.map((p) => `nome.ilike.${p},descricao.ilike.${p}`).join(","));

  let rows = Array.isArray(itemsEmpresa) ? itemsEmpresa : [];
  if (rows.length === 0) {
    if (!isAll) {
      const { data: fallbackEmpresa } = await baseQ;
      rows = Array.isArray(fallbackEmpresa) ? fallbackEmpresa : [];
    }
    const baseNull = supabase
      .from("catalog_items")
      .select("id, tipo, nome, descricao, valor, image_url")
      .is("empresa_id", null)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(isAll ? 10 : 3);
    const { data: itemsNull } = isAll
      ? await baseNull
      : await baseNull.or(patterns.map((p) => `nome.ilike.${p},descricao.ilike.${p}`).join(","));
    rows = Array.isArray(itemsNull) ? itemsNull : [];
    if (rows.length === 0 && !isAll) {
      const { data: fallbackNull } = await baseNull;
      rows = Array.isArray(fallbackNull) ? fallbackNull : [];
    }
  }
  const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
  const number = normalizeNumber(args.rjid);
  if (!conexao || !number) return { ok: false, sent: 0 };

  if (rows.length === 0) {
    if (args.suppressNotFoundMessage) {
      return { ok: false, sent: 0, notFound: true };
    }
    const text = "Não encontrei opções no catálogo para isso. Você pode me dizer o destino ou o serviço que procura?";
    const sent = await sendTextDelayed(conexao, number, text);
    await supabase.from("mensagens").insert({
      empresa_id: args.empresaId,
      contato_id: args.contatoId,
      conexao_id: args.conexaoId,
      direcao: "out",
      conteudo: text,
      status: sent.ok ? "enviado" : "erro",
      external_id: sent.ok ? extractExternalIdFromEvolutionResponse(sent.body) : null,
      tipo: "text"
    } as any);
    return { ok: sent.ok, sent: 0, notFound: true };
  }

  let sentCount = 0;
  for (const it of rows) {
    try {
      const caption = buildCatalogCaption(it);
      const imageUrl = pickCatalogImageUrl(it);
      if (imageUrl) {
        const guessed = guessImageMimeFromUrl(imageUrl);
        const fileName = `${String(it?.nome || "item").slice(0, 32)}.${guessed.ext}`;
        let media = imageUrl;
        const proxy = buildMediaProxyUrl(imageUrl);
        if (proxy) {
          const ts = Date.now().toString();
          const sig = await hmacSha256Hex(Deno.env.get("MEDIA_PROXY_SECRET") || "", `${ts}.${proxy.bucket}.${proxy.path}`);
          media = `${supabaseUrl}/functions/v1/whatsapp-media?bucket=${encodeURIComponent(proxy.bucket)}&path=${encodeURIComponent(proxy.path)}&ts=${encodeURIComponent(ts)}&sig=${encodeURIComponent(sig)}`;
        }
        const sent = await sendMediaDelayed(conexao, number, {
          mediatype: "image",
          media,
          caption,
          mimetype: guessed.mimetype,
          fileName,
        });
        const extId = sent.ok ? extractExternalIdFromEvolutionResponse(sent.body) : null;
        const ok = Boolean(sent.ok && extId);
        await supabase.from("mensagens").insert({
          empresa_id: args.empresaId,
          contato_id: args.contatoId,
          conexao_id: args.conexaoId,
          direcao: "out",
          conteudo: caption || "",
          status: ok ? "enviado" : "erro",
          external_id: extId,
          tipo: "image",
          media_url: imageUrl,
          mimetype: guessed.mimetype,
          file_name: fileName
        } as any);
        if (ok) {
          sentCount += 1;
        } else {
          const sentText = await sendTextDelayed(conexao, number, caption);
          await supabase.from("mensagens").insert({
            empresa_id: args.empresaId,
            contato_id: args.contatoId,
            conexao_id: args.conexaoId,
            direcao: "out",
            conteudo: caption,
            status: sentText.ok ? "enviado" : "erro",
            external_id: sentText.ok ? extractExternalIdFromEvolutionResponse(sentText.body) : null,
            tipo: "text"
          } as any);
          if (sentText.ok) sentCount += 1;
        }
      } else {
        const sent = await sendTextDelayed(conexao, number, caption);
        await supabase.from("mensagens").insert({
          empresa_id: args.empresaId,
          contato_id: args.contatoId,
          conexao_id: args.conexaoId,
          direcao: "out",
          conteudo: caption,
          status: sent.ok ? "enviado" : "erro",
          external_id: sent.ok ? extractExternalIdFromEvolutionResponse(sent.body) : null,
          tipo: "text"
        } as any);
        if (sent.ok) sentCount += 1;
      }
    } catch {
      continue;
    }
  }
  return { ok: true, sent: sentCount };
}

function buildCatalogNotFoundFallback(term: string) {
  const raw = String(term || "").trim();
  const t = raw.toLowerCase().trim();
  const isAll = !t || t === "all";
  const isFlight = /(passagem|passagens|a[eé]reo|aerea|avi[aã]o|voo|voos)/i.test(t);
  const isCar = /(carro|aluguel|loca[cç][aã]o|rent)/i.test(t);
  const isHotel = /(hotel|hospedagem|pousada|resort)/i.test(t);
  const isInsurance = /(seguro\s*viagem|seguro)/i.test(t);

  if (isFlight) {
    return "Consigo te ajudar com passagens. Qual é a cidade de origem e o destino?";
  }
  if (isCar) {
    return "Consigo te ajudar com aluguel de carro. Em qual cidade você quer retirar o carro e para quando seria?";
  }
  if (isHotel) {
    return "Consigo te ajudar com hospedagem. Qual cidade e para quais datas?";
  }
  if (isInsurance) {
    return "Consigo te ajudar com seguro viagem. Qual destino e para quais datas?";
  }
  if (!isAll) {
    return `Não encontrei ${raw} no nosso catálogo agora, mas consigo te ajudar por aqui. Para quando seria?`;
  }
  return "Não encontrei esse item pronto no nosso catálogo, mas consigo te ajudar por aqui. Você procura qual destino/serviço e para quando seria?";
}

async function sendViaN8nSend(params: { empresaId: string; remoteJid: string; number: string; text: string; tipo?: string; mediaUrl?: string; mimetype?: string; fileName?: string }) {
  const url = `${supabaseUrl}/functions/v1/n8n-send`;
  const body = {
    empresa_id: params.empresaId,
    remoteJid: params.remoteJid,
    number: params.number,
    text: params.text,
    ...(params.tipo ? { tipo: params.tipo } : {}),
    ...(params.mediaUrl ? { media_url: params.mediaUrl } : {}),
    ...(params.mimetype ? { mimetype: params.mimetype } : {}),
    ...(params.fileName ? { file_name: params.fileName } : {}),
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return res?.ok ?? false;
}

async function handleMenuFlow(args: {
  empresaId: string;
  contatoId: string;
  conexaoId: string | null;
  conexaoInfo: any;
  rjid: string;
  pushName: string;
  content: string;
  settings: any;
}) {
  const enabled = Boolean(args.settings?.menu_enabled);
  if (!enabled) return { handled: false };

  const rawTree = args.settings?.menu_tree;
  const tree = Array.isArray(rawTree) ? (rawTree as MenuItem[]) : [];
  if (tree.length === 0) return { handled: false };

  const greeting = String(args.settings?.menu_greeting || "").trim();
  const greetingRendered = applyGreetingTemplate(greeting, args.pushName);
  const timeoutMinutes = Number.isFinite(Number(args.settings?.menu_timeout_minutes)) ? Number(args.settings?.menu_timeout_minutes) : 30;
  const nowIso = new Date().toISOString();

  const input = String(args.content || "").trim();
  const lowered = input.toLowerCase();

  const { data: session } = await supabase
    .from("menu_sessions")
    .select("id, path, updated_at")
    .eq("empresa_id", args.empresaId)
    .eq("contato_id", args.contatoId)
    .maybeSingle();

  const lastMs = session?.updated_at ? Date.parse(String(session.updated_at)) : 0;
  const isExpired = !lastMs || Number.isNaN(lastMs) ? false : Date.now() - lastMs > timeoutMinutes * 60_000;

  const resetToRoot = async () => {
    if (session?.id) {
      await supabase.from("menu_sessions").update({ path: [], updated_at: nowIso } as any).eq("id", session.id);
    } else {
      await supabase.from("menu_sessions").insert({ empresa_id: args.empresaId, contato_id: args.contatoId, path: [], updated_at: nowIso } as any);
    }
    const node = getNodeByPath(tree, []);
    const text = renderMenuMessage(greetingRendered, node.label, node.children || [], []);
    const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
    const number = normalizeNumber(args.rjid);
    if (conexao && number && text) {
      const sent = await sendTextDelayed(conexao, number, text);
      await supabase.from("mensagens").insert({
        empresa_id: args.empresaId,
        contato_id: args.contatoId,
        conexao_id: args.conexaoId,
        direcao: "out",
        conteudo: text,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
    }
    return { handled: true };
  };

  if (!session?.id) {
    return await resetToRoot();
  }

  if (isExpired || lowered === "menu") {
    return await resetToRoot();
  }

  const path = Array.isArray(session.path) ? (session.path as string[]) : [];

  if (path?.[0] === "__post_catalog") {
    const choice = normalizeChoice(input);
    const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
    const number = normalizeNumber(args.rjid);

    if (choice === "2") {
      return await resetToRoot();
    }

    if (choice === "3") {
      await supabase.from("menu_sessions").delete().eq("id", session.id);
      await supabase
        .from("contatos")
        .update({
          atendimento_mode: "humano",
          conversa_status: "resolvida",
          conversa_resolvida_em: nowIso,
          updated_at: nowIso,
        } as any)
        .eq("id", args.contatoId);
      const text = "Atendimento encerrado. Se precisar novamente, digite MENU.";
      if (conexao && number) {
        const sent = await sendTextDelayed(conexao, number, text);
        await supabase.from("mensagens").insert({
          empresa_id: args.empresaId,
          contato_id: args.contatoId,
          conexao_id: args.conexaoId,
          direcao: "out",
          conteudo: text,
          status: sent.ok ? "enviado" : "erro",
          external_id: null
        } as any);
      }
      return { handled: true };
    }

    if (choice === "1") {
      await supabase.from("menu_sessions").delete().eq("id", session.id);
      const text = "Perfeito! Me diga o que você procura e eu te ajudo agora.";
      if (conexao && number) {
        const sent = await sendTextDelayed(conexao, number, text);
        await supabase.from("mensagens").insert({
          empresa_id: args.empresaId,
          contato_id: args.contatoId,
          conexao_id: args.conexaoId,
          direcao: "out",
          conteudo: text,
          status: sent.ok ? "enviado" : "erro",
          external_id: null
        } as any);
      }
      return { handled: true };
    }

    const text = "Escolha uma opção:\n\n*1* Continuar\n*2* Voltar ao menu\n*3* Encerrar atendimento";
    if (conexao && number) {
      const sent = await sendTextDelayed(conexao, number, text);
      await supabase.from("mensagens").insert({
        empresa_id: args.empresaId,
        contato_id: args.contatoId,
        conexao_id: args.conexaoId,
        direcao: "out",
        conteudo: text,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
    }
    await supabase.from("menu_sessions").update({ updated_at: nowIso } as any).eq("id", session.id);
    return { handled: true };
  }

  const choice = normalizeChoice(input);
  if (!choice) {
    const node = getNodeByPath(tree, path);
    const text = renderMenuMessage(greetingRendered, node.label, node.children || [], path);
    const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
    const number = normalizeNumber(args.rjid);
    if (conexao && number && text) {
      const sent = await sendTextDelayed(conexao, number, text);
      await supabase.from("mensagens").insert({
        empresa_id: args.empresaId,
        contato_id: args.contatoId,
        conexao_id: args.conexaoId,
        direcao: "out",
        conteudo: text,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
    }
    await supabase.from("menu_sessions").update({ updated_at: nowIso } as any).eq("id", session.id);
    return { handled: true };
  }

  if (choice === "0") {
    const nextPath = path.slice(0, Math.max(0, path.length - 1));
    await supabase.from("menu_sessions").update({ path: nextPath, updated_at: nowIso } as any).eq("id", session.id);
    const node = getNodeByPath(tree, nextPath);
    const text = renderMenuMessage(greetingRendered, node.label, node.children || [], nextPath);
    const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
    const number = normalizeNumber(args.rjid);
    if (conexao && number && text) {
      const sent = await sendTextDelayed(conexao, number, text);
      await supabase.from("mensagens").insert({
        empresa_id: args.empresaId,
        contato_id: args.contatoId,
        conexao_id: args.conexaoId,
        direcao: "out",
        conteudo: text,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
    }
    return { handled: true };
  }

  const node = getNodeByPath(tree, path);
  const children = node.children || [];
  const picked = children.find((c) => c?.code && sameCode(String(c.code), String(choice)));
  if (!picked) {
    const text = renderMenuMessage(greetingRendered, node.label, children, path);
    const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
    const number = normalizeNumber(args.rjid);
    if (conexao && number && text) {
      const sent = await sendTextDelayed(conexao, number, text);
      await supabase.from("mensagens").insert({
        empresa_id: args.empresaId,
        contato_id: args.contatoId,
        conexao_id: args.conexaoId,
        direcao: "out",
        conteudo: text,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
    }
    await supabase.from("menu_sessions").update({ updated_at: nowIso } as any).eq("id", session.id);
    return { handled: true };
  }

  if (picked.type === "submenu") {
    const nextPath = [...path, String(picked.code)];
    await supabase.from("menu_sessions").update({ path: nextPath, updated_at: nowIso } as any).eq("id", session.id);
    const nextNode = getNodeByPath(tree, nextPath);
    const text = renderMenuMessage(greetingRendered, nextNode.label, nextNode.children || [], nextPath);
    const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
    const number = normalizeNumber(args.rjid);
    if (conexao && number && text) {
      const sent = await sendTextDelayed(conexao, number, text);
      await supabase.from("mensagens").insert({
        empresa_id: args.empresaId,
        contato_id: args.contatoId,
        conexao_id: args.conexaoId,
        direcao: "out",
        conteudo: text,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
    }
    return { handled: true };
  }

  if (picked.type === "catalog") {
    const term = String(picked.term || picked.label || "all").trim() || "all";
    const isAll = term.toLowerCase() === "all";
    const cleanedTerm = term
      .replace(/\/sc\b/gi, "")
      .replace(/\/\w{2,}\b/gi, "")
      .replace(/[–—-].*$/, "")
      .trim();
    const patterns = isAll ? [] : Array.from(new Set([term, cleanedTerm].filter(Boolean))).map((t) => `%${t}%`);

    const baseQ = supabase
      .from("catalog_items")
      .select("id, tipo, nome, descricao, valor, image_url")
      .eq("empresa_id", args.empresaId)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: items } = isAll
      ? await baseQ
      : await baseQ.or(
          patterns
            .map((p) => `nome.ilike.${p},descricao.ilike.${p}`)
            .join(",")
        );

    let rows = Array.isArray(items) ? items : [];
    if (!isAll && rows.length === 0) {
      const { data: fallback } = await baseQ;
      rows = Array.isArray(fallback) ? fallback : [];
    }

    if (rows.length === 0) {
      const baseNull = supabase
        .from("catalog_items")
        .select("id, tipo, nome, descricao, valor, image_url")
        .is("empresa_id", null)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: itemsNull } = isAll
        ? await baseNull
        : await baseNull.or(
            patterns
              .map((p) => `nome.ilike.${p},descricao.ilike.${p}`)
              .join(",")
          );

      rows = Array.isArray(itemsNull) ? itemsNull : [];
    }
    const number = normalizeNumber(args.rjid);
    if (rows.length === 0) {
      const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
      const text = "Não encontrei opções no catálogo para essa escolha. Digite MENU para ver as opções.";
      if (conexao && number) {
        const sent = await sendTextDelayed(conexao, number, text);
        await supabase.from("mensagens").insert({
          empresa_id: args.empresaId,
          contato_id: args.contatoId,
          conexao_id: args.conexaoId,
          direcao: "out",
          conteudo: text,
          status: sent.ok ? "enviado" : "erro",
          external_id: null
        } as any);
      }
      await supabase.from("menu_sessions").update({ updated_at: nowIso } as any).eq("id", session.id);
      return { handled: true };
    }

    for (const it of rows) {
      const caption = buildCatalogCaption(it);
      const imageUrl = pickCatalogImageUrl(it);
      const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
      if (imageUrl) {
        if (conexao && number) {
          const fileName = `${String(it?.nome || "item").slice(0, 32)}.jpg`;
          const sent = await sendMediaDelayed(conexao, number, {
            mediatype: "image",
            media: imageUrl,
            caption,
            mimetype: "image/jpeg",
            fileName,
          });
          await supabase.from("mensagens").insert({
            empresa_id: args.empresaId,
            contato_id: args.contatoId,
            conexao_id: args.conexaoId,
            direcao: "out",
            conteudo: caption || "",
            status: sent.ok ? "enviado" : "erro",
            external_id: sent.ok ? extractExternalIdFromEvolutionResponse(sent.body) : null,
            tipo: "image",
            media_url: imageUrl,
            mimetype: "image/jpeg",
            file_name: fileName
          } as any);
        }
      } else {
        if (conexao && number) {
          const sent = await sendTextDelayed(conexao, number, caption);
          await supabase.from("mensagens").insert({
            empresa_id: args.empresaId,
            contato_id: args.contatoId,
            conexao_id: args.conexaoId,
            direcao: "out",
            conteudo: caption,
            status: sent.ok ? "enviado" : "erro",
            external_id: sent.ok ? extractExternalIdFromEvolutionResponse(sent.body) : null,
            tipo: "text"
          } as any);
        }
      }
    }

    await supabase.from("menu_sessions").update({ path: ["__post_catalog"], updated_at: nowIso } as any).eq("id", session.id);

    await new Promise((r) => setTimeout(r, 15_000));

    const { data: contatoModeNow } = await supabase
      .from("contatos")
      .select("atendimento_mode")
      .eq("id", args.contatoId)
      .maybeSingle();
    if (contatoModeNow?.atendimento_mode !== "humano") {
      const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
      const number = normalizeNumber(args.rjid);
      const text = "Deseja continuar?\n\n*1* Continuar\n*2* Voltar ao menu\n*3* Encerrar atendimento";
      if (conexao && number) {
        const sent = await sendTextDelayed(conexao, number, text);
        await supabase.from("mensagens").insert({
          empresa_id: args.empresaId,
          contato_id: args.contatoId,
          conexao_id: args.conexaoId,
          direcao: "out",
          conteudo: text,
          status: sent.ok ? "enviado" : "erro",
          external_id: null
        } as any);
      }
    }
    return { handled: true };
  }

  if (picked.type === "ia") {
    await supabase.from("menu_sessions").delete().eq("id", session.id);
    const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
    const number = normalizeNumber(args.rjid);
    const text = "Perfeito! Me diga o que você procura e eu te ajudo agora.";
    if (conexao && number) {
      const sent = await sendTextDelayed(conexao, number, text);
      await supabase.from("mensagens").insert({
        empresa_id: args.empresaId,
        contato_id: args.contatoId,
        conexao_id: args.conexaoId,
        direcao: "out",
        conteudo: text,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
    }
    return { handled: true };
  }

  if (picked.type === "human") {
    await supabase.from("menu_sessions").delete().eq("id", session.id);
    await supabase
      .from("contatos")
      .update({ atendimento_mode: "humano", updated_at: nowIso } as any)
      .eq("id", args.contatoId);
    const conexao = args.conexaoInfo || (await resolveConexaoForEmpresa(args.empresaId, args.conexaoId));
    const number = normalizeNumber(args.rjid);
    const text = "Certo! Vou te encaminhar para um atendente.";
    if (conexao && number) {
      const sent = await sendTextDelayed(conexao, number, text);
      await supabase.from("mensagens").insert({
        empresa_id: args.empresaId,
        contato_id: args.contatoId,
        conexao_id: args.conexaoId,
        direcao: "out",
        conteudo: text,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
    }
    return { handled: true };
  }

  return { handled: true };
}

async function resolveConexaoForEmpresa(empresaId: string, conexaoId: string | null) {
  const q = supabase.from("conexoes").select("id, empresa_id, api_url, nome_api, apikey, globalkey");
  const { data } = conexaoId
    ? await q.eq("id", conexaoId).maybeSingle()
    : await q.eq("empresa_id", empresaId).limit(1).maybeSingle();
  return data || null;
}

async function tryUpdateProfilePic(conexao: { api_url?: string | null; nome_api?: string | null; apikey?: string | null; globalkey?: string | null }, remoteJid: string, contatoId: string) {
  const apiUrl = (conexao.api_url || "").toString().replace(/\/+$/, "");
  const instance = (conexao.nome_api || "").toString();
  const apikey = (conexao.apikey || conexao.globalkey || "").toString();
  if (!apiUrl || !instance || !apikey) return;
  const url = `${apiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`;
  const body = JSON.stringify({ number: remoteJid });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apikey },
    body
  }).catch(() => null);
  if (!res || !res.ok) return;
  const json = await res.json().catch(() => ({} as any));
  const profilePictureUrl = json?.profilePictureUrl as string | undefined;
  if (!profilePictureUrl) return;
  await supabase
    .from("contatos")
    .update({ profile_img_url: profilePictureUrl, profile_img_fetched_at: new Date().toISOString() } as any)
    .eq("id", contatoId);
}

function detectMessageType(msg: any) {
  if (msg?.reactionMessage) return "reactionMessage";
  if (msg?.interactiveResponseMessage) return "interactiveResponseMessage";
  if (msg?.buttonsResponseMessage) return "buttonsResponseMessage";
  if (msg?.templateButtonReplyMessage) return "templateButtonReplyMessage";
  if (msg?.listResponseMessage) return "listResponseMessage";
  if (msg?.interactiveMessage) return "interactiveMessage";
  if (msg?.templateMessage) return "templateMessage";
  if (msg?.contactMessage) return "contactMessage";
  if (msg?.buttonsMessage) return "buttonsMessage";
  if (msg?.extendedTextMessage) return "extendedTextMessage";
  if (msg?.conversation) return "conversation";
  if (msg?.stickerMessage) return "stickerMessage";
  if (msg?.imageMessage) return "imageMessage";
  if (msg?.audioMessage) return "audioMessage";
  if (msg?.videoMessage) return "videoMessage";
  if (msg?.documentMessage) return "documentMessage";
  return "unknown";
}

function unwrapMessage(input: any) {
  let msg = input;
  for (let i = 0; i < 8; i += 1) {
    if (!msg || typeof msg !== "object") return msg;
    const inner =
      msg?.message ||
      msg?.ephemeralMessage?.message ||
      msg?.viewOnceMessage?.message ||
      msg?.viewOnceMessageV2?.message ||
      msg?.viewOnceMessageV2Extension?.message ||
      msg?.documentWithCaptionMessage?.message ||
      msg?.editedMessage?.message ||
      msg?.protocolMessage?.editedMessage ||
      null;
    if (!inner || inner === msg) return msg;
    msg = inner;
  }
  return msg;
}

function safeJsonParse(value: unknown) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return null;
  }
}

function stringifyObjectLines(obj: Record<string, unknown>) {
  const formatValue = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const t = typeof v;
    if (t === "string") return String(v);
    if (t === "number" || t === "boolean" || t === "bigint") return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  const entries = Object.entries(obj)
    .map(([k, v]) => `${k}: ${formatValue(v)}`.trim())
    .filter(Boolean);
  return entries.join("\n");
}

function amountToString(input: unknown, currency?: string) {
  const obj = (input && typeof input === "object") ? (input as Record<string, unknown>) : null;
  const valueRaw = obj?.value;
  const offsetRaw = obj?.offset;
  const value = typeof valueRaw === "number" ? valueRaw : Number(valueRaw);
  const offset = typeof offsetRaw === "number" ? offsetRaw : Number(offsetRaw);
  if (!Number.isFinite(value) || !Number.isFinite(offset)) return "";
  const denom = Math.pow(10, Math.max(0, Math.min(6, Math.floor(offset))));
  const num = value / denom;
  const formatted = num.toFixed(Math.max(0, Math.min(6, Math.floor(offset))));
  return currency ? `${currency} ${formatted}` : formatted;
}

function formatPixParams(parsed: Record<string, unknown>) {
  const currency = typeof parsed.currency === "string" ? parsed.currency : undefined;
  const referenceId = typeof parsed.referenceid === "string" ? parsed.referenceid : (typeof parsed.referenceId === "string" ? parsed.referenceId : undefined);
  const totalAmount =
    parsed.totalamount ??
    parsed.totalAmount ??
    (typeof parsed.order === "object" && parsed.order ? (parsed.order as Record<string, unknown>).totalamount : undefined);
  const totalLabel = amountToString(totalAmount, currency);

  const paymentSettings = parsed.paymentsettings ?? parsed.paymentSettings;
  const list = Array.isArray(paymentSettings) ? paymentSettings : [];
  let pix: Record<string, unknown> | null = null;
  for (const it of list) {
    const row = (it && typeof it === "object") ? (it as Record<string, unknown>) : null;
    const type = String(row?.type || "").toLowerCase();
    if (type === "pixstaticcode" && row?.pixstaticcode && typeof row.pixstaticcode === "object") {
      pix = row.pixstaticcode as Record<string, unknown>;
      break;
    }
  }
  if (!pix && parsed.pixstaticcode && typeof parsed.pixstaticcode === "object") pix = parsed.pixstaticcode as Record<string, unknown>;
  if (!pix) return "";

  const key = typeof pix.key === "string" ? pix.key : "";
  if (!key) return "";
  const merchantName = typeof pix.merchantname === "string" ? pix.merchantname : (typeof pix.merchantName === "string" ? pix.merchantName : "");
  const keyType = typeof pix.keytype === "string" ? pix.keytype : (typeof pix.keyType === "string" ? pix.keyType : "");

  const lines: string[] = [];
  lines.push("Copiar chave Pix");
  lines.push(`Chave Pix: ${key}`);
  if (merchantName) lines.push(`Recebedor: ${merchantName}`);
  if (keyType) lines.push(`Tipo: ${keyType}`);
  if (totalLabel) lines.push(`Valor: ${totalLabel}`);
  if (referenceId) lines.push(`Referência: ${referenceId}`);
  return lines.join("\n");
}

function extractNativeFlowButtonsText(nativeFlowMessage: any) {
  const buttons = Array.isArray(nativeFlowMessage?.buttons) ? nativeFlowMessage.buttons : [];
  const lines: string[] = [];
  for (const b of buttons) {
    const paramsJson = b?.buttonParamsJson;
    if (!paramsJson) continue;
    const parsed = safeJsonParse(paramsJson);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const pix = formatPixParams(obj);
      if (pix) {
        lines.push(pix);
        continue;
      }
      const label =
        (obj.display_text as string | undefined) ||
        (obj.text as string | undefined) ||
        (obj.button_text as string | undefined) ||
        "";
      const copy =
        (obj.copy_code as string | undefined) ||
        (obj.code as string | undefined) ||
        (obj.pix as string | undefined) ||
        "";
      const url = (obj.url as string | undefined) || "";
      if (label) lines.push(String(label));
      if (copy) lines.push(String(copy));
      if (!label && !copy && url) lines.push(String(url));
      if (!label && !copy && !url) {
        const txt = stringifyObjectLines(obj);
        if (txt) lines.push(txt);
      }
      continue;
    }
    lines.push(String(paramsJson));
  }
  return lines.join("\n").trim();
}

function extractTextContent(msg: any) {
  const conversation = msg?.conversation as string | undefined;
  if (conversation) return conversation;

  const ext = msg?.extendedTextMessage || null;
  if (ext?.text) return String(ext.text);
  if (ext?.canonicalUrl) return String(ext.canonicalUrl);
  if (ext?.matchedText) return String(ext.matchedText);

  const imgCap = msg?.imageMessage?.caption;
  if (imgCap) return String(imgCap);
  const vidCap = msg?.videoMessage?.caption;
  if (vidCap) return String(vidCap);
  const docCap = msg?.documentMessage?.caption;
  if (docCap) return String(docCap);

  const buttonsResp = msg?.buttonsResponseMessage || null;
  if (buttonsResp?.selectedDisplayText) return String(buttonsResp.selectedDisplayText);
  if (buttonsResp?.selectedButtonId) return String(buttonsResp.selectedButtonId);

  const templateBtn = msg?.templateButtonReplyMessage || null;
  if (templateBtn?.selectedDisplayText) return String(templateBtn.selectedDisplayText);
  if (templateBtn?.selectedId) return String(templateBtn.selectedId);

  const listResp = msg?.listResponseMessage || null;
  if (listResp?.title) return String(listResp.title);
  if (listResp?.description) return String(listResp.description);
  if (listResp?.singleSelectReply?.selectedRowId) return String(listResp.singleSelectReply.selectedRowId);

  const interactiveResp = msg?.interactiveResponseMessage || null;
  if (interactiveResp?.buttonReplyMessage?.selectedDisplayText) return String(interactiveResp.buttonReplyMessage.selectedDisplayText);
  if (interactiveResp?.buttonReplyMessage?.selectedButtonId) return String(interactiveResp.buttonReplyMessage.selectedButtonId);
  if (interactiveResp?.listReplyMessage?.title) return String(interactiveResp.listReplyMessage.title);
  if (interactiveResp?.listReplyMessage?.description) return String(interactiveResp.listReplyMessage.description);
  if (interactiveResp?.nativeFlowResponseMessage?.name) return String(interactiveResp.nativeFlowResponseMessage.name);
  if (interactiveResp?.nativeFlowResponseMessage?.paramsJson) {
    const parsed = safeJsonParse(interactiveResp.nativeFlowResponseMessage.paramsJson);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const pix = formatPixParams(obj);
      if (pix) return pix;
      return stringifyObjectLines(obj);
    }
    return String(interactiveResp.nativeFlowResponseMessage.paramsJson);
  }

  const interactiveMsg = msg?.interactiveMessage || null;
  if (interactiveMsg?.body?.text) return String(interactiveMsg.body.text);
  if (interactiveMsg?.footer?.text) return String(interactiveMsg.footer.text);
  if (interactiveMsg?.header?.title) return String(interactiveMsg.header.title);
  if (interactiveMsg?.header?.text) return String(interactiveMsg.header.text);
  if (interactiveMsg?.nativeFlowMessage) {
    const nativeButtons = extractNativeFlowButtonsText(interactiveMsg.nativeFlowMessage);
    if (nativeButtons) return nativeButtons;
  }

  const templateMsg = msg?.templateMessage || null;
  const hydrated = templateMsg?.hydratedTemplate || templateMsg?.hydratedFourRowTemplate || null;
  if (hydrated?.hydratedContentText) return String(hydrated.hydratedContentText);
  if (hydrated?.hydratedFooterText) return String(hydrated.hydratedFooterText);
  if (Array.isArray(hydrated?.hydratedButtons)) {
    const lines: string[] = [];
    for (const b of hydrated.hydratedButtons) {
      const quick = b?.quickReplyButton;
      const urlBtn = b?.urlButton;
      const call = b?.callButton;
      const copy = b?.copyButton;
      if (quick?.displayText) lines.push(String(quick.displayText));
      if (urlBtn?.displayText) lines.push(String(urlBtn.displayText));
      if (urlBtn?.url) lines.push(String(urlBtn.url));
      if (call?.displayText) lines.push(String(call.displayText));
      if (call?.phoneNumber) lines.push(String(call.phoneNumber));
      if (copy?.displayText) lines.push(String(copy.displayText));
      if (copy?.copyCode) lines.push(String(copy.copyCode));
    }
    const joined = lines.filter(Boolean).join("\n").trim();
    if (joined) return joined;
  }

  const contactMsg = msg?.contactMessage || null;
  if (contactMsg?.displayName) return String(contactMsg.displayName);
  const vcard = contactMsg?.vcard ? String(contactMsg.vcard) : "";
  if (vcard) {
    const name = vcard.match(/^FN:(.+)$/m)?.[1]?.trim() || "";
    const tel = vcard.match(/^TEL[^:]*:(.+)$/m)?.[1]?.trim() || "";
    const parts = [name, tel].filter(Boolean).join(" • ");
    if (parts) return parts;
    return vcard.slice(0, 2000);
  }

  const buttonsMsg = msg?.buttonsMessage || null;
  if (buttonsMsg?.contentText) return String(buttonsMsg.contentText);
  if (buttonsMsg?.footerText) return String(buttonsMsg.footerText);

  return "";
}

function fallbackContentForType(msgType: string) {
  if (msgType === "audioMessage") return "[Áudio]";
  if (msgType === "imageMessage") return "[Imagem]";
  if (msgType === "videoMessage") return "[Vídeo]";
  if (msgType === "documentMessage") return "[Documento]";
  if (msgType === "stickerMessage") return "[Figurinha]";
  if (msgType === "buttonsMessage") return "[Botões]";
  if (msgType === "buttonsResponseMessage" || msgType === "templateButtonReplyMessage" || msgType === "interactiveResponseMessage" || msgType === "listResponseMessage") {
    return "[Interação]";
  }
  if (msgType === "interactiveMessage") return "[Interação]";
  if (msgType === "templateMessage") return "[Template]";
  if (msgType === "contactMessage") return "[Contato]";
  return "[Mensagem]";
}

async function markAiDispatched(empresaId: string, contatoId: string, externalId: string | null, conteudo: string) {
  const nowIso = new Date().toISOString();
  if (externalId) {
    await supabase
      .from("mensagens")
      .update({ ai_dispatched_at: nowIso } as any)
      .eq("external_id", externalId)
      .eq("empresa_id", empresaId)
      .eq("contato_id", contatoId);
    return;
  }
  const windowStart = new Date(Date.now() - 60 * 1000).toISOString();
  const { data: latest } = await supabase
    .from("mensagens")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("contato_id", contatoId)
    .eq("direcao", "in")
    .eq("conteudo", conteudo)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest?.id) return;
  await supabase
    .from("mensagens")
    .update({ ai_dispatched_at: nowIso } as any)
    .eq("id", latest.id);
}

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isWithinBusinessHours(now: Date, timezone: string, businessHours: any) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Sao_Paulo",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const weekday = String(map.weekday || "").toLowerCase();
    const hm = `${map.hour}:${map.minute}`;
    const dayMap: Record<string, string> = {
      mon: "mon",
      tue: "tue",
      wed: "wed",
      thu: "thu",
      fri: "fri",
      sat: "sat",
      sun: "sun",
    };
    const key = dayMap[weekday.slice(0, 3)] || weekday.slice(0, 3);
    const cfg = businessHours?.[key];
    if (!cfg || cfg.enabled === false) return false;
    const start = cfg.start || "00:00";
    const end = cfg.end || "23:59";
    return hm >= start && hm <= end;
  } catch {
    return true;
  }
}

function timezoneOffsetString(timezone: string, at: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Sao_Paulo",
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(at);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    const m = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!m) return "-03:00";
    const sign = m[1] === "-" ? "-" : "+";
    const h = String(m[2] || "0").padStart(2, "0");
    const mm = String(m[3] || "0").padStart(2, "0");
    return `${sign}${h}:${mm}`;
  } catch {
    return "-03:00";
  }
}

function isoDateInTz(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value || "1970";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const d = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${d}`;
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map((p) => Number(p));
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

function parseAppointmentDateTime(text: string, timezone: string, now: Date) {
  const src = String(text || "").toLowerCase();
  const today = isoDateInTz(now, timezone);
  const offset = timezoneOffsetString(timezone, now);

  let dateIso: string | null = null;
  if (/\bamanh[ãa]\b/.test(src)) dateIso = addDaysToIsoDate(today, 1);
  else if (/\bhoje\b/.test(src)) dateIso = today;

  const ddmmyy = src.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (ddmmyy) {
    const dd = String(ddmmyy[1]).padStart(2, "0");
    const mm = String(ddmmyy[2]).padStart(2, "0");
    const yyyyRaw = ddmmyy[3];
    const yyyy = yyyyRaw ? (String(yyyyRaw).length === 2 ? `20${yyyyRaw}` : String(yyyyRaw)) : today.slice(0, 4);
    dateIso = `${yyyy}-${mm}-${dd}`;
  }

  const time1 = src.match(/\b(\d{1,2})h(\d{2})\b/);
  const time2 = src.match(/\b(\d{1,2})(?::(\d{2}))\b/);
  const time3 = src.match(/\b(\d{1,2})h\b/);
  const hourRaw = time1?.[1] || time2?.[1] || time3?.[1] || null;
  const minRaw = time1?.[2] || time2?.[2] || (time3 ? "00" : null);

  if (!dateIso || !hourRaw || !minRaw) return null;
  const hour = Math.max(0, Math.min(23, Number(hourRaw)));
  const minute = Math.max(0, Math.min(59, Number(minRaw)));

  const localLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const localIso = `${dateIso}T${localLabel}:00${offset}`;
  const iso = new Date(localIso).toISOString();
  if (Number.isNaN(new Date(iso).getTime())) return null;
  return { iso, localLabel, dateIso };
}

function parseAppointmentService(text: string) {
  const src = String(text || "").trim();
  const lowered = src.toLowerCase();
  if (lowered.includes("check-in") || lowered.includes("checkin")) return "check-in";
  if (lowered.includes("reuni")) return "reunião";
  const m = lowered.match(/\b(agendar|marcar|agende|marque)\b([\s\S]*)/i);
  if (!m?.[2]) return "";
  const cleaned = String(m[2])
    .replace(/\b(para|pra|um|uma|o|a|meu|minha)\b/gi, " ")
    .replace(/\b(hoje|amanh[ãa]|dia)\b[\s\S]*$/i, "")
    .replace(/\b(as|às)\b[\s\S]*$/i, "")
    .replace(/[^\p{L}\p{N}\s\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

async function handleAppointmentFlow(args: {
  empresaId: string;
  contatoId: string;
  conexaoId: string | null;
  conexaoInfo: any;
  rjid: string;
  pushName: string;
  content: string;
  timezone: string;
}) {
  const { empresaId, contatoId, conexaoId, conexaoInfo, rjid, pushName, content, timezone } = args;
  const text = String(content || "").trim();
  const lowered = text.toLowerCase();

  const looksLikeSchedule = /\b(agendar|agende|marcar|marque|agendamento)\b/.test(lowered);
  const looksLikeCancel = /\b(cancelar|cancela|desmarcar|desmarque)\b/.test(lowered);
  if (!looksLikeSchedule && !looksLikeCancel) return { handled: false, closeSession: false };

  const number = normalizeNumber(rjid);
  const conexao = conexaoInfo || (await resolveConexaoForEmpresa(empresaId, conexaoId));
  if (!conexao || !number) return { handled: true, closeSession: false };

  const dt = parseAppointmentDateTime(text, timezone, new Date());
  if (!dt) {
    const msg = "Me informe o dia e horário para agendar (ex.: hoje às 14h ou 30/03 às 10:30).";
    const sent = await sendTextDelayed(conexao, number, msg);
    await supabase.from("mensagens").insert({
      empresa_id: empresaId,
      contato_id: contatoId,
      conexao_id: conexaoId,
      direcao: "out",
      conteudo: msg,
      status: sent.ok ? "enviado" : "erro",
      external_id: null
    } as any);
    return { handled: true, closeSession: false };
  }

  if (looksLikeCancel) {
    const start = new Date(dt.iso);
    const windowStart = new Date(start.getTime() - 60_000).toISOString();
    const windowEnd = new Date(start.getTime() + 60_000).toISOString();
    const { data: appt } = await supabase
      .from("agendamentos")
      .select("id, contato_cliente, status, data_hora, servico")
      .eq("empresa_id", empresaId)
      .gte("data_hora", windowStart)
      .lt("data_hora", windowEnd)
      .not("status", "eq", "Cancelado")
      .order("data_hora", { ascending: true })
      .limit(1)
      .maybeSingle();

    const sameContact = appt?.contato_cliente ? normalizeNumber(String(appt.contato_cliente)) === number : false;
    if (!appt?.id || !sameContact) {
      const msg = `Não encontrei um agendamento seu nesse horário (${dt.localLabel}).`;
      const sent = await sendTextDelayed(conexao, number, msg);
      await supabase.from("mensagens").insert({
        empresa_id: empresaId,
        contato_id: contatoId,
        conexao_id: conexaoId,
        direcao: "out",
        conteudo: msg,
        status: sent.ok ? "enviado" : "erro",
        external_id: null
      } as any);
      return { handled: true, closeSession: false };
    }

    await supabase.from("agendamentos").update({ status: "Cancelado" } as any).eq("id", appt.id);
    const msg = `Agendamento cancelado com sucesso para ${dt.localLabel}.`;
    const sent = await sendTextDelayed(conexao, number, msg);
    await supabase.from("mensagens").insert({
      empresa_id: empresaId,
      contato_id: contatoId,
      conexao_id: conexaoId,
      direcao: "out",
      conteudo: msg,
      status: sent.ok ? "enviado" : "erro",
      external_id: null
    } as any);
    return { handled: true, closeSession: true };
  }

  const service = parseAppointmentService(text);
  if (!service) {
    const msg = "Qual serviço você quer agendar? (ex.: reunião, check-in, corte de cabelo)";
    const sent = await sendTextDelayed(conexao, number, msg);
    await supabase.from("mensagens").insert({
      empresa_id: empresaId,
      contato_id: contatoId,
      conexao_id: conexaoId,
      direcao: "out",
      conteudo: msg,
      status: sent.ok ? "enviado" : "erro",
      external_id: null
    } as any);
    return { handled: true, closeSession: false };
  }

  const start = new Date(dt.iso);
  const durationMinutes = 30;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const { data: conflicts } = await supabase
    .from("agendamentos")
    .select("id, contato_cliente, status, data_hora")
    .eq("empresa_id", empresaId)
    .gte("data_hora", start.toISOString())
    .lt("data_hora", end.toISOString())
    .not("status", "eq", "Cancelado");
  const list = Array.isArray(conflicts) ? conflicts : [];
  if (list.length > 0) {
    const sameContact = list.every((a: any) => normalizeNumber(String(a?.contato_cliente || "")) === number);
    const msg = sameContact
      ? `Seu agendamento já está confirmado para ${dt.localLabel}.`
      : `Esse horário (${dt.localLabel}) não está disponível. Pode me sugerir outro?`;
    const sent = await sendTextDelayed(conexao, number, msg);
    await supabase.from("mensagens").insert({
      empresa_id: empresaId,
      contato_id: contatoId,
      conexao_id: conexaoId,
      direcao: "out",
      conteudo: msg,
      status: sent.ok ? "enviado" : "erro",
      external_id: null
    } as any);
    return { handled: true, closeSession: false };
  }

  const { data: created, error: insErr } = await supabase
    .from("agendamentos")
    .insert({
      nome_cliente: pushName || "Cliente",
      contato_cliente: number,
      servico: service,
      data_hora: start.toISOString(),
      empresa_id: empresaId,
      origem: "IA",
      status: "Confirmado"
    } as any)
    .select("id")
    .single();

  const msg = insErr || !created?.id
    ? `Não consegui salvar o agendamento agora. Pode tentar novamente?`
    : `Agendamento confirmado para ${dt.localLabel} (${service}).`;

  const sent = await sendTextDelayed(conexao, number, msg);
  await supabase.from("mensagens").insert({
    empresa_id: empresaId,
    contato_id: contatoId,
    conexao_id: conexaoId,
    direcao: "out",
    conteudo: msg,
    status: sent.ok ? "enviado" : "erro",
    external_id: null
  } as any);
  return { handled: true, closeSession: Boolean(created?.id) };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));

    const instanceFromHeader = req.headers.get("x-instance") || undefined;
    const instanceName =
      body?.instance ??
      body?.instanceName ??
      body?.data?.instance ??
      body?.data?.instanceName ??
      body?.data?.data?.instance ??
      body?.data?.data?.instanceName ??
      instanceFromHeader;
    const eventRaw = (body?.event as string | undefined) || "";
    const eventNormalized = eventRaw.toLowerCase().replaceAll("_", "-");
    console.info(JSON.stringify({
      event: eventRaw,
      instanceName,
      keys: Object.keys(body || {}),
      dataKeys: Object.keys((body as any)?.data || {})
    }));

    const messagesArray =
      body?.data?.messages ??
      body?.messages ??
      body?.data?.data?.messages ??
      [];
    const upsert = Array.isArray(messagesArray)
      ? messagesArray
      : [];
    let remoteJid = body?.remoteJid as string | undefined;
    let texto = body?.texto as string | undefined;
    let nomeContato = (body?.nome as string | undefined) || "Contato";
    const event = eventNormalized || (req.url.split("/").pop() || "").toLowerCase();

    if ((!upsert || upsert.length === 0) && (body?.data?.key || body?.data?.data?.key || body?.key)) {
      const single =
        (body?.data?.key ? body.data : null) ||
        (body?.data?.data?.key ? body.data.data : null) ||
        (body?.key ? body : null);
      if (single) {
        upsert.push(single);
      }
    }

    if (upsert && upsert.length > 0) {
      let processed = 0;
      for (const m of upsert) {
        const env = m?.data?.data || m?.data || m;
        const key = env?.key || m?.key || {};
        const msg = env?.message || m?.message || {};
        const msgInner = unwrapMessage(msg);
        const msgType = detectMessageType(msgInner);
        const extId = key?.id as string | undefined;
        const fromMe = Boolean(key?.fromMe);
        const rjid = remoteJid || (env?.remoteJid as string | undefined) || (m?.remoteJid as string | undefined) || key?.remoteJid;
        const pushNameRaw = (env?.pushName as string | undefined) || (m?.pushName as string | undefined);
        const pushName = String(pushNameRaw || "").trim() || "Cliente";
        const contatoNome = deriveContatoNome({ rjid, fromMe, pushName, bodyNomeContato: nomeContato });
        let content =
          texto ||
          (env?.texto as string | undefined) ||
          extractTextContent(msgInner) ||
          "";
        if (!content) content = fallbackContentForType(msgType);
        if (!rjid) continue;
        let empresaId = (body?.empresa_id as string | undefined) || undefined;
        let conexaoId: string | null = null;
        let conexaoInfo: any = null;
        if (instanceName) {
          const { data: cx } = await supabase
            .from("conexoes")
            .select("id, empresa_id, api_url, nome_api, apikey, globalkey, id_ia")
            .eq("nome_api", instanceName)
            .maybeSingle();
          empresaId = empresaId || cx?.empresa_id || undefined;
          conexaoId = (cx?.id as string | undefined) || null;
          conexaoInfo = cx || null;
        }
        if (!empresaId) continue;
        let contatoId: string | null = null;
        let profileImgUrl: string | null = null;
        let afterHoursLastSentAt: string | null = null;
        let aiSessionId: string | null = null;
        let aiSessionUpdatedAt: string | null = null;
        let aiSessionClosedAt: string | null = null;
        let profileFetchedAt: string | null = null;
        {
          const { data: c1 } = await supabase
            .from("contatos")
            .select("id, nome, atendimento_mode, profile_img_url, profile_img_fetched_at, after_hours_last_sent_at, ai_session_id, ai_session_updated_at, ai_session_closed_at")
            .eq("empresa_id", empresaId)
            .eq("contato", rjid)
            .limit(1)
            .maybeSingle();
          if (c1?.id) {
            contatoId = c1.id as string;
            const currentContatoNome = (c1.nome as string | null | undefined) || null;
            profileImgUrl = (c1.profile_img_url as string | null | undefined) || null;
            profileFetchedAt = (c1.profile_img_fetched_at as string | null | undefined) || null;
            afterHoursLastSentAt = (c1.after_hours_last_sent_at as string | null | undefined) || null;
            aiSessionId = (c1.ai_session_id as string | null | undefined) || null;
            aiSessionUpdatedAt = (c1.ai_session_updated_at as string | null | undefined) || null;
            aiSessionClosedAt = (c1.ai_session_closed_at as string | null | undefined) || null;
            await supabase
              .from("contatos")
              .update({ updated_at: new Date().toISOString(), conexao_id: conexaoId } as any)
              .eq("id", contatoId);
            if (!fromMe && shouldUpdateContatoNome({ currentNome: currentContatoNome, newNome: contatoNome, rjid, bodyNomeContato: nomeContato })) {
              await supabase
                .from("contatos")
                .update({ nome: contatoNome } as any)
                .eq("id", contatoId);
            }
          } else {
            const { data: c2, error: e2 } = await supabase
              .from("contatos")
              .insert({
                nome: contatoNome,
                contato: rjid,
                empresa_id: empresaId,
                resumo: "",
                profile_img_url: null,
                fase_id: (await getDefaultFaseId(empresaId)) || null,
                conexao_id: conexaoId,
                atendimento_mode: "ia"
              } as any)
              .select("id")
              .single();
            if (e2) {
              return new Response(JSON.stringify({ error: "Falha ao criar contato" }), { status: 500 });
            }
            contatoId = c2.id as string;
            aiSessionId = crypto.randomUUID();
            aiSessionUpdatedAt = new Date().toISOString();
            aiSessionClosedAt = null;
            await supabase
              .from("contatos")
              .update({ ai_session_id: aiSessionId, ai_session_updated_at: aiSessionUpdatedAt, ai_session_closed_at: null } as any)
              .eq("id", contatoId);
          }
        }
        if (!contatoId) continue;

        if (msgType === "reactionMessage") {
          const reactedExtId =
            (msgInner?.reactionMessage?.key?.id as string | undefined) ||
            (msgInner?.reactionMessage?.keyId as string | undefined) ||
            undefined;
          const emoji =
            (msgInner?.reactionMessage?.text as string | undefined) ||
            (msgInner?.reactionMessage?.emoji as string | undefined) ||
            "";
          if (reactedExtId && emoji) {
            await supabase
              .from("mensagens")
              .update({ reacao_emoji: emoji, reacao_direcao: fromMe ? "out" : "in", reacao_em: new Date().toISOString() } as any)
              .eq("empresa_id", empresaId)
              .eq("contato_id", contatoId)
              .eq("external_id", reactedExtId);
          }
          processed += 1;
          continue;
        }
        if (conexaoInfo && !fromMe) {
          const last = profileFetchedAt ? Date.parse(String(profileFetchedAt)) : 0;
          const stale = !last || Number.isNaN(last) ? true : Date.now() - last > 24 * 60 * 60_000;
          if (!profileImgUrl || stale) {
            await tryUpdateProfilePic(conexaoInfo, rjid, contatoId).catch(() => null);
          }
        }
        if (extId) {
          const { data: existing } = await supabase
            .from("mensagens")
            .select("id")
            .eq("external_id", extId)
            .maybeSingle();
          if (existing?.id) {
            await supabase
              .from("mensagens")
              .update({ updated_at: new Date().toISOString() } as any)
              .eq("id", existing.id);
            processed += 1;
            continue;
          }
        }
        if (fromMe && extId) {
          const windowStart = new Date(Date.now() - 2 * 60 * 1000).toISOString();
          const { data: pendingMatch } = await supabase
            .from("mensagens")
            .select("id")
            .eq("empresa_id", empresaId)
            .eq("contato_id", contatoId)
            .eq("direcao", "out")
            .eq("status", "pendente")
            .is("external_id", null)
            .eq("conteudo", content)
            .gte("created_at", windowStart)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pendingMatch?.id) {
            await supabase
              .from("mensagens")
              .update({ status: "enviado", external_id: extId, updated_at: new Date().toISOString() } as any)
              .eq("id", pendingMatch.id);
            processed += 1;
            continue;
          }
        }
        if (fromMe) {
          await supabase
            .from("contatos")
            .update({ atendimento_mode: "humano", updated_at: new Date().toISOString() } as any)
            .eq("id", contatoId);
        }

        let tipo: "text" | "image" | "video" | "document" | "audio" | "sticker" = "text";
        let mediaUrl: string | null = null;
        let mimetype: string | null = null;
        let fileName: string | null = null;
        let durationMs: number | null = null;

        if (msgType === "imageMessage" || msgType === "videoMessage" || msgType === "documentMessage" || msgType === "audioMessage" || msgType === "stickerMessage") {
          tipo =
            msgType === "imageMessage"
              ? "image"
              : msgType === "videoMessage"
                ? "video"
                : msgType === "documentMessage"
                  ? "document"
                  : msgType === "stickerMessage"
                    ? "image"
                    : "audio";
          const node =
            msgType === "imageMessage"
              ? (msgInner?.imageMessage || {})
              : msgType === "videoMessage"
                ? (msgInner?.videoMessage || {})
                : msgType === "documentMessage"
                  ? (msgInner?.documentMessage || {})
                  : msgType === "stickerMessage"
                    ? (msgInner?.stickerMessage || {})
                    : (msgInner?.audioMessage || {});

          mimetype = (node?.mimetype as string | undefined) || mimetype;
          if (msgType === "stickerMessage") {
            mimetype = mimetype || "image/webp";
          }

          if (msgType === "audioMessage") {
            const seconds = Number(node?.seconds);
            durationMs = Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
          }

          const rawUrl = (node?.url as string | undefined) || null;
          const base64Raw =
            (m as any)?.message?.base64 ||
            (msgInner as any)?.base64 ||
            (node as any)?.base64 ||
            (body as any)?.data?.message?.base64 ||
            null;

          let bytes: Uint8Array | null = null;
          if (base64Raw) {
            const parsed = parseDataUrlBase64(String(base64Raw));
            mimetype = mimetype || parsed.mimetype;
            bytes = decodeBase64ToBytes(parsed.base64);
          }

          const apiUrl = (conexaoInfo?.api_url || "").toString().replace(/\/+$/, "");
          const apikey = (conexaoInfo?.apikey || conexaoInfo?.globalkey || "").toString();

          if (!bytes && rawUrl) {
            const abs =
              rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
                ? rawUrl
                : apiUrl
                  ? `${apiUrl}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`
                  : rawUrl;
            bytes = await fetchBytes(abs);
            if (!bytes && apikey) bytes = await fetchBytes(abs, { apikey });
            mediaUrl = abs;
          }

          if (bytes && empresaId && contatoId) {
            const bucket = "orcamentos";
            const ext = extensionFromMime(mimetype);
            const safeId = String(extId || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "");
            const path = `chat-media/${empresaId}/${contatoId}/${safeId}.${ext}`;
            const uploadOptions = mimetype ? { upsert: true, contentType: mimetype } : { upsert: true };
            const normalized = new Uint8Array(bytes);
            const blob = new Blob([normalized.buffer], { type: mimetype || "application/octet-stream" });
            const up = await supabase.storage.from(bucket).upload(path, blob, uploadOptions);
            if (!up.error) {
              mediaUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl || mediaUrl;
              if (msgType === "audioMessage") {
                fileName = `audio-${safeId}.${ext}`;
              } else if (msgType === "imageMessage") {
                fileName = `image-${safeId}.${ext}`;
              } else if (msgType === "videoMessage") {
                fileName = `video-${safeId}.${ext}`;
              } else if (msgType === "stickerMessage") {
                fileName = `sticker-${safeId}.${ext}`;
              } else {
                fileName = (node?.fileName as string | undefined) || `document-${safeId}.${ext}`;
              }
            }
          }
        }

        await supabase
          .from("mensagens")
          .insert({
            empresa_id: empresaId,
            contato_id: contatoId,
            conexao_id: conexaoId,
            direcao: fromMe ? "out" : "in",
            conteudo: content,
            status: fromMe ? "enviado" : "enviado",
            external_id: extId || null,
            tipo,
            media_url: mediaUrl,
            mimetype,
            file_name: fileName,
            duration_ms: durationMs
          } as any);
        processed += 1;

        if (!fromMe) {
          await supabase
            .from("contatos")
            .update({ conversa_status: "aberta", conversa_resolvida_em: null, conversa_resolvida_por: null } as any)
            .eq("id", contatoId);

          const { data: contato2 } = await supabase
            .from("contatos")
            .select("atendimento_mode")
            .eq("id", contatoId)
            .maybeSingle();
          if (contato2?.atendimento_mode === "humano") {
            continue;
          }
          const { data: settings } = await supabase
            .from("empresa_settings")
            .select("timezone, business_hours, after_hours_message, ai_session_timeout_minutes, menu_enabled, menu_greeting, menu_tree, menu_timeout_minutes")
            .eq("empresa_id", empresaId)
            .maybeSingle();
          const timezone = settings?.timezone || "America/Sao_Paulo";
          const businessHours = settings?.business_hours || {};
          const timeoutMinutesRaw = settings?.ai_session_timeout_minutes;
          const timeoutMinutes = Number.isFinite(Number(timeoutMinutesRaw)) ? Number(timeoutMinutesRaw) : 60;
          const nowIso = new Date().toISOString();

          const shouldRotateSession = (() => {
            if (!aiSessionId) return true;
            if (aiSessionClosedAt) return true;
            if (!aiSessionUpdatedAt) return true;
            const last = Date.parse(aiSessionUpdatedAt);
            if (Number.isNaN(last)) return true;
            return Date.now() - last > timeoutMinutes * 60_000;
          })();

          if (shouldRotateSession) {
            aiSessionId = crypto.randomUUID();
            aiSessionClosedAt = null;
          }
          aiSessionUpdatedAt = nowIso;
          await supabase
            .from("contatos")
            .update({ ai_session_id: aiSessionId, ai_session_updated_at: aiSessionUpdatedAt, ai_session_closed_at: aiSessionClosedAt } as any)
            .eq("id", contatoId);

          if (!isWithinBusinessHours(new Date(), timezone, businessHours)) {
            const message = (settings?.after_hours_message || "").toString().trim();
            if (message) {
              const last = afterHoursLastSentAt ? new Date(afterHoursLastSentAt).getTime() : 0;
              const nowMs = Date.now();
              const cooldownMs = 6 * 60 * 60 * 1000;
              if (!last || nowMs - last > cooldownMs) {
                const number = normalizeNumber(rjid);
                const conexao = conexaoInfo || (await resolveConexaoForEmpresa(empresaId, conexaoId));
                if (conexao && number) {
                  const sent = await sendTextDelayed(conexao, number, message);
                  let ext: string | null = null;
                  if (sent.ok) {
                    try {
                      const parsed = JSON.parse(sent.body || "{}");
                      ext = parsed?.key?.id || parsed?.message?.key?.id || null;
                    } catch {
                      ext = null;
                    }
                  }
                  await supabase
                    .from("mensagens")
                    .insert({
                      empresa_id: empresaId,
                      contato_id: contatoId,
                      conexao_id: conexaoId,
                      direcao: "out",
                      conteudo: message,
                      status: sent.ok ? "enviado" : "erro",
                      external_id: ext
                    } as any);
                  await supabase
                    .from("contatos")
                    .update({ after_hours_last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
                    .eq("id", contatoId);
                }
              }
            }
            continue;
          }

          const menuHandled = await handleMenuFlow({
            empresaId,
            contatoId,
            conexaoId,
            conexaoInfo,
            rjid,
            pushName,
            content,
            settings
          }).catch(() => ({ handled: false }));
          if (menuHandled?.handled) {
            await markAiDispatched(empresaId, contatoId, extId || null, content).catch(() => null);
            continue;
          }

          const handled = await handleAppointmentFlow({
            empresaId,
            contatoId,
            conexaoId,
            conexaoInfo,
            rjid,
            pushName,
            content,
            timezone
          }).catch(() => ({ handled: false, closeSession: false }));

          if (handled?.handled) {
            await markAiDispatched(empresaId, contatoId, extId || null, content).catch(() => null);
            if (handled.closeSession) {
              await supabase
                .from("contatos")
                .update({ ai_session_closed_at: new Date().toISOString(), ai_session_updated_at: new Date().toISOString() } as any)
                .eq("id", contatoId);
            }
            continue;
          }

          const iaId = (conexaoInfo as any)?.id_ia as string | null | undefined;
          if (!iaId) {
            console.info(JSON.stringify({ ai_dispatch: "skipped", reason: "no_ia_assigned", empresaId, contatoId, conexaoId }));
            continue;
          }
          const { data: ia } = await supabase
            .from("ias")
            .select("id, ativa, prompt, openia_key, msg_reativacao, nome, response_delay_min_ms, response_delay_max_ms")
            .eq("id", iaId)
            .maybeSingle();
          if (!ia?.id || !ia.ativa || !ia.openia_key || !ia.prompt) {
            console.info(JSON.stringify({ ai_dispatch: "skipped", reason: "ia_inactive_or_missing_key", empresaId, contatoId, conexaoId, iaId }));
            continue;
          }
          const delayCfg = { minMs: Number((ia as any).response_delay_min_ms ?? 900), maxMs: Number((ia as any).response_delay_max_ms ?? 2800) };

          const { data: history } = await supabase
            .from("mensagens")
            .select("direcao, conteudo")
            .eq("empresa_id", empresaId)
            .eq("contato_id", contatoId)
            .order("created_at", { ascending: false })
            .limit(20);
          const hist = Array.isArray(history) ? history.slice().reverse() : [];
          const messagesForAi = hist
            .map((h: any) => {
              const dir = String(h?.direcao || "");
              const txt = String(h?.conteudo || "").trim();
              if (!txt) return null;
              return { role: dir === "in" ? ("user" as const) : ("assistant" as const), content: txt };
            })
            .filter(Boolean) as Array<{ role: "user" | "assistant"; content: string }>;

          const aiText = await openAiChat({
            apiKey: String(ia.openia_key || ""),
            prompt: String(ia.prompt || ""),
            messages: messagesForAi,
          }).catch(() => null);

          if (!aiText) {
            console.info(JSON.stringify({ ai_dispatch: "error", reason: "empty_ai_response", empresaId, contatoId, conexaoId, iaId }));
            continue;
          }

          const mCatalog = aiText.match(/^\s*CATALOGO_CARDS\[(.*?)\]\s*$/i);
          if (mCatalog) {
            const term = String(mCatalog[1] || "all").trim() || "all";
            const catResult = await sendCatalogCards({
              empresaId,
              contatoId,
              conexaoId,
              conexaoInfo,
              rjid,
              term,
              suppressNotFoundMessage: true
            }).catch(() => null);
            if (catResult && (catResult as any).notFound) {
              const number = normalizeNumber(rjid);
              const conexao = conexaoInfo || (await resolveConexaoForEmpresa(empresaId, conexaoId));
              if (conexao && number) {
                const text = buildCatalogNotFoundFallback(term);
                  const sent = await sendTextDelayed(conexao, number, text, delayCfg);
                await supabase.from("mensagens").insert({
                  empresa_id: empresaId,
                  contato_id: contatoId,
                  conexao_id: conexaoId,
                  direcao: "out",
                  conteudo: text,
                  status: sent.ok ? "enviado" : "erro",
                  external_id: sent.ok ? extractExternalIdFromEvolutionResponse(sent.body) : null,
                  tipo: "text"
                } as any);
              }
            }
            await markAiDispatched(empresaId, contatoId, extId || null, content).catch(() => null);
            continue;
          }

          {
            const number = normalizeNumber(rjid);
            const conexao = conexaoInfo || (await resolveConexaoForEmpresa(empresaId, conexaoId));
            if (!conexao || !number) continue;
            const sent = await sendTextDelayed(conexao, number, aiText, delayCfg);
            const ext = sent.ok ? extractExternalIdFromEvolutionResponse(sent.body) : null;
            await supabase.from("mensagens").insert({
              empresa_id: empresaId,
              contato_id: contatoId,
              conexao_id: conexaoId,
              direcao: "out",
              conteudo: aiText,
              status: sent.ok ? "enviado" : "erro",
              external_id: ext,
              tipo: "text"
            } as any);
            await markAiDispatched(empresaId, contatoId, extId || null, content).catch(() => null);
            console.info(JSON.stringify({ ai_dispatch: "ok", empresaId, contatoId, conexaoId, iaId }));
          }
        }
      }
      return new Response(JSON.stringify({ ok: true, processed }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const keyId =
      body?.data?.key?.id ||
      body?.data?.data?.key?.id ||
      body?.key?.id ||
      (body as any)?.data?.id ||
      (body as any)?.id;
    if ((event.includes("messages-update") || event.includes("messages.update")) && keyId) {
      const statusUpdate = "enviado";
      await supabase
        .from("mensagens")
        .update({ status: statusUpdate, updated_at: new Date().toISOString() } as any)
        .eq("external_id", keyId);
      return new Response(JSON.stringify({ ok: true, processed: 0, updated: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      ok: true,
      processed: 0,
      reason: "no_messages_detected",
      event: eventRaw,
      instanceName
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

async function getDefaultFaseId(empresaId: string): Promise<string | null> {
  const { data } = await supabase
    .from("fases")
    .select("id")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true })
    .limit(1);
  const empresaPhaseId = data?.[0]?.id ?? null;
  if (empresaPhaseId) return empresaPhaseId;

  const { data: globalData } = await supabase
    .from("fases")
    .select("id")
    .is("empresa_id", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const globalPhaseId = globalData?.[0]?.id ?? null;
  if (globalPhaseId) return globalPhaseId;

  const { data: created } = await supabase
    .from("fases")
    .insert({
      nome: "Lead",
      position: 1,
      cor: "#10B981",
      empresa_id: empresaId
    } as any)
    .select("id")
    .single();
  return (created?.id as string | undefined) ?? null;
}
