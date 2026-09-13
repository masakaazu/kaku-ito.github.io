/*
  基本情報学習サイト 共通同期スクリプト

  役割
  - WBSでログインしたSupabaseのセッションを使う
  - 各クイズの正答・誤答をquiz_resultsへ保存する
  - 各復習HTMLから recordAnswer(...) を呼ぶだけで使える

  注意
  - Project URL と Publishable key だけを設定する
  - Secret key、service_role key、DBパスワードは絶対に書かない
*/

(function () {
  "use strict";

  /*
    ============================================================
    ここにSupabaseのProject URLとPublishable keyを貼る
    WBSページに書いた値と同じものを使う
    ============================================================
  */
  const SUPABASE_URL = "https://zydnjkwpznxkirohdlyz.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_7d_y3bNO0-BRY4cVNMRd-A_rBVTWex-";

  /*
    Supabase側で作成したテーブル名
  */
  const ANSWERS_TABLE = "quiz_results";

  /*
    Supabase JavaScript SDKの読み込み先
  */
  const SUPABASE_SCRIPT_URL =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  let supabaseClient = null;
  let currentUser = null;
  let initialized = false;
  let sdkPromise = null;

  /*
    ページ起動直後に回答された場合の一時キュー。
    Supabase初期化が完了してからまとめて保存する。
  */
  const pendingAnswers = [];

  function showSyncMessage(message, type = "info") {
    let element = document.getElementById("fe-study-sync-status");

    if (!element) {
      element = document.createElement("div");
      element.id = "fe-study-sync-status";
      element.setAttribute("role", "status");

      element.style.cssText = `
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 9999;
        max-width: calc(100vw - 24px);
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #ffffff;
        color: #334155;
        font: 14px/1.4 -apple-system, BlinkMacSystemFont,
          "Segoe UI", "Noto Sans JP", sans-serif;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
      `;

      document.body.appendChild(element);
    }

    const colors = {
      info: {
        background: "#eff6ff",
        color: "#1e3a8a",
        border: "#93c5fd"
      },
      success: {
        background: "#f0fdf4",
        color: "#166534",
        border: "#86efac"
      },
      error: {
        background: "#fef2f2",
        color: "#b91c1c",
        border: "#fca5a5"
      }
    };

    const color = colors[type] || colors.info;

    element.style.background = color.background;
    element.style.color = color.color;
    element.style.borderColor = color.border;
    element.textContent = message;
  }

  function loadSupabaseSdk() {
    if (window.supabase) {
      return Promise.resolve(window.supabase);
    }

    if (sdkPromise) {
      return sdkPromise;
    }

    sdkPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");

      script.src = SUPABASE_SCRIPT_URL;
      script.async = true;

      script.onload = function () {
        if (window.supabase) {
          resolve(window.supabase);
        } else {
          reject(
            new Error("Supabase SDKが利用できません。")
          );
        }
      };

      script.onerror = function () {
        reject(
          new Error("Supabase SDKの読み込みに失敗しました。")
        );
      };

      document.head.appendChild(script);
    });

    return sdkPromise;
  }

  /*
    review/2026-09-13/913no1.html のURLから
    2026-09-13 を自動取得する。
  */
  function getReviewDate() {
    const match = window.location.pathname.match(
      /\/(\d{4}-\d{2}-\d{2})\//
    );

    return match ? match[1] : "unknown";
  }

  async function initialize() {
    try {
      const supabaseSdk = await loadSupabaseSdk();

      supabaseClient = supabaseSdk.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );

      const {
        data,
        error
      } = await supabaseClient.auth.getSession();

      if (error) {
        throw error;
      }

      currentUser = data.session ? data.session.user : null;
      initialized = true;

      supabaseClient.auth.onAuthStateChange(function (
        event,
        session
      ) {
        currentUser = session ? session.user : null;

        if (event === "SIGNED_IN" && currentUser) {
          flushPendingAnswers().catch(function (error) {
            console.error(
              "[fe-study-sync] 回答の保存に失敗しました",
              error
            );
          });
        }

        if (event === "SIGNED_OUT") {
          pendingAnswers.length = 0;
        }
      });

      if (!currentUser) {
        pendingAnswers.length = 0;

        showSyncMessage(
          "ログインすると正答・誤答を端末間で同期できます。",
          "info"
        );

        return;
      }

      await flushPendingAnswers();

      showSyncMessage(
        "回答結果の同期を利用できます。",
        "success"
      );
    } catch (error) {
      console.error(
        "[fe-study-sync] 初期化に失敗しました",
        error
      );

      initialized = true;

      showSyncMessage(
        "同期を利用できません。教材の演習は続けられます。",
        "error"
      );
    }
  }

  async function saveAnswer(questionId, category, isCorrect) {
    if (!currentUser || !supabaseClient) {
      return;
    }

    const reviewDate = getReviewDate();

    /*
      この問題の過去の正答・誤答回数を取得する
    */
    const {
      data: existingData,
      error: existingError
    } = await supabaseClient
      .from(ANSWERS_TABLE)
      .select("correct_count, wrong_count")
      .eq("user_id", currentUser.id)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const previous = existingData || {};

    const row = {
      user_id: currentUser.id,
      review_date: reviewDate,
      category: category || "未分類",
      question_id: questionId,

      correct_count:
        (previous.correct_count || 0) +
        (isCorrect ? 1 : 0),

      wrong_count:
        (previous.wrong_count || 0) +
        (isCorrect ? 0 : 1),

      last_answer_correct: Boolean(isCorrect),
      last_answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const {
      error: saveError
    } = await supabaseClient
      .from(ANSWERS_TABLE)
      .upsert(row, {
        onConflict: "user_id,question_id"
      });

    if (saveError) {
      throw saveError;
    }
  }

  async function flushPendingAnswers() {
    while (pendingAnswers.length > 0) {
      const answer = pendingAnswers.shift();

      await saveAnswer(
        answer.questionId,
        answer.category,
        answer.isCorrect
      );
    }
  }

  /*
    各復習HTMLから呼び出すための共通関数

    使用例：
    recordAnswer(
      "913no1-q01",
      "クラウド・セキュリティ",
      true
    );
  */
  window.recordAnswer = function (
    questionId,
    category,
    isCorrect
  ) {
    if (!questionId) {
      console.warn(
        "[fe-study-sync] questionId は必須です。"
      );

      return;
    }

    const answer = {
      questionId: String(questionId),
      category: category || "未分類",
      isCorrect: Boolean(isCorrect)
    };

    /*
      初期化途中なら、一時的にキューへ入れる。
    */
    if (!initialized) {
      pendingAnswers.push(answer);
      return;
    }

    /*
      未ログインでも教材は普通に使える。
      ただし結果のクラウド保存はしない。
    */
    if (!currentUser || !supabaseClient) {
      return;
    }

    saveAnswer(
      answer.questionId,
      answer.category,
      answer.isCorrect
    )
      .then(function () {
        showSyncMessage(
          answer.isCorrect
            ? "正解を同期しました。"
            : "誤答を同期しました。",
          answer.isCorrect ? "success" : "info"
        );
      })
      .catch(function (error) {
        console.error(
          "[fe-study-sync] 回答保存に失敗しました",
          error
        );

        showSyncMessage(
          "回答結果を同期できませんでした。",
          "error"
        );
      });
  };

  /*
    現在の日付教材の問題別成績を取得する。
    将来「苦手問題だけ表示」に使う。
  */
  window.getReviewAnswerStats = async function () {
    if (!currentUser || !supabaseClient) {
      return [];
    }

    const {
      data,
      error
    } = await supabaseClient
      .from(ANSWERS_TABLE)
      .select(
        "question_id, category, correct_count, wrong_count, last_answer_correct"
      )
      .eq("user_id", currentUser.id)
      .eq("review_date", getReviewDate());

    if (error) {
      console.error(
        "[fe-study-sync] 成績の取得に失敗しました",
        error
      );

      return [];
    }

    return data || [];
  };

  /*
    苦手問題の基本判定。
    誤答回数が正答回数より多いときtrue。
  */
  window.isWeakReviewQuestion = function (stats) {
    if (!stats) {
      return false;
    }

    return (
      (stats.wrong_count || 0) >
      (stats.correct_count || 0)
    );
  };

  initialize();
})();