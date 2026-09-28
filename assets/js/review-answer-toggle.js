(() => {
  const setupAnswers = () => {
    document.querySelectorAll(".answer").forEach((answer, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "答えを表示";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", `answer-${index + 1}`);
      button.style.cssText = "margin: 8px 0; padding: 6px 12px; border: 1px solid #2476c9; border-radius: 5px; color: #2476c9; background: #fff; cursor: pointer; font: inherit;";

      answer.id = `answer-${index + 1}`;
      answer.hidden = true;
      answer.before(button);

      button.addEventListener("click", () => {
        answer.hidden = !answer.hidden;
        button.textContent = answer.hidden ? "答えを表示" : "答えを隠す";
        button.setAttribute("aria-expanded", String(!answer.hidden));
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAnswers);
  } else {
    setupAnswers();
  }
})();
