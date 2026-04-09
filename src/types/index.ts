export interface Connection {
  id: string;
  nome_api: string;
  api_url: string;
  telefone?: string;
  apikey?: string;
  globalkey?: string;
  status: 'desconectado' | 'pendente' | 'conectado';
  empresa_id?: string;
  id_ia?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QRCodeData {
  base64: string;
  pairingCode: string;
  code: string;
}

export interface IA {
  id: string;
  nome: string;
  personalidade: 'Formal' | 'Informal' | 'Casual';
  prompt: string;
  sexo: 'Masculino' | 'Feminino';
  profile_img_url?: string;
  ativa: boolean;
  vision_ativo?: boolean;
  whisper_ativo?: boolean;
  rag_ativo?: boolean;
  openia_key?: string;
  msg_reativacao?: string;
  empresa_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FAQ {
  id: string;
  pergunta: string;
  resposta: string;
  ia_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface Categoria {
  id: string;
  nome: string;
  cor: string;
  empresa_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogItem {
  id: string;
  tipo: 'Produto' | 'Serviço';
  nome: string;
  descricao?: string;
  valor: number;
  categoria_id: string;
  ativo: boolean;
  empresa_id?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  categoria?: {
    nome: string;
    cor: string;
  };
}

export interface Fase {
  id: string;
  nome: string;
  position: number;
  cor: string;
  empresa_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Contato {
  id: string;
  nome: string;
  contato: string;
  resumo?: string;
  profile_img_url?: string;
  fase_id: string;
  conexao_id?: string;
  observacoes_ia?: string;
  empresa_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Nota {
  id: string;
  texto: string;
  contato_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  telefone: string;
  responsavel: string;
  ativa: boolean;
  criado_em: string;
  logo_url?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  empresa_id: string;
  papel: 'owner' | 'admin' | 'cliente';
  avatar_url?: string;
}

export interface BrandingConfig {
  id?: string;
  system_name: string;
  logo_url: string;
  logo_url_light?: string;
  logo_url_dark?: string;
  primary_color: string;
  secondary_color: string;
}

export type UserMode = 'client' | 'admin';
