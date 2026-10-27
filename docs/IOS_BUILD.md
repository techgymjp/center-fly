# iOS 版をビルドして App Store に出す手順（Mac での作業）

センターフライの iOS 版は、Android 版と同じ Capacitor で作っています（`ios/` フォルダ）。構成は techgymjp/jet-fighter（JET STRIKE）と同じです。
コードの準備はできているので、Mac では「ビルドして App Store Connect にアップロードする」作業だけを行います。

- Bundle ID：`jp.techgym.centerfly`（Android のパッケージ名と同じ）
- チーム：Team ID `GNM3VTX9YG`（Xcode の設定に入れてあります）。Apple Developer には**個人で登録**しています（App Store の販売元は個人名になります）
- 対応端末：iPhone（横画面固定）。iPad では iPhone 用の画面で動きます
- ホーム画面の名前：日本語の端末では「センターフライ」、それ以外では「Center Fly」
- 広告：AdMob（iOS 用のアプリと広告ユニット）。インタースティシャル（「もう一度」「タイトルへ」のとき）、リワード（落球のやり直し、1 ゲーム 5 回まで）、バナー（タイトル・結果・ポーズ画面の下）。起動時に「トラッキングの許可」の確認画面が出ます

---

## 0. ブラウザでの準備（最初の1回だけ）

1. **Apple Developer**（developer.apple.com）→「Certificates, Identifiers & Profiles」→「Identifiers」→「＋」→「App IDs」→「App」
   - Description：`Center Fly`
   - Bundle ID：「Explicit」で `jp.techgym.centerfly`
   - Capabilities：何もチェックしない
2. **App Store Connect**（appstoreconnect.apple.com）→「マイ App」→「＋」→「新規 App」
   - プラットフォーム：iOS ／ 名前：`センターフライ 〜100球、全部捕れるか〜`（Google Play と同じ。30 文字以内）／ プライマリ言語：日本語
   - バンドル ID：`jp.techgym.centerfly` ／ SKU：`centerfly`（あとから変更不可）／ ユーザアクセス：アクセス制限なし
3. **AdMob**
   - 「アプリを追加」→ **iOS** →「ストアに掲載されていない」で登録し、インタースティシャル・リワード・バナーの広告ユニットを作る
   - アプリ ID と広告ユニット ID を Claude Code に渡す（`ios/App/App/Info.plist` の `GADApplicationIdentifier` と `ads.js` の `UNITS.ios.production` に入れます。**入れるまではテスト広告の ID のまま**）
   - 「プライバシーとメッセージ」→「欧州の規制」のメッセージに iOS アプリも追加する

---

## 1. Mac の準備（最初の1回だけ）

1. **Xcode** を App Store からインストールする（数十 GB あるので時間がかかります）。インストール後に一度起動し、追加コンポーネントのインストールを済ませる
2. Xcode の「Settings…」→「Accounts」→「＋」で、Apple Developer に登録している Apple ID でサインインする（チームが個人名で表示されれば OK）
3. **Node.js**（LTS 版）を https://nodejs.org/ からインストールする
4. ターミナルでリポジトリを取得する
   ```bash
   cd ~/Desktop   # 置きたい場所（どこでもよい）
   git clone https://github.com/techgymjp/center-fly.git
   cd center-fly
   npm ci
   ```
   `git` がないと言われたら、表示に従って「コマンドライン・デベロッパツール」をインストールしてから、もう一度実行します。

2回目以降は、`cd center-fly` のあと `git pull` と `npm ci` で最新にします。

---

## 2. 自分の iPhone で動作確認する（テスト広告）

```bash
npm run ios:sync    # ゲームのファイルを iOS のプロジェクトにコピー（テスト広告）
npm run ios:open    # Xcode で開く
```

1. iPhone を USB ケーブルで Mac につなぎ、iPhone で「このコンピュータを信頼」を許可する
2. iPhone の「設定」→「プライバシーとセキュリティ」→「デベロッパモード」をオンにする（再起動を求められます。項目がない場合は、Xcode で一度 iPhone を選ぶと表示されます）
3. Xcode の上部で、実行先に自分の iPhone を選ぶ
4. 左の「App」→「Signing & Capabilities」で、「Automatically manage signing」がオン、Team に自分（個人名）のチームが選ばれていることを確認する
5. ▶（Run）を押すと、iPhone にアプリが入って起動する

確認すること：

