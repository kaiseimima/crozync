# Crozync

<p align="center">
  <strong>Cross the distance. Stay in sync.</strong>
</p>

**Crozync** is a real-time sync app for two people living far apart.
It keeps you connected across timezones — shared moments, status, and presence on the channels you already live in.

## How it works

```
Expo (React Native + TypeScript)
        │
        ▼
   Supabase
    ├── Auth      (認証)
    ├── Database  (PostgreSQL + RLS)
    ├── Storage   (写真)
    ├── Realtime  (Crozyncセッション)
    └── Edge Functions (ビジネスロジック)
```

## Getting Started

Setup guides and architecture details will be added as the project takes shape.
