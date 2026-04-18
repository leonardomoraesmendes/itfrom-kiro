# AP Automation — Automação do Processo de Contas a Pagar

## Visão Geral

Sistema integrado de Automação de Contas a Pagar (AP Automation) que substitui o fluxo manual e fragmentado por uma solução que centraliza recebimento de documentos fiscais, automatiza extração via OCR/IDP, implementa workflow formal de aprovação com alçadas, integra-se ao ERP corporativo e fornece dashboards operacionais/gerenciais com trilha auditável completa.

### Principais Capacidades

| Capacidade | Descrição |
|---|---|
| Canal Único de Recebimento | Upload, e-mail e API com protocolo único sequencial |
| Captura Inteligente (OCR/IDP) | Extração automática de dados com índice de confiança |
| Validações e Anti-duplicidade | Regras de negócio + detecção de duplicatas (tolerância 1%) |
| Workflow de Aprovação | Alçadas configuráveis, escalação automática, SoD |
| Fila Operacional com SLA | Priorização por risco/vencimento, rastreamento de SLA |
| Integração ERP | Registro bidirecional com reprocessamento |
| Dashboard Gerencial | KPIs operacionais/gerenciais, previsão de pagamentos |
| Trilha de Auditoria | Registro imutável (append-only) de todas as ações |

---

## Arquitetura

### Visão de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (SPA - React)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Painel AP│ │  Intake  │ │ Integr.  │ │Dashboard │  ...       │
│  │          │ │Documentos│ │   ERP    │ │Gerencial │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │             │            │             │                 │
│  ┌────┴─────────────┴────────────┴─────────────┴─────┐          │
│  │              Zustand Stores + API Client           │          │
│  └────────────────────────┬──────────────────────────┘          │
└───────────────────────────┼──────────────────────────────────────┘
                            │ HTTP (Vite Proxy /api → :3000)
┌───────────────────────────┼──────────────────────────────────────┐
│                    Backend (Fastify)                              │
│  ┌────────────────────────┴──────────────────────────┐           │
│  │           API Gateway + OpenAPI + CORS             │           │
│  │           Auth Middleware (Bearer + RBAC)           │           │
│  └────┬───────┬───────┬───────┬───────┬───────┬──────┘           │
│       │       │       │       │       │       │                  │
│  ┌────┴──┐┌───┴──┐┌───┴───┐┌─┴───┐┌──┴──┐┌───┴───┐┌─────────┐  │
│  │ Doc   ││ OCR  ││Valid. ││Work ││Queue││ ERP   ││Dashboard│  │
│  │Service││Serv. ││Serv.  ││flow ││Serv.││Connec.││ Service │  │
│  └───┬───┘└──────┘└───────┘└──┬──┘└─────┘└───┬───┘└─────────┘  │
│      │                        │              │                   │
│  ┌───┴────────────────────────┴──────────────┴───────────────┐   │
│  │              Audit Service (Append-Only)                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Notification Service                          │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
         ┌────┴───┐  ┌─────┴────┐  ┌─────┴────┐
         │  ERP   │  │ OCR/IDP  │  │  E-mail  │
         │Corpor. │  │ Provider │  │ Gateway  │
         └────────┘  └──────────┘  └──────────┘
```

### Fluxo Principal do Processo

```
Recebimento → Captura OCR/IDP → Validações → Workflow Aprovação → Integração ERP → Dashboard
     │              │                │              │                    │
     └──────────────┴────────────────┴──────────────┴────────────────────┘
                              Trilha de Auditoria (append-only)
