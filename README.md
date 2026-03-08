# Crozync

<p align="center">
  <strong>Cross the distance. Stay in sync.</strong>
</p>

**Crozync** is a real-time sync app for long-distance couples.
It keeps you connected across timezones — shared moments, status, and presence on the channels you already live in.

## How it works

```
Mobile App (React Native / Expo)
        │
        ▼
┌───────────────────────────┐
│         API Server         │
│        (FastAPI)           │
│                            │
│  ┌──────────┐  ┌────────┐ │
│  │ REST API │  │  WSS   │ │
│  └──────────┘  └────────┘ │
└──────────┬────────────────┘
           │
     ┌─────┴─────┐
     │           │
  PostgreSQL    Redis
  (persistent) (pub/sub)
```

## Getting Started

Setup guides and architecture details will be added as the project takes shape.
