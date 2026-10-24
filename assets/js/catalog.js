/*
  サイト全体の目次データ（このファイルが唯一の登録先）

  教材を追加したら、materials の該当資格に1行追加するだけで
  トップ・資格ページ・分野マップ・中分類ページ・ナビバーに自動で反映される。

  教材1件の書き方:
    { type: "note", file: "notes/apno1.html", title: "…", desc: "…", fields: [10] }

    type    教材の型。note（ノート）／terms（用語集）／quiz（問題演習）
    file    資格フォルダ（ap/ や fe/）から見たファイルの場所
    fields  シラバスの中分類番号（下の fields 一覧）。複数の分野にまたがるときは複数書く
    date    （基本情報の日別復習だけ）学習日 "YYYY-MM-DD"
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
      desc: "受験前に作った日別の復習教材を、分野からも引けるように残している。",
      exams: [{ label: "試験日", date: "2026-10-03" }],
      /* 日別復習の一覧に出す、その日のまとめ */
      days: {
        "2026-09-13": "クラウド・セキュリティ・基礎理論・毎日の復習",
        "2026-09-14": "AI・メモリ・ネットワーク基礎",
        "2026-09-15": "CPU・記憶装置・OS・記憶管理",
        "2026-09-16": "セキュリティ・戦略・数学・AI総合",
        "2026-09-25": "メモリ・OS・記憶装置・セキュリティ総合",
        "2026-09-27": "アルゴリズム・ネットワーク・セキュリティ・DB・経営の総合復習",
        "2026-09-28": "計算問題（数値表現・性能評価・ネットワーク・経営分析）",
      },
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
        type: "terms", file: "terms/10.html", title: "ネットワーク 用語集", desc: "OSI・TCP/IP・IPアドレス・LAN機器・メール・SDNなど83語と問題60問", fields: [10],
        ids: ["927no5-", "914no1-osi-", "913no3-q5", "914no1-network-q01", "914no1-network-q02", "927no8-q6", "927no8-q7", "927no8-q8", "927no8-q9", "927no8-q10", "927no8-q11", "927no8-q12", "927no10-0", "927no10-1", "927no10-2", "927no10-3", "927no10-4", "927no10-5", "927no10-6", "927no10-7", "927no10-8", "927no10-10", "927no13-4", "927no13-5", "927no13-6", "927no13-7", "927no14-11", "927no14-12", "927no14-13", "927no14-14"],
      },

      { type: "quiz", date: "2026-09-13", file: "review/2026-09-13/913no1.html", title: "クラウド・セキュリティ・基礎理論", desc: "用語カードと4択クイズで確認します。", fields: [4, 11, 1] },
      { type: "quiz", date: "2026-09-13", file: "review/2026-09-13/913no2.html", title: "毎日10分の復習", desc: "用語カード、クイズ、苦手復習に取り組みます。", fields: [] },
      { type: "quiz", date: "2026-09-13", file: "review/2026-09-13/913no3.html", title: "マネジメント・法務・ネットワーク基礎", desc: "用語カード、クイズ、苦手復習に取り組みます。", fields: [14, 15, 23, 10] },
      { type: "quiz", date: "2026-09-14", file: "review/2026-09-14/914no1.html", title: "AI・メモリ・ネットワーク基礎", desc: "用語カード、クイズ、苦手復習に取り組みます。", fields: [1, 3, 10] },
      { type: "quiz", date: "2026-09-15", file: "review/2026-09-15/915no1.html", title: "CPU・主記憶・キャッシュ", desc: "CPU、記憶装置、キャッシュの基礎を確認します。", fields: [3] },
      { type: "quiz", date: "2026-09-15", file: "review/2026-09-15/915no2.html", title: "記憶装置・インタフェース・OS", desc: "記憶装置、インタフェース、OSの用語を復習します。", fields: [3, 5] },
      { type: "quiz", date: "2026-09-15", file: "review/2026-09-15/915no3.html", title: "CPUスケジューリングと記憶管理", desc: "用語カード、クイズ、苦手復習に取り組みます。", fields: [5] },
      { type: "quiz", date: "2026-09-16", file: "review/2026-09-16/916no1.html", title: "セキュリティ・戦略・数学・AI総合復習", desc: "用語カード、クイズ、苦手復習に取り組みます。", fields: [11, 17, 19, 1] },
      { type: "quiz", date: "2026-09-25", file: "review/2026-09-25/925no1.html", title: "メモリ・OS・記憶装置・セキュリティ総合復習", desc: "用語カード、クイズ、苦手復習に取り組みます。", fields: [3, 5, 11] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no1.html", title: "探索・整列・コンパイル・HTML/XML・UML", desc: "アルゴリズムと言語処理、Web、UMLを復習します。", fields: [2, 5, 12] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no2.html", title: "システム評価・開発手法・モデリング", desc: "信頼性、開発手法、データモデリングを復習します。", fields: [4, 12, 13] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no3.html", title: "IT戦略分野", desc: "ITサービス、監査、業務・生産分野を復習します。", fields: [15, 16, 21] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no4.html", title: "経営戦略", desc: "経営戦略、マーケティング、経営管理を復習します。", fields: [19, 22] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no6.html", title: "情報セキュリティ", desc: "脅威、暗号、認証、ネットワーク防御を復習します。", fields: [11] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no7.html", title: "セキュリティ・アルゴリズム・データ構造", desc: "セキュリティ対策、プログラムの性質、木構造を復習します。", fields: [11, 2] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no8.html", title: "DB・ネットワーク", desc: "データベース、SQL、LAN、OSI・TCP/IPを復習します。", fields: [9, 10] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no9.html", title: "ページング・画像・DB", desc: "ページ置換、画像形式、AR、DB設計と正規化を復習します。", fields: [5, 8, 9] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no10.html", title: "ネットワーク・セキュリティ", desc: "メール、誤り検出、マルウェア、セキュリティ管理を復習します。", fields: [10, 11] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no11.html", title: "経営・会計・知的財産", desc: "業績評価、会計、財務諸表、知的財産権を復習します。", fields: [22, 23] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no12.html", title: "DFD・モジュール・テスト・PMBOK・見積り", desc: "設計、テスト、プロジェクト管理、日程計画を復習します。", fields: [12, 14] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no13.html", title: "セキュリティ・ネットワーク・運用管理", desc: "暗号、ネットワーク機器、統計、運用管理を復習します。", fields: [11, 10, 15] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no14.html", title: "法規・標準化・NoSQL・SDN", desc: "法規、標準化、データベース、ネットワーク制御を復習します。", fields: [23, 9, 10] },
      { type: "quiz", date: "2026-09-27", file: "review/2026-09-27/927no15.html", title: "システム構成・性能評価", desc: "処理方式、クライアント構成、信頼性、性能指標を復習します。", fields: [4] },
      { type: "quiz", date: "2026-09-28", file: "review/2026-09-28/928no1.html", title: "計算問題 Part1：数値表現・論理演算・性能評価", desc: "基本情報で頻出する計算公式と数値問題を復習します。", fields: [1, 4] },
      { type: "quiz", date: "2026-09-28", file: "review/2026-09-28/928no2.html", title: "計算問題 Part2：ネットワーク・経営分析・プロジェクト管理・誤り検出", desc: "ネットワーク計算、経営指標、誤り検出の問題を復習します。", fields: [10, 22, 14, 1] },
    ],
  },

  common: [
    { file: "it-english-300.html", icon: "EN", title: "IT English 300", desc: "ITエンジニア向けの英単語を一覧・カード・暗記・クイズで学ぶ。" },
    { file: "it-acronyms-300.html", icon: "AC", title: "IT Acronyms 300", desc: "ITエンジニア向けの略語を一覧・カード・暗記・クイズで学ぶ。" },
  ],
};
