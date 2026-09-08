# WEB DESK

4つの軽量Webツールを1つにまとめた、GitHub Pages + Supabase構成のサイトです。

## Tools

### 1. Security RSS
- JPCERT/CC、IPA、CISA、BleepingComputer、The Hacker News、PortSwigger Researchを集約
- 記事は**公開時刻から8時間だけ**保持
- Edge Functionが取得・正規化し、Supabase Postgresへ最小限のメタデータだけ保存
- 期限切れはリクエスト時に削除 + `pg_cron` が15分ごとに削除
- DBはRLSを有効化し、ブラウザからテーブルを直接読ませない
- 検索、ソース絞り込み、未読表示、残り保持時間、ソース状態表示

### 2. Calculator
- 四則演算、括弧、べき乗、剰余
- sin / cos / tan / sqrt / ln / log / abs / floor / ceil / round
- DEG / RAD切替、キーボード操作、履歴
- `eval` / `Function` を使わない独自式パーサ

### 3. Clock
- ローカル時刻・日付
- 東京 / UTC / ロンドン / ニューヨークの世界時計
- ストップウォッチ + ラップ
- プリセット付きタイマー、完了音・バイブレーション

### 4. Todo
- タイトル、メモ、カテゴリ、優先度、期限
- 未完了 / 今日 / 期限切れ / 完了フィルタ
- 検索、編集、完了、削除
- JSONバックアップ / 復元
- タスクはブラウザの`localStorage`のみに保存し、サーバへ送信しない

## Architecture

- Frontend: vanilla HTML / CSS / JavaScript
- Hosting: GitHub Pages
- RSS backend: Supabase Edge Functions + Postgres + pg_cron
- No frontend framework, no analytics, no ad SDK, no external font dependency

## RSS endpoint

`https://dcvtubivtextycifngtk.supabase.co/functions/v1/security-rss`

公開RSS情報専用のGETエンドポイントです。Supabase service-role keyはEdge Function環境内だけで使い、GitHub Pages側には置いていません。
