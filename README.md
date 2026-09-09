# WEB DESK

7つの軽量Webツールを1つにまとめた、GitHub Pages + Supabase構成のサイトです。

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

### 5. Music
- Apple Music風のレスポンシブUI
- 曲名 / アーティスト / アルバム検索
- iTunes Search APIの30秒プレビューを再生
- 再生 / 一時停止 / 前後曲 / シーク / 音量
- Media Session対応ブラウザではOSのメディア操作と連携
- お気に入りは`localStorage`に保存
- フル楽曲の配信・保存・ダウンロードは行わない

### 6. 破産統計マップ
- 裁判所の公開司法統計だけを利用
- 2020年の47都道府県別「破産事件新受」総数をヒートマップ化
- 都道府県検索、地方絞り込み、全国順位、全国比を表示
- 2020〜2024年の全国推移を表示
- 個人名・住所・勤務先・官報掲載者の位置情報は収集・表示しない
- 北海道は札幌 / 函館 / 旭川 / 釧路の4地裁を合算

### 7. Free Tier Monitor
- Supabase Freeプランの主要無料枠を1画面で確認
- Database / File Storage / Auth activity / public rowsを1分ごとに更新
- `pg_cron`が公開用の集計1行だけを更新し、RLSで匿名SELECTのみ許可
- service role keyやユーザー情報、テーブル内容はブラウザへ公開しない
- Egress / Edge Function Invocations / Realtimeなど公式Billing meterが必要な項目は、推測せず無料枠上限だけ表示

## Architecture

- Frontend: vanilla HTML / CSS / JavaScript
- Hosting: GitHub Pages
- RSS backend: Supabase Edge Functions + Postgres + pg_cron
- Free tier monitor: Supabase Postgres aggregate row + pg_cron + RLS
- Music catalog / previews: Apple iTunes Search API
- Bankruptcy map data: 裁判所「司法統計年報 民事・行政編」の集計統計
- No frontend framework, no analytics, no ad SDK, no external font dependency

## RSS endpoint

`https://dcvtubivtextycifngtk.supabase.co/functions/v1/security-rss`

公開RSS情報専用のGETエンドポイントです。Supabase service-role keyはEdge Function環境内だけで使い、GitHub Pages側には置いていません。
