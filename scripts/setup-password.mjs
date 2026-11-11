import {randomBytes,createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve(process.argv[2]||'.private/login.txt');
const password=randomBytes(24).toString('base64url');
const key=randomBytes(32);
const values={
  PASSWORD_KEY:key.toString('base64url'),
  PASSWORD_VERIFIER:createHmac('sha256',key).update(password).digest('base64url'),
  SESSION_SECRET:randomBytes(32).toString('base64url')
};
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,'易の書庫 ログイン情報\n\nURL: https://eki-library-private.imaron0812.workers.dev\nパスワード: '+password+'\n\nこのファイルは手元で保管してください。GitHubには含まれません。\n', {encoding:'utf8',mode:0o600});
const wrangler=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
// Keys are supplied through stdin, never command arguments, source files or console output.
const result=spawnSync(process.execPath,['--dns-result-order=ipv4first',wrangler,'secret','bulk'],{
  input:JSON.stringify(values),encoding:'utf8',stdio:['pipe','inherit','inherit']
});
if(result.status===0)console.log('ログイン情報を保存しました: '+output);
else console.error('秘密情報の登録に失敗しました。再実行で新しいパスワードを生成します。');
process.exitCode=result.status??1;