```

### Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Fluent UI v9, Zustand, React Router, Vite |
| Backend | Fastify 4, TypeScript, OpenAPI/Swagger |
| Tipos Compartilhados | TypeScript (workspace `shared/`) |
| Testes | Vitest, fast-check (PBT), Testing Library |
| Monorepo | npm workspaces |
| Autenticação | OAuth 2.0 / OIDC (MVP: Bearer token base64) |
| Criptografia | TLS 1.2+, AES-256-GCM |

---

## Estrutura do Projeto

```
ap-automation/
├── shared/                          # Tipos e validação compartilhados
│   └── src/
│       ├── types/
│       │   ├── document.ts          # DocumentoFiscal, ItemLinha, Imposto, etc.
│       │   ├── audit.ts             # AuditEntry, AuditActionType, AuditFilters
│       │   ├── config.ts            # AlcadaConfig, SLAConfig, SoDRule
│       │   ├── auth.ts              # UserProfile, Permission
│       │   ├── services.ts          # Interfaces de todos os serviços
│       │   └── common.ts            # PaginatedResult<T>
│       └── validation/
│           ├── documento-fiscal-schema.ts   # JSON Schema (AJV)
│           └── documento-fiscal-validator.ts # validate/parse functions
│
├── backend/                         # API Fastify
│   └── src/
│       ├── index.ts                 # Entry point (porta 3000)
│       ├── app.ts                   # Fastify app builder + plugins
│       ├── container.ts             # Service container (DI)
│       ├── config/
│       │   └── security.ts          # TLS, AES-256, security headers
│       ├── middleware/
│       │   └── auth.ts              # Autenticação + RBAC
│       ├── routes/
│       │   ├── documents.ts         # POST/GET /documents
│       │   ├── ocr.ts               # POST /ocr/extract, GET /ocr/status
│       │   ├── validation.ts        # POST /validation/validate|duplicate|resolve
│       │   ├── workflow.ts          # POST /workflow/submit|approve|reject|return|escalate
│       │   ├── queue.ts             # GET /queue/:id, PUT /queue/reassign
│       │   ├── erp.ts               # POST /erp/register|reprocess|sync
│       │   ├── dashboard.ts         # GET /dashboard/operational|management|forecast|audit|export
│       │   └── audit.ts             # GET /audit
│       └── services/
│           ├── audit-service.ts     # Trilha imutável (append-only)
│           ├── document-service.ts  # Recebimento + classificação
│           ├── ocr-service.ts       # Extração OCR/IDP (mock)
│           ├── validation-service.ts # Regras de negócio + anti-duplicidade
│           ├── workflow-service.ts  # Aprovação com alçadas + SoD
│           ├── queue-service.ts     # Fila operacional + SLA
│           ├── erp-connector.ts     # Integração ERP (mock)
│           ├── dashboard-service.ts # KPIs + exportação
│           └── notification-service.ts # Notificações SLA
│
├── frontend/                        # SPA React + Fluent UI
│   └── src/
│       ├── main.tsx                 # Entry point
│       ├── App.tsx                  # Router + Layout + Sidebar
│       ├── api/
│       │   └── client.ts           # HTTP client com auth interceptor
│       ├── stores/
│       │   ├── documents.ts        # Zustand store — documentos
│       │   ├── queue.ts            # Zustand store — fila operacional
│       │   ├── approvals.ts        # Zustand store — aprovações
│       │   └── dashboard.ts        # Zustand store — dashboard
│       ├── containers/
│       │   ├── PainelAPPage.tsx     # Painel AP conectado
│       │   ├── IntakeDocumentosPage.tsx
│       │   ├── IntegracaoERPPage.tsx
│       │   └── DashboardGerencialPage.tsx
│       ├── pages/                   # Componentes de página (presentational)
│       │   ├── PainelAP.tsx
│       │   ├── IntakeDocumentos.tsx
│       │   ├── CapturaValidacao.tsx
│       │   ├── ValidacoesAntiDuplicidade.tsx
│       │   ├── AprovacaoAlcadas.tsx
│       │   ├── FilaOperacional.tsx
│       │   ├── IntegracaoERP.tsx
│       │   └── DashboardGerencial.tsx
│       └── components/              # Componentes reutilizáveis
│           ├── KPICard.tsx
│           ├── StatusTable.tsx
│           ├── AlertsPanel.tsx
│           ├── DocumentHeader.tsx
│           ├── AssistedReviewForm.tsx
│           ├── JustificationModal.tsx
│           ├── HistoryTimeline.tsx
│           └── IntegrationBadge.tsx
│
└── .kiro/specs/ap-automation/       # Especificação do projeto
    ├── requirements.md
    ├── design.md
    └── tasks.md