- 横画面で全画面表示になる。左右の端（Dynamic Island 側）や下のホームバーに、方角リングやボタンがかからない
- 起動時にトラッキングの確認画面が出る（2回目以降は出ない）
- 移動・ダッシュ・ジャンプ・ダイブができる。タップすると音が鳴る（**マナーモードでも鳴るか**も確認）
- 打球を落とすと「広告を見てこの球をやり直す」が出て、**テスト広告**のリワードが流れ、同じ打球をもう一度受けられる
- 結果画面の「もう一度」「タイトルへ」、ポーズ画面の「タイトルへ」で**テスト広告**のインタースティシャルが出る
- タイトル・結果・ポーズ画面の下中央に**テスト広告**のバナーが出る（プレイ中は出ない）
- 結果画面の「結果をシェア」で iPhone の共有メニューが出る
- ホームに戻る→アプリに戻ると一時停止している（音も止まっている）

---

## 3. App Store 用にビルドしてアップロードする（本番広告）

```bash
git pull && npm ci
npm run ios:release   # 本番の広告 ID でコピーする（ここが ios:sync と違う）
npm run ios:open
```

1. Xcode の左で「App」→「General」→「Identity」を開き、**Build の番号を前回より大きくする**（初回は 1。アップロードのたびに 2、3…と上げる。同じ番号は二度アップロードできない）。Version は `1.0.0`
2. 上部の実行先を「**Any iOS Device (arm64)**」にする
3. メニューの「Product」→「**Archive**」（メニューバーは画面の最上部。全画面表示だと隠れるので、マウスを画面の上端に動かす）
4. 終わると Organizer が開くので、「**Distribute App**」→「**App Store Connect**」→「Upload」で進める（途中の確認は既定のまま「Next」でよい）
5. 10〜30 分ほどで、App Store Connect の「TestFlight」タブにビルドが表示される

輸出コンプライアンス（暗号化）の質問は、Info.plist で「独自の暗号化は使っていない」と設定済みなので、聞かれません。

**注意**：`ios:release` でビルドしたアプリは本番の広告が出ます。TestFlight で確認するときも、**本番の広告はタップしない**でください（AdMob のアカウント停止の対象）。Xcode から iPhone に直接入れて試すときは、`npm run ios:sync` でテスト広告に戻してから実行します。

---

## 4. TestFlight で確認し、審査用の画面録画を撮る

1. App Store Connect の「TestFlight」→「内部テスト」でグループを作り、自分を追加する
2. iPhone に「TestFlight」アプリを App Store から入れ、届いた招待からセンターフライをインストールする
3. **審査用の画面録画を撮る**（新しいアカウントの初回審査で求められる。先に用意しておくと早い）
   - iPhone の「設定」→「コントロールセンター」に「画面収録」を追加し、コントロールセンターから録画を始める
   - **アプリの起動から**撮る：起動 → トラッキングの確認 → タイトル → プレイ（移動・ダッシュ・ダイブ・ジャンプ・捕球）→ 落球して「やり直し」→ 結果画面 → シェア → 「もう一度」
   - 本番広告が出ても**タップしない**（閉じるボタンだけ押す）
   - ファイルが大きいと App Review への返信で添付できない（400MB でも失敗した例あり）。Mac の Finder で右クリック →「選択したビデオファイルをエンコード」→ 720p で小さくするか、Google ドライブの共有リンクを返信文に貼る

---

## 5. App Store Connect で審査に出す

「配信」タブ（iOS App のバージョン 1.0.0）で入力します。**バージョンが「1.0」になっていたら「1.0.0」に直して保存**します（違うとアップロードしたビルドが選べない）。

| 項目 | 入力内容 |
| --- | --- |
| スクリーンショット | 「Dynamic Island 搭載 iPhone（中型ディスプレイ）」の欄に、`docs/store/ios/6.3inch/` の 2622 × 1206（横向き）を入れる。日本語版（ja-）と英語版（en-）各 4 枚。6.9 インチ（2868 × 1320）は受け付けられなかった（JET STRIKE の経験） |
| ヘッダ・検索結果 | 「ヘッダと検索結果」タブに `docs/store/ios/appstore-header-3840x1646.png` と `appstore-search-3840x2560.png`（ヘッダを入れたら検索結果も入れないと赤枠になる） |
| 名前・サブタイトル・プロモーション用テキスト・概要・キーワード | `docs/store/ios/listing-appstore.md`（日本語・英語） |
| サポート URL | https://techgym.jp/ |
| プライバシーポリシー URL（App 情報・App のプライバシー） | https://techgym.jp/privacy-policy/ |
| カテゴリ（App 情報） | ゲーム ／ サブカテゴリ「スポーツ」 |
| コンテンツの配信権（App 情報） | 第三者のコンテンツ：「いいえ」（絵・音はすべて自前。three.js は MIT ライセンスのライブラリ） |
| 著作権 | 2026 TECH GYM K.K. |
| ビルド | TestFlight で確認したビルドを選ぶ |
| 年齢制限 | 質問に答える（暴力・流血・性的表現・ギャンブルなし。野球のゲーム） |
| App のプライバシー | AdMob が収集するデータを申告する（下記） |
| App Review に関する情報 | ログイン不要。連絡先を入力。メモに `docs/store/ios/review-notes.md` の文を入れる |

