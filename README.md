# 易の書庫

Cloudflare Workersで公開する、64卦・384爻の個人用リファレンスです。専用パスワードによるログイン方式で、Cloudflare Access / Zero TrustやGoogleログインは使いません。メールアドレスによる本人限定ではなく、パスワードを知る人が閲覧できる方式です。

## 操作

- 卦名・番号で検索。`兌為澤三爻`、`兌為沢3爻`、`58-3`、`乾為天九三`に対応。
- 64卦一覧、上卦×下卦の8×8表、しおりから選択。
- 初爻～上爻のタブ、矢印キー、前後の爻ボタンで移動。
- 伏卦の爻辞と意味を併記し、その爻へ移動。
- 爻ごとのURL、しおりと閲覧履歴、原文・意味の全文検索。
- CSVの文章は変更・補作せず、占例は掲載しません。

## 認証

生成した32文字・192ビットの乱数パスワードをサーバーで照合します。照合用のHMAC鍵・検証値とセッション署名キーはCloudflare Secretsに保存し、平文のパスワードはWorkerにも公開ソースにも保存しません。HMACはWeb Cryptoのverifyで照合します。人が考えた短いパスワードに置き換えるための機能ではありません。

- CookieはSecure / HttpOnly / SameSite=Strict / __Host-接頭辞で、12時間有効。
- ログインは署名付きチャレンジ、Origin、CSRFトークンで保護。
- IP単位で概ね10回/60秒の試行制限。CloudflareのRate Limiting bindingを使用し、地域ごとの近似制限であるため厳密な世界共通の上限ではありません。
- `run_worker_first: true` でHTML、JS、卦名一覧、本文APIをすべて認証後に配信。
- 設定不足や別ホスト・プレビューからのアクセスには本文を返しません。
- ログアウトは同一サイトからのPOSTのみ。Cookieと画面上の本文を消去。
- 本文・パスワード・セッションはlocalStorageへ保存しません。しおりと履歴は卦番号・爻位置のみ。
- 保護された応答は`private, no-store`とし、共有キャッシュには保存しません。

## データ

`python scripts/import_data.py` で元CSVから取り込みます。卦辞115行の重複51行が同一内容であることを照合し、64卦に整理します。384爻と全伏卦リンクも検証します。

- `public/`：画面コードと卦名一覧のみ。本文・CSVは入れない。
- `.private/data.json`：非公開の本文。Git管理対象外。Workerにのみ組み込む。
- `worker/`：ログイン、セッション、本文APIと画面配信。

## 公開先

https://eki-library-private.imaron0812.workers.dev

GitHubのmainはソース管理用です。本文・鍵・ログイン情報ファイルはpushしません。旧GitHub PagesはCloudflare版の動作確認後に停止します。

## 再配備

```powershell
python scripts/import_data.py
npm install
npm test
npm run deploy
```

## パスワードの再生成

```powershell
npm run setup:password -- '<手元の非公開ログイン情報ファイルの絶対パス>'
```

新しいランダムパスワードをローカルファイルに保存し、照合用の値と新しいセッション署名キーを標準入力でCloudflare Secretsへ登録します。キーやパスワードを端末出力やコマンド引数へ出しません。成功すると旧パスワードと既存のログインセッションは無効になります。鍵を変更しただけなら通常はソースの再配備は不要です。

ログイン情報ファイルはソースディレクトリの外か`.private/`に置いてください。クラウド連携されたフォルダを指定した場合は、そのフォルダの同期設定に従います。

## 検証

`npm test` は全384爻への検索、全伏卦参照、正しいパスワードでのログイン、誤パスワード、CSRF、偽造・期限切れセッション、鍵交換後の旧セッション、未認証での直接取得、試行制限を検証します。テストのパスワードと鍵は実行時に生成し、本番用の値を使いません。

## 根拠

- [Workers Static Assetsのルーティング](https://developers.cloudflare.com/workers/static-assets/routing/advanced/)
- [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
