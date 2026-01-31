
# StagingPro - プロフェッショナル運用マニュアル

## 📦 Cloudflare R2 (ストレージ) の導入手順 【推奨】

Supabase Storageの代わりにR2を使用することで、転送量課金をゼロにし、10GBまでの無料枠を活用できます。

### STEP 1: R2バケットの作成
1. [Cloudflare Dashboard](https://dash.cloudflare.com) にログイン。
2. `R2` > `Create bucket` をクリック。
3. バケット名を `staging-pro-assets` などで作成（名前は自由）。

### STEP 2: Pagesへのバインド（接続）
1. Cloudflare Pagesのプロジェクト設定を開く。
2. `Settings` > `Functions` > `R2 bucket bindings` を探す。
3. `Add binding` をクリック。
   - **Variable name**: `R2_BUCKET` (必ずこの名前にしてください)
   - **R2 bucket**: 先ほど作成したバケットを選択。
4. 保存して再デプロイしてください。

---

## 💳 Stripe決済の導入手順

1. Cloudflare Pagesの `Settings` > `Environment variables` に `STRIPE_SECRET_KEY` を追加。
2. `VITE_STRIPE_PUBLISHABLE_KEY` をフロントエンド用に設定。

---

## 🌐 独自ドメイン（お名前.com）の設定手順
CloudflareのDNS設定にドメインを追加し、ネームサーバーをお名前.com側で切り替えてください。

---

## 📧 メール通知の設定 (Resend)
`VITE_RESEND_API_KEY` を環境変数に設定し、Resend側でドメイン認証を完了させてください。
