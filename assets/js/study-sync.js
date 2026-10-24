/*
  回答記録の共通スクリプト（基本情報・応用情報で共通）

  役割
  - Supabase のログイン状態を確認する（ログインは login.html で行う）
  - 各教材の正答・誤答を quiz_results へ保存する
  - 教材からは recordAnswer(...) を呼ぶだけで使える
  - 一覧ページ・ログインページからは window.StudySync を使う

  読み込み方
    <script src="../../../assets/js/study-sync.js"></script>
    data-quiet を付けると、画面右下の同期メッセージを出さない（一覧ページ用）

  注意
  - Project URL と Publishable key だけを設定する
  - Secret key、service_role key、DBパスワードは絶対に書かない
*/

(function () {
  "use strict";

  if (window.StudySync) {
    return;
  }

  const SUPABASE_URL = "https://zydnjkwpznxkirohdlyz.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_7d_y3bNO0-BRY4cVNMRd-A_rBVTWex-";

  /* Supabase側のテーブル名 */
  const ANSWERS_TABLE = "quiz_results";

  /* Supabase JavaScript SDKの読み込み先 */
  const SUPABASE_SCRIPT_URL =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  const LOG = "[study-sync]";
  const script = document.currentScript;
  const quiet = Boolean(script && script.hasAttribute("data-quiet"));

  let supabaseClient = null;
  let currentUser = null;
  let initialized = false;
  let sdkPromise = null;
  const listeners = [];

  /* ページ起動直後に回答された場合の一時キュー（初期化後にまとめて保存） */
  const pendingAnswers = [];

  /* ---------- 画面右下の同期メッセージ ---------- */

  function showSyncMessage(message, type = "info") {
    if (quiet) {
      return;
    }

    let element = document.getElementById("study-sync-status");

    if (!element) {
      element = document.createElement("div");
      element.id = "study-sync-status";
      element.setAttribute("role", "status");
      element.style.cssText = `
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 9999;
        max-width: calc(100vw - 24px);
        padding: 8px 12px;
        border: 1px solid;
        border-radius: var(--theme-radius, 4px);
        font: 14px/1.4 var(--theme-font-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
      `;
      document.body.appendChild(element);
    }

    const colors = {
      info: ["var(--theme-bg, #272726)", "var(--theme-cream, #e8e2d6)", "var(--theme-line, rgba(232, 226, 214, 0.3))"],
      success: ["var(--theme-good-bg, #1d241f)", "var(--theme-good, #8db094)", "var(--theme-good, #3d5a44)"],
      error: ["var(--theme-bad-bg, #2a1f1e)", "var(--theme-bad, #d19489)", "var(--theme-bad, #6b4846)"],
    };
    const [background, color, border] = colors[type] || colors.info;

    element.style.background = background;
    element.style.color = color;
    element.style.borderColor = border;
    element.textContent = message;
  }

  /* ---------- Supabase ---------- */

  function loadSupabaseSdk() {
    if (window.supabase) {
      return Promise.resolve(window.supabase);
    }
    if (sdkPromise) {
      return sdkPromise;
    }

    sdkPromise = new Promise(function (resolve, reject) {
      const tag = document.createElement("script");
      tag.src = SUPABASE_SCRIPT_URL;
      tag.async = true;
      tag.onload = function () {
        if (window.supabase) {
          resolve(window.supabase);
        } else {
          reject(new Error("Supabase SDKが利用できません。"));
        }
      };
      tag.onerror = function () {
        reject(new Error("Supabase SDKの読み込みに失敗しました。"));
      };
      document.head.appendChild(tag);
    });

    return sdkPromise;
  }

  /*
    回答の日付。
    基本情報の日別復習（fe/review/2026-09-13/913no1.html）はURLの日付を使い、
    それ以外の教材は回答した日（日本時間）を使う。
  */
  function getReviewDate() {
    const match = window.location.pathname.match(/\/(\d{4}-\d{2}-\d{2})\//);
    if (match) {
      return match[1];
    }
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  }

  function notify() {
    listeners.forEach(function (listener) {
      try {
        listener(currentUser);
      } catch (error) {
        console.error(LOG, error);
      }
    });
  }

  async function initialize() {
    try {
      const supabaseSdk = await loadSupabaseSdk();
      supabaseClient = supabaseSdk.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

      const { data, error } = await supabaseClient.auth.getSession();
      if (error) {
        throw error;
      }

      currentUser = data.session ? data.session.user : null;
      initialized = true;

      supabaseClient.auth.onAuthStateChange(function (event, session) {
        currentUser = session ? session.user : null;
        notify();

        if (event === "SIGNED_IN" && currentUser) {
          flushPendingAnswers().catch(function (error) {
            console.error(LOG, "回答の保存に失敗しました", error);
          });
        }
        if (event === "SIGNED_OUT") {
          pendingAnswers.length = 0;
        }
      });

      notify();

      if (!currentUser) {
        pendingAnswers.length = 0;
        showSyncMessage("ログインすると正答・誤答を端末間で同期できます。", "info");
        return;
      }

      await flushPendingAnswers();
      showSyncMessage("回答結果の同期を利用できます。", "success");
    } catch (error) {
      console.error(LOG, "初期化に失敗しました", error);
      initialized = true;
      notify();
      showSyncMessage("同期を利用できません。教材の演習は続けられます。", "error");
    }
  }

  async function saveAnswer(questionId, category, isCorrect) {
    if (!currentUser || !supabaseClient) {
      return;
    }

    /* この問題の過去の正答・誤答回数を取得する */
    const { data: existingData, error: existingError } = await supabaseClient
      .from(ANSWERS_TABLE)
      .select("correct_count, wrong_count")
      .eq("user_id", currentUser.id)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const previous = existingData || {};
    const now = new Date().toISOString();

    const row = {
      user_id: currentUser.id,
      review_date: getReviewDate(),
      category: category || "未分類",
      question_id: questionId,
      correct_count: (previous.correct_count || 0) + (isCorrect ? 1 : 0),
      wrong_count: (previous.wrong_count || 0) + (isCorrect ? 0 : 1),
      last_answer_correct: Boolean(isCorrect),
      last_answered_at: now,
      updated_at: now,
    };

    const { error: saveError } = await supabaseClient
      .from(ANSWERS_TABLE)
      .upsert(row, { onConflict: "user_id,question_id" });

    if (saveError) {
      throw saveError;
    }
  }

  async function flushPendingAnswers() {
    while (pendingAnswers.length > 0) {
      const answer = pendingAnswers.shift();
      await saveAnswer(answer.questionId, answer.category, answer.isCorrect);
    }
  }

  const ready = initialize();

  /* ---------- 教材から呼ぶ関数 ---------- */

  /*
    回答を記録する。
      recordAnswer("ap-20-PoC", "技術戦略マネジメント", true);
  */
  window.recordAnswer = function (questionId, category, isCorrect) {
    if (!questionId) {
      console.warn(LOG, "questionId は必須です。");
      return;
    }

    const answer = {
      questionId: String(questionId),
      category: category || "未分類",
      isCorrect: Boolean(isCorrect),
    };

    /* 初期化途中なら、一時的にキューへ入れる */
    if (!initialized) {
      pendingAnswers.push(answer);
      return;
    }

    /* 未ログインでも教材は使える。クラウド保存だけしない */
    if (!currentUser || !supabaseClient) {
      return;
    }

    saveAnswer(answer.questionId, answer.category, answer.isCorrect)
      .then(function () {
        showSyncMessage(
          answer.isCorrect ? "正解を同期しました。" : "誤答を同期しました。",
          answer.isCorrect ? "success" : "info"
        );
      })
      .catch(function (error) {
        console.error(LOG, "回答保存に失敗しました", error);
        showSyncMessage("回答結果を同期できませんでした。", "error");
      });
  };

  /* この日付の教材の問題別成績（基本情報の苦手復習で使用） */
  window.getReviewAnswerStats = async function () {
    if (!currentUser || !supabaseClient) {
      return [];
    }

    const { data, error } = await supabaseClient
      .from(ANSWERS_TABLE)
      .select("question_id, category, correct_count, wrong_count, last_answer_correct")
      .eq("user_id", currentUser.id)
      .eq("review_date", getReviewDate());

    if (error) {
      console.error(LOG, "成績の取得に失敗しました", error);
      return [];
    }
    return data || [];
  };

  /* 苦手問題の基本判定。誤答回数が正答回数より多いときtrue */
  window.isWeakReviewQuestion = function (stats) {
    if (!stats) {
      return false;
    }
    return (stats.wrong_count || 0) > (stats.correct_count || 0);
  };

  window.resetReviewProgress = async function () {
    if (!currentUser || !supabaseClient) {
      return { ok: false, reason: "not-logged-in" };
    }

    const result = await supabaseClient
      .from(ANSWERS_TABLE)
      .update({
        correct_count: 0,
        wrong_count: 0,
        last_answer_correct: null,
        last_answered_at: new Date().toISOString(),
      })
      .eq("user_id", currentUser.id)
      .eq("review_date", getReviewDate());

    if (result.error) {
      console.error(LOG, "reset failed", result.error);
      showSyncMessage("クラウドの進捗リセットに失敗しました。", "error");
      return { ok: false, reason: "error", error: result.error };
    }

    showSyncMessage("クラウドの進捗をリセットしました。", "success");
    return { ok: true };
  };

  /* ---------- 一覧ページ・ログインページから使う窓口 ---------- */

  window.StudySync = {
    /* 初期化が終わると解決する。中身は現在のユーザー（未ログインなら null） */
    ready: ready.then(function () {
      return currentUser;
    }),

    user: function () {
      return currentUser;
    },

    /* ログイン状態が変わるたびに呼ばれる */
    onChange: function (listener) {
      listeners.push(listener);
    },

    signIn: async function (email, password) {
      await ready;
      if (!supabaseClient) {
        throw new Error("同期サーバーに接続できません。");
      }
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      currentUser = data.user;
      notify();
      return currentUser;
    },

    signOut: async function () {
      await ready;
      if (!supabaseClient) {
        return;
      }
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        throw error;
      }
      currentUser = null;
      notify();
    },

    /* 自分の全回答記録（正答率の集計に使う）。未ログインなら空 */
    fetchAllStats: async function () {
      await ready;
      if (!currentUser || !supabaseClient) {
        return [];
      }

      const rows = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabaseClient
          .from(ANSWERS_TABLE)
          .select("question_id, correct_count, wrong_count, last_answer_correct, last_answered_at")
          .eq("user_id", currentUser.id)
          .range(from, from + pageSize - 1);
        if (error) {
          throw error;
        }
        rows.push(...(data || []));
        if (!data || data.length < pageSize) {
          break;
        }
      }
      return rows;
    },
  };
})();
