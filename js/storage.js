const FEE_TABLE = {
  adult: 800,
  child: 500,
};

const AGE_GROUPS = [
  { value: "4-5", label: "4～5 歲" },
  { value: "6-7", label: "6～7 歲" },
  { value: "8-9", label: "8～9 歲" },
  { value: "10-11", label: "10～11 歲" },
  { value: "12-13", label: "12～13 歲" },
  { value: "14-15", label: "14～15 歲" },
  { value: "16-17", label: "16～17 歲" },
];

const WEIGHT_CLASSES = [
  { value: "20-25", label: "20～25 kg" },
  { value: "25-30", label: "25～30 kg" },
  { value: "30-35", label: "30～35 kg" },
  { value: "35-40", label: "35～40 kg" },
  { value: "40-45", label: "40～45 kg" },
  { value: "45-50", label: "45～50 kg" },
  { value: "50-55", label: "50～55 kg" },
  { value: "55-60", label: "55～60 kg" },
  { value: "60-65", label: "60～65 kg" },
  { value: "65-70", label: "65～70 kg" },
];

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

function calcFee(category) {
  return FEE_TABLE[category] || 0;
}

function formatFee(amount) {
  return `NT$ ${Number(amount || 0).toLocaleString("zh-TW")}`;
}

function categoryLabel(category) {
  return category === "child" ? "兒童組" : "成人組";
}

function ageGroupLabel(value) {
  return AGE_GROUPS.find((item) => item.value === value)?.label || value || "—";
}

function weightClassLabel(value) {
  return WEIGHT_CLASSES.find((item) => item.value === value)?.label || value || "—";
}

function fillSelectOptions(select, options, placeholder) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder || "請選擇";
  select.appendChild(first);
  options.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.value;
    opt.textContent = item.label;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

async function createRegistration(data) {
  const result = await apiRequest({ action: "create", ...data });
  return result.record;
}

async function findRegistration(name) {
  const result = await apiRequest({ action: "find", name });
  return result.record;
}

async function updateRegistration(lookupName, data) {
  const result = await apiRequest({
    action: "update",
    lookupName,
    ...data,
  });
  return result.record;
}

async function listRegistrations() {
  const result = await apiRequest({ action: "list" });
  return result.records || [];
}

function bindFeeSummary(form, summaryEl) {
  const refresh = () => {
    const category = form.querySelector('input[name="category"]:checked')?.value || "adult";
    const fee = calcFee(category);
    summaryEl.innerHTML = `報名費：<strong>${formatFee(fee)}</strong><span class="summary-note">／單場</span>`;
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
    if (transferFields) transferFields.hidden = !isTransfer;
    if (!isTransfer && last5) {
      last5.value = "";
      if (last5Error) last5Error.hidden = true;
    }
  };

  form.addEventListener("change", (e) => {
    if (e.target.name === "payment") refresh();
  });
  refresh();
}

function bindCategoryFields(form) {
  const childFields = form.querySelector("#child-fields");
  const ageSelect = form.querySelector('select[name="ageGroup"]');
  const weightSelect = form.querySelector('select[name="weightClass"]');

  fillSelectOptions(ageSelect, AGE_GROUPS, "請選擇年齡區間");
  fillSelectOptions(weightSelect, WEIGHT_CLASSES, "請選擇體重級別");

  const refresh = () => {
    const category = form.querySelector('input[name="category"]:checked')?.value;
    const isChild = category === "child";
    if (childFields) childFields.hidden = !isChild;
    if (!isChild) {
      if (ageSelect) ageSelect.value = "";
      if (weightSelect) weightSelect.value = "";
      const ageError = form.querySelector("#age-error");
      const weightError = form.querySelector("#weight-error");
      if (ageError) ageError.hidden = true;
      if (weightError) weightError.hidden = true;
    }
  };

  form.addEventListener("change", (e) => {
    if (e.target.name === "category") refresh();
  });
  refresh();
}

function readFormData(form) {
  const fd = new FormData(form);
  const category = String(fd.get("category") || "");
  return {
    name: String(fd.get("name") || "").trim(),
    phone: String(fd.get("phone") || "").trim(),
    email: String(fd.get("email") || "").trim(),
    category,
    ageGroup: category === "child" ? String(fd.get("ageGroup") || "").trim() : "",
    weightClass: category === "child" ? String(fd.get("weightClass") || "").trim() : "",
    payment: String(fd.get("payment") || ""),
    last5: String(fd.get("last5") || "").trim(),
  };
}

function validateRegistration(form, data) {
  const last5Error = form.querySelector("#last5-error");
  const emailError = form.querySelector("#email-error");
  const phoneError = form.querySelector("#phone-error");
  const ageError = form.querySelector("#age-error");
  const weightError = form.querySelector("#weight-error");
  let ok = true;

  if (last5Error) last5Error.hidden = true;
  if (emailError) emailError.hidden = true;
  if (phoneError) phoneError.hidden = true;
  if (ageError) ageError.hidden = true;
  if (weightError) weightError.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    ok = false;
  }

  if (data.phone && !/^09\d{8}$/.test(data.phone)) {
    if (phoneError) phoneError.hidden = false;
    ok = false;
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    if (emailError) emailError.hidden = false;
    ok = false;
  }

  if (data.category === "child") {
    if (!AGE_GROUPS.some((item) => item.value === data.ageGroup)) {
      if (ageError) ageError.hidden = false;
      ok = false;
    }
    if (!WEIGHT_CLASSES.some((item) => item.value === data.weightClass)) {
      if (weightError) weightError.hidden = false;
      ok = false;
    }
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
  const setValue = (selector, value) => {
    const el = form.querySelector(selector);
    if (el) el.value = value || "";
  };

  setValue('input[name="name"]', record.name);
  setValue('input[name="phone"]', record.phone);
  setValue('input[name="email"]', record.email);
  setValue('input[name="last5"]', record.last5);

  const cat = form.querySelector(`input[name="category"][value="${record.category}"]`);
  if (cat) cat.checked = true;

  const pay = form.querySelector(`input[name="payment"][value="${record.payment}"]`);
  if (pay) pay.checked = true;

  form.dispatchEvent(new Event("change", { bubbles: true }));

  setValue('select[name="ageGroup"]', record.ageGroup);
  setValue('select[name="weightClass"]', record.weightClass);
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
  AGE_GROUPS,
  WEIGHT_CLASSES,
  calcFee,
  formatFee,
  categoryLabel,
  ageGroupLabel,
  weightClassLabel,
  createRegistration,
  findRegistration,
  updateRegistration,
  listRegistrations,
  bindFeeSummary,
  bindPaymentToggle,
  bindCategoryFields,
  readFormData,
  validateRegistration,
  fillForm,
  setBusy,
  getApiUrl,
};
