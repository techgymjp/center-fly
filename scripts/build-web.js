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

// Web 版だけの部分(Google Play へのリンク、テスト用フック)はアプリに入れない。
// 「アプリでは隠す」コードが入っていると、iOS の審査で「審査中に隠した機能」(Guideline 5.6)とみなされることがあるため、
// 目印で囲んだ範囲ごと取り除く。HTML は <!-- web-only … --> 〜 <!-- /web-only -->、
// JS は // web-only:start 〜 // web-only:end、CSS は /* web-only:start */ 〜 /* web-only:end */
const WEB_ONLY = [
  /[ \t]*<!-- web-only\b[^>]*-->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g,
  /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end[ \t]*\n?/g,
  /[ \t]*\/\* web-only:start \*\/[\s\S]*?\/\* web-only:end \*\/[ \t]*\n?/g,
];
for (const file of ['index.html', 'style.css', 'game.js', 'i18n.js']) {
  const p = path.join(out, file);
  let text = fs.readFileSync(p, 'utf8');
  for (const re of WEB_ONLY) text = text.replace(re, '');
  fs.writeFileSync(p, text);
}
// 取り除き漏れがあればビルドを止める
for (const file of fs.readdirSync(out)) {
  if (!/\.(html|js|css)$/.test(file)) continue;
  const text = fs.readFileSync(path.join(out, file), 'utf8');
  for (const bad of ['web-only', 'play.google.com', 'storeLink', 'window.CenterFly']) {
    if (text.includes(bad)) {
      console.error(`www/${file} に Web 版だけの部分(${bad})が残っています`);
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
console.log(`built web assets into www/ (ads: ${mode}, version: ${version})`);
