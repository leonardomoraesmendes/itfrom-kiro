# Plano de Implementação: Automação do Processo de Contas a Pagar (AP Automation)

## Visão Geral

Este plano converte o design do sistema AP Automation em tarefas incrementais de codificação. A implementação segue a ordem: modelos de dados e tipos → serviços de domínio → componentes reutilizáveis → telas do frontend → integração e wiring. Cada tarefa referencia requisitos específicos para rastreabilidade. A linguagem de implementação é TypeScript (React + Fluent UI v9 no frontend, TypeScript no backend).

## Tarefas

- [x] 1. Configurar estrutura do projeto e definir tipos e interfaces core
  - [x] 1.1 Criar estrutura de diretórios do projeto (frontend e backend)
    - Configurar monorepo ou workspaces com pastas `frontend/`, `backend/`, `shared/`
    - Configurar TypeScript, ESLint, Prettier e framework de testes (Vitest ou Jest)
    - Instalar dependências: React, Fluent UI v9, Zustand/Redux Toolkit, Express/Fastify
    - _Requisitos: 9.1, 9.6_

  - [x] 1.2 Definir tipos e interfaces compartilhados (`shared/types/`)
    - Criar `DocumentoFiscal`, `ItemLinha`, `Imposto`, `DocumentStatus`, `ProcessStage`
    - Criar `AlcadaConfig`, `SLAConfig`, `SoDRule`, `UserProfile`, `Permission`
    - Criar `AuditEntry`, `AuditEntryInput`, `AuditActionType`, `AuditFilters`
    - Criar tipos auxiliares: `DocumentChannel`, `DocumentType`, `DocumentFilters`, `PaginatedResult`
    - _Requisitos: 1.1, 2.2, 10.1, 10.2_

  - [x] 1.3 Implementar JSON Schema de validação do DocumentoFiscal
    - Criar schema JSON conforme especificação do design (padrão protocoloUnico, CNPJ, etc.)
    - Implementar funções `validateDocumentoFiscal(json)` e `parseDocumentoFiscal(json)` com mensagens de erro descritivas por campo
    - _Requisitos: 10.1, 10.2, 10.5_

  - [x] 1.4 Escrever teste de propriedade para round-trip de serialização
    - **Propriedade 1: Round-trip de serialização/desserialização**
    - Para qualquer `DocumentoFiscal` válido, `JSON.parse(JSON.stringify(doc))` deve produzir objeto equivalente ao original
    - Serializar → desserializar → serializar novamente deve produzir JSON idêntico
    - **Valida: Requisitos 2.7, 10.4**

  - [x] 1.5 Escrever testes unitários para validação de schema
    - Testar rejeição de CNPJ inválido, protocoloUnico fora do padrão, campos obrigatórios ausentes
    - Testar mensagens de erro descritivas para cada tipo de violação
    - _Requisitos: 10.5_

- [x] 2. Implementar Audit Service (Trilha de Auditoria)
  - [x] 2.1 Implementar interface `IAuditService` e serviço de auditoria
    - Criar tabela append-only no PostgreSQL (INSERT only, sem UPDATE/DELETE)
    - Implementar método `log(entry)` que registra ação com usuário, data/hora (precisão de segundos), tipo de ação, documento afetado, valores anteriores/posteriores
    - Implementar método `query(filters)` com paginação e filtros por período, usuário, tipo de ação, documento
    - Garantir imutabilidade: nenhum endpoint de alteração ou exclusão de registros
    - _Requisitos: 8.1, 8.2, 8.7_

  - [x] 2.2 Escrever teste de propriedade para imutabilidade da trilha de auditoria
    - **Propriedade 5: Imutabilidade da trilha de auditoria**
    - Para qualquer sequência de operações de log, o número de registros só pode crescer (nunca diminuir)
    - Nenhuma operação deve alterar registros existentes
    - **Valida: Requisitos 8.1, 8.2**

  - [x] 2.3 Escrever testes unitários do Audit Service
    - Testar registro com todos os campos obrigatórios
    - Testar filtros de consulta (período, usuário, tipo de ação)
    - Testar que destaque é registrado para overrides
    - _Requisitos: 8.1, 8.3, 8.7_

