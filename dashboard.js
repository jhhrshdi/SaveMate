/* dashboard.js - financial calculations and the dashboard screen */

function sumAmounts(list) {
  return list.reduce(function (sum, r) { return sum + Number(r.amount); }, 0);
}

// All the formulas live here.
function calculateTotals() {
  var settings = getSettings();
  var savings = getRecords("savings");
  var income = sumAmounts(getRecords("income"));
  var expenses = sumAmounts(getRecords("expenses"));
  var deposits = sumAmounts(savings.filter(function (r) { return r.type === "Deposit"; }));
  var withdrawals = sumAmounts(savings.filter(function (r) { return r.type === "Withdrawal"; }));
  var savingsBalance = roundMoney(settings.openingSavings + deposits - withdrawals);
  // Pot balances are PART of general savings, so they are never added on top of it.
  var allocated = getTotalAllocated();
  return {
    totalAllocated: allocated,
    unallocatedSavings: roundMoney(savingsBalance - allocated),
    totalIncome: roundMoney(income),
    totalExpenses: roundMoney(expenses),
    availableBalance: roundMoney(settings.openingBalance + income - expenses - deposits + withdrawals),
    savingsBalance: roundMoney(settings.openingSavings + deposits - withdrawals),
    potentialSavings: roundMoney(income - expenses)
  };
}

function initDashboard() {
  var settings = getSettings();
  document.getElementById("opening-balance").value = settings.openingBalance;
  document.getElementById("opening-savings").value = settings.openingSavings;
  document.getElementById("month-select").value = todayISO().slice(0, 7);
  document.getElementById("month-select").addEventListener("change", renderMonthlyOverview);
  document.getElementById("settings-form").addEventListener("submit", handleSettingsSubmit);
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  var balanceText = document.getElementById("opening-balance").value;
  var savingsText = document.getElementById("opening-savings").value;
  var balance = Number(balanceText);
  var savings = Number(savingsText);
  var error = document.getElementById("settings-error");
  if (balanceText === "" || savingsText === "" || !isFinite(balance) || !isFinite(savings) || balance < 0 || savings < 0) {
    error.textContent = "Opening balances must be numbers of 0 or more.";
    return;
  }
  var totals = calculateTotals();
  var newSavingsBalance = totals.savingsBalance - getSettings().openingSavings + roundMoney(savings);
  if (newSavingsBalance < totals.totalAllocated) {
    error.textContent = "Opening savings is too low: " + formatRM(totals.totalAllocated) + " is already allocated to Savings Pots.";
    return;
  }
  error.textContent = "";
  if (saveSettings({ openingBalance: roundMoney(balance), openingSavings: roundMoney(savings) })) {
    refreshAll();
  }
}

function renderDashboard() {
  var totals = calculateTotals();
  document.getElementById("stat-income").textContent = formatRM(totals.totalIncome);
  document.getElementById("stat-expenses").textContent = formatRM(totals.totalExpenses);
  document.getElementById("stat-savings").textContent = formatRM(totals.savingsBalance);
  document.getElementById("stat-allocated").textContent = formatRM(totals.totalAllocated);
  document.getElementById("stat-unallocated").textContent = formatRM(totals.unallocatedSavings);
  renderGoalsOverview();
  document.getElementById("stat-available").textContent = formatRM(totals.availableBalance);
  document.getElementById("stat-potential").textContent = formatRM(totals.potentialSavings);
  renderMonthlyOverview();
  renderRecentTransactions();
}

function renderMonthlyOverview() {
  var month = document.getElementById("month-select").value || todayISO().slice(0, 7);
  function inMonth(r) { return r.date.indexOf(month) === 0; }
  var savings = getRecords("savings").filter(inMonth);
  var income = roundMoney(sumAmounts(getRecords("income").filter(inMonth)));
  var expenses = roundMoney(sumAmounts(getRecords("expenses").filter(inMonth)));
  var deposits = sumAmounts(savings.filter(function (r) { return r.type === "Deposit"; }));
  var withdrawals = sumAmounts(savings.filter(function (r) { return r.type === "Withdrawal"; }));
  var biggest = Math.max(income, expenses, 1);
  document.getElementById("month-income").textContent = formatRM(income);
  document.getElementById("month-expenses").textContent = formatRM(expenses);
  document.getElementById("bar-income").style.width = (income / biggest * 100) + "%";
  document.getElementById("bar-expenses").style.width = (expenses / biggest * 100) + "%";
  document.getElementById("month-net").textContent = formatRM(roundMoney(income - expenses));
  document.getElementById("month-deposits").textContent = formatRM(roundMoney(deposits));
  document.getElementById("month-withdrawals").textContent = formatRM(roundMoney(withdrawals));
}

// Mixes income, expenses and savings, newest first, and shows the latest 8.
function renderRecentTransactions() {
  var all = [];
  getRecords("income").forEach(function (r) { all.push({ r: r, label: "Income", sign: "+", css: "good-text" }); });
  getRecords("expenses").forEach(function (r) { all.push({ r: r, label: "Expense", sign: "-", css: "bad-text" }); });
  getRecords("savings").forEach(function (r) {
    all.push({ r: r, label: "Savings " + r.type.toLowerCase(), sign: "", css: "" });
  });
  all.sort(function (a, b) {
    return b.r.date.localeCompare(a.r.date) || (b.r.createdAt || 0) - (a.r.createdAt || 0);
  });
  var rows = all.slice(0, 8).map(function (t) {
    return "<tr><td>" + formatDate(t.r.date) + '</td><td class="wrap">' + escapeHtml(t.r.description) +
      '</td><td><span class="badge">' + t.label + '</span></td><td class="num ' + t.css + '">' +
      t.sign + formatRM(t.r.amount) + "</td></tr>";
  });
  document.getElementById("recent-body").innerHTML = rows.length ? rows.join("") :
    '<tr><td class="empty" colspan="4">No transactions yet. Add income or an expense to get started.</td></tr>';
}
