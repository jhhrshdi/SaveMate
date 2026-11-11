/* income.js - add, edit, delete and list income records */

var INCOME_CATEGORIES = ["Allowance", "Salary", "Part-time Income", "Business Income", "Gift", "Others"];

function initIncome() {
  fillSelect("income-category", INCOME_CATEGORIES);
  document.getElementById("income-form").addEventListener("submit", handleIncomeSubmit);
  document.getElementById("income-cancel").addEventListener("click", resetIncomeForm);
  document.getElementById("income-body").addEventListener("click", handleIncomeTableClick);
  resetIncomeForm();
}

function resetIncomeForm() {
  document.getElementById("income-form").reset();
  document.getElementById("income-id").value = "";
  document.getElementById("income-date").value = todayISO();
  document.getElementById("income-form-title").textContent = "Add income";
  document.getElementById("income-submit").textContent = "Add income";
  document.getElementById("income-cancel").hidden = true;
  document.getElementById("income-error").textContent = "";
}

function handleIncomeSubmit(event) {
  event.preventDefault();
  var date = document.getElementById("income-date").value;
  var description = document.getElementById("income-description").value;
  var category = document.getElementById("income-category").value;
  var check = validateCommonFields(date, description, document.getElementById("income-amount").value);
  if (check.error) {
    document.getElementById("income-error").textContent = check.error;
    return;
  }
  var id = document.getElementById("income-id").value;
  var existing = id ? findRecord("income", id) : null;
  var record = {
    id: existing ? existing.id : createId(),
    createdAt: existing ? existing.createdAt : Date.now(),
    date: date,
    description: description.trim(),
    category: category,
    amount: check.amount,
    notes: document.getElementById("income-notes").value.trim()
  };
  if (upsertRecord("income", record)) {
    resetIncomeForm();
    refreshAll();
  }
}

function handleIncomeTableClick(event) {
  var button = event.target.closest("button[data-action]");
  if (!button) return;
  var id = button.dataset.id;
  if (button.dataset.action === "delete") {
    if (!confirm("Delete this income record?")) return;
    deleteRecord("income", id);
    if (document.getElementById("income-id").value === id) resetIncomeForm();
    refreshAll();
  } else {
    var record = findRecord("income", id);
    if (!record) return;
    document.getElementById("income-id").value = record.id;
    document.getElementById("income-date").value = record.date;
    document.getElementById("income-description").value = record.description;
    document.getElementById("income-category").value = record.category;
    document.getElementById("income-amount").value = record.amount;
    document.getElementById("income-notes").value = record.notes || "";
    document.getElementById("income-form-title").textContent = "Edit income";
    document.getElementById("income-submit").textContent = "Save changes";
    document.getElementById("income-cancel").hidden = false;
    document.getElementById("income-form").scrollIntoView({ behavior: "smooth" });
  }
}

function renderIncome() {
  var list = sortNewestFirst(getRecords("income"));
  var total = 0;
  var rows = list.map(function (r) {
    total += Number(r.amount);
    return "<tr><td>" + formatDate(r.date) + '</td><td class="wrap">' + escapeHtml(r.description) +
      "</td><td>" + escapeHtml(r.category) + '</td><td class="wrap">' + escapeHtml(r.notes) +
      '</td><td class="num good-text">' + formatRM(r.amount) + "</td><td>" + rowButtons(r.id) + "</td></tr>";
  });
  document.getElementById("income-body").innerHTML = rows.length ? rows.join("") :
    '<tr><td class="empty" colspan="6">No income yet. Add your first record above.</td></tr>';
  document.getElementById("income-total").textContent = rows.length ? "Total " + formatRM(roundMoney(total)) : "";
}
