# Roteiro de Execução e Evidências — Loja API (N3)
**Autor:** Rafael Gabriel

## 1. Docker e Docker Compose
```bash
cp .env.example .env
# Edite o .env para alterar as senhas antes de subir
docker compose up -d --build
docker compose ps

# Validar saúde e prontidão
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready

# Cadastrar e listar produtos
curl -s -X POST http://localhost:3000/produtos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teclado Mecânico RGB","preco":320.00,"estoque":10}'
curl -s http://localhost:3000/produtos

# Validar persistência recriando os containers
docker compose down
docker compose up -d
curl -s http://localhost:3000/produtos
```

## 2. Build e Deploy no Kubernetes (`n3-rafael`)
```bash
docker build -t loja-api:1.0 ./app
kubectl apply -f k8s/
kubectl get nodes
kubectl get all -n n3-rafael
kubectl get pvc -n n3-rafael

# Validar API via NodePort (30080)
curl -s http://localhost:30080/health
curl -s http://localhost:30080/ready
curl -s -X POST http://localhost:30080/produtos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Monitor 27 Polegadas","preco":1250.00,"estoque":5}'
curl -s http://localhost:30080/produtos
```

## 3. Escala Manual, Rolling Update e Rollback
```bash
# Escalar para 4 réplicas e retornar para 2
kubectl scale deployment loja-api -n n3-rafael --replicas=4
kubectl get pods -n n3-rafael
kubectl scale deployment loja-api -n n3-rafael --replicas=2
kubectl get pods -n n3-rafael

# Simular falha de imagem e executar rollback
kubectl set image deployment/loja-api loja-api=loja-api:versao-inexistente -n n3-rafael
kubectl rollout status deployment/loja-api -n n3-rafael --timeout=30s || true
kubectl get pods -n n3-rafael
kubectl rollout undo deployment/loja-api -n n3-rafael
kubectl rollout status deployment/loja-api -n n3-rafael
```

## 4. Autoscaling (HPA) e Teste de Carga
```bash
# Verificar requests/limits configurados
kubectl describe deployment loja-api -n n3-rafael

# Criar HPA (requer Metrics Server ativo)
kubectl autoscale deployment loja-api \
  --cpu-percent=50 \
  --min=2 \
  --max=5 \
  -n n3-rafael
kubectl get hpa -n n3-rafael

# Aplicar carga HTTP e observar escalonamento
kubectl apply -f extras/carga.yaml
kubectl get hpa -n n3-rafael -w
```

## 5. Persistência do MySQL no Kubernetes
```bash
# Consultar produto antes de apagar o Pod do MySQL
curl -s http://localhost:30080/produtos

# Deletar o Pod do MySQL para forçar recriação pelo Deployment
kubectl delete pod -l app=mysql -n n3-rafael
kubectl get pods -n n3-rafael -w

# Consultar novamente após o novo Pod ficar Ready
curl -s http://localhost:30080/produtos
```
