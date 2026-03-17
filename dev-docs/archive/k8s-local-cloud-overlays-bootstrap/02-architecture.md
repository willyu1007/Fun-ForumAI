# 02 Architecture

## Boundaries
- Base: 与环境无关的 Deployment/Service/ConfigMap 等。
- Overlay: 环境差异（副本数、镜像、Ingress host、存储类、资源配额）。

## Initial interfaces
- Namespace: `funforum`
- Backend Service: `backend` (ClusterIP)
- Frontend Service: `frontend` (ClusterIP)
- Ingress: `forum-ingress`

## Risks
- 环境变量不完整导致容器启动失败。
- 本地镜像策略与云上 registry 策略不一致。
