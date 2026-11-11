/* app.js - starts the app, handles navigation, refreshes every screen */

function showView(name) {
  document.querySelectorAll(".view").forEach(function (v) {
    v.classList.toggle("active", v.id === "view-" + name);
  });
  document.querySelectorAll(".nav-btn").forEach(function (b) {
    b.classList.toggle("active", b.dataset.view === name);
  });
  window.scrollTo(0, 0);
}

// Call this after ANY change so every figure and table stays correct.
function refreshAll() {
  renderIncome();
  renderExpenses();
  renderSavings();
  renderPots();
  renderDashboard();
}

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".nav-btn").forEach(function (button) {
    button.addEventListener("click", function () { showView(button.dataset.view); });
  });
  initIncome();
  initExpenses();
  initSavings();
  initPots();
  initDashboard();
  refreshAll();
});
