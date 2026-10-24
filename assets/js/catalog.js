/*
  サイト全体の目次データ（このファイルが唯一の登録先）

  教材を追加したら、materials の該当資格に1行追加するだけで
  トップ・資格ページ・分野マップ・中分類ページ・ナビバーに自動で反映される。

  教材1件の書き方:
    { type: "note", file: "notes/apno1.html", title: "…", desc: "…", fields: [10] }

    type    教材の型。note（ノート）／terms（用語集）／quiz（問題演習）
    file    資格フォルダ（ap/ や fe/）から見たファイルの場所
    fields  シラバスの中分類番号（下の fields 一覧）。複数の分野にまたがるときは複数書く
    date    （任意）日付ごとにまとめる教材の学習日 "YYYY-MM-DD"（topics の days と組み合わせる）
    qid     （任意）回答記録の問題IDの頭。省略すると用語集は "ap-20-"、それ以外はファイル名＋"-"（例: "927no5-"）
    pdf     （任意）図解スライドのPDF。資格フォルダから見た場所
    ids     （任意）日別復習などから移してきた問題の元の問題ID。回答記録を引き継ぐ。
            「927no5-」のように「-」で終わるものは、頭が一致するIDをすべて含む

  試験日は topics の exams に { label, date: "YYYY-MM-DD" } で書く。
*/
window.SITE_CATALOG = {
  siteName: "資格学習支援サイト",

  /* 教材の型（表示名と並び順） */
  types: {
    note: { label: "ノート", icon: "NOTE" },
    terms: { label: "用語集", icon: "TERM" },
    quiz: { label: "問題演習", icon: "QUIZ" },
  },

  /* シラバスの分類（基本情報・応用情報で共通） */
  groups: [
    { id: "technology", name: "テクノロジ系", en: "Technology" },
    { id: "management", name: "マネジメント系", en: "Management" },
    { id: "strategy", name: "ストラテジ系", en: "Strategy" },
  ],

  fields: [
    { no: 1, group: "technology", major: "基礎理論", name: "基礎理論" },
    { no: 2, group: "technology", major: "基礎理論", name: "アルゴリズムとプログラミング" },
    { no: 3, group: "technology", major: "コンピュータシステム", name: "コンピュータ構成要素" },
    { no: 4, group: "technology", major: "コンピュータシステム", name: "システム構成要素" },
    { no: 5, group: "technology", major: "コンピュータシステム", name: "ソフトウェア" },
    { no: 6, group: "technology", major: "コンピュータシステム", name: "ハードウェア" },
    { no: 7, group: "technology", major: "技術要素", name: "ユーザーインタフェース" },
    { no: 8, group: "technology", major: "技術要素", name: "情報メディア" },
    { no: 9, group: "technology", major: "技術要素", name: "データベース" },
    { no: 10, group: "technology", major: "技術要素", name: "ネットワーク" },
    { no: 11, group: "technology", major: "技術要素", name: "セキュリティ" },
    { no: 12, group: "technology", major: "開発技術", name: "システム開発技術" },
    { no: 13, group: "technology", major: "開発技術", name: "ソフトウェア開発管理技術" },
    { no: 14, group: "management", major: "プロジェクトマネジメント", name: "プロジェクトマネジメント" },
    { no: 15, group: "management", major: "サービスマネジメント", name: "サービスマネジメント" },
    { no: 16, group: "management", major: "サービスマネジメント", name: "システム監査" },
    { no: 17, group: "strategy", major: "システム戦略", name: "システム戦略" },
    { no: 18, group: "strategy", major: "システム戦略", name: "システム企画" },
    { no: 19, group: "strategy", major: "経営戦略", name: "経営戦略マネジメント" },
    { no: 20, group: "strategy", major: "経営戦略", name: "技術戦略マネジメント" },
    { no: 21, group: "strategy", major: "経営戦略", name: "ビジネスインダストリ" },
    { no: 22, group: "strategy", major: "企業と法務", name: "企業活動" },
    { no: 23, group: "strategy", major: "企業と法務", name: "法務" },
  ],

  /* 資格（トップに並ぶ順） */
  topics: {
    ap: {
      name: "応用情報技術者試験",
      short: "応用情報",
      icon: "AP",
      status: "学習中",
      active: true,
      desc: "分野ごとにノート・用語集・問題演習を積み上げる。",
      exams: [
        { label: "科目A", date: "2027-02-14" },
        { label: "科目B", date: "2027-03-07" },
      ],
    },
    fe: {
      name: "基本情報技術者試験",
      short: "基本情報",
      icon: "FE",
      status: "受験済み",
      active: false,
      desc: "全23分野を、PDF・一覧・カード・クイズの用語集にまとめ直した。",
      exams: [{ label: "試験日", date: "2026-10-03" }],
    },
  },

  materials: {
    ap: [
      { type: "note", file: "notes/apno1.html", title: "TCP/IPとHTTP", desc: "アプリケーション層とHTTPプロトコル", fields: [10] },
      { type: "note", file: "notes/apno2.html", title: "OS仮想化とコンテナ", desc: "仮想化方式とコンテナ型仮想化", fields: [4] },
      { type: "note", file: "notes/apno3.html", title: "HTTPSとTLS", desc: "安全なWeb通信とTLSハンドシェイク", fields: [11] },
      { type: "note", file: "notes/apno4.html", title: "仮想記憶とページング", desc: "ページフォールトとスラッシング", fields: [5] },
      { type: "note", file: "notes/apno5.html", title: "仮想記憶とページング（補足）", desc: "OS・仮想化の性能問題", fields: [5] },
      { type: "note", file: "notes/apno6.html", title: "リレーショナルDBとSQL", desc: "SELECTとJOINの基本", fields: [9] },
      { type: "note", file: "notes/apno7.html", title: "OSI参照モデルとTCP/IP", desc: "ネットワークの層と障害切り分け", fields: [10] },
      { type: "note", file: "notes/apno8.html", title: "トランザクションとACID", desc: "データベースの同時実行制御", fields: [9] },
      { type: "note", file: "notes/apno9.html", title: "ITSM・ITIL・SLA", desc: "ITサービスマネジメント", fields: [15] },
      { type: "note", file: "notes/apno10.html", title: "SLAとサービス可用性", desc: "ナインとダウンタイム", fields: [15] },
      { type: "note", file: "notes/apno11.html", title: "OS仮想化とコンテナ（補足）", desc: "VMとコンテナの使い分け", fields: [4] },
      { type: "note", file: "notes/apno12.html", title: "トランザクションとACID（補足）", desc: "FEからAPへの発展", fields: [9] },
      { type: "note", file: "notes/apno13.html", title: "データベースの正規化", desc: "第1〜第3正規形", fields: [9] },
      { type: "note", file: "notes/apno14.html", title: "トランザクションとACID（復旧）", desc: "ログと障害復旧", fields: [9] },
      { type: "note", file: "notes/apno15.html", title: "情報セキュリティのリスク対応", desc: "回避・低減・移転・保有", fields: [11] },

      { type: "terms", file: "terms/17.html", title: "システム戦略 用語まとめ", desc: "EA・BPR・IT投資評価・UML・調達など54語", fields: [17] },
      { type: "terms", file: "terms/18.html", title: "システム企画 用語集", desc: "システム化計画・要件定義・調達と契約など157語", fields: [18] },
      { type: "terms", file: "terms/19.html", title: "経営戦略マネジメント 用語集", desc: "PPM・競争戦略・マーケティング・BSCなど206語", fields: [19] },
      { type: "terms", file: "terms/20.html", title: "技術戦略マネジメント 用語集", desc: "MOT・イノベーション・PoC・知的財産など68語", fields: [20] },
      { type: "terms", file: "terms/21.html", title: "ビジネスインダストリ 用語一覧", desc: "ビジネスシステム・IoT・電子商取引など291語（用語名のみ）", fields: [21] },
    ],

    fe: [
      {
        type: "terms", file: "terms/01.html", title: "基礎理論 用語集", desc: "離散数学・応用数学・情報に関する理論・通信に関する理論・計測・制御に関する理論など48語と問題28問", fields: [1],
        ids: ["s4", "916no1-math-0", "916no1-math-1", "927no13-10", "s3", "d1", "913no2-ai-2", "914no1-ai-q01", "914no1-ai-q02", "914no1-ai-q03", "916no1-ai-0", "916no1-ai-1", "916no1-ai-2", "d3", "d4"],
      },
      {
        type: "terms", file: "terms/02.html", title: "アルゴリズムとプログラミング 用語集", desc: "データ構造・アルゴリズム・プログラミング・プログラム言語・その他の言語など36語と問題26問", fields: [2],
        ids: ["927no7-q10", "927no7-q11", "927no7-q12", "927no7-q13", "925no1-memory-1", "927no1-algo-0", "927no1-algo-1", "927no1-algo-2", "927no1-algo-3", "927no1-algo-4", "916no1-math-2", "925no1-memory-0", "927no7-q6", "927no7-q7", "927no7-q8", "927no7-q9", "927no1-web-0", "927no1-web-1", "927no1-web-2"],
      },
      {
        type: "terms", file: "terms/03.html", title: "コンピュータ構成要素 用語集", desc: "プロセッサ・メモリ・バス・入出力デバイス・入出力装置など45語と問題33問", fields: [3],
        ids: ["s1", "915no1-cpu-q01", "915no1-cpu-q02", "915no1-cpu-q03", "915no1-cpu-q04", "915no1-cpu-q05", "927no7-q14", "915no3-cpu-q05", "914no1-memory-q01", "914no1-memory-q02", "914no1-memory-q03", "915no1-memory-q06", "915no1-memory-q07", "915no1-memory-q08", "915no1-memory-q09", "915no1-memory-q10", "925no1-memory-2", "925no1-memory-3", "925no1-storage-0", "925no1-storage-1", "925no1-storage-2", "915no2-interface-0", "915no2-interface-1", "915no2-interface-2", "915no2-interface-3", "915no2-storage-2", "915no2-storage-3", "915no2-storage-4"],
      },
      {
        type: "terms", file: "terms/04.html", title: "システム構成要素 用語集", desc: "システムの構成・システムの評価指標など44語と問題35問", fields: [4],
        ids: ["c1", "913no2-system-0", "913no2-system-1", "914no1-reliability-q03", "925no1-os-0", "925no1-os-2", "915no2-storage-0", "915no2-storage-1", "927no15-設計・処理方式-一定期間の処理データをためてから、後でまとめて処理する方式はどれか。", "927no15-クライアント構成-ノートの整理で、アプリケーション層をクライアントが保持するのはどれか。", "927no15-クライアント構成-端末の機能を必要最小限にし、主に画面表示・入力を担当させる方式はどれか。", "927no15-クライアント構成-外部事業者がクラウド上で仮想デスクトップ環境を提供する形態はどれか。", "927no15-信頼性・バックアップ-同じ処理を2組のシステムで同時に実行し、結果を照合する方式はどれか。", "927no15-信頼性・バックアップ-通常は1組を稼働させ、もう1組を障害時の予備とする方式はどれか。", "914no1-reliability-q01", "914no1-reliability-q02", "916no1-reliability-0", "916no1-reliability-1", "916no1-reliability-2", "927no2-reliability-0", "927no2-reliability-1", "927no2-reliability-2", "927no2-reliability-3", "927no13-11", "927no13-12", "927no13-13", "927no15-信頼性・バックアップ-最後のフルバックアップ以降に変更されたデータを対象とするものはどれか。", "927no15-信頼性・バックアップ-直前のバックアップ以降に変更されたデータを対象とするものはどれか。", "927no15-性能評価-機械や装置の故障率と時間の関係を表す曲線はどれか。", "927no15-性能評価-単位時間あたりに処理できる仕事量を表す指標はどれか。", "927no15-性能評価-データ入力からデータ出力までにかかる一連の時間で、主にバッチ処理で用いられるものはどれか。", "927no15-性能評価-100時間稼働し、5時間故障したシステムの稼働率として最も近いものはどれか。"],
      },
      {
        type: "terms", file: "terms/05.html", title: "ソフトウェア 用語集", desc: "オペレーティングシステム・ミドルウェア・ファイルシステム・開発ツール・オープンソースソフトウェアなど38語と問題31問", fields: [5],
        ids: ["s2", "915no2-software-0", "915no2-software-2", "915no2-software-3", "915no2-task-0", "915no2-task-1", "915no2-task-2", "915no2-task-3", "915no3-cpu-q01", "915no3-cpu-q02", "915no3-cpu-q03", "915no3-cpu-q04", "925no1-os-1", "915no3-memory-q01", "915no3-memory-q02", "915no3-memory-q03", "915no3-memory-q04", "915no3-memory-q05", "925no1-memory-4", "927no9-page-0", "927no9-page-1", "927no9-page-2", "915no2-software-1", "927no1-lang-0", "927no1-lang-1", "927no1-lang-2", "927no13-14"],
      },
      {
        type: "terms", file: "terms/06.html", title: "ハードウェア 用語集", desc: "電気・電子回路・機械・制御・論理設計・構成部品・消費電力など23語と問題8問", fields: [6],
      },
      {
        type: "terms", file: "terms/07.html", title: "ユーザーインタフェース 用語集", desc: "ヒューマンインタフェース技術・インタフェース設計など20語と問題6問", fields: [7],
      },
      {
        type: "terms", file: "terms/08.html", title: "情報メディア 用語集", desc: "マルチメディア技術・マルチメディア応用など23語と問題9問", fields: [8],
        ids: ["d2", "927no9-media-0", "927no9-media-1", "927no9-media-3", "927no9-media-2"],
      },
      {
        type: "terms", file: "terms/09.html", title: "データベース 用語集", desc: "データベース方式・データベース設計・データ操作・トランザクション処理・データベース応用など43語と問題19問", fields: [9],
        ids: ["927no9-db-0", "927no14-9", "927no14-10", "927no9-db-1", "927no9-db-2", "927no8-q1", "927no8-q2", "927no8-q3", "927no8-q4", "927no8-q5", "927no9-db-4", "927no9-db-3", "913no2-system-2"],
      },
      {
        type: "terms", file: "terms/10.html", title: "ネットワーク 用語集", desc: "OSI・TCP/IP・IPアドレス・LAN機器・メール・SDNなど83語と問題60問", fields: [10],
        ids: ["927no5-", "914no1-osi-", "c2", "913no3-q5", "914no1-network-q01", "914no1-network-q02", "927no8-q6", "927no8-q7", "927no8-q8", "927no8-q9", "927no8-q10", "927no8-q11", "927no8-q12", "927no10-0", "927no10-1", "927no10-2", "927no10-3", "927no10-4", "927no10-5", "927no10-6", "927no10-7", "927no10-8", "927no10-10", "927no13-4", "927no13-5", "927no13-6", "927no13-7", "927no14-11", "927no14-12", "927no14-13", "927no14-14"],
      },
      {
        type: "terms", file: "terms/11.html", title: "セキュリティ 用語集", desc: "情報セキュリティ・情報セキュリティ管理・セキュリティ技術評価・情報セキュリティ対策・セキュリティ実装技術など66語と問題48問", fields: [11],
        ids: ["913no2-security-3", "913no2-ai-0", "913no2-ai-1", "916no1-security-1", "925no1-security-4", "927no6-0", "927no6-1", "927no6-2", "927no6-3", "914no1-network-q03", "927no10-11", "927no13-1", "c3", "913no2-security-0", "927no10-12", "927no13-16", "927no7-q4", "927no7-q5", "913no2-security-1", "916no1-security-0", "916no1-security-2", "925no1-security-0", "925no1-security-1", "927no6-9", "927no6-10", "927no6-11", "927no6-12", "927no7-q1", "927no7-q2", "927no10-13", "927no10-14", "c4", "913no2-security-2", "925no1-security-2", "925no1-security-3", "927no6-4", "927no6-5", "927no6-6", "927no6-7", "927no6-8", "927no7-q3", "927no10-9", "927no13-0", "927no13-2", "927no13-3", "security-0", "security-1", "security-2", "security-3"],
      },
      {
        type: "terms", file: "terms/12.html", title: "システム開発技術 用語集", desc: "要件定義・設計・実装・構築・統合・テスト・導入・受入れ支援・保守・廃棄など39語と問題23問", fields: [12],
        ids: ["927no1-uml-0", "927no1-uml-1", "927no1-uml-2", "927no2-modeling-0", "927no2-modeling-1", "927no2-modeling-2", "927no2-modeling-3", "927no12-d1", "927no12-d2", "927no12-d3", "927no15-設計・処理方式-親クラスと子クラスの関係を表す概念として最も適切なものはどれか。", "927no15-設計・処理方式-UMLについての説明として適切なものはどれか。", "927no12-t1", "927no12-t2", "927no12-t3", "927no12-t4", "927no2-development-2"],
      },
      {
        type: "terms", file: "terms/13.html", title: "ソフトウェア開発管理技術 用語集", desc: "開発プロセス・手法・知的財産適用管理・開発環境管理・構成管理・変更管理など21語と問題5問", fields: [13],
        ids: ["927no2-development-3"],
      },
      {
        type: "terms", file: "terms/14.html", title: "プロジェクトマネジメント 用語集", desc: "プロジェクトマネジメント・統合・スコープ・資源・時間・コスト・リスク・品質・調達・コミュニケーションなど24語と問題15問", fields: [14],
        ids: ["927no12-p1", "927no12-p2", "927no12-e1", "927no12-e2", "927no12-e3", "927no12-e4", "927no12-e5", "927no12-p3", "927no12-p4", "927no12-p5"],
      },
      {
        type: "terms", file: "terms/15.html", title: "サービスマネジメント 用語集", desc: "サービスマネジメント・計画及び運用・パフォーマンス評価及び改善・サービスの運用・ファシリティマネジメントなど24語と問題7問", fields: [15],
        ids: ["927no3-0", "927no3-1"],
      },
      {
        type: "terms", file: "terms/16.html", title: "システム監査 用語集", desc: "システム監査・内部統制など16語と問題6問", fields: [16],
        ids: ["927no3-2", "927no3-3", "927no3-4"],
      },
      {
        type: "terms", file: "terms/17.html", title: "システム戦略 用語集", desc: "情報システム戦略・業務プロセス・ソリューションビジネス・システム活用促進・評価など26語と問題8問", fields: [17],
        ids: ["927no2-development-1", "927no3-5", "927no3-7"],
      },
      {
        type: "terms", file: "terms/18.html", title: "システム企画 用語集", desc: "システム化計画・要件定義・調達計画・実施など16語と問題7問", fields: [18],
        ids: ["916no1-strategy-0", "916no1-strategy-1", "916no1-strategy-2", "927no2-development-0"],
      },
      {
        type: "terms", file: "terms/19.html", title: "経営戦略マネジメント 用語集", desc: "経営戦略手法・マーケティング・ビジネス戦略と目標・評価・経営管理システムなど28語と問題20問", fields: [19],
        ids: ["927no4-経営戦略手法-0", "927no4-経営戦略手法-1", "927no4-経営戦略手法-2", "927no4-経営戦略手法-3", "927no4-分析・市場戦略-0", "927no4-分析・市場戦略-1", "927no4-分析・市場戦略-2", "927no4-分析・市場戦略-3", "927no4-マーケティング・価格-0", "927no4-マーケティング・価格-1", "927no4-マーケティング・価格-2", "913no3-q1", "927no11-0", "927no11-1", "927no4-経営管理システム-0", "927no4-経営管理システム-1", "927no4-経営管理システム-2", "927no4-経営管理システム-3"],
      },
      {
        type: "terms", file: "terms/20.html", title: "技術戦略マネジメント 用語集", desc: "技術開発戦略の立案・技術開発計画など14語と問題5問", fields: [20],
        ids: ["927no11-2"],
      },
      {
        type: "terms", file: "terms/21.html", title: "ビジネスインダストリ 用語集", desc: "ビジネスシステム・エンジニアリングシステム・e-ビジネス・民生機器・産業機器など29語と問題13問", fields: [21],
        ids: ["913no2-system-3", "927no3-11", "927no3-12", "927no3-13", "927no3-14", "927no3-6", "927no3-8", "927no3-9", "927no3-10", "927no3-15"],
      },
      {
        type: "terms", file: "terms/22.html", title: "企業活動 用語集", desc: "経営・組織論・OR・IE・会計・財務など33語と問題26問", fields: [22],
        ids: ["927no13-15", "927no13-19", "913no3-q2", "927no11-3", "927no11-4", "927no11-13", "927no11-14", "927no13-8", "927no13-9", "927no13-17", "927no13-18", "913no2-management-0", "913no2-management-1", "913no2-management-2", "913no3-q3", "927no11-5", "927no11-6", "927no11-7", "927no11-8", "927no11-9"],
      },
      {
        type: "terms", file: "terms/23.html", title: "法務 用語集", desc: "知的財産権・セキュリティ関連法規・労働関連・取引関連法規・その他の法律・ガイドライン・技術者倫理・標準化関連など35語と問題16問", fields: [23],
        ids: ["913no3-q4", "927no11-10", "927no11-11", "927no11-12", "927no14-0", "927no14-1", "927no14-2", "927no14-3", "927no14-4", "927no14-5", "927no14-6", "927no14-7", "927no14-8"],
      },
    ],
  },

  common: [
    { file: "it-english-300.html", icon: "EN", title: "IT English 300", desc: "ITエンジニア向けの英単語を一覧・カード・暗記・クイズで学ぶ。" },
    { file: "it-acronyms-300.html", icon: "AC", title: "IT Acronyms 300", desc: "ITエンジニア向けの略語を一覧・カード・暗記・クイズで学ぶ。" },
  ],
};
