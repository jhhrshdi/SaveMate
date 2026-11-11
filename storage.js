/* storage.js - saves/loads data in LocalStorage and holds helpers shared by all files */

var STORAGE_KEYS = {
  income: "savemate_income",
  expenses: "savemate_expenses",
  savings: "savemate_savings",
  settings: "savemate_settings",
  pots: "savemate_pots",
  potTransactions: "savemate_pot_transactions"
};

// Read JSON from LocalStorage. Returns the fallback if empty, missing or corrupted.
function readFromStorage(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;
    var parsed = JSON.parse(raw);
    return parsed === null ? fallback : parsed;
  } catch (error) {
    return fallback;
  }
}

function writeToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    alert("Could not save your data. Your browser storage may be full or disabled.");
    return false;
  }
}

// name is "income", "expenses" or "savings". Bad records are ignored.
function getRecords(name) {
  var list = readFromStorage(STORAGE_KEYS[name], []);
  if (!Array.isArray(list)) return [];
  return list.filter(function (r) {
    return r && typeof r === "object" && r.id && isFinite(Number(r.amount));
  });
}

function saveRecords(name, list) {
  return writeToStorage(STORAGE_KEYS[name], list);
}

// Add a new record, or replace the one with the same id (editing).
function upsertRecord(name, record) {
  var list = getRecords(name);
  var index = list.findIndex(function (r) { return r.id === record.id; });
  if (index >= 0) list[index] = record; else list.push(record);
  return saveRecords(name, list);
}

function deleteRecord(name, id) {
  var list = getRecords(name).filter(function (r) { return r.id !== id; });
  return saveRecords(name, list);
}

function findRecord(name, id) {
  return getRecords(name).find(function (r) { return r.id === id; });
}

function getSettings() {
  var s = readFromStorage(STORAGE_KEYS.settings, {});
  var opening = Number(s.openingBalance);
  var savings = Number(s.openingSavings);
  return {
    openingBalance: isFinite(opening) && opening >= 0 ? opening : 0,
    openingSavings: isFinite(savings) && savings >= 0 ? savings : 0
  };
}

function saveSettings(settings) {
  return writeToStorage(STORAGE_KEYS.settings, settings);
}

/* ---------- Shared helpers ---------- */

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function formatRM(amount) {
  var sign = amount < 0 ? "-" : "";
  return sign + "RM " + Math.abs(amount).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "2026-11-10" -> "10/11/2026"
function formatDate(isoDate) {
  var p = String(isoDate).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : isoDate;
}

function todayISO() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

// Stops user text from being treated as HTML.
function escapeHtml(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function fillSelect(selectId, options) {
  document.getElementById(selectId).innerHTML = options.map(function (o) {
    return '<option value="' + o + '">' + o + "</option>";
  }).join("");
}

function sortNewestFirst(list) {
  return list.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
  });
}

// Checks date, description and amount. Returns { error, amount }.
function validateCommonFields(date, description, amountText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
    return { error: "Please choose a valid date." };
  }
  if (description.trim() === "") return { error: "Please enter a description." };
  var amount = Number(amountText);
  if (amountText === "" || !isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a number greater than 0." };
  }
  if (amount > 1000000000) return { error: "Amount is too large." };
  return { error: "", amount: roundMoney(amount) };
}

// Buttons shown at the end of every history row.
function rowButtons(id) {
  return '<button class="btn small ghost" data-action="edit" data-id="' + id + '">Edit</button>' +
         '<button class="btn small danger" data-action="delete" data-id="' + id + '">Delete</button>';
}
