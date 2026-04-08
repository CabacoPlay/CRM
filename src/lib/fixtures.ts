import { 
  Connection, 
  QRCodeData, 
  IA, 
  Categoria, 
  CatalogItem, 
  Fase, 
  Contato, 
  Empresa, 
  Usuario,
  BrandingConfig 
} from '@/types';

// Mock QR Code data
export const mockQRData: QRCodeData = {
  base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  pairingCode: "ABCD-1234",
  code: "2@n88PEstKmzOYE9vKIhd0QNalYxrTrlyTWZ4vqgty8="
};

// Conexões mockadas
export const mockConnections: Connection[] = [
  {
    id: '1',
    nome_api: 'WhatsApp Business',
    api_url: 'https://api.whatsapp.com/v1',
    telefone: '+55 11 99999-9999',
    status: 'conectado',
  },
  {
    id: '2', 
    nome_api: 'WhatsApp Multi-Device',
    api_url: 'https://evolution-api.com',
    status: 'desconectado',
  },
  {
    id: '3',
    nome_api: 'WhatsApp Baileys',
    api_url: 'https://baileys-api.herokuapp.com',
    telefone: '+55 11 88888-8888',
    status: 'pendente',
  }
];

// IAs mockadas
export const mockIAs: IA[] = [
  {
    id: '1',
    nome: 'Assistente de Vendas',
    personalidade: 'Formal',
    sexo: 'Feminino',
    prompt: 'Você é um assistente especializado em vendas. Seja cordial, profissional e sempre busque entender as necessidades do cliente para oferecer as melhores soluções.',
    ativa: true,
  }
];

// Categorias mockadas
export const mockCategorias: Categoria[] = [
  {
    id: '1',
    nome: 'Eletrônicos',
    cor: '#3B82F6'
  },
  {
    id: '2',
    nome: 'Consultoria', 
    cor: '#10B981'
  }
];

// Itens do catálogo mockados
export const mockCatalogItems: CatalogItem[] = [
  {
    id: '1',
    tipo: 'Produto',
    nome: 'Smartphone Premium',
    descricao: 'Smartphone com tecnologia avançada e design moderno',
    valor: 1299.99,
    categoria_id: '1',
    ativo: true
  },
  {
    id: '2',
    tipo: 'Serviço', 
    nome: 'Consultoria em Marketing Digital',
    descricao: 'Serviço especializado em estratégias de marketing digital',
    valor: 500.00,
    categoria_id: '2',
    ativo: true
  }
];

// Fases do CRM mockadas
export const mockFases: Fase[] = [
  {
    id: '1',
    nome: 'Novo',
    position: 1,
    cor: '#F59E0B'
  },
  {
    id: '2',
    nome: 'Em Progresso',
    position: 2, 
    cor: '#3B82F6'
  },
  {
    id: '3',
    nome: 'Concluído',
    position: 3,
    cor: '#10B981'
  }
];

// Contatos mockados
export const mockContatos: Contato[] = [
  {
    id: '1',
    nome: 'João Silva',
    contato: '+55 11 99999-1111',
    resumo: 'Cliente interessado em smartphone premium. Demonstrou interesse em parcelamento.',
    profile_img_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=joao',
    fase_id: '1'
  },
  {
    id: '2',
    nome: 'Maria Santos',
    contato: '+55 11 88888-2222', 
    resumo: 'Empresa buscando consultoria em marketing digital para expansão online.',
    profile_img_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria',
    fase_id: '2',
  },
  {
    id: '3',
    nome: 'Carlos Oliveira',
    contato: '+55 11 77777-3333',
    resumo: 'Comprou smartphone premium. Processo finalizado com sucesso.',
    profile_img_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=carlos',
    fase_id: '3', 
    
  }
];

// Empresas mockadas (Admin)
export const mockEmpresas: Empresa[] = [
  {
    id: '1',
    nome: 'TechCorp Solutions',
    telefone: '+55 11 3333-4444',
    responsavel: 'Ana Costa',
    ativa: true,
    criado_em: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    nome: 'Digital Marketing Pro',
    telefone: '+55 11 5555-6666',
    responsavel: 'Roberto Lima',
    ativa: true,
    criado_em: '2024-01-05T00:00:00Z'
  }
];

// Usuários mockados (Admin)
export const mockUsuarios: Usuario[] = [
  {
    id: '1',
    nome: 'Ana Costa',
    telefone: '+55 11 99999-0001',
    email: 'ana@techcorp.com',
    empresa_id: '1',
    papel: 'owner'
  },
  {
    id: '2',
    nome: 'Roberto Lima',
    telefone: '+55 11 99999-0002', 
    email: 'roberto@digitalmarketing.com',
    empresa_id: '2',
    papel: 'admin'
  },
  {
    id: '3',
    nome: 'Carlos Mendes',
    telefone: '+55 11 99999-0003',
    email: 'carlos@techcorp.com', 
    empresa_id: '1',
    papel: 'cliente'
  }
];

// Configuração de branding padrão
export const defaultBranding: BrandingConfig = {
  system_name: 'Automoção',
  logo_url: '',
  logo_url_light: '',
  logo_url_dark: 'https://rhmxylgoxqafgcbfbdaa.supabase.co/storage/v1/object/public/branding/logo_1764020683521.png',
  primary_color: '#17a15a',
  secondary_color: '#46a071'
};
