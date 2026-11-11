/* pots.js - Savings Pots (goals). Pot money is PART of General Savings, never extra money.
   Unallocated Savings = Total General Savings - Total Allocated Savings */

var POT_ICONS = [
  ["🎯", "Goal"], ["📱", "Phone / Tablet"], ["💻", "Laptop"], ["🛡️", "Emergency"],
  ["✈️", "Holiday"], ["🎓", "Education"], ["🎁", "Gift"], ["🏠", "Home"], ["🚗", "Car"]
];
var openHistoryPotIds = []; // pots whose history list is currently expanded

/* ---------- Data helpers ---------- */

function getPots() {
  var list = readFromStorage(STORAGE_KEYS.pots, []);
  if (!Array.isArray(list)) return [];
  return list.filter(function (p) { return p && typeof p === "object" && p.id && isFinite(Number(p.target)); });
}

function savePots(list) { return writeToStorage(STORAGE_KEYS.pots, list); }

function getPotTransactions() { return getRecords("potTransactions"); }

// Balance = starting balance + money added - money withdrawn.
function calcPotBalance(pot, transactions) {
  var balance = Number(pot.initialBalance) || 0;
  transactions.forEach(function (t) {
    if (t.potId !== pot.id) return;
    balance += t.type === "Add Money" ? Number(t.amount) : -Number(t.amount);
  });
  return roundMoney(balance);
}

function getTotalAllocated() {
  var transactions = getPotTransactions();
  return roundMoney(getPots().reduce(function (sum, p) { return sum + calcPotBalance(p, transactions); }, 0));
}

// General savings WITHOUT looking at pots (calculateTotals already includes this as savingsBalance).
function getTotalGeneralSavings() { return calculateTotals().savingsBalance; }

// Safety check for a proposed change: no pot below 0, and pots together never above general savings.
function isPotStateValid(pots, transactions) {
  var total = 0;
  for (var i = 0; i < pots.length; i++) {
    var balance = calcPotBalance(pots[i], transactions);
    if (balance < 0) return "That change would make \"" + pots[i].name + "\" negative.";
    total += balance;
  }
  if (roundMoney(total) > getTotalGeneralSavings()) {
    return "That change would allocate more than your Total General Savings (" + formatRM(getTotalGeneralSavings()) + ").";
  }
  return "";
}

/* ---------- Setup ---------- */

function initPots() {
  document.getElementById("pot-icon").innerHTML = POT_ICONS.map(function (i) {
    return '<option value="' + i[0] + '">' + i[0] + " " + i[1] + "</option>";
  }).join("");
  document.getElementById("pot-form").addEventListener("submit", handlePotSubmit);
  document.getElementById("pot-cancel").addEventListener("click", resetPotForm);
  document.getElementById("pot-money-form").addEventListener("submit", handlePotMoneySubmit);
  document.getElementById("pots-list").addEventListener("click", handlePotsListClick);
  resetPotForm();
  document.getElementById("pot-money-date").value = todayISO();
}

function resetPotForm() {
  document.getElementById("pot-form").reset();
  document.getElementById("pot-id").value = "";
  document.getElementById("pot-form-title").textContent = "Create a savings pot";
  document.getElementById("pot-submit").textContent = "Create pot";
  document.getElementById("pot-cancel").hidden = true;
  document.getElementById("pot-error").textContent = "";
}

/* ---------- Create / edit pot ---------- */

function handlePotSubmit(event) {
  event.preventDefault();
  var errorBox = document.getElementById("pot-error");
  var name = document.getElementById("pot-name").value.trim();
  var targetText = document.getElementById("pot-target").value;
  var initialText = document.getElementById("pot-initial").value;
  var date = document.getElementById("pot-date").value;
  var target = Number(targetText);
  var initial = initialText === "" ? 0 : Number(initialText);

  if (name === "") { errorBox.textContent = "Please enter a goal name."; return; }
  if (targetText === "" || !isFinite(target) || target <= 0 || target > 1000000000) { errorBox.textContent = "Target amount must be greater than 0."; return; }
  if (!isFinite(initial) || initial < 0) { errorBox.textContent = "Starting balance cannot be negative."; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) { errorBox.textContent = "Please choose a valid target date."; return; }

  var id = document.getElementById("pot-id").value;
  var existing = id ? getPots().find(function (p) { return p.id === id; }) : null;
  var pot = {
    id: existing ? existing.id : createId(),
    createdAt: existing ? existing.createdAt : Date.now(),
    name: name,
    icon: document.getElementById("pot-icon").value,
    target: roundMoney(target),
    initialBalance: roundMoney(initial),
    targetDate: date,
    description: document.getElementById("pot-description").value.trim()
  };

  var pots = getPots().filter(function (p) { return p.id !== pot.id; });
  pots.push(pot);
  var problem = isPotStateValid(pots, getPotTransactions());
  if (problem) { errorBox.textContent = problem; return; }
  if (savePots(pots)) { resetPotForm(); refreshAll(); }
}