```

---

## Serviços de Domínio

### 1. Audit Service (Trilha de Auditoria)

Registro imutável append-only de todas as ações do sistema.

- `log(entry)` — registra ação com usuário, timestamp (precisão de segundos), tipo, documento, valores antes/depois
- `query(filters)` — consulta com paginação e filtros (período, usuário, tipo, documento)
- Sem endpoints de UPDATE ou DELETE (imutabilidade garantida)
- Entries são congeladas com `Object.freeze()`

### 2. Document Service (Recebimento)

Ciclo de vida do documento fiscal desde o recebimento.

- `receiveDocument(file, channel)` — valida formato (PDF/XML/JPEG/PNG) e tamanho (≤25MB), gera Protocolo Único (`AP-YYYYMMDD-NNNNNN`)
- `receiveBatch(files, channel)` — processamento individual em lote
- `classifyDocument()` — classificação automática (nota_fiscal, boleto, fatura)
- Registra recebimento na trilha de auditoria

### 3. OCR/IDP Service (Extração)

Extração inteligente de dados estruturados.

- `extractData(protocoloUnico, buffer)` — extrai 8 campos obrigatórios com índice de confiança
- Campos com confiança < 85% marcados como `requerRevisao: true`
- Interface `ExternalOCRProvider` para integração com provedor real

### 4. Validation Service (Validações)

Regras de negócio e detecção de duplicidade.

- Regras: consistência CNPJ, validade data vencimento, coerência valor total vs. itens, existência fornecedor
- Anti-duplicidade: mesmo CNPJ + mesmo número + valor dentro de tolerância de 1%
- `resolveException()` com justificativa obrigatória

### 5. Workflow Service (Aprovação)

Workflow formal com alçadas configuráveis.

- Roteamento automático por valor vs. alçada do aprovador
- Segregação de Funções (SoD): quem registrou não aprova; quem aprovou não registra no ERP
- Escalação automática para nível hierárquico superior
- Justificativa obrigatória para rejeição/devolução
- Bloqueio de aprovações fora do workflow formal

### 6. Queue Service (Fila Operacional)

Gestão priorizada com rastreamento de SLA.

- Ordenação: vencido → alerta → dentro_prazo, depois por proximidade de vencimento
- SLA: < 80% = dentro_prazo, ≥ 80% e ≤ 100% = alerta, > 100% = vencido
- Destaque de exceções (validação reprovada, devolução, erro integração)

### 7. ERP Connector (Integração)

Integração bidirecional com ERP corporativo.

- `registerDocument()` — envia dados ao ERP, atualiza status
- `reprocessDocument()` — reenvio para itens com erro
- `syncPaymentStatus()` — consulta periódica de status de pagamento
- KPIs de integração (taxa de sucesso, erros, reprocessamento)

### 8. Dashboard Service (KPIs)

KPIs operacionais e gerenciais.

- Operacional: volume por etapa, taxa de exceções, tempo médio, itens vencidos SLA
- Gerencial: previsão 30 dias, tendências, taxa de automação, duplicatas evitadas
- Exportação CSV e PDF
- Trilha de auditoria com filtros

---

## API REST

Base URL: `http://localhost:3000/api`

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/documents` | Receber documento fiscal |
| POST | `/documents/batch` | Receber documentos em lote |
| GET | `/documents/:id` | Obter documento por protocolo |
| GET | `/documents` | Listar documentos com filtros |
| POST | `/ocr/extract/:id` | Iniciar extração OCR |
| GET | `/ocr/status/:id` | Status da extração |
| POST | `/validation/validate/:id` | Executar validações |
| POST | `/validation/duplicate/:id` | Verificar duplicidade |
| POST | `/validation/resolve/:id` | Resolver exceção |
| POST | `/workflow/submit/:id` | Submeter para aprovação |
| POST | `/workflow/approve/:id` | Aprovar documento |
| POST | `/workflow/reject/:id` | Rejeitar documento |
| POST | `/workflow/return/:id` | Devolver para correção |
| POST | `/workflow/escalate/:id` | Escalar aprovação |
| GET | `/workflow/sod/:id/:userId` | Verificar conflito SoD |
| GET | `/queue/:analistaId` | Obter fila do analista |
| PUT | `/queue/reassign/:id` | Reatribuir item |
| GET | `/queue/kpis/:analistaId` | KPIs da fila |
| POST | `/erp/register/:id` | Registrar no ERP |
| POST | `/erp/reprocess/:id` | Reprocessar integração |
| POST | `/erp/sync` | Sincronizar status pagamento |
| GET | `/erp/kpis` | KPIs de integração |
| GET | `/erp/transactions` | Transações recentes |
| GET | `/dashboard/operational` | KPIs operacionais |
| GET | `/dashboard/management` | KPIs gerenciais |
| GET | `/dashboard/forecast/:periodo` | Previsão de pagamentos |
| GET | `/dashboard/audit` | Trilha de auditoria |
| GET | `/dashboard/export` | Exportar dados (CSV/PDF) |
| GET | `/audit` | Consultar auditoria |
| GET | `/health` | Health check |

Documentação interativa: `http://localhost:3000/docs`