- [x] 3. Implementar Document Service (Serviço de Documentos)
  - [x] 3.1 Implementar interface `IDocumentService`
    - Implementar `receiveDocument(file, channel)` com geração de Protocolo_Unico sequencial
    - Implementar `receiveBatch(files, channel)` para upload em lote
    - Implementar validação de formato (PDF, XML, JPEG, PNG) e tamanho máximo (25 MB)
    - Implementar `classifyDocument(protocoloUnico)` para classificação automática de tipo
    - Implementar `getDocument()` e `listDocuments()` com filtros e paginação
    - Registrar recebimento na Trilha de Auditoria
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 3.2 Escrever testes unitários do Document Service
    - Testar geração de Protocolo_Unico único por documento
    - Testar rejeição de formatos não suportados com mensagem descritiva
    - Testar rejeição de arquivos acima de 25 MB
    - Testar processamento individual em upload em lote
    - _Requisitos: 1.1, 1.2, 1.5, 1.6_

- [x] 4. Implementar OCR/IDP Service (Motor de Extração)
  - [x] 4.1 Implementar interface `IOCRService`
    - Implementar `extractData(protocoloUnico, buffer)` que chama serviço externo de OCR via API
    - Implementar `getExtractionStatus(protocoloUnico)` para consulta de status
    - Garantir início do processamento em até 60 segundos após recebimento
    - Marcar campos com `indiceConfianca < 85` como `requerRevisao: true`
    - Extrair campos obrigatórios: CNPJ emitente/destinatário, número documento, datas, valor total, itens, impostos
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 9.3_

  - [x] 4.2 Escrever testes unitários do OCR/IDP Service
    - Testar marcação de campos com confiança < 85% como `requerRevisao: true`
    - Testar extração de todos os campos obrigatórios
    - Testar tratamento de falha do serviço externo
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Implementar Validation Service (Motor de Validação)
  - [x] 5.1 Implementar interface `IValidationService`
    - Implementar `validateDocument(doc)` com regras: consistência CNPJ, validade data vencimento, coerência valor total vs. soma itens, existência fornecedor no ERP
    - Implementar `checkDuplicate(doc)` com critérios: mesmo CNPJ emitente + mesmo número documento + valor dentro de tolerância de 1%
    - Implementar `resolveException(protocoloUnico, decision)` com justificativa obrigatória
    - Registrar todas as decisões na Trilha de Auditoria
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 5.2 Escrever teste de propriedade para detecção de duplicidade
    - **Propriedade 3: Detecção de duplicidade com tolerância de 1%**
    - Para dois documentos com mesmo CNPJ emitente e mesmo número, se `|valorA - valorB| / max(valorA, valorB) <= 0.01`, então `checkDuplicate` deve retornar `duplicataDetectada: true`
    - Se a diferença de valor exceder 1%, não deve ser detectada como duplicata (considerando os demais critérios)
    - **Valida: Requisitos 3.3**

  - [x] 5.3 Escrever testes unitários do Validation Service
    - Testar cada regra de validação individualmente
    - Testar encaminhamento automático quando todas as validações passam
    - Testar exigência de justificativa para liberação de duplicata
    - _Requisitos: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7_

- [x] 6. Checkpoint — Verificar serviços core
  - Garantir que todos os testes passam para os serviços implementados até aqui (Audit, Document, OCR, Validation)
  - Perguntar ao usuário se há dúvidas antes de prosseguir

