# センターフライ (Center Fly)

センターを守るあなたに、ひたすらセンターフライが飛んでくる。
**100球すべて捕れるか!?** を競うブラウザゲームです。

画面は **野手の背中越しにホームベースを見る3D視点**(ホームラン競争をセンター側から見た構図)。
ナイター照明のスタジアムで、打者・投手・満員のスタンドを正面に見ながら打球を追います。

`index.html` をブラウザで開くだけで遊べます(Web 版はビルド不要)。Android アプリ版もあります(下記)。3D描画に同梱の three.js(`vendor/three.min.js`, MIT License)を使っています。
GitHub Pages などの静的ホスティングにそのまま置けます。

## 言語

日本語と英語に対応しています。端末(ブラウザ)の言語が日本語なら日本語、それ以外は英語で表示し、タイトル画面左下のボタンで切り替えられます(設定は保存)。
文言は `i18n.js` にまとめています(構成は techgymjp/jet-fighter の `js/i18n.js` と同じ)。Android アプリは英語の端末ではアプリ名も「Center Fly」になります。

## 操作

| 操作 | タッチ / マウス | キーボード |
| --- | --- | --- |
| 移動 | 左下の **方角リング** をタッチ(16方位に合わせる・中心からの距離で速さ) | 矢印キー / WASD / テンキー 1〜9(8方向) |
| ダッシュ | ダッシュボタン長押し(スタミナ消費) | Shift / Space / C |
| ジャンプ | ジャンプボタン | Z / J |
| ダイブ | ダイブボタン(移動方向へ飛び込む) | X / K |
| 一時停止 | — | P / Esc |
| 音のオン/オフ | 画面上部のスピーカーボタン | M |
| 着地点ナビのオン/オフ | 画面上部の「ナビ」ボタン | N |

移動方向は画面基準です(上 = 前進 = ホーム方向、下 = バック = フェンス方向)。
捕球は自動です。ボールが近づくと野手がグラブを差し出し、グラブの届く範囲(高さ・距離)にボールが入ると捕れます。
立っているときは高さ 2.3m・半径 1.1m、ジャンプ中は最高 3.8m まで、ダイブ中は飛び込んだ前方 2.5m 先まで届きます。

## 打球の種類

- **普通のフライ** — 落下点に入れば捕れる。
- **前後左右への大きな打球** — ダッシュが必要。
- **頭上を越える深い打球** — 早めに打球を読んで下がらないと間に合わない。
- **前に落ちる低いライナー** — 走るだけでは届かない。**ダイビングキャッチ** で!
- **フェンス際の打球** — フェンスの上を越えていく。フェンス際で **ジャンプ** してホームランキャッチ!
- **風** — 中盤以降は風で打球が流される(画面上部に風向き表示)。

球数が進むほど難しい打球が増えます。

## スマホ

横画面で遊ぶゲームです。縦向きのときは「横向きにしてください」と表示して一時停止します。
対応ブラウザ(Android の Chrome など)ではスタート時に全画面・横向き固定になります。
画面は横長のスマホいっぱいに広がります(縦横比 4:3〜2.4:1)。ホーム画面に追加すると全画面で起動します。

## 見かた

- **着地点ナビ**: 打球が上がると地面に黄色い輪が出ます。最初は大きく、落下が近づくほど落下点に絞られます。
  フェンス際の打球は輪がオレンジになり「ジャンプ!」、走っても間に合わない打球には「ダイブ!」と表示します。

- 芝に落ちるボールの **影** が地面上の位置です。影の動きで落下点を読みましょう。
- 頭上を越える打球など画面外のボールは、画面端の矢印で方向と高さを表示します。
- 右上のミニマップ(画面と同じくホームが上)では打った直後から打球の方向が見えます。
- フェンス際ではカメラがフェンスの外に出て、フェンスが半透明になります。
- スコアは捕り方で加点(普通 100 / ランニング 150 / ジャンピング 250 / ダイビング 300 / ホームランキャッチ 500)+ 連続捕球ボーナス。
- ベスト記録はブラウザに保存されます。
- 結果画面の「結果をシェア」から成績をシェアできます(対応スマホは成績画像つき。X・LINE・コピーにも対応)。
  シェア文には紹介記事 https://techgym.jp/column/claude-code-game-center-fly/ と、ナビあり/なしが入ります。

