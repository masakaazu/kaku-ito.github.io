(() => {
  const setupAnswers = () => {
    document.querySelectorAll(".answer").forEach((answer, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "答えを表示";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", `answer-${index + 1}`);
      button.className = "button is-secondary";
      button.style.margin = "8px 0";

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
