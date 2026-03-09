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
- Backend: FastAPI (Python)
- DB: PostgreSQL
- Real-time: WebSocket + Redis
- Push: Expo Push API
- Auth: JWT
- Infra: Docker (dev) → AWS + Terraform (prod)

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

## 次のアクション
- [x] DB スキーマ設計
- [ ] WebSocket イベント設計
- [ ] API エンドポイント設計