## 球場の音と演出

音はすべて Web Audio API で合成しています(音声ファイルなし)。

- 球場のざわめき、トランペットと太鼓のオリジナル応援曲(打球が飛んでいる間は音量を絞る)
- 打球が上がると「おおおー」とどよめき、落下が近づくほど大きくなる
- **アウトを取るたびに花火が上がり、大歓声・拍手・指笛**。ダイビング/ジャンピング/ホームランキャッチはエアホーンも鳴り、花火が増える
- 10連続アウトごとに花火の追加とエアホーン
- ヒットやホームランを許すと観客のため息「あー…」
- 試合終了時はファンファーレ。全球捕球なら花火の大連発

## Android アプリ

[Capacitor](https://capacitorjs.com/) でゲームのファイルをアプリに同梱し、Android アプリにしています(オフラインで遊べます)。
構成は techgymjp/jet-fighter の `docs/ANDROID_PORTING.md` と同じです。

- パッケージ名: `jp.techgym.centerfly`
- 横画面固定・全画面・プレイ中は画面を消さない
- 戻るボタン: プレイ中は一時停止(ポーズ画面の「再開」「タイトルへ」ボタンで操作)、タイトル・結果画面ではアプリを終了
- 別アプリに切り替えると自動で一時停止して音を止める
- シェアは Android の共有メニュー
- 広告(AdMob)
  - インタースティシャル: 結果画面の「もう一度」と、結果画面・ポーズ画面の「タイトルへ」を押したとき、毎回
  - リワード: 打球を落としたときに「広告を見てこの球をやり直す」(1 ゲーム 1 回。6 秒で自動的に次の球へ)。見終わると落球を取り消して同じ打球をもう一度。使ったことは結果画面とシェア文に「やり直し1回」と出る
  - バナー: タイトル画面・結果画面・ポーズ画面の下中央だけ(プレイ中は操作ボタンと重なるので出さない)
  - EU など同意が必要な地域ではタイトル画面に「広告の設定」
- タイトル画面にバージョン(ビルド番号)とプライバシーポリシーへのリンク

ビルドは GitHub Actions(`.github/workflows/android.yml`)で行います。

1. `npm ci` → `npm run build`(`www/` に Web ファイルをコピーし、`ads-config.js` と `build-info.js` を生成)→ `npx cap sync android` → `./gradlew assembleDebug`
2. 既定ブランチなら、Release `android-latest` の `center-fly.apk` を差し替え(動作確認用・テスト広告)
   - リリース画面: `https://github.com/techgymjp/center-fly/releases/tag/android-latest`(QR コード: `docs/apk-qr.png`)
   - APK 直接: `https://github.com/techgymjp/center-fly/releases/latest/download/center-fly.apk`
3. GitHub Secrets に署名鍵(`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`)があれば、本番広告で署名付き AAB を作り Artifact に上げる

手元で試すとき: `npm install` → `npm run android:sync` → `npm run android:open`(Android Studio が必要)。
アイコンと起動画面は `assets/` の元画像から `npx @capacitor/assets generate --android` で生成しています。

## ライセンス

著作権はテックジム株式会社に帰属します(All rights reserved)。許可なく複製・改変・再配布すること、Web サイトやアプリ(Google Play、App Store など)として公開・販売すること、名前・ロゴ・アイコン・画像を使うことを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開・広告の掲載・販売などの商用利用は禁止し、著作権表示を残してください。
同梱の three.js は MIT License です。詳しくは [LICENSE](LICENSE) を見てください。

## English

**Center Fly** — you play center field, and 100 fly balls are coming your way. Can you catch them all?
A 3D baseball game viewed from behind the center fielder, looking in toward home plate under the stadium lights.

- Move with the direction ring (or arrow keys / WASD), hold DASH to sprint, JUMP to rob home runs at the wall, DIVE for sinking liners. Catching is automatic.
- The yellow ring on the grass (NAV) shows where the ball will land. Your result shows whether NAV was on.
- Every out sets off fireworks and a big cheer.
- Open `index.html` in a browser to play. An Android app (Capacitor) is also built by GitHub Actions.
- The game switches to English automatically when your device language is not Japanese; you can also switch on the title screen.
