// App Store 用のプロビジョニングプロファイルを App Store Connect API で作り直し、
// Xcode プロジェクトのアプリのターゲット(Release)を手動署名に切り替える。
//
// Xcode の自動署名(-allowProvisioningUpdates)は、まっさらな GitHub の Mac では実行のたびに開発用の証明書を作り、
// 上限に達すると「maximum number of certificates」で Archive が失敗する。
// そこで、登録済みの配布用証明書(Secrets の p12)だけで署名する。
//
// 環境変数: ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH(.p8 のパス)/ IDENTITY_SHA1(キーチェーンに入れた配布用証明書の SHA-1)
// 書き出す環境変数(GITHUB_ENV): PROFILE_NAME / PROFILE_UUID
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BUNDLE_ID = 'jp.techgym.centerfly';
const PROFILE_NAME = 'CenterFly App Store (GitHub Actions)';
const PBXPROJ = 'ios/App/App.xcodeproj/project.pbxproj';
const APP_RELEASE_CONFIG = '504EC3181FED79650016851F /* Release */'; // アプリのターゲットの Release 設定

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, IDENTITY_SHA1, GITHUB_ENV } = process.env;
for (const [k, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, IDENTITY_SHA1 })) {
  if (!v) throw new Error(`${k} が設定されていません`);
}

// App Store Connect API のトークン(ES256 の JWT、有効期限 20 分以内)
function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' })}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: fs.readFileSync(ASC_KEY_PATH, 'utf8'), dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64url')}`;
}
const auth = token();

async function api(method, url, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

// 1. Bundle ID
const bundles = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=200`);
const bundle = bundles.data.find((b) => b.attributes.identifier === BUNDLE_ID);
if (!bundle) throw new Error(`Bundle ID ${BUNDLE_ID} が App Store Connect に見つかりません`);

// 2. Secrets の p12 と同じ配布用証明書(SHA-1 で照合)
const certs = await api('GET', '/v1/certificates?limit=200&fields[certificates]=certificateContent,certificateType,name,expirationDate');
const want = IDENTITY_SHA1.toUpperCase();
const cert = certs.data.find((c) => c.attributes.certificateContent
  && crypto.createHash('sha1').update(Buffer.from(c.attributes.certificateContent, 'base64')).digest('hex').toUpperCase() === want);
if (!cert) throw new Error('Secrets の配布用証明書(IOS_DIST_CERT_P12_BASE64)が App Store Connect に見つかりません。失効していないか確認してください');
console.log(`証明書: ${cert.attributes.name} (${cert.attributes.certificateType}, 期限 ${cert.attributes.expirationDate})`);

// 3. 前回このワークフローが作ったプロファイルを消して、作り直す(同じ名前は作れないため。手作業のプロファイルには触らない)
const old = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&limit=200`);
for (const p of old.data.filter((p) => p.attributes.name === PROFILE_NAME)) await api('DELETE', `/v1/profiles/${p.id}`);
const created = await api('POST', '/v1/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundle.id } },
      certificates: { data: [{ type: 'certificates', id: cert.id }] },
    },
  },
});
const { uuid, profileContent } = created.data.attributes;

// 4. プロファイルを Xcode が読む場所に置く(Xcode 16 以降と、それより前の場所の両方)
for (const dir of [
  path.join(os.homedir(), 'Library/Developer/Xcode/UserData/Provisioning Profiles'),
  path.join(os.homedir(), 'Library/MobileDevice/Provisioning Profiles'),
]) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${uuid}.mobileprovision`), Buffer.from(profileContent, 'base64'));
}

// 5. アプリのターゲットの Release だけ手動署名にする(Swift Package のターゲットには署名の設定を渡さない)
let pbx = fs.readFileSync(PBXPROJ, 'utf8');
const start = pbx.indexOf(APP_RELEASE_CONFIG);
if (start < 0) throw new Error(`${PBXPROJ} にアプリの Release 設定が見つかりません`);
const end = pbx.indexOf('name = Release;', start);
const block = pbx.slice(start, end);
if (!block.includes('CODE_SIGN_STYLE = Automatic;')) throw new Error('アプリの Release 設定に CODE_SIGN_STYLE = Automatic; がありません');
pbx = pbx.slice(0, start) + block.replace('CODE_SIGN_STYLE = Automatic;',
  `CODE_SIGN_STYLE = Manual;\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "${PROFILE_NAME}";`) + pbx.slice(end);
fs.writeFileSync(PBXPROJ, pbx);

if (GITHUB_ENV) fs.appendFileSync(GITHUB_ENV, `PROFILE_NAME=${PROFILE_NAME}\nPROFILE_UUID=${uuid}\n`);
console.log(`プロファイル「${PROFILE_NAME}」(${uuid})を作成し、手動署名に切り替えました`);
