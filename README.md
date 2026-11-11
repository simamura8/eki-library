# 易の書庫

64卦・384爻の個人用リファレンス。GitHub Pagesは本文を含まない画面のみを配信し、Cloudflare Accessで保護するWorkerから本人だけが本文を取得します。

## 操作

- 卦名または番号で検索。`兌為澤三爻`、`兌為沢3爻`、`58-3`、`乾為天九三`に対応。
- 卦の一覧、上卦×下卦の8×8表、しおりから選択。
- 初爻～上爻のタブで移動。タブは矢印キーでも操作可能。
- 伏卦の同じ爻の本文・意味を併記し、その爻へ移動可能。
- 各爻のURLをコピー可能。しおりと履歴には本文を保存しません。
- 認証後は本文も検索可能。本文データはメモリのみに保持し、リロードすると再認証が必要です。
- CSVをそのまま使用し、文章の修正・補作、占例の掲載は行いません。

## データと公開境界

`python scripts/import_data.py` で元のCSVから取り込みます。卦辞115行の重複51行が一致することを検証して64卦に整理し、384爻および全伏卦参照を検証します。

- `public/`：公開可能な画面、卦名・番号・卦の形のみ。Pagesに配信するのはこのディレクトリだけ。
- `.private/data.json`：非公開の本文。Git管理対象外。原文CSVもアップロードしません。
- `worker/index.js`：サーバー処理。本文はAccess認証済みの許可メールにのみ返します。

## ローカル

```powershell
python scripts/import_data.py
npm install
npm test
npm run preview
```

`http://127.0.0.1:4318` で確認。ローカルプレビューでも未認証の本文は配信しません。

## 本人限定認証の設定

1. Cloudflare Zero Trustの初期設定を完了。
2. Cloudflare接続に Workers Scripts の編集、Access Apps and Policies の編集、Access Organizations / Identity Providers の編集権限を許可。
3. `npm run deploy:api` でWorkerを配備。Access未設定でも、Workerは`ctx.access`がなければ403を返すため本文は出ません。
4. Zero Trust → Access → Applicationsで、このWorkerの本番URLを保護するSelf-hostedアプリを追加。可能ならWorker全体を保護。
5. Allowルールは `wrangler.jsonc` の `ALLOWED_EMAIL` の1アドレスだけ。Everyone、ドメイン全体の許可、Bypassは追加しない。
6. ログイン方法はOne-time PIN（メールコード）。自動的に有効にならない場合はSettings → Authenticationで追加。
7. Workerのサブドメインを `public/config.js` の `apiUrl` に設定し、GitHubへpush。
8. 未ログイン、別アドレス、許可アドレスの3通りで確認。

Accessが通っても、WorkerはCloudflareが検証した `ctx.access.getIdentity()` のメールを照合します。ユーザーが付けたメールヘッダーでは認証しません。Accessを外すと本文を返せなくなる設計です。WorkerにはStatic Assetsのbindingを付けないでください（`ctx.access`伝播の制約があるため）。

## GitHub Pages

公開元は`gh-pages`ブランチです。変更をmainにコミットした後、`npm run publish:pages` で `public/` のみを切り出して配備します。通常のGitHub Pagesにメール別のアクセス制限はないため、ログイン前の画面・卦名一覧は公開されます。本文は非公開です。

## 根拠

- [GitHub Pagesの公開範囲](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)
- [Cloudflare Access for Workers / ctx.access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Workersのworkers.dev保護](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
