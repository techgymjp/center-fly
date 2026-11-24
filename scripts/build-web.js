// Android / iOS アプリに同梱する Web ファイルを www/ にコピーする(Web 版はリポジトリのファイルをそのまま公開する)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of [
  'index.html', 'style.css', 'manifest.json', 'icon.svg',
  'game.js', 'scene3d.js', 'sound.js', 'ads.js', 'i18n.js', 'vendor',
]) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}

// アプリに入れない部分を、目印で囲んだ範囲ごと取り除く。
// 端末や OS によって「アプリでは隠す」「動きを変える」コードが入っていると、iOS の審査で
// 「審査中に隠した機能」(Guideline 5.6)とみなされることがあるため、アプリにはその OS で使う処理だけを入れる。
//   web-only     … Web 版だけ(Google Play へのリンク、縦向きの案内、テスト用フックなど)。アプリでは常に取り除く
//   android-only … Android アプリだけ(戻るボタン、Android の広告 ID)。APP_PLATFORM=ios のとき取り除く
//   ios-only     … iOS アプリだけ(App Tracking Transparency、iOS の広告 ID)。APP_PLATFORM=android のとき取り除く
// 目印は HTML が <!-- 名前 … --> 〜 <!-- /名前 -->、JS が // 名前:start 〜 // 名前:end、CSS が /* 名前:start */ 〜 /* 名前:end */
const platform = process.env.APP_PLATFORM || '';
if (!['', 'android', 'ios'].includes(platform)) throw new Error(`APP_PLATFORM は android か ios: ${platform}`);
const strip = ['web-only'];
if (platform === 'ios') strip.push('android-only');
if (platform === 'android') strip.push('ios-only');
for (const file of ['index.html', 'style.css', 'game.js', 'i18n.js', 'ads.js']) {
  const p = path.join(out, file);
  let text = fs.readFileSync(p, 'utf8');
  for (const tag of strip) {
    for (const re of [
      new RegExp(`[ \\t]*<!-- ${tag}\\b[^>]*-->[\\s\\S]*?<!-- \\/${tag} -->[ \\t]*\\n?`, 'g'),
      new RegExp(`[ \\t]*\\/\\/ ${tag}:start[\\s\\S]*?\\/\\/ ${tag}:end[ \\t]*\\n?`, 'g'),
      new RegExp(`[ \\t]*\\/\\* ${tag}:start \\*\\/[\\s\\S]*?\\/\\* ${tag}:end \\*\\/[ \\t]*\\n?`, 'g'),
    ]) text = text.replace(re, '');
  }
  // 残した範囲の目印の行も消す
  text = text.replace(/^[ \t]*\/\/ (android|ios)-only:(start|end)[ \t]*\n/gm, '');
  fs.writeFileSync(p, text);
}
// CSS の { } の数がそろっているか(目印の置き場所を間違えて、規則の途中を取り除いていないか)
{
  const css = fs.readFileSync(path.join(out, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) {
    console.error('www/style.css の { } の数がそろっていません。web-only などの目印の位置を確認してください');
    process.exit(1);
  }
}
// 取り除き漏れがあればビルドを止める
const banned = ['web-only', 'play.google.com', 'storeLink', 'window.CenterFly', 'setBot', 'rotate.msg', 'portraitMQ', 'title.sound'];
if (platform === 'ios') banned.push('android', 'Android', 'backButton', 'exitApp');
if (platform === 'android') banned.push('ios-only', 'requestTrackingAuthorization', '4411468910');
for (const file of fs.readdirSync(out)) {
  if (!/\.(html|js|css)$/.test(file)) continue;
  const text = fs.readFileSync(path.join(out, file), 'utf8');
  for (const bad of banned) {
    if (text.includes(bad)) {
      console.error(`www/${file} にアプリに入れない部分(${bad})が残っています(APP_PLATFORM=${platform || '未指定'})`);
      process.exit(1);
    }
  }
}
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (platform: ${platform || 'both'}, ads: ${mode}, version: ${version})`);
