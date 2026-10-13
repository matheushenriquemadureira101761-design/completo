# AGROVINC

Marketplace nacional de máquinas, implementos, fretes e serviços para o agro.

## Estrutura

- `app/` — App móvel (React Native + Expo), também roda em web
- `backend/` — Servidor (Node/Express + PostgreSQL)
- `painel/` — Painel administrativo (React + Vite)

## Rodar localmente

### App
```bash
cd app
npm install
npx expo start
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Preencher o .env
npm run migrar
npm run dev
```

### Painel
```bash
cd painel
npm install
npm run dev
```
