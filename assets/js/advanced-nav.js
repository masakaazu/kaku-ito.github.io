const initAdvancedNavigation = () => {
  const notes = [
    "TCP/IPとHTTP",
    "OS仮想化とコンテナ",
    "HTTPSとTLS",
    "仮想記憶とページング",
    "仮想記憶とページング（補足）",
    "リレーショナルDBとSQL",
    "OSI参照モデルとTCP/IP",
    "トランザクションとACID",
    "ITSM・ITIL・SLA",
    "SLAとサービス可用性",
    "OS仮想化とコンテナ（補足）",
    "トランザクションとACID（補足）",
    "データベースの正規化",
    "トランザクションとACID（復旧）",
    "情報セキュリティのリスク対応",
  ];

  const currentMatch = location.pathname.match(/advancedno(\d+)\.html$/);
  if (!currentMatch) return;

  const current = Number(currentMatch[1]);
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "応用情報ノートの移動");
  nav.innerHTML = `
    <a href="index.html">一覧</a>
    <span>${current} / ${notes.length}　${notes[current - 1] || "ノート"}</span>
    <span class="advanced-nav-links">
      ${current > 1 ? `<a href="advancedno${current - 1}.html">← 前へ</a>` : ""}
      ${current < notes.length ? `<a href="advancedno${current + 1}.html">次へ →</a>` : ""}
    </span>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .advanced-nav {
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 8px max(12px, calc((100% - 960px) / 2));
      border-bottom: 1px solid #dbe3ef;
      background: rgba(255, 255, 255, 0.96);
      color: #475569;
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif;
      backdrop-filter: blur(8px);
    }
    .advanced-nav a {
      color: #2563eb;
      font-weight: 700;
      text-decoration: none;
    }
    .advanced-nav a:hover {
      text-decoration: underline;
    }
    .advanced-nav-links {
      display: inline-flex;
      gap: 10px;
      margin-left: auto;
    }
    @media (max-width: 600px) {
      .advanced-nav-links {
        width: 100%;
        margin-left: 0;
        justify-content: space-between;
      }
    }
  `;
  nav.className = "advanced-nav";
  document.head.append(style);
  document.body.prepend(nav);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdvancedNavigation);
} else {
  initAdvancedNavigation();
}
