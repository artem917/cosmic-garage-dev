// Only presentation/entry: no save writes, audio, network assets or game rules here.
const screen = document.querySelector("#startupScreen");
const loading = document.querySelector("#startupLoading");
const progress = document.querySelector("#startupProgress");
const status = document.querySelector("#startupStatus");
const detail = document.querySelector("#startupDetail");
const enter = document.querySelector("#enterGarage");
const game = document.querySelector(".game-shell");
const started = performance.now();
const stages = {
  ui: [25, "Проверяем изоленту…", "Интерфейс собран"],
  save: [45, "Ищем последний болт…", "Сохранение прочитано"],
  logic: [75, "Пинаем стартер…", "Игровая логика и управление готовы"],
  canvas: [90, "Протираем иллюминатор…", "Ракета и холст готовы"],
};
function onStage(event) {
  const stage = stages[event.detail];
  if (!stage) return;
  progress.value = stage[0]; status.textContent = stage[1]; detail.textContent = stage[2];
  screen.dataset.stage = event.detail;
}
window.addEventListener("cosmic-startup-stage", onStage);

// One intentional user gesture; a future audio unlock can live here, not in loading.
function enterGarage() {
  screen.hidden = true;
  game.inert = false;
  game.removeAttribute("aria-hidden");
  document.querySelector("#launchButton").focus({preventScroll:true});
}

try {
  await import("./game.js");
  progress.value = 100;
  status.textContent = "Все системы готовы";
  detail.textContent = "Ничего лишнего. Только ракета и ты.";
  // Presentation hold, explicitly not fake downloading progress.
  await new Promise(resolve => setTimeout(resolve, Math.max(0, 800 - (performance.now() - started))));
  loading.hidden = true;
  enter.hidden = false;
  screen.dataset.stage = "ready";
  screen.setAttribute("aria-busy", "false");
  enter.addEventListener("click", enterGarage, {once:true});
  enter.focus({preventScroll:true});
} catch (error) {
  status.textContent = "Не удалось подготовить ракету";
  detail.textContent = "Обновите страницу. Ваше сохранение не сброшено.";
  progress.hidden = true;
  screen.dataset.stage = "error";
  screen.setAttribute("aria-busy", "false");
  console.error("Cosmic Garage initialization failed", error);
} finally {
  window.removeEventListener("cosmic-startup-stage", onStage);
}
