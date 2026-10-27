# App Review 用の説明（下書き）

新しいアカウントの初回審査では「Guideline 2.1 - Information Needed」で、実機での操作の録画と、次の 6 項目の説明を求められることがあります（JET STRIKE の経験）。
App Store Connect のバージョンのページ「App Review に関する情報」→「メモ」に、はじめから英語版を入れておきます。依頼が来たら、画面録画（`docs/IOS_BUILD.md` の 4 章）と一緒に同じ文を返信します。

---

## English（メモ欄・返信に使う）

```
Thank you for reviewing Center Fly.

1. Screen recording
A screen recording on a physical iPhone (latest iOS), starting from app launch, is attached / available at: [URL]

2. Purpose and target audience
Center Fly is a casual 3D baseball game. The player is a center fielder and tries to catch 100 fly balls. It is for general audiences (ages 13 and up) who enjoy simple sports games.

3. How to use the app
No account or login is required. Tap the screen on the title to start. Move with the direction ring at the bottom left, and use the DASH, JUMP and DIVE buttons. Catching is automatic. The yellow ring (NAV) shows where the ball will land. After 100 balls, the result screen shows the score and lets the player share it.

4. External services
The app uses Google AdMob to show banner, interstitial and rewarded ads. Banner ads appear only on the title, result and pause screens, not during play. After the Google consent check (UMP), the app asks for App Tracking Transparency permission once. Ads still work if the user declines. Rewarded ads are optional: after dropping a ball, the player can watch an ad to try the same ball again (up to 5 times per game). The app uses the iOS share sheet to share results. There is no server, account system or in-app purchase.

5. Regional differences
The game is the same in all regions. The display language is Japanese on Japanese devices and English elsewhere. The Google consent form appears only in regions where it is required (such as the EEA and the UK).

6. Regulated industries and third-party content
The app is not in a regulated industry. All graphics and sounds are original (sounds are generated in the app with the Web Audio API). The app includes the three.js library under the MIT License.
```

---

## 日本語（内容の確認用）

1. **画面録画**：最新の iOS の実機（iPhone）で、アプリの起動から撮った録画を添付／URL を記載
2. **目的と対象者**：センターを守り、100 球のフライを捕るカジュアルな 3D 野球ゲーム。シンプルなスポーツゲームを楽しむ一般の利用者（13 歳以上）向け
3. **使い方**：アカウント・ログインは不要。タイトルでタップして開始。左下の方角リングで移動、ダッシュ・ジャンプ・ダイブのボタン。捕球は自動。黄色い輪（ナビ）が落下点を示す。100 球のあと結果画面でスコアを表示・シェアできる
4. **外部サービス**：Google AdMob（バナー・インタースティシャル・リワード。バナーはタイトル・結果・ポーズ画面だけで、プレイ中は出さない）。Google の同意確認（UMP）のあと、App Tracking Transparency の確認を一度だけ行う。断られても広告は出る。リワード広告は任意で、落球したときに広告を見ると同じ打球をもう一度受けられる（1 ゲーム 5 回まで）。シェアは iOS の共有メニュー。サーバー・アカウント・アプリ内課金はない
5. **地域による違い**：どの地域でも同じ。日本語の端末では日本語、それ以外は英語で表示。Google の同意フォームは必要な地域（EEA・英国など）でだけ出る
6. **規制業種・第三者の素材**：規制業種ではない。絵と音はすべて自前（音はアプリ内で Web Audio API により合成）。three.js（MIT ライセンス）を同梱

`[URL]` は、録画を Google ドライブなどに置いた場合の共有リンクに差し替えてください。