- [x] 7. Implementar Workflow Service (Workflow de Aprovação)
  - [x] 7.1 Implementar interface `IWorkflowService`
    - Implementar `submitForApproval(protocoloUnico)` com roteamento automático baseado em valor vs. alçada
    - Implementar `approve()`, `reject()`, `returnForCorrection()` com justificativa obrigatória para rejeição/devolução
    - Implementar `escalate()` para escalação automática quando valor excede alçada
    - Implementar `checkSoDConflict()` para verificação de Segregação de Funções
    - Bloquear aprovação se mesmo usuário registrou o documento (SoD)
    - Bloquear aprovações fora do workflow formal
    - Implementar notificação de escalação quando SLA é excedido
    - Registrar todas as ações na Trilha de Auditoria
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 7.2 Escrever teste de propriedade para Segregação de Funções (SoD)
    - **Propriedade 2: Enforcement de Segregação de Funções**
    - Para qualquer documento e qualquer usuário, se o usuário executou a ação de registro, então `approve()` deve ser bloqueado para esse usuário nesse documento
    - Se o usuário aprovou, então `registerInERP()` deve ser bloqueado para esse usuário nesse documento
    - **Valida: Requisitos 4.7, 8.4, 8.5**

  - [x] 7.3 Escrever testes unitários do Workflow Service
    - Testar roteamento correto por alçada
    - Testar escalação automática
    - Testar bloqueio de SoD com mensagem explicativa
    - Testar exigência de justificativa para rejeição e devolução
    - _Requisitos: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 8. Implementar Queue Service (Fila Operacional)
  - [x] 8.1 Implementar interface `IQueueService`
    - Implementar `getQueue(analistaId, filters)` com ordenação por prioridade (proximidade vencimento + nível de risco)
    - Implementar cálculo de `slaStatus`: 'dentro_prazo', 'alerta' (≥80% do SLA), 'vencido' (>100% do SLA)
    - Implementar `reassignItem()` para reatribuição
    - Implementar `getQueueKPIs()` com totais pendentes, vencidos, em alerta
    - Implementar filtros: etapa, SLA, fornecedor, faixa de valor, período de vencimento
    - Destacar itens com exceção (validação reprovada, devolução, erro integração)
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 8.2 Escrever teste de propriedade para rastreamento de SLA
    - **Propriedade 4: Rastreamento de SLA com limiar de 80%**
    - Para qualquer item na fila, se `tempoDecorrido / slaMaximo >= 0.8` e `tempoDecorrido / slaMaximo <= 1.0`, então `slaStatus` deve ser 'alerta'
    - Se `tempoDecorrido / slaMaximo > 1.0`, então `slaStatus` deve ser 'vencido'
    - Se `tempoDecorrido / slaMaximo < 0.8`, então `slaStatus` deve ser 'dentro_prazo'
    - **Valida: Requisitos 5.3, 5.4**

  - [x] 8.3 Escrever testes unitários do Queue Service
    - Testar ordenação por prioridade
    - Testar transições de status SLA
    - Testar filtros combinados
    - _Requisitos: 5.1, 5.2, 5.5, 5.6_

- [x] 9. Implementar ERP Connector (Conector ERP)
  - [x] 9.1 Implementar interface `IERPConnector`
    - Implementar `registerDocument(doc)` para envio de dados ao ERP após aprovação
    - Implementar `reprocessDocument(protocoloUnico)` para reenvio em caso de erro
    - Implementar `syncPaymentStatus()` para consulta periódica de status de pagamento
    - Implementar `getIntegrationKPIs()` e `getRecentTransactions()`
    - Atualizar status do documento: 'registrado_erp' em sucesso, 'erro_integracao' em falha
    - Verificar SoD: quem aprovou não pode registrar no ERP
    - Registrar todas as tentativas na Trilha de Auditoria
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 8.4_

  - [x] 9.2 Escrever testes unitários do ERP Connector
    - Testar registro com sucesso e armazenamento do ID de transação ERP
    - Testar tratamento de erro com encaminhamento para fila operacional
    - Testar reprocessamento e registro na auditoria
    - _Requisitos: 6.1, 6.2, 6.3, 6.5_

- [x] 10. Implementar Dashboard Service
  - [x] 10.1 Implementar interface `IDashboardService`
    - Implementar `getOperationalKPIs()`: volume por etapa, taxa de exceções, tempo médio por etapa, itens vencidos SLA, alertas
    - Implementar `getManagementKPIs()`: previsão 30 dias, tendências, taxa de automação, duplicatas evitadas
    - Implementar `getPaymentForecast(periodo)` agrupado por fornecedor e centro de custo
    - Implementar `getAuditLog(filters)` com paginação
    - Implementar `exportData(format, filters)` para CSV e PDF
    - _Requisitos: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7_

  - [x] 10.2 Escrever testes unitários do Dashboard Service
    - Testar cálculo de KPIs operacionais e gerenciais
    - Testar exportação CSV e PDF
    - Testar filtros de auditoria
    - _Requisitos: 7.1, 7.2, 7.5, 7.6_