/* ---------- Add / withdraw money ---------- */

function handlePotMoneySubmit(event) {
  event.preventDefault();
  var errorBox = document.getElementById("pot-money-error");
  var potId = document.getElementById("pot-money-pot").value;
  var type = document.getElementById("pot-money-type").value;
  var pots = getPots();
  var pot = pots.find(function (p) { return p.id === potId; });
  if (!pot) { errorBox.textContent = "Create a savings pot first."; return; }
  // The description is optional here, so a placeholder is passed to the shared checker.
  var check = validateCommonFields(document.getElementById("pot-money-date").value, "ok", document.getElementById("pot-money-amount").value);
  if (check.error) { errorBox.textContent = check.error; return; }

  var transactions = getPotTransactions();
  var balance = calcPotBalance(pot, transactions);
  var unallocated = roundMoney(getTotalGeneralSavings() - getTotalAllocated());
  if (type === "Add Money" && check.amount > unallocated) {
    errorBox.textContent = "Only " + formatRM(unallocated) + " of unallocated savings is available.";
    return;
  }
  if (type === "Withdraw Money" && check.amount > balance) {
    errorBox.textContent = "This pot only has " + formatRM(balance) + ".";
    return;
  }
  var record = {
    id: createId(), createdAt: Date.now(), potId: potId,
    date: document.getElementById("pot-money-date").value,
    type: type, amount: check.amount,
    description: document.getElementById("pot-money-description").value.trim()
  };
  if (upsertRecord("potTransactions", record)) {
    errorBox.textContent = "";
    document.getElementById("pot-money-amount").value = "";
    document.getElementById("pot-money-description").value = "";
    refreshAll();
  }
}

/* ---------- Buttons on pot cards ---------- */

function handlePotsListClick(event) {
  var button = event.target.closest("button[data-action]");
  if (!button) return;
  var action = button.dataset.action;
  var id = button.dataset.id;

  if (action === "pot-add" || action === "pot-withdraw") {
    document.getElementById("pot-money-pot").value = id;
    document.getElementById("pot-money-type").value = action === "pot-add" ? "Add Money" : "Withdraw Money";
    document.getElementById("pot-money-card").scrollIntoView({ behavior: "smooth" });
    document.getElementById("pot-money-amount").focus();
  } else if (action === "pot-history") {
    var at = openHistoryPotIds.indexOf(id);
    if (at >= 0) openHistoryPotIds.splice(at, 1); else openHistoryPotIds.push(id);
    renderPots();
  } else if (action === "pot-edit") {
    var pot = getPots().find(function (p) { return p.id === id; });
    if (!pot) return;
    document.getElementById("pot-id").value = pot.id;
    document.getElementById("pot-name").value = pot.name;
    document.getElementById("pot-icon").value = pot.icon;
    document.getElementById("pot-target").value = pot.target;
    document.getElementById("pot-initial").value = pot.initialBalance;
    document.getElementById("pot-date").value = pot.targetDate;
    document.getElementById("pot-description").value = pot.description || "";
    document.getElementById("pot-form-title").textContent = "Edit savings pot";
    document.getElementById("pot-submit").textContent = "Save changes";
    document.getElementById("pot-cancel").hidden = false;
    document.getElementById("pot-error").textContent = "";
    document.getElementById("pot-form-card").scrollIntoView({ behavior: "smooth" });
  } else if (action === "pot-delete") {
    var potToDelete = getPots().find(function (p) { return p.id === id; });
    if (!potToDelete) return;
    var remaining = calcPotBalance(potToDelete, getPotTransactions());
    var message = 'Delete "' + potToDelete.name + '"?' + (remaining > 0 ? " Its " + formatRM(remaining) + " will go back to Unallocated Savings." : "");
    if (!confirm(message)) return;
    // Balance is calculated from the pot's own records, so removing them frees the money automatically.
    savePots(getPots().filter(function (p) { return p.id !== id; }));
    saveRecords("potTransactions", getPotTransactions().filter(function (t) { return t.potId !== id; }));
    if (document.getElementById("pot-id").value === id) resetPotForm();
    refreshAll();
  } else if (action === "tx-delete") {
    var transactions = getPotTransactions();
    var remainingTx = transactions.filter(function (t) { return t.id !== id; });
    var problem = isPotStateValid(getPots(), remainingTx);
    if (problem) { alert("Cannot delete this transaction. " + problem); return; }
    if (!confirm("Delete this pot transaction?")) return;
    saveRecords("potTransactions", remainingTx);
    refreshAll();
  }
}

