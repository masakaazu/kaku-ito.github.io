# 復習HTMLの運用方針

## 目的

復習HTMLを日付ごとに追加する現在の運用を維持しながら、正答・誤答の記録をSupabaseへ集約する。

教材ごとにSupabase連携を実装するのではなく、共通JavaScriptを1つだけ用意し、すべての復習HTMLから読み込む。

## ディレクトリ構成

```text
kaku-ito.github.io/
├── index.html
├── wbs/
│   └── index.html
├── review/
│   ├── index.html
│   ├── 2026-09-13/
│   │   ├── index.html
│   │   ├── 913no1.html
│   │   ├── 913no2.html
│   │   └── 913no3.html
│   └── 2026-09-14/
│       └── 914no1.html
└── assets/
    └── js/
        └── fe-study-sync.js
```

`assets/js/fe-study-sync.js` は、すべての復習HTMLで共用する同期処理とする。

## 共通JavaScriptの責務

`fe-study-sync.js` に次の処理を集約する。

- Supabaseクライアントの初期化
- ログイン状態の確認
- 回答結果の保存
- 正答数・誤答数の取得
- 苦手問題の判定
- 同期エラーの表示

教材HTMLごとにSupabase接続処理やログイン確認処理を重複して書かない。

## 復習HTML側の変更

各復習HTMLの `</body>` の直前で、共通JavaScriptを1行読み込む。

実際の配置は次の階層になる。

```text
review/YYYY-MM-DD/ファイル名.html
```

この階層からルートの `assets/js` までは2階層戻る必要がある。

```html
<script src="../../assets/js/fe-study-sync.js"></script>
```

パスの数え方:

```text
ファイル自身から見て
../     → review/
../../  → ルート（assets/js/ がある場所）
```

HTMLを別の階層へ置く場合は、実際のフォルダの深さに応じて `../` の数を調整する。**必ずブラウザで読み込みエラーが出ないことを確認してから確定する。**

## 問題IDのルール

各問題には、**全教材を通して重複しない**固定IDを付ける。教材内だけで重複しなければよい、という判断はしない。

命名例:

```text
913no1-c1
913no1-c2
913no2-s1
914no1-d1
```

問題IDには次の要素を必ず含める。

- 教材ファイル名（例：`913no1`）
- 教材内での問題番号（例：`c1`、`s1`、`d1` など、既存の命名でよい）

過去に作成した教材（`913no1.html`、`913no2.html` など）は、短い形式のIDのまま稼働している。**今後新しく作る教材から、上記の命名ルールを適用する。** 既存の短いIDを一括で変更する場合は、Supabase側の既存データも合わせて移行するか、削除してから作業する。

問題を削除・差し替えた場合、別の問題として扱う必要があれば新しいIDを発行する。

## 回答記録のインターフェース

共通JSは、教材側から次の関数を呼び出せるようにする。

```js
recordAnswer(questionId, category, isCorrect);
```

引数の意味:

- `questionId`: 固定の問題ID
- `category`: 問題のカテゴリ
- `isCorrect`: 正解なら `true`、不正解なら `false`

**重要：** 教材ごとに、既存の回答判定関数で使われている変数名は異なる。コピー&ペーストする前に、必ず該当教材の判定関数を確認し、その教材で実際に使われている変数名に置き換える。

既存の回答判定処理で正誤が決まった直後、その関数の**閉じカッコの前**に1行追加する。

判定関数のパターン例:

```js
// 例1：変数名が q, ok の場合
function answer(box, n) {
  // ...正誤判定処理...
  save();

  if (window.recordAnswer) {
    window.recordAnswer(q.id, q.cat, ok);
  }
}

// 例2：変数名が item, picked, ans の場合
function answer(box, btn) {
  // ...正誤判定処理...
  save();

  if (window.recordAnswer) {
    window.recordAnswer(item.id, item.cat || "未分類", picked === ans);
  }
}
```

共通の注意点:

- `recordAnswer(...)` は、必ず判定関数の**内側**に置く（関数の外に置くと変数が見えずエラーになる）
- `window.recordAnswer` の存在チェックを必ず付ける（共通JSの読み込みが遅れても教材を止めないため）
- カテゴリ用のプロパティ名が教材ごとに異なる場合があるため、存在しない場合は `|| "未分類"` などで補う