---

## Modelo de Dados Principal

```typescript
interface DocumentoFiscal {
  protocoloUnico: string;        // AP-YYYYMMDD-NNNNNN
  cnpjEmitente: string;          // 14 dígitos
  cnpjDestinatario: string;      // 14 dígitos
  numeroDocumento: string;
  dataEmissao: Date;
  dataVencimento: Date;
  valorTotal: number;            // centavos (inteiro)
  itensLinha: ItemLinha[];
  impostos: Imposto[];
  tipoDocumento: 'nota_fiscal' | 'boleto' | 'fatura';
  canalOrigem: 'email' | 'upload' | 'api';
  status: DocumentStatus;        // 12 estados possíveis
  indiceConfiancaPorCampo: Record<string, number>;
}
```

**Status possíveis:** recebido → em_extracao → aguardando_revisao → em_validacao → aguardando_aprovacao → aprovado → registrado_erp → pago (ou rejeitado / devolvido / erro_integracao / cancelado)

---

## Segurança

### Autenticação e Autorização (RBAC)

| Perfil | Permissões |
|---|---|
| Analista AP | documento.receber, documento.revisar, documento.validar, fila.visualizar |
| Aprovador | documento.aprovar, documento.rejeitar, documento.devolver, fila.visualizar |
| Tesouraria | dashboard.operacional, dashboard.gerencial, dados.exportar |
| Controladoria | auditoria.consultar, dashboard.operacional, dashboard.gerencial, dados.exportar |
| Administrador | Todas as permissões |

### Segregação de Funções (SoD)

- Quem registrou o documento **não pode** aprová-lo
- Quem aprovou o documento **não pode** registrá-lo no ERP
- Violações são bloqueadas e registradas na trilha de auditoria

### Criptografia

- TLS 1.2+ para dados em trânsito
- AES-256-GCM para dados sensíveis em repouso
- Security headers (HSTS, CSP, X-Frame-Options, etc.)

---

## Propriedades de Corretude (Property-Based Testing)

| # | Propriedade | Validação |
|---|---|---|
| 1 | Round-trip de serialização | `JSON.parse(JSON.stringify(doc))` produz objeto equivalente |
| 2 | Segregação de Funções | Quem registrou não aprova; quem aprovou não registra no ERP |
| 3 | Detecção de duplicidade | Tolerância de 1% no valor com mesmo CNPJ e número |
| 4 | Rastreamento de SLA | < 80% = dentro_prazo, ≥ 80% = alerta, > 100% = vencido |
| 5 | Imutabilidade da auditoria | Registros só crescem, nunca são alterados ou removidos |

---

## Testes

### Cobertura

| Workspace | Arquivos de Teste | Total de Testes |
|---|---|---|
| shared | 3 | 23 |
| backend | 17 | 237 |
| frontend | 17 | 175 |
| **Total** | **37** | **435** |

### Tipos de Teste

- **Unitários** — validação de cada serviço e componente isoladamente
- **Property-Based (PBT)** — 5 propriedades formais com fast-check (100-300 runs cada)
- **Integração** — fluxo completo Intake → OCR → Validação → Aprovação → ERP
- **Componentes** — Testing Library para todos os componentes React

### Executar Testes

```bash
# Todos os workspaces
npm test

# Workspace específico
npm test --workspace=@ap-automation/backend
npm test --workspace=@ap-automation/frontend
npm test --workspace=@ap-automation/shared
```

---

