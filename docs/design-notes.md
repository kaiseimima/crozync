# Crozync — Design Notes

議事録 / 設計ディスカッションのメモ。決定事項と未決事項を随時更新。

---

## 2026-03-09

### アプリ概要
- **名前**: Crozync（Cross + Sync）
- **対象**: 遠距離の二人（恋人・友人問わず）
- **コンセプト**: テキストなし、体験ベースの繋がり

### 技術スタック
- Frontend: React Native (Expo) + TypeScript
- Backend: Supabase (Auth / Database / Storage / Realtime / Edge Functions)
- DB: PostgreSQL (Supabase、RLS でアクセス制御)
- Real-time: Supabase Realtime (Crozyncセッション状態)
- Storage: Supabase Storage (写真)
- Push: Expo Push API
- ビジネスロジック: Supabase Edge Functions (ターンチェック、1日1回制限等)

※ FastAPI・Redis・Docker・Terraform は不採用（Supabase に統合）

---

## 機能スコープ（MVP）

### ✅ 確定

**1. 相手の現地時刻表示**
- ホーム画面で相手の現在時刻をパッと確認できる

**2. おはよう / お休み通知**
- 各ユーザーが自分のタイムゾーンで起床・就寝時刻を設定
- その時刻になると A・B 両方に通知が飛ぶ
- 1日4回（A のおはよう / A のお休み / B のおはよう / B のお休み）

**3. 写真日記（シール帳）**

*基本ルール: 交互投稿*
- A が撮ったら次は B が撮らないと A は撮れない（A → B → A → B ...）
- 連続投稿不可。必ず交互。

*追加機能: Crozync リクエスト*
- どちらかが「Crozync！」を送ると同時撮影セッションが始まる
- 1ペアにつき1日1回まで
- 2枚で1セット（両面プリクラ / シール的）
- タイムアウト: 3分。相手が応答しなければ権利が復活し、再度リクエスト可能

*フィード*
- 過去のセットを時系列で見返せる（写真日記）

**4. その他**
- 写真は永久保存
- ペアの繋がり方: QR コード
- おはよう/お休み通知へのリアクション: 通知タップでハート1つ送れる
- テキスト・通話は持たない（LINE / WhatsApp に任せる）

### ❓ 未決

（なし）

---

## DB スキーマ（最終決定版）

### users
| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| display_name | TEXT | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | |
| timezone | TEXT | 例: "Asia/Tokyo" |
| wake_time | TIME | ユーザーのTZ基準 |
| sleep_time | TIME | ユーザーのTZ基準 |
| push_token | TEXT (nullable) | Expo Push通知用 |
| avatar_url | TEXT (nullable) | |
| created_at | TIMESTAMPTZ | |

### pairs
| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| user_1_id | UUID FK → users | UUID小さい方 |
| user_2_id | UUID FK → users | UUID大きい方 |
| next_turn_user_id | UUID FK → users | 次に撮るべきユーザー |
| created_at | TIMESTAMPTZ | |

制約: `UNIQUE(user_1_id, user_2_id)`
初回ターン: ペア成立時に招待した側（pair_invites.created_by_user_id）を next_turn_user_id にセット

### pair_invites
| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| created_by_user_id | UUID FK → users | |
| code | TEXT UNIQUE | QRに埋め込む6〜8桁 |
| expires_at | TIMESTAMPTZ | 24時間 |
| accepted_at | TIMESTAMPTZ (nullable) | ペア成立日時 |

### stickers
| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| pair_id | UUID FK → pairs | |
| user_id | UUID FK → users | 投稿者 |
| image_url | TEXT | S3等 |
| is_crozync | BOOLEAN | 同時撮影か |
| crozync_session_id | UUID FK → crozync_sessions (nullable) | |
| deleted_at | TIMESTAMPTZ (nullable) | 論理削除 |
| created_at | TIMESTAMPTZ | |

### crozync_sessions
| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| pair_id | UUID FK → pairs | |
| requested_by_user_id | UUID FK → users | |
| status | ENUM | pending / completed / expired |
| requested_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | requested_at + 3分 |
| completed_at | TIMESTAMPTZ (nullable) | |

### hearts
| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| from_user_id | UUID FK → users | |
| to_user_id | UUID FK → users | |
| type | ENUM | good_morning / good_night |
| sent_at | TIMESTAMPTZ | |

制約: `UNIQUE(from_user_id, type, DATE(sent_at))` — 1日1回制限

---

---

## API エンドポイント設計（最終決定版）

### 認証
```
POST   /auth/register
POST   /auth/login             # JWT返す
POST   /auth/logout
```

### ユーザー
```
GET    /users/me
PATCH  /users/me               # timezone, wake_time, sleep_time, avatar等
PATCH  /users/me/push-token    # Expo push token更新
```

### ペアリング
```
POST   /pairs/invite           # QRコード生成
POST   /pairs/join             # QRスキャンしてペア成立
GET    /pairs/me               # ホーム画面用リッチレスポンス（下記参照）
DELETE /pairs/me               # ペア解除
```

`GET /pairs/me` レスポンス:
```json
{
  "partner": {
    "display_name": "...",
    "avatar_url": "...",
    "timezone": "America/Toronto"
  },
  "is_my_turn": true,
  "active_crozync_session_id": "uuid or null"
}
```

### スティッカー
```
GET    /stickers               # フィード（カーソルページネーション）
POST   /stickers/upload-url    # S3 Presigned URL取得（有効期限5分）
POST   /stickers               # 投稿（ターンチェック → 保存 → ターン更新）
DELETE /stickers/{id}          # 論理削除
```

`POST /stickers` ロジック:
1. `pairs.next_turn_user_id == current_user.id` を確認
2. `stickers` に保存
3. `pairs.next_turn_user_id` をパートナーIDに更新

### Crozync セッション
```
POST   /crozync/request                  # セッション開始 → パートナーにPush通知
GET    /crozync/session/{id}             # 状態取得（expires_at超過で自動expired化）
POST   /crozync/session/{id}/accept      # パートナーが応答
POST   /crozync/session/{id}/photo       # 写真アップロード（S3 URL）
```

`POST /crozync/request` レスポンス:
```json
{
  "session_id": "uuid",
  "expires_at": "2026-03-10T03:30:00Z"
}
```

### ハート
```
POST   /hearts                 # 送信（1日1回チェック）
GET    /hearts/today           # 今日のハート状況
```

---

---

## Realtime 設計（最終決定版）

Supabase Realtime でテーブルの変更を購読する方式。

### 購読テーブルと用途

| テーブル | イベント | 用途 |
|---|---|---|
| `crozync_sessions` | UPDATE | status変化（pending→completed/expired）を検知 → screen03の状態更新 |
| `stickers` | INSERT | 相手の投稿を検知 → screen02フィード更新 + 自分のターン通知 |
| `hearts` | INSERT | ハート受信を検知 → screen01アニメーション表示 |

### バックグラウンド時の通知
アプリがバックグラウンドの場合は Supabase Realtime が届かないため、
**Supabase Edge Functions から Expo Push 通知**を送信。

| トリガー | 通知内容 |
|---|---|
| `POST /crozync/request` | 「Crozyncリクエストが届きました」 |
| `stickers` INSERT | 「相手が写真を投稿しました（あなたのターンです）」 |
| `hearts` INSERT | 「ハートが届きました」 |
| おはよう/お休み時刻 | 「おはようございます / おやすみなさい」（Scheduled Edge Function） |

---

## 次のアクション
- [x] DB スキーマ設計
- [x] API エンドポイント設計
- [x] Realtime イベント設計
- [ ] 実装開始