## Supabaseへ保存する項目

回答結果は、少なくとも次の情報を保存する。

| 項目 | 内容 |
| --- | --- |
| `user_id` | Supabase AuthのユーザーID |
| `review_date` | 教材の日付 |
| `question_id` | 固定の問題ID |
| `category` | 問題カテゴリ |
| `correct_count` | 累計正答回数 |
| `wrong_count` | 累計誤答回数 |
| `last_answer_correct` | 直近の回答が正解かどうか |
| `last_answered_at` | 直近の回答日時 |

保存先のテーブル名は `quiz_results` に統一する。共通JS内の `ANSWERS_TABLE` 定数がこの名前と一致していることを確認する。

同じ問題を複数回解いた場合は、問題IDをキーに正答数・誤答数を更新する。

## ログイン方針

初期方針は次のとおりとする。

- 未ログインでも教材の閲覧と問題演習はできる
- ログイン中だけ回答結果をSupabaseへ保存する
- 未ログイン時は、保存できないことを教材の邪魔にならない形で表示する
- 同期失敗時も、教材の閲覧自体は止めない

WBSと復習HTMLは同じGitHub Pagesドメイン（`https://kaku-ito.github.io/`）で公開する。ローカルのLive Server（`http://127.0.0.1:5500/`）とGitHub Pagesの公開URLは別オリジンとして扱われるため、ログイン状態は共有されない。ログイン状態の同期確認は、必ず公開後の同一ドメイン上で行う。

## 毎日の作業手順

```text
1. 新しい復習HTMLを作成する
2. review/YYYY-MM-DD/ に配置する
3. 問題ごとに固定問題IDを設定する（教材名を含める）
4. 既存の回答判定関数を開き、実際の変数名を確認する
5. 判定関数の内側、save() の直後に recordAnswer(...) を1行追加する
6. HTML末尾で共通JS（../../assets/js/fe-study-sync.js）を読み込む
7. review/index.html または日付別index.htmlからリンクする
8. ローカルまたは公開URLで、表示・回答・同期メッセージを確認する
9. Safariコンソールでエラーが出ていないか確認する
10. GitHub Pages公開後のURLで、再度1問だけ動作確認する
11. GitへPushする
```

将来的には、復習HTML生成用テンプレートに次の3点を含める。

- 共通JSの読み込み（正しい階層のパス）
- `recordAnswer(...)` を呼ぶ回答判定処理（教材ごとの変数名に対応済み）
- 教材名を含む問題IDの命名

これにより、日々の作業を「作る → フォルダへ入れる → 変数名を確認して1行追加 → Pushする」まで減らせる。

## 実装時の確認項目

- [ ] HTMLの階層に合わせて、正しい数の `../` で共通JSを読み込めている
- [ ] 問題IDが教材をまたいで重複していない
- [ ] `recordAnswer(...)` が回答判定関数の内側に書かれている
- [ ] `recordAnswer(...)` に渡す変数が、その教材の実際の変数名と一致している
- [ ] 正解時に `isCorrect === true` で記録される
- [ ] 不正解時に `isCorrect === false` で記録される
- [ ] 未ログインでも教材を閲覧できる
- [ ] 未ログイン時に回答処理で画面エラーが起きない
- [ ] Supabaseへの保存失敗時に教材の操作を継続できる
- [ ] iPhoneとMacで同じユーザーの記録を参照できる（公開URLで確認）
- [ ] GitHub Pages公開URLから共通JSを読み込める
- [ ] Safariコンソールに `ReferenceError` が出ていない

## 公開前の注意

Supabaseの Project URL や Publishable key を共通JSに設定する場合、公開サイトへ配置してよい値だけを使用する。Secret key、service_role key、データベースパスワードなど管理者権限を持つ値は、GitHub Pagesへ絶対に配置しない。

データベース側では、ログインユーザーが自分の回答記録だけを読み書きできるよう、Row Level Security（RLS）を有効にしてポリシーを設定する。