**App のプライバシー（AdMob を使うアプリの目安）**
Google の「Apple の App Store のデータ開示要件への準備」（AdMob のヘルプ）に、AdMob が収集するデータの一覧があります。必ずそちらを見て最終確認してください。目安は次のとおりです。

- 収集する：ID（デバイス ID）、使用状況データ（広告データ、製品の操作）、診断（クラッシュデータ、パフォーマンスデータ、その他の診断データ）、位置情報（おおよその場所）
- 目的：サードパーティ広告、アナリティクス
- ユーザーに関連付け：しない
- トラッキングに使用：デバイス ID と広告データは「する」

入力が終わったら「審査用に追加」→「審査へ提出」。

**初回審査で「Guideline 2.1 - Information Needed」が来たら**：4 章で撮った画面録画と、`docs/store/ios/review-notes.md` の文を App Review への返信で送ります（同じ文をバージョンのページの「メモ」にも入れる）。

---

## 6. 公開後にやること

- AdMob で iOS アプリを App Store のアプリに紐づける（「アプリ」→ iOS のセンターフライ →「アプリの設定」）
- App Store からインストールして、起動・同意画面・トラッキングの確認・広告を確認する

---

## 7. 自動化の準備（2回目以降を GitHub Actions に任せる場合）

JET STRIKE の `docs/IOS_BUILD.md` の 7 章と同じです。App Store Connect の API キーと配布用の証明書（.p12）は、JET STRIKE で作ったものを使い回せます。
このリポジトリの Secrets（https://github.com/techgymjp/center-fly/settings/secrets/actions）に、次の 5 つを登録してから、Claude Code に「iOS の自動アップロードのワークフローを作って」と頼みます。

| 名前 | 内容 |
| --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | 証明書（.p12）を `base64 -i 証明書.p12 \| tr -d '\n' \| pbcopy` で変換した文字列 |
| `IOS_DIST_CERT_PASSWORD` | .p12 を書き出したときのパスワード |
| `ASC_KEY_ID` | API キーのキー ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8_BASE64` | API キー（.p8）を変換した文字列 |

**注意**：証明書（.p12）、そのパスワード、API キー（.p8）は、チャット・AI へのアップロード・リポジトリへのコミットで**絶対に共有しない**でください。

いまは `.github/workflows/ios.yml` で、push のたびに「Xcode でビルドできるか」だけを確認しています（署名なし・シミュレーター向け。公開リポジトリなので無料）。

---

## つまずきやすいところ

| 症状 | 対処 |
| --- | --- |
| アップロードで「同じビルド番号がすでにある」 | General の Build の番号を上げてから Archive し直す |
| Signing でエラー（チームが選べない、証明書がない） | Xcode の Accounts で Apple ID にサインインし直し、Team に自分のチームを選ぶ。「Automatically manage signing」をオンにする |
| 実行先に iPhone が出ない | ケーブルをつなぎ直し、iPhone で「信頼」を許可。デベロッパモードをオンにする |
| 実行先に「iOS 26.x Not Installed」と出る | 「Get」で iOS のシミュレーターと部品をダウンロードする（8 GB ほど。Archive にも必要） |
| ビルドが古いゲームのまま | `npm run ios:sync`（または `ios:release`）を実行し忘れている。`git pull` してから実行し直す |
| アップロードしたビルドが選べない | App Store Connect のバージョンが「1.0」のまま。「1.0.0」に直して保存する |
| 「審査用に追加できません」 | 「App 情報」のコンテンツの配信権、「App のプライバシー」のプライバシーポリシー URL が未入力 |
| Archive で「Xcode Cloud can automate…」が出る | 「Remind Me Later」で閉じてよい |
| 音が鳴らない | 一度画面をタップする（タップで音が有効になる）。音量とスピーカーボタン（上部）を確認 |
| App Store の審査で「Xcode が古い」と言われる | Xcode を最新版に更新してから Archive し直す |
