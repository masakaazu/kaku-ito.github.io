/*
  サイト全体の目次データ（このファイルが唯一の登録先）

  教材を追加したら、ここに1行追加するだけで
  トップページ・各一覧ページ・ページ上部のナビバーに自動で反映される。

  - 基本情報の復習教材: feReview の該当日の items に追加（新しい日は日付ブロックごと追加）
  - 応用情報のノート:   apNotes に追加（file は ap/notes/ からのファイル名）
  - 共通教材:           common に追加（file は common/ からのファイル名）
  - 試験日:             topics の examDate を "YYYY-MM-DD" で入力（未定なら ""）
*/
window.SITE_CATALOG = {
  siteName: "資格学習支援サイト",

  topics: {
    ap: {
      name: "応用情報技術者試験",
      short: "応用情報",
      status: "学習中",
      examDate: "",
    },
    fe: {
      name: "基本情報技術者試験",
      short: "基本情報",
      status: "受験済み",
      examDate: "2026-10-03",
    },
  },

  feReview: [
    {
      date: "2026-09-13",
      summary: "クラウド・セキュリティ・基礎理論・毎日の復習",
      items: [
        { file: "913no1.html", title: "クラウド・セキュリティ・基礎理論", desc: "用語カードと4択クイズで確認します。" },
        { file: "913no2.html", title: "毎日10分の復習", desc: "用語カード、クイズ、苦手復習に取り組みます。" },
        { file: "913no3.html", title: "マネジメント・法務・ネットワーク基礎", desc: "用語カード、クイズ、苦手復習に取り組みます。" },
      ],
    },
    {
      date: "2026-09-14",
      summary: "AI・メモリ・ネットワーク基礎",
      items: [
        { file: "914no1.html", title: "AI・メモリ・ネットワーク基礎", desc: "用語カード、クイズ、苦手復習に取り組みます。" },
      ],
    },
    {
      date: "2026-09-15",
      summary: "CPU・記憶装置・OS・記憶管理",
      items: [
        { file: "915no1.html", title: "CPU・主記憶・キャッシュ", desc: "CPU、記憶装置、キャッシュの基礎を確認します。" },
        { file: "915no2.html", title: "記憶装置・インタフェース・OS", desc: "記憶装置、インタフェース、OSの用語を復習します。" },
        { file: "915no3.html", title: "CPUスケジューリングと記憶管理", desc: "用語カード、クイズ、苦手復習に取り組みます。" },
      ],
    },
    {
      date: "2026-09-16",
      summary: "セキュリティ・戦略・数学・AI総合",
      items: [
        { file: "916no1.html", title: "セキュリティ・戦略・数学・AI総合復習", desc: "用語カード、クイズ、苦手復習に取り組みます。" },
      ],
    },
    {
      date: "2026-09-25",
      summary: "メモリ・OS・記憶装置・セキュリティ総合",
      items: [
        { file: "925no1.html", title: "メモリ・OS・記憶装置・セキュリティ総合復習", desc: "用語カード、クイズ、苦手復習に取り組みます。" },
      ],
    },
    {
      date: "2026-09-27",
      summary: "アルゴリズム・ネットワーク・セキュリティ・DB・経営の総合復習",
      items: [
        { file: "927no1.html", title: "探索・整列・コンパイル・HTML/XML・UML", desc: "アルゴリズムと言語処理、Web、UMLを復習します。" },
        { file: "927no2.html", title: "システム評価・開発手法・モデリング", desc: "信頼性、開発手法、データモデリングを復習します。" },
        { file: "927no3.html", title: "IT戦略分野", desc: "ITサービス、監査、業務・生産分野を復習します。" },
        { file: "927no4.html", title: "経営戦略", desc: "経営戦略、マーケティング、経営管理を復習します。" },
        { file: "927no5.html", title: "ネットワーク", desc: "TCP/IP、IPアドレス、DHCP、DNSを復習します。" },
        { file: "927no6.html", title: "情報セキュリティ", desc: "脅威、暗号、認証、ネットワーク防御を復習します。" },
        { file: "927no7.html", title: "セキュリティ・アルゴリズム・データ構造", desc: "セキュリティ対策、プログラムの性質、木構造を復習します。" },
        { file: "927no8.html", title: "DB・ネットワーク", desc: "データベース、SQL、LAN、OSI・TCP/IPを復習します。" },
        { file: "927no9.html", title: "ページング・画像・DB", desc: "ページ置換、画像形式、AR、DB設計と正規化を復習します。" },
        { file: "927no10.html", title: "ネットワーク・セキュリティ", desc: "メール、誤り検出、マルウェア、セキュリティ管理を復習します。" },
        { file: "927no11.html", title: "経営・会計・知的財産", desc: "業績評価、会計、財務諸表、知的財産権を復習します。" },
        { file: "927no12.html", title: "DFD・モジュール・テスト・PMBOK・見積り", desc: "設計、テスト、プロジェクト管理、日程計画を復習します。" },
        { file: "927no13.html", title: "セキュリティ・ネットワーク・運用管理", desc: "暗号、ネットワーク機器、統計、運用管理を復習します。" },
        { file: "927no14.html", title: "法規・標準化・NoSQL・SDN", desc: "法規、標準化、データベース、ネットワーク制御を復習します。" },
        { file: "927no15.html", title: "システム構成・性能評価", desc: "処理方式、クライアント構成、信頼性、性能指標を復習します。" },
      ],
    },
    {
      date: "2026-09-28",
      summary: "計算問題（数値表現・性能評価・ネットワーク・経営分析）",
      items: [
        { file: "928no1.html", title: "計算問題 Part1：数値表現・論理演算・性能評価", desc: "基本情報で頻出する計算公式と数値問題を復習します。" },
        { file: "928no2.html", title: "計算問題 Part2：ネットワーク・経営分析・プロジェクト管理・誤り検出", desc: "ネットワーク計算、経営指標、誤り検出の問題を復習します。" },
      ],
    },
  ],

  apNotes: [
    { file: "apno1.html", title: "TCP/IPとHTTP", desc: "アプリケーション層とHTTPプロトコル" },
    { file: "apno2.html", title: "OS仮想化とコンテナ", desc: "仮想化方式とコンテナ型仮想化" },
    { file: "apno3.html", title: "HTTPSとTLS", desc: "安全なWeb通信とTLSハンドシェイク" },
    { file: "apno4.html", title: "仮想記憶とページング", desc: "ページフォールトとスラッシング" },
    { file: "apno5.html", title: "仮想記憶とページング（補足）", desc: "OS・仮想化の性能問題" },
    { file: "apno6.html", title: "リレーショナルDBとSQL", desc: "SELECTとJOINの基本" },
    { file: "apno7.html", title: "OSI参照モデルとTCP/IP", desc: "ネットワークの層と障害切り分け" },
    { file: "apno8.html", title: "トランザクションとACID", desc: "データベースの同時実行制御" },
    { file: "apno9.html", title: "ITSM・ITIL・SLA", desc: "ITサービスマネジメント" },
    { file: "apno10.html", title: "SLAとサービス可用性", desc: "ナインとダウンタイム" },
    { file: "apno11.html", title: "OS仮想化とコンテナ（補足）", desc: "VMとコンテナの使い分け" },
    { file: "apno12.html", title: "トランザクションとACID（補足）", desc: "FEからAPへの発展" },
    { file: "apno13.html", title: "データベースの正規化", desc: "第1〜第3正規形" },
    { file: "apno14.html", title: "トランザクションとACID（復旧）", desc: "ログと障害復旧" },
    { file: "apno15.html", title: "情報セキュリティのリスク対応", desc: "回避・低減・移転・保有" },
  ],

  common: [
    { file: "it-english-300.html", icon: "EN", title: "IT English 300", desc: "ITエンジニア向けの英単語を一覧・カード・暗記・クイズで学ぶ。" },
    { file: "it-acronyms-300.html", icon: "AC", title: "IT Acronyms 300", desc: "ITエンジニア向けの略語を一覧・カード・暗記・クイズで学ぶ。" },
  ],
};