- [x] 11. Implementar camada de API REST e autenticação
  - [x] 11.1 Configurar API Gateway com OpenAPI
    - Definir rotas REST para todos os serviços de domínio
    - Gerar documentação OpenAPI automática
    - _Requisitos: 9.1_

  - [x] 11.2 Implementar autenticação OAuth 2.0 / OIDC e RBAC
    - Implementar middleware de autenticação
    - Implementar middleware de autorização baseado em perfis (`UserProfile`, `Permission`)
    - Perfis mínimos: Analista_AP, Aprovador, Tesouraria, Controladoria, Administrador
    - Registrar alterações de configuração de perfis/alçadas na Trilha de Auditoria
    - _Requisitos: 8.6, 8.7, 9.4_

  - [x] 11.3 Escrever testes unitários de autenticação e autorização
    - Testar bloqueio de acesso sem token válido
    - Testar permissões por perfil
    - Testar registro de alterações de configuração na auditoria
    - _Requisitos: 8.6, 8.7_

- [x] 12. Checkpoint — Verificar backend completo
  - Garantir que todos os testes do backend passam
  - Verificar integração entre serviços (Document → OCR → Validation → Workflow → ERP)
  - Perguntar ao usuário se há dúvidas antes de prosseguir para o frontend

- [x] 13. Implementar componentes reutilizáveis do frontend
  - [x] 13.1 Implementar KPICard e StatusTable
    - `KPICard`: card com valor, label, tendência e cor semântica (verde/âmbar/vermelho)
    - `StatusTable`: tabela com ordenação, paginação, chips de status e indicadores SLA
    - Garantir acessibilidade: contraste AA, navegação por teclado, `aria-live` para atualizações
    - _Requisitos: 5.2, 7.1, 9.6_

  - [x] 13.2 Implementar AlertsPanel e DocumentHeader
    - `AlertsPanel`: painel de alertas com severidade e ações, cor nunca como único indicador
    - `DocumentHeader`: header financeiro com valor, fornecedor, vencimento, centro de custo
    - _Requisitos: 4.2, 5.6, 9.6_

  - [x] 13.3 Implementar AssistedReviewForm e JustificationModal
    - `AssistedReviewForm`: split-view com preview do documento (esquerda) e formulário editável (direita), destaque amarelo para confiança < 85%, contorno vermelho para campos obrigatórios vazios
    - `JustificationModal`: modal com textarea obrigatória e confirmação
    - _Requisitos: 2.4, 2.5, 3.6, 4.4, 4.5, 9.6_

  - [x] 13.4 Implementar HistoryTimeline e IntegrationBadge
    - `HistoryTimeline`: timeline de eventos/etapas do documento
    - `IntegrationBadge`: badge de status de integração/conformidade
    - _Requisitos: 4.2, 6.4, 9.6_

  - [x] 13.5 Escrever testes unitários dos componentes reutilizáveis
    - Testar renderização de cada componente com dados válidos e estados vazios
    - Testar acessibilidade: labels, aria-describedby, navegação por teclado
    - _Requisitos: 9.6_

- [x] 14. Implementar telas do frontend — Painel AP e Intake
  - [x] 14.1 Implementar Tela 1: Painel AP
    - Cards de KPI (documentos recebidos, pendentes aprovação, vencidos SLA, valor total pipeline)
    - Alertas de SLA e duplicidade via MessageBar
    - Tabela de documentos críticos
    - CTA para Fila Operacional
    - Estados: loading (skeleton), empty, error (banner com retry), success
    - _Requisitos: 7.1, 7.4, 9.1_

  - [x] 14.2 Implementar Tela 2: Intake de Documentos
    - Área de upload drag & drop + seleção de arquivo com suporte a lote
    - Lista de documentos recebidos com Protocolo_Unico, data, canal, tipo
    - Validação de formato e tamanho no frontend com mensagens descritivas
    - Estados: loading (barra de progresso), empty, error, success, disabled
    - _Requisitos: 1.1, 1.2, 1.4, 1.5, 1.6_

- [x] 15. Implementar telas do frontend — Captura e Validações
  - [x] 15.1 Implementar Tela 3: Captura e Validação Assistida
    - Layout split-view: preview do documento (esquerda), formulário estruturado (direita)
    - Índice de confiança por campo com destaque visual (amarelo < 85%)
    - Alertas para campos obrigatórios vazios e inconsistências
    - Registro de correções manuais na Trilha de Auditoria via API
    - Auto-save com toast de confirmação
    - _Requisitos: 2.4, 2.5, 2.6, 9.6_

  - [x] 15.2 Implementar Tela 4: Validações e Anti-duplicidade
    - Resumo do documento no topo
    - Lista de validações com status (aprovada/reprovada) e criticidade
    - Tabela de documentos similares lado a lado
    - Painel de decisão: bloquear / justificar e liberar / rejeitar
    - Modal de justificativa obrigatória para liberação de duplicata
    - _Requisitos: 3.3, 3.5, 3.6, 3.7_