## Como Executar

### Pré-requisitos

- Node.js 18+
- npm 9+

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
# Terminal 1 — Backend (porta 3000)
cd backend && npx tsx src/index.ts

# Terminal 2 — Frontend (porta 5173)
cd frontend && npx vite
```

### URLs

| Serviço | URL |
|---|---|
| Frontend (SPA) | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| OpenAPI Docs | http://localhost:3000/docs |
| Health Check | http://localhost:3000/health |

---

## Telas do Frontend

| # | Tela | Rota | Descrição |
|---|---|---|---|
| 1 | Painel AP | `/painel` | KPIs operacionais, alertas, documentos críticos |
| 2 | Intake de Documentos | `/intake` | Upload drag & drop, lista de documentos recebidos |
| 3 | Captura e Validação | — | Split-view OCR com índice de confiança |
| 4 | Validações | — | Regras de negócio e anti-duplicidade |
| 5 | Aprovação com Alçadas | — | Aprovação formal com SoD e SLA countdown |
| 6 | Fila Operacional | — | Priorização por SLA com filtros avançados |
| 7 | Integração ERP | `/erp` | KPIs de integração, reprocessamento |
| 8 | Dashboard Gerencial | `/dashboard` | KPIs gerenciais, auditoria, exportação |

---

## Componentes Reutilizáveis

| Componente | Descrição |
|---|---|
| KPICard | Card com valor, label, tendência e cor semântica |
| StatusTable | Tabela com ordenação, paginação, chips de status e SLA |
| AlertsPanel | Painel de alertas com severidade (WCAG: cor nunca como único indicador) |
| DocumentHeader | Header financeiro (valor, fornecedor, vencimento, centro de custo) |
| AssistedReviewForm | Split-view com preview + formulário editável |
| JustificationModal | Modal com textarea obrigatória e confirmação |
| HistoryTimeline | Timeline vertical de eventos do documento |
| IntegrationBadge | Badge de status de integração ERP |

---

## Decisões Arquiteturais

| Decisão | Escolha | Justificativa |
|---|---|---|
| Frontend | React + Fluent UI v9 | Componentes acessíveis nativos, Fluent Design System |
| State Management | Zustand | Leve, sem boilerplate, ideal para stores simples |
| API | REST + OpenAPI (Fastify) | Interoperabilidade com ERP, documentação automática |
| Autenticação | OAuth 2.0 / OIDC + RBAC | Padrão corporativo, segregação de funções |
| Trilha de Auditoria | Append-only (imutável) | Conformidade regulatória |
| OCR/IDP | Serviço externo via API | Flexibilidade de provedor |
| Banco de Dados | PostgreSQL (planejado) | ACID, JSON, maturidade |
| Criptografia | TLS 1.2+ / AES-256 | Requisitos de segurança |
| Monorepo | npm workspaces | Tipos compartilhados, build unificado |
| Testes | Vitest + fast-check | Rápido, PBT nativo, compatível com Testing Library |

---

## Docker

### Arquivos

| Arquivo | Descrição |
|---|---|
| `backend/Dockerfile` | Multi-stage: deps → build → runtime com Node.js 20 Alpine + tsx |
| `frontend/Dockerfile` | Multi-stage: deps → Vite build → nginx 1.27 Alpine para servir SPA |
| `frontend/nginx.conf` | Proxy reverso `/api/` → backend, SPA fallback, gzip, cache |
| `docker-compose.yml` | Orquestra backend + frontend com health check |
| `.dockerignore` | Exclui node_modules, testes, docs do contexto de build |

### Subir com Docker Compose

```bash
# Build e start
docker-compose up --build

# Em background
docker-compose up --build -d

# Parar
docker-compose down
```

### URLs (Docker)

| Serviço | URL |
|---|---|
| Frontend (SPA) | http://localhost |
| Backend API (direto) | http://localhost:3000 |
| OpenAPI Docs (via frontend) | http://localhost/docs |
| Health Check | http://localhost/health |

### Build Individual

```bash
# Backend
docker build -f backend/Dockerfile -t ap-automation-backend .

# Frontend
docker build -f frontend/Dockerfile -t ap-automation-frontend .
```

---

## Licença

Projeto interno — uso restrito.
