/* expenses.js - add, edit, delete and list expense records */

var EXPENSE_CATEGORIES = ["Food & Drinks", "Transportation", "Shopping", "Education", "Bills & Utilities", "Entertainment", "Personal Care", "Health", "Others"];
var PAYMENT_METHODS = ["Cash", "Bank", "E-wallet"];

function initExpenses() {
  fillSelect("expense-category", EXPENSE_CATEGORIES);
  fillSelect("expense-method", PAYMENT_METHODS);
  document.getElementById("expense-form").addEventListener("submit", handleExpenseSubmit);
  document.getElementById("expense-cancel").addEventListener("click", resetExpenseForm);
  document.getElementById("expense-body").addEventListener("click", handleExpenseTableClick);
  resetExpenseForm();
}

function resetExpenseForm() {
  document.getElementById("expense-form").reset();
  document.getElementById("expense-id").value = "";
  document.getElementById("expense-date").value = todayISO();
  document.getElementById("expense-form-title").textContent = "Add expense";
  document.getElementById("expense-submit").textContent = "Add expense";
  document.getElementById("expense-cancel").hidden = true;
  document.getElementById("expense-error").textContent = "";
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  var date = document.getElementById("expense-date").value;
  var description = document.getElementById("expense-description").value;
  var check = validateCommonFields(date, description, document.getElementById("expense-amount").value);
  if (check.error) {
    document.getElementById("expense-error").textContent = check.error;
    return;
  }
  var id = document.getElementById("expense-id").value;
  var existing = id ? findRecord("expenses", id) : null;
  var record = {
    id: existing ? existing.id : createId(),
    createdAt: existing ? existing.createdAt : Date.now(),
    date: date,
    description: description.trim(),
    category: document.getElementById("expense-category").value,
    paymentMethod: document.getElementById("expense-method").value,
    amount: check.amount,
    notes: document.getElementById("expense-notes").value.trim()
  };
  if (upsertRecord("expenses", record)) {
    resetExpenseForm();
    refreshAll();
  }
}

function handleExpenseTableClick(event) {
  var button = event.target.closest("button[data-action]");
  if (!button) return;
  var id = button.dataset.id;
  if (button.dataset.action === "delete") {
    if (!confirm("Delete this expense?")) return;
    deleteRecord("expenses", id);
    if (document.getElementById("expense-id").value === id) resetExpenseForm();
    refreshAll();
  } else {
    var record = findRecord("expenses", id);
    if (!record) return;
    document.getElementById("expense-id").value = record.id;
    document.getElementById("expense-date").value = record.date;
    document.getElementById("expense-description").value = record.description;
    document.getElementById("expense-category").value = record.category;
    document.getElementById("expense-method").value = record.paymentMethod;
    document.getElementById("expense-amount").value = record.amount;
    document.getElementById("expense-notes").value = record.notes || "";
    document.getElementById("expense-form-title").textContent = "Edit expense";
    document.getElementById("expense-submit").textContent = "Save changes";
    document.getElementById("expense-cancel").hidden = false;
    document.getElementById("expense-form").scrollIntoView({ behavior: "smooth" });
  }
}

function renderExpenses() {
  var list = sortNewestFirst(getRecords("expenses"));
  var total = 0;
  var rows = list.map(function (r) {
    total += Number(r.amount);
    return "<tr><td>" + formatDate(r.date) + '</td><td class="wrap">' + escapeHtml(r.description) +
      "</td><td>" + escapeHtml(r.category) + "</td><td>" + escapeHtml(r.paymentMethod) +
      '</td><td class="wrap">' + escapeHtml(r.notes) +
      '</td><td class="num bad-text">' + formatRM(r.amount) + "</td><td>" + rowButtons(r.id) + "</td></tr>";
  });
  document.getElementById("expense-body").innerHTML = rows.length ? rows.join("") :
    '<tr><td class="empty" colspan="7">No expenses yet. Add your first record above.</td></tr>';
  document.getElementById("expense-total").textContent = rows.length ? "Total " + formatRM(roundMoney(total)) : "";
}
