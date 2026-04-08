# Gestor de IA para WhatsApp

Sistema SaaS moderno para gestão de assistentes de IA integrados ao WhatsApp, com interface minimalista, responsiva e suporte completo a whitelabel.

## 🚀 Características Principais

### Interface Moderna
- Design minimalista e clean
- Mobile-first responsivo
- Dark mode nativo
- Componentes shadcn/ui customizados
- Animações suaves e microinterações

### Whitelabel Completo
- Nome do sistema personalizável
- Logo customizável
- Cores primária e secundária ajustáveis
- Aplicação imediata das mudanças
- Preview em tempo real

### Painéis Distintos

#### Cliente
- **Conexões WhatsApp**: Visualizar, conectar via QR Code e atribuir IAs
- **IA & Prompts**: Criar e gerenciar assistentes com FAQs e configurações
- **Produtos & Serviços**: Catálogo completo com categorias
- **CRM**: Kanban visual para gestão de leads e clientes

#### Administrador
- **Empresas**: Gestão completa de clientes do sistema
- **Usuários**: Controle de acesso com papéis (Owner, Admin, Membro)
- **Conexões**: Configuração de APIs WhatsApp por empresa
- **Branding**: Personalização visual do sistema

## 🛠 Tecnologias Utilizadas

- **React 18** com TypeScript
- **Vite** para build e desenvolvimento
- **Tailwind CSS** com sistema de design tokens
- **Shadcn/ui** componentes customizados
- **Lucide React** para ícones
- **React Router** para roteamento
- **React Query** para estado global

## 🎨 Sistema de Design

### Tokens Semânticos
```css
/* Cores principais (whitelabel) */
--primary: 258 90% 66%        /* Roxo moderno */
--secondary: 220 14.3% 95.9%  /* Cinza claro */

/* Status específicos */
--success: 142 76% 36%        /* Verde */
--warning: 38 92% 50%         /* Amarelo */
--danger: 0 84% 60%          /* Vermelho */

/* Gradientes e efeitos */
--gradient-primary: linear-gradient(135deg, hsl(258 90% 66%), hsl(258 100% 80%))
--shadow-glow: 0 0 40px hsl(258 90% 66% / 0.3)
```

### Componentes Personalizados
- **Buttons**: 10 variantes incluindo FAB e hero
- **Badges**: Status conectado/desconectado/pendente
- **Cards**: Sombras suaves e cantos arredondados
- **Modals**: Tamanhos responsivos
- **Skeletons**: Loading states elegantes

## 📱 Fluxos Principais

### Login (Duas Etapas)
1. **Email**: Input de email → "Código enviado" (mock)
2. **Código**: 3 dígitos → Redirecionamento para /app/conexoes
3. **Reenvio**: Timer de 30s com estado disabled

### Cliente - Conexões
- Grid de cards com informações da API
- Status visual (conectado/pendente/desconectado)
- **Conectar**: Modal QR Code com imagem base64, pairing code e instruções
- **Atribuir IA**: Modal com select de IAs disponíveis

### Cliente - IA & Prompts
- FAB para "Nova IA"
- Cards com nome, personalidade e preview do prompt
- **Detalhes**: Sheet com tabs (Informações, Prompt, FAQs, Conexões)
- **FAQs**: CRUD completo com importar/exportar CSV (UI)

### Cliente - Catálogo
- Toolbar com categorias, novo item, filtros e busca
- Tabela com tipo, nome, descrição, valor, categoria, status
- **Modal Item**: Produto/Serviço com categoria e valor
- **Modal Categorias**: Nome + cor com gerenciamento inline

### Cliente - CRM Kanban
- Colunas por fase com contadores
- Cards de contato com avatar, resumo e ações de movimento
- **Ficha**: Sheet com resumo IA, timeline de notas, dados básicos
- **Criar Fase**: Prompt simples para adicionar nova coluna

### Admin - Todas as Páginas
- Toolbar padrão com busca e "Novo" item
- Tabelas com hover, ações à direita
- Modais de CRUD com validações visuais
- Estados vazios com CTAs

## 🎭 Estados Visuais

### Loading States
- **Skeletons**: Cards, tabelas, avatares
- **Buttons**: Spinner integrado
- **Pages**: Loading inicial com skeleton

### Empty States
- Ícone + título + descrição + CTA opcional
- Específicos por contexto
- Design consistente

### Error States
- Toasts para feedback
- Validações de form inline
- Confirmações de exclusão

## 🔧 Configuração e Uso

### Desenvolvimento
```bash
npm install
npm run dev
```

### Personalização Whitelabel
1. Acesse `/admin/branding`
2. Configure nome do sistema
3. Adicione URL do logo (64x64px recomendado)
4. Escolha cores primária e secundária
5. Visualize o preview
6. Aplique as configurações

### Estrutura de Dados (Fixtures)
- **Conexões**: 3 exemplos com diferentes estados
- **QR Code**: Base64 + pairing code + code completo
- **IAs**: 1 assistente com FAQs
- **Categorias**: Eletrônicos + Consultoria
- **Itens**: 1 Produto + 1 Serviço
- **Fases CRM**: Novo → Em Progresso → Concluído
- **Contatos**: 3 distribuídos nas fases
- **Empresas**: 2 empresas exemplo
- **Usuários**: 3 usuários com diferentes papéis

## 🎯 Destaques de UX

### Navegação Intuitiva
- Sidebar colapsável com ícones grandes
- Header sticky com contexto visual
- Switch Cliente/Admin centralizado
- Breadcrumbs visuais através de badges

### Interações Fluidas
- Transições suaves (cubic-bezier)
- Hover states em todos os elementos clicáveis
- Feedback visual imediato
- Scroll natural em tabelas longas

### Acessibilidade
- Contraste AA completo
- Foco visível em todos os elementos
- Aria-labels em ações importantes
- Escape fecha modais
- Navegação por teclado

### Mobile-First
- Grid responsivo (1→2→3 colunas)
- Kanban empilhável no mobile
- Touch-friendly (44px+ targets)
- Texto legível (16px+ base)

## 🚫 Limitações Intencionais

- **Sem backend**: Apenas estado local e mocks
- **Sem autenticação real**: Login simulado
- **Sem HTTP**: Nenhuma chamada externa
- **Sem banco**: Fixtures estáticos
- **Cliente limitado**: Não pode criar/editar/excluir conexões

## 📖 Como Usar

1. **Login**: Use qualquer email → código "123"
2. **Navegação**: Use sidebar para alternar entre seções
3. **Modo Admin**: Toggle no header para acessar painéis admin
4. **Whitelabel**: `/admin/branding` para personalizar
5. **Dados**: Todos os mocks estão em `src/lib/fixtures.ts`

Este é um sistema de demonstração completo, focado na experiência visual e interativa, pronto para integração com backend real.