- [x] 16. Implementar telas do frontend — Aprovação e Fila Operacional
  - [x] 16.1 Implementar Tela 5: Aprovação com Alçadas
    - Header: valor, fornecedor, vencimento, centro de custo
    - Resumo financeiro, anexos originais, histórico de etapas
    - Barra de ação fixa: Aprovar / Rejeitar / Devolver
    - Countdown de SLA restante
    - Bloqueio visual quando alçada insuficiente ou conflito SoD
    - Justificativa obrigatória para rejeição/devolução
    - Layout responsivo mobile para aprovadores
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 9.6_

  - [x] 16.2 Implementar Tela 6: Fila Operacional com SLA
    - Filtros avançados: etapa, SLA, fornecedor, valor, período
    - KPIs resumidos (total pendente, vencidos, em alerta)
    - Tabela principal com ordenação e indicadores visuais de SLA
    - Destaque de exceções com motivo resumido
    - Ação rápida: reatribuir / tratar
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 17. Implementar telas do frontend — Integração ERP e Dashboard
  - [x] 17.1 Implementar Tela 7: Integração com ERP
    - KPIs de sucesso/erro
    - Lista de transações recentes com status
    - Detalhe técnico-funcional por item (ID ERP, última tentativa, motivo de erro)
    - Ação de reprocessamento controlado (restrito por perfil)
    - _Requisitos: 6.2, 6.3, 6.4, 6.5_

  - [x] 17.2 Implementar Tela 8: Dashboard Gerencial e Auditoria
    - KPIs gerenciais: backlog por status, previsão 30 dias, lead time, duplicatas evitadas
    - Gráfico de previsão de pagamentos
    - Tabela auditável com filtros (período, usuário, tipo de ação, documento)
    - Exportação CSV/PDF (restrita por perfil)
    - Tempo de carregamento < 3 segundos
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 18. Checkpoint — Verificar frontend completo
  - Garantir que todos os testes do frontend passam
  - Verificar navegação entre telas conforme fluxo do design
  - Perguntar ao usuário se há dúvidas

- [x] 19. Integração end-to-end e wiring final
  - [x] 19.1 Conectar frontend aos endpoints da API
    - Configurar cliente HTTP com interceptors de autenticação
    - Implementar stores (Zustand/Redux) para estado global: documentos, fila, aprovações, dashboard
    - Conectar cada tela aos respectivos serviços via API
    - _Requisitos: 9.1, 9.4_

  - [x] 19.2 Implementar criptografia e segurança
    - Configurar TLS 1.2+ para todas as comunicações
    - Configurar AES-256 para dados em repouso no PostgreSQL
    - _Requisitos: 9.4, 9.5_

  - [x] 19.3 Implementar fluxo completo de notificações e SLA
    - Notificação automática ao analista quando SLA é excedido
    - Notificação de escalação ao aprovador e gestor quando aprovação excede SLA
    - _Requisitos: 4.8, 5.4_

  - [x] 19.4 Escrever testes de integração do fluxo principal
    - Testar fluxo: Intake → OCR → Validação → Aprovação → ERP
    - Testar fluxo de exceção: Validação falha → Fila Operacional → Reprocessamento
    - Testar bloqueio de SoD no fluxo completo
    - _Requisitos: 1.1, 3.4, 4.7, 6.1, 8.4_

- [x] 20. Checkpoint final — Garantir qualidade e completude
  - Garantir que todos os testes passam (unitários, propriedade, integração)
  - Verificar cobertura de todos os 10 requisitos e 61 critérios de aceitação
  - Perguntar ao usuário se há dúvidas ou ajustes necessários

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental a cada bloco de funcionalidade
- Testes de propriedade validam propriedades universais de corretude definidas no design
- Testes unitários validam exemplos específicos e casos de borda
- A linguagem de implementação é TypeScript em todo o stack
