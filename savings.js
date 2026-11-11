/* savings.js - savings deposits and withdrawals (never counted as expenses or income) */

function initSavings() {
  document.getElementById("savings-form").addEventListener("submit", handleSavingsSubmit);
  document.getElementById("savings-cancel").addEventListener("click", resetSavingsForm);
  document.getElementById("savings-body").addEventListener("click", handleSavingsTableClick);
  resetSavingsForm();
}

function resetSavingsForm() {
  document.getElementById("savings-form").reset();
  document.getElementById("savings-id").value = "";
  document.getElementById("savings-date").value = todayISO();
  document.getElementById("savings-form-title").textContent = "Add savings record";
  document.getElementById("savings-submit").textContent = "Add record";
  document.getElementById("savings-cancel").hidden = true;
  document.getElementById("savings-error").textContent = "";
}

// Savings balance if one record (the one being edited) is left out.
function savingsBalanceWithout(excludedId) {
  var balance = getSettings().openingSavings;
  getRecords("savings").forEach(function (r) {
    if (r.id === excludedId) return;
    balance += r.type === "Deposit" ? Number(r.amount) : -Number(r.amount);
  });
  return roundMoney(balance);
}

function handleSavingsSubmit(event) {
  event.preventDefault();
  var date = document.getElementById("savings-date").value;
  var description = document.getElementById("savings-description").value;
  var type = document.getElementById("savings-type").value;
  var check = validateCommonFields(date, description, document.getElementById("savings-amount").value);
  var id = document.getElementById("savings-id").value;
  if (!check.error && type !== "Deposit" && type !== "Withdrawal") check.error = "Choose Deposit or Withdrawal.";
  // Money inside Savings Pots cannot be taken out here: general savings must stay at or above the allocated total.
  if (!check.error) {
    var newBalance = savingsBalanceWithout(id) + (type === "Deposit" ? check.amount : -check.amount);
    var allocated = getTotalAllocated();
    if (newBalance < allocated) {
      check.error = type === "Withdrawal"
        ? "Withdrawal is more than your unallocated savings (" + formatRM(roundMoney(savingsBalanceWithout(id) - allocated)) + "). Withdraw from a Savings Pot first."
        : "This change would leave less savings than the " + formatRM(allocated) + " allocated to Savings Pots.";
    }
  }
  if (check.error) {
    document.getElementById("savings-error").textContent = check.error;
    return;
  }
  var existing = id ? findRecord("savings", id) : null;
  var record = {
    id: existing ? existing.id : createId(),
    createdAt: existing ? existing.createdAt : Date.now(),
    date: date,
    description: description.trim(),
    type: type,
    amount: check.amount
  };
  if (upsertRecord("savings", record)) {
    resetSavingsForm();
    refreshAll();
  }
}

function handleSavingsTableClick(event) {
  var button = event.target.closest("button[data-action]");
  if (!button) return;
  var id = button.dataset.id;
  if (button.dataset.action === "delete") {
    if (savingsBalanceWithout(id) < getTotalAllocated()) {
      alert("Cannot delete: your savings would drop below the " + formatRM(getTotalAllocated()) + " allocated to Savings Pots. Withdraw from a pot first.");
      return;
    }
    if (!confirm("Delete this savings record?")) return;
    deleteRecord("savings", id);
    if (document.getElementById("savings-id").value === id) resetSavingsForm();
    refreshAll();
  } else {
    var record = findRecord("savings", id);
    if (!record) return;
    document.getElementById("savings-id").value = record.id;
    document.getElementById("savings-date").value = record.date;
    document.getElementById("savings-description").value = record.description;
    document.getElementById("savings-type").value = record.type;
    document.getElementById("savings-amount").value = record.amount;
    document.getElementById("savings-form-title").textContent = "Edit savings record";
    document.getElementById("savings-submit").textContent = "Save changes";
    document.getElementById("savings-cancel").hidden = false;
    document.getElementById("savings-form").scrollIntoView({ behavior: "smooth" });
  }
}

function renderSavings() {
  var rows = sortNewestFirst(getRecords("savings")).map(function (r) {
    var isDeposit = r.type === "Deposit";
    return "<tr><td>" + formatDate(r.date) + '</td><td class="wrap">' + escapeHtml(r.description) +
      '</td><td><span class="badge">' + escapeHtml(r.type) + '</span></td><td class="num ' +
      (isDeposit ? "good-text" : "bad-text") + '">' + (isDeposit ? "+" : "-") + formatRM(r.amount) +
      "</td><td>" + rowButtons(r.id) + "</td></tr>";
  });
  document.getElementById("savings-body").innerHTML = rows.length ? rows.join("") :
    '<tr><td class="empty" colspan="5">No savings records yet. Add a deposit above.</td></tr>';
  var totals = calculateTotals();
  document.getElementById("savings-balance").textContent = formatRM(totals.savingsBalance);
  document.getElementById("savings-split").textContent = "Allocated to pots: " + formatRM(totals.totalAllocated) + " | Unallocated: " + formatRM(totals.unallocatedSavings);
}
