'use strict';
// 表示言語(日本語 / 英語)。端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替えも可能
// 構成は techgymjp/jet-fighter の js/i18n.js と同じ
window.I18N = (() => {
  const dict = {
    ja: {
      'doc.title': 'センターフライ',
      'rotate.msg': 'スマホを横向きにしてください',
      'rotate.sub': 'センターフライは横画面で遊ぶゲームです',
      'legal.privacy': 'プライバシーポリシー',
      'legal.adSettings': '広告の設定',
      'url.privacy': 'https://techgym.jp/privacy-policy/',

      'btn.dash': 'ダッシュ', 'btn.jump': 'ジャンプ', 'btn.dive': 'ダイブ',
      'ring.fwd': '前進', 'ring.back': 'バック',
      'nav.btn': 'ナビ {s}',

      'title.name': 'センターフライ',
      'title.sub': '100球のフライ、全部捕れるか!?',
      'help.touch.1': '移動 : 左下の方角リングをタッチ(16方位・中心から離すほど速い)',
      'help.touch.2': 'ダッシュ : ダッシュボタンを押している間(スタミナ消費)',
      'help.touch.3': 'ジャンプ : ジャンプボタン — フェンス際の打球は「ホームランキャッチ」',
      'help.touch.4': 'ダイブ : ダイブボタン — 前に落ちるライナーは飛び込んで捕れ!',
      'help.touch.5': '捕球は自動。芝に落ちるボールの「影」で落下点を読もう。',
      'help.touch.6': '黄色い輪が着地点ナビ(上の「ナビ」ボタンでオン/オフ)',
      'help.key.1': '移動 : 方角リングをタッチ / 矢印キー・WASD・テンキー(8方向)',
      'help.key.2': 'ダッシュ : ダッシュボタン長押し / Shift・Space(スタミナ消費)',
      'help.key.3': 'ジャンプ : Z  — フェンス際の打球はジャンプで「ホームランキャッチ」',
      'help.key.4': 'ダイブ : X  — 前に落ちるライナーは飛び込んで捕れ!',
      'help.key.5': '捕球は自動。芝に落ちるボールの「影」で落下点を読もう。',
      'help.key.6': '黄色い輪が着地点ナビ(N キーでオン/オフ)。M : 音のオン/オフ',
      'title.best': 'ベスト: {c} / {t} 球  (SCORE {s})',
      'title.start.touch': 'タップでプレイボール',
      'title.start.key': 'SPACE / タップでプレイボール',
      'title.sound': '音が鳴ります(M キー / 上のボタンで消音)。iPhone はマナーモードを解除してください',

      'hud.pitch': '第 {n} 球 / {t}',
      'hud.catches': '捕球 {n}', 'hud.misses': '落球 {n}', 'hud.streak': '連続 {n}',
      'hud.dash': 'ダッシュ',
      'hud.wind': '風 {d} {s}', 'hud.windStrong': '強', 'hud.windWeak': '弱',
      'ready.pitch': '第 {n} 球',
      'ready.wind': '風が {d}方向に吹いている', 'ready.left': 'レフト', 'ready.right': 'ライト',
      'pause.title': 'PAUSE', 'pause.resume': 'P / Esc / タップで再開',
      'ind.over': '頭上を越える!',
      'hint.jump': 'ジャンプ!', 'hint.dive': 'ダイブ!',
      'sound.tap': '音が出ないときはタップ',

      'catch.hr': 'ホームランキャッチ!!', 'catch.jump': 'ジャンピングキャッチ!',
      'catch.dive': 'ダイビングキャッチ!!', 'catch.running': 'ランニングキャッチ!', 'catch.normal': 'キャッチ',
      'miss.hr': 'ホームラン…', 'miss.hit': 'ヒット…',
      'streak': '{n} 連続アウト!',

      'rank.0': '草野球', 'rank.1': '二軍', 'rank.2': '守備固め要員',
      'rank.3': '不動のレギュラー', 'rank.4': 'ゴールデングラブ', 'rank.5': '伝説の名手',

      'over.title': 'ゲームセット',
      'over.catches': '{c} / {t} 球 捕球',
      'over.perfect': '★ パーフェクト!! 全球捕球 ★',
      'over.rank': '称号: {r}',
      'over.line1': 'SCORE {s}   最大連続捕球 {k}   {nav}',
      'over.line2': 'ダイビング {d}  ジャンピング {j}  ホームランキャッチ {h}  ランニング {r}',
      'over.new': 'NEW RECORD!',
      'over.best': 'ベスト: {c} 球 (SCORE {s})',
      'over.retry.touch': 'ここをタップでもう一度',
      'over.retry.key': 'SPACE / ここをタップでもう一度',
      'nav.on': 'ナビあり', 'nav.off': 'ナビなし', 'nav.redo': '・やり直し{n}回',
      'over.retryBtn': 'もう一度',
      'redo.watch': '▶ 広告を見てこの球をやり直す',
      'redo.next': 'つぎへ ({s})',
      'redo.loading': '広告を読み込み中…',
      'redo.fail': '広告を読み込めませんでした',
      'redo.note': '1ゲームに1回だけ、落とした打球をもう一度受けられます',

      'share.btn': '📤 結果をシェア', 'share.post': '𝕏 ポスト', 'share.copy': 'コピー',
      'share.title': 'センターフライ', 'share.dialog': '結果をシェア',
      'share.msg.native': '共有メニューからシェアできます',
      'share.msg.image': '成績画像つきでシェアできます',
      'share.msg.links': 'X・LINE・コピーからシェアしてください',
      'share.copied': '結果をコピーしました!SNSに貼り付けてください',
      'share.copyFail': 'コピーできませんでした。X・LINEボタンを使ってください',
      'share.perfect': '【パーフェクト!】',
      'share.text': '⚾センターフライで{c}/{t}球捕球!{p}\n称号:{r} SCORE {s}({nav})\nダイビング{d}・ホームランキャッチ{h}・最大{k}連続\n#センターフライ #ClaudeCode',
      'card.head': 'センターフライ({nav})',
      'card.catches': '{c}/{t}球',
      'card.rank': '称号:{r}',
      'card.line1': 'SCORE {s} ・ 最大{k}連続アウト',
      'card.line2': 'ダイビング{d} ジャンピング{j} HRキャッチ{h}',
      'card.tags': '#センターフライ  #ClaudeCode',
    },
    en: {
      'doc.title': 'Center Fly',
      'rotate.msg': 'Please rotate your phone to landscape',
      'rotate.sub': 'Center Fly is played in landscape mode',
      'legal.privacy': 'Privacy Policy',
      'legal.adSettings': 'Ad settings',
      'url.privacy': 'https://techgym.jp/privacy-policy-en/',

      'btn.dash': 'DASH', 'btn.jump': 'JUMP', 'btn.dive': 'DIVE',
      'ring.fwd': 'IN', 'ring.back': 'BACK',
      'nav.btn': 'NAV {s}',

      'title.name': 'CENTER FLY',
      'title.sub': '100 fly balls. Can you catch them all?',
      'help.touch.1': 'Move: touch the direction ring (16 directions; farther from center = faster)',
      'help.touch.2': 'Dash: hold the DASH button (uses stamina)',
      'help.touch.3': 'Jump: JUMP button — rob home runs at the wall',
      'help.touch.4': 'Dive: DIVE button — lay out for sinking liners!',
      'help.touch.5': 'Catching is automatic. Read the landing spot from the ball\'s shadow.',
      'help.touch.6': 'The yellow ring shows where the ball will land (toggle with NAV)',
      'help.key.1': 'Move: direction ring / arrow keys, WASD or numpad (8 directions)',
      'help.key.2': 'Dash: hold DASH / Shift or Space (uses stamina)',
      'help.key.3': 'Jump: Z — rob home runs at the wall',
      'help.key.4': 'Dive: X — lay out for sinking liners!',
      'help.key.5': 'Catching is automatic. Read the landing spot from the ball\'s shadow.',
      'help.key.6': 'Yellow ring = landing guide (N to toggle).  M: sound on/off',
      'title.best': 'Best: {c} / {t}  (SCORE {s})',
      'title.start.touch': 'Tap to play ball',
      'title.start.key': 'SPACE / Tap to play ball',
      'title.sound': 'This game has sound (M key / top button to mute). On iPhone, turn off silent mode.',

      'hud.pitch': 'Ball {n} / {t}',
      'hud.catches': 'Outs {n}', 'hud.misses': 'Drops {n}', 'hud.streak': 'Streak {n}',
      'hud.dash': 'DASH',
      'hud.wind': 'Wind {d} {s}', 'hud.windStrong': 'strong', 'hud.windWeak': 'light',
      'ready.pitch': 'Ball {n}',
      'ready.wind': 'Wind blowing toward {d} field', 'ready.left': 'left', 'ready.right': 'right',
      'pause.title': 'PAUSE', 'pause.resume': 'P / Esc / Tap to resume',
      'ind.over': 'Over your head!',
      'hint.jump': 'JUMP!', 'hint.dive': 'DIVE!',
      'sound.tap': 'No sound? Tap here',

      'catch.hr': 'HOME RUN ROBBED!!', 'catch.jump': 'LEAPING CATCH!',
      'catch.dive': 'DIVING CATCH!!', 'catch.running': 'RUNNING CATCH!', 'catch.normal': 'CAUGHT',
      'miss.hr': 'Home run...', 'miss.hit': 'Base hit...',
      'streak': '{n} outs in a row!',

      'rank.0': 'Sandlot Player', 'rank.1': 'Minor Leaguer', 'rank.2': 'Defensive Sub',
      'rank.3': 'Everyday Starter', 'rank.4': 'Gold Glover', 'rank.5': 'Legendary Center Fielder',

      'over.title': 'GAME OVER',
      'over.catches': '{c} / {t} caught',
      'over.perfect': '★ PERFECT!! Every ball caught ★',
      'over.rank': 'Rank: {r}',
      'over.line1': 'SCORE {s}   Best streak {k}   {nav}',
      'over.line2': 'Diving {d}  Leaping {j}  HR robbed {h}  Running {r}',
      'over.new': 'NEW RECORD!',
      'over.best': 'Best: {c} (SCORE {s})',
      'over.retry.touch': 'Tap here to play again',
      'over.retry.key': 'SPACE / Tap here to play again',
      'nav.on': 'NAV on', 'nav.off': 'NAV off', 'nav.redo': ', {n} redo',
      'over.retryBtn': 'Play again',
      'redo.watch': '▶ Watch an ad to redo this ball',
      'redo.next': 'Next ({s})',
      'redo.loading': 'Loading ad…',
      'redo.fail': 'Could not load an ad',
      'redo.note': 'Once per game, you can try a dropped ball again',

      'share.btn': '📤 Share result', 'share.post': '𝕏 Post', 'share.copy': 'Copy',
      'share.title': 'Center Fly', 'share.dialog': 'Share result',
      'share.msg.native': 'Share from the share menu',
      'share.msg.image': 'Share with a result card image',
      'share.msg.links': 'Share via X, LINE or copy',
      'share.copied': 'Copied! Paste it into your social media',
      'share.copyFail': 'Could not copy. Please use the X or LINE button',
      'share.perfect': ' PERFECT GAME!',
      'share.text': '⚾I caught {c}/{t} fly balls in Center Fly!{p}\nRank: {r}  SCORE {s} ({nav})\n{d} diving catches, {h} home runs robbed, best streak {k}\n#CenterFly #ClaudeCode',
      'card.head': 'CENTER FLY ({nav})',
      'card.catches': '{c}/{t} caught',
      'card.rank': 'Rank: {r}',
      'card.line1': 'SCORE {s} ・ Best streak {k}',
      'card.line2': 'Diving {d}  Leaping {j}  HR robbed {h}',
      'card.tags': '#CenterFly  #ClaudeCode',
    },
  };

  const STORE_KEY = 'centerfly.lang';
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* 保存不可 */ }
  const deviceLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
  let lang = dict[saved] ? saved : (/^ja\b/i.test(deviceLang) ? 'ja' : 'en');
  const listeners = [];

  // t('hud.pitch', { n: 3, t: 100 }) → '第 3 球 / 100'
  function t(key, vars) {
    let s = dict[lang][key];
    if (s === undefined) s = dict.ja[key];
    if (s === undefined) return key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
  }

  // data-i18n(文字)/ data-i18n-href(リンク先)の付いた要素を書き換える
  function apply() {
    document.documentElement.lang = lang;
    document.title = t('doc.title');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-href]').forEach((el) => { el.href = t(el.dataset.i18nHref); });
    document.querySelectorAll('[data-lang]').forEach((el) => el.classList.toggle('on', el.dataset.lang === lang));
  }

  function setLang(l) {
    if (!dict[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (e) { /* 保存不可 */ }
    apply();
    listeners.forEach((f) => f(l));
  }

  return {
    t, apply, setLang,
    get lang() { return lang; },
    onChange(f) { listeners.push(f); },
  };
})();
