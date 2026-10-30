const FEE_TABLE = {
  adult: { one: 800, two: 1400 },
  child: { one: 500, two: 900 },
};

const DATE_LABELS = {
  "2026-11-13": "11/13（五）",
  "2026-11-14": "11/14（六）",
};

function getApiUrl() {
  const url = window.BJJ_CONFIG && window.BJJ_CONFIG.API_URL;
  return String(url || "").trim();
}

function ensureApiConfigured() {
  const url = getApiUrl();
  if (!url) {
    throw new Error("尚未設定線上 API。請先完成 backend 部署，並在 js/config.js 填入 API_URL。");
  }
  return url;
}

async function apiRequest(payload) {
  const url = ensureApiConfigured();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("伺服器回應格式錯誤，請確認 API 部署是否正確。");
  }

  if (!data.ok) {
    throw new Error(data.error || "操作失敗");
  }
  return data;
}

function calcFee(category, dates) {
  const count = Array.isArray(dates) ? dates.length : 0;
  if (!count || !FEE_TABLE[category]) return 0;
  const tier = FEE_TABLE[category];
  return count >= 2 ? tier.two : tier.one;
}

function formatFee(amount) {
  return `NT$ ${amount.toLocaleString("zh-TW")}`;
}

async function createRegistration(data) {
  const result = await apiRequest({ action: "create", ...data });
  return result.record;
}

async function findRegistration(id, phone) {
  const result = await apiRequest({ action: "find", id, phone });
  return result.record;
}

async function updateRegistration(id, lookupPhone, data) {
  const result = await apiRequest({
    action: "update",
    id,
    lookupPhone,
    ...data,
  });
  return result.record;
}

function bindFeeSummary(form, summaryEl) {
  const refresh = () => {
    const category = form.querySelector('input[name="category"]:checked')?.value || "adult";
    const dates = [...form.querySelectorAll('input[name="dates"]:checked')].map((el) => el.value);
    const fee = calcFee(category, dates);
    summaryEl.innerHTML = `預估費用：<strong>${formatFee(fee)}</strong>`;
  };

  form.addEventListener("change", refresh);
  refresh();
}

function bindPaymentToggle(form) {
  const transferFields = form.querySelector("#transfer-fields");
  const last5 = form.querySelector('input[name="last5"]');
  const last5Error = form.querySelector("#last5-error");

  const refresh = () => {
    const payment = form.querySelector('input[name="payment"]:checked')?.value;
    const isTransfer = payment === "transfer";
    transferFields.hidden = !isTransfer;
    if (!isTransfer) {
      last5.value = "";
      if (last5Error) last5Error.hidden = true;
    }
  };

  form.addEventListener("change", (e) => {
    if (e.target.name === "payment") refresh();
  });
  refresh();
}

function readFormData(form) {
  const fd = new FormData(form);
  const dates = [...form.querySelectorAll('input[name="dates"]:checked')].map((el) => el.value);
  return {
    name: String(fd.get("name") || "").trim(),
    phone: String(fd.get("phone") || "").trim(),
    email: String(fd.get("email") || "").trim(),
    dates,
    category: String(fd.get("category") || ""),
    payment: String(fd.get("payment") || ""),
    last5: String(fd.get("last5") || "").trim(),
  };
}

function validateRegistration(form, data) {
  const datesError = form.querySelector("#dates-error");
  const last5Error = form.querySelector("#last5-error");
  const emailError = form.querySelector("#email-error");
  let ok = true;

  if (datesError) datesError.hidden = true;
  if (last5Error) last5Error.hidden = true;
  if (emailError) emailError.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    ok = false;
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    if (emailError) emailError.hidden = false;
    ok = false;
  }

  if (!data.dates.length) {
    if (datesError) datesError.hidden = false;
    ok = false;
  }

  if (data.payment === "transfer") {
    if (!/^\d{5}$/.test(data.last5)) {
      if (last5Error) last5Error.hidden = false;
      ok = false;
    }
  } else {
    data.last5 = "";
  }

  return ok;
}

function fillForm(form, record) {
  form.name.value = record.name || "";
  form.phone.value = record.phone || "";
  form.email.value = record.email || "";

  form.querySelectorAll('input[name="dates"]').forEach((el) => {
    el.checked = (record.dates || []).includes(el.value);
  });

  const cat = form.querySelector(`input[name="category"][value="${record.category}"]`);
  if (cat) cat.checked = true;

  const pay = form.querySelector(`input[name="payment"][value="${record.payment}"]`);
  if (pay) pay.checked = true;

  form.last5.value = record.last5 || "";
  form.dispatchEvent(new Event("change", { bubbles: true }));
}

function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText || "處理中…";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

window.BjjStore = {
  FEE_TABLE,
  DATE_LABELS,
  calcFee,
  formatFee,
  createRegistration,
  findRegistration,
  updateRegistration,
  bindFeeSummary,
  bindPaymentToggle,
  readFormData,
  validateRegistration,
  fillForm,
  setBusy,
  getApiUrl,
};