/* ---------- Drawing the screen ---------- */

function potPercent(balance, target) {
  return Math.min(100, Math.round(balance / target * 1000) / 10);
}

function renderPots() {
  var pots = getPots().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  var transactions = getPotTransactions();
  var totals = calculateTotals();
  document.getElementById("pots-total").textContent = formatRM(totals.savingsBalance);
  document.getElementById("pots-allocated").textContent = formatRM(totals.totalAllocated);
  document.getElementById("pots-unallocated").textContent = formatRM(totals.unallocatedSavings);

  // Keep the pot dropdown in sync (remember the current choice).
  var select = document.getElementById("pot-money-pot");
  var chosen = select.value;
  select.innerHTML = pots.length ? pots.map(function (p) {
    return '<option value="' + p.id + '">' + escapeHtml(p.icon) + " " + escapeHtml(p.name) + "</option>";
  }).join("") : '<option value="">No pots yet</option>';
  if (chosen && pots.some(function (p) { return p.id === chosen; })) select.value = chosen;

  document.getElementById("pots-list").innerHTML = pots.length ? pots.map(function (pot) {
    var balance = calcPotBalance(pot, transactions);
    var done = balance >= pot.target;
    var percent = potPercent(balance, pot.target);
    var history = "";
    if (openHistoryPotIds.indexOf(pot.id) >= 0) {
      var items = sortNewestFirst(transactions.filter(function (t) { return t.potId === pot.id; }));
      history = '<div class="pot-history">' + (items.length ? items.map(function (t) {
        var add = t.type === "Add Money";
        return '<div class="row"><span>' + formatDate(t.date) + " · " + t.type + (t.description ? " · " + escapeHtml(t.description) : "") +
          '</span><span class="' + (add ? "good-text" : "bad-text") + '">' + (add ? "+" : "-") + formatRM(t.amount) +
          '</span><button class="btn small danger" data-action="tx-delete" data-id="' + t.id + '">x</button></div>';
      }).join("") : "No transactions yet.") +
        (Number(pot.initialBalance) > 0 ? '<div class="row"><span>Starting balance</span><span>' + formatRM(pot.initialBalance) + "</span></div>" : "") + "</div>";
    }
    return '<div class="card pot-card"><div class="pot-head"><div class="pot-icon">' + escapeHtml(pot.icon) + "</div><h3>" + escapeHtml(pot.name) +
      '</h3><span class="badge' + (done ? " done" : "") + '">' + (done ? "Completed" : "In Progress") + "</span></div>" +
      '<div class="pot-saved">' + formatRM(balance) + "</div>" +
      '<div class="pot-meta">Target: <b>' + formatRM(pot.target) + "</b> · Remaining: <b>" + formatRM(Math.max(0, roundMoney(pot.target - balance))) + "</b></div>" +
      '<div class="pot-progress"><div class="bar"><i class="' + (done ? "complete" : "") + '" style="width:' + percent + '%"></i></div><b>' + percent + "%</b></div>" +
      '<div class="pot-meta">Target date: <b>' + formatDate(pot.targetDate) + "</b></div>" +
      (pot.description ? '<div class="pot-meta">' + escapeHtml(pot.description) + "</div>" : "") +
      '<div class="pot-actions">' +
      '<button class="btn small" data-action="pot-add" data-id="' + pot.id + '">Add money</button>' +
      '<button class="btn small ghost" data-action="pot-withdraw" data-id="' + pot.id + '">Withdraw</button>' +
      '<button class="btn small ghost" data-action="pot-history" data-id="' + pot.id + '">History</button>' +
      '<button class="btn small ghost" data-action="pot-edit" data-id="' + pot.id + '">Edit</button>' +
      '<button class="btn small danger" data-action="pot-delete" data-id="' + pot.id + '">Delete</button></div>' + history + "</div>";
  }).join("") : '<div class="card">No savings pots yet. Create your first goal below.</div>';
}

// Small summary of every pot, shown on the Dashboard.
function renderGoalsOverview() {
  var pots = getPots();
  var transactions = getPotTransactions();
  document.getElementById("goals-overview").innerHTML = pots.length ? pots.map(function (pot) {
    var balance = calcPotBalance(pot, transactions);
    var percent = potPercent(balance, pot.target);
    return '<div class="mini-goal"><span>' + escapeHtml(pot.icon) + " " + escapeHtml(pot.name) + '</span><div class="bar"><i class="' +
      (balance >= pot.target ? "complete" : "") + '" style="width:' + percent + '%"></i></div><b>' +
      formatRM(balance) + " / " + formatRM(pot.target) + " (" + percent + "%)</b></div>";
  }).join("") : '<p class="month-line">No savings pots yet. Open the Pots page to create one.</p>';
}
