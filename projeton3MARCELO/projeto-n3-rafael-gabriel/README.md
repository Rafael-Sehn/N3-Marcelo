# Loja API — Docker, Compose e Kubernetes (N3)
**Autor:** Rafael Gabriel

API REST de gerenciamento de produtos desenvolvida em Node.js com persistência em MySQL e camada de cache em Redis.

## Requisitos
- Docker Desktop (com Docker Compose)
- Kubernetes habilitado no cluster local (Docker Desktop / Minikube / Kind)
- `kubectl` configurado
- Metrics Server instalado no cluster para funcionamento do HPA

## Execução com Docker Compose
1. Copie `.env.example` para `.env` e altere as senhas padrão:
   ```bash
   cp .env.example .env
   ```
2. Suba os serviços:
   ```bash
   docker compose up -d --build
   ```
3. Acesse a API em `http://localhost:3000/` (rotas `/health`, `/ready` e `/produtos`).
4. Teste a persistência cadastrando um produto via `POST /produtos`, recriando os containers (`docker compose down && docker compose up -d`) e consultando novamente.

## Execução no Kubernetes
1. Construa a imagem local:
   ```bash
   docker build -t loja-api:1.0 ./app
   ```
2. Aplique os manifestos:
   ```bash
   kubectl apply -f k8s/
   ```
3. Verifique os recursos no namespace `n3-rafael`:
   ```bash
   kubectl get all -n n3-rafael
   ```
4. Acesse a API via NodePort em `http://localhost:30080/`.

## Roteiro de Testes e Evidências
O passo a passo completo para escala, rolling update, rollback, HPA e persistência está documentado em `comandos.md`.
