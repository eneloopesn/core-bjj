const CATEGORIES = [
  { value: "child", label: "兒童組", fee: 500, ageGroups: ["4-5", "6-7", "8-9", "10-11"] },
  { value: "junior", label: "少年組", fee: 500, ageGroups: ["12-13", "14-15"] },
  { value: "youth", label: "青少年組", fee: 500, ageGroups: ["16-17"] },
  { value: "young", label: "青年組", fee: 500, ageGroups: [] },
];

const FEE_TABLE = {
  adult: 500,
  child: 500,
  junior: 500,
  youth: 500,
  young: 500,
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

const GENDERS = [
  { value: "male", label: "男子組" },
  { value: "female", label: "女子組" },
];

const WEIGHT_TABLES = {
  male: {
    kids: ["u25", "u28", "u32", "u36", "u40", "u44", "u48", "u52", "o52"],
    youth: ["u32", "u36", "u40", "u44", "u48", "u52", "u56", "u62", "u69", "u77", "o77"],
    young: ["u48", "u52", "u56", "u62", "u69", "u77", "u85", "o85"],
  },
  female: {
    kids: ["u22", "u25", "u28", "u32", "u36", "u40", "u44", "o44"],
    youth: ["u25", "u28", "u32", "u36", "u40", "u44", "u48", "u52", "u57", "u63", "o63"],
    young: ["u40", "u44", "u48", "u52", "u57", "u63", "u70", "o70"],
  },
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

function calcFee(category) {
  if (Object.prototype.hasOwnProperty.call(FEE_TABLE, category)) return FEE_TABLE[category];
  return 500;
}

function formatFee(amount) {
  return `NT$ ${Number(amount || 0).toLocaleString("zh-TW")}`;
}

function getCategory(category) {
  return CATEGORIES.find((item) => item.value === category) || null;
}

function categoryNeedsBracket(category) {
  const item = getCategory(category);
  return Boolean(item && item.ageGroups.length);
}

function ageOptionsFor(category) {
  const item = getCategory(category);
  if (!item) return [];
  return AGE_GROUPS.filter((age) => item.ageGroups.includes(age.value));
}

function categoryLabel(category) {
  if (category === "adult") return "成人組";
  return getCategory(category)?.label || category || "—";
}

function ageGroupLabel(value) {
  return AGE_GROUPS.find((item) => item.value === value)?.label || value || "—";
}

function weightBand(category) {
  if (category === "child" || category === "junior") return "kids";
  if (category === "youth") return "youth";
  if (category === "young") return "young";
  return "";
}

function weightTokenLabel(value) {
  const text = String(value || "");
  const open = text.match(/^o(\d+)$/);
  if (open) return `${open[1]}kg~`;
  const under = text.match(/^u(\d+)$/);
  if (under) return `~${under[1]}kg`;
  return WEIGHT_CLASSES.find((item) => item.value === value)?.label || text || "—";
}

function rangeStart(kg) {
  return ((Math.round(Number(kg) * 100) + 1) / 100).toFixed(2);
}

function weightRangeLabel(codes, index) {
  const value = String(codes[index] || "");
  const open = value.match(/^o(\d+)$/);
  const under = value.match(/^u(\d+)$/);
  const previous = index > 0 ? String(codes[index - 1]).match(/(\d+)$/) : null;
  const previousKg = previous ? Number(previous[1]) : null;
  if (index === 0 && under) return `~${under[1]}kg`;
  if (under && previousKg !== null) return `${rangeStart(previousKg)}~${under[1]}kg`;
  if (open && previousKg !== null) return `${rangeStart(previousKg)}kg以上`;
  return weightTokenLabel(value);
}

function weightOptionsFor(category, gender) {
  const codes = WEIGHT_TABLES[gender]?.[weightBand(category)] || [];
  return codes.map((value, index) => {
    const level = `量級-${index + 1}`;
    const kg = weightRangeLabel(codes, index);
    return { value, level, kg, label: `${level} ${kg}` };
  });
}

function genderLabel(gender) {
  return GENDERS.find((item) => item.value === gender)?.label || "";
}

function weightSortIndex(value) {
  const matched = String(value || "").match(/^(u|o)(\d+)$/);
  if (!matched) {
    const legacy = WEIGHT_CLASSES.findIndex((item) => item.value === value);
    return legacy < 0 ? 9999 : legacy;
  }
  return Number(matched[2]) * 2 + (matched[1] === "o" ? 1 : 0);
}

function weightClassLabel(value, category, gender) {
  const match = weightOptionsFor(category, gender).find((item) => item.value === value);
  if (match) return match.label;
  return weightTokenLabel(value);
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

function selectedCategory(form) {
  return (
    form.querySelector('input[type="hidden"][name="category"]')?.value ||
    form.querySelector('input[name="category"]:checked')?.value ||
    ""
  );
}

function isValidDate(year, month, day) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function toIsoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function categoryFromBirth(year, month, day) {
  if (!year || !month || !day || !isValidDate(year, month, day)) return "";
  const iso = toIsoDate(year, month, day);
  if (iso > "2018-12-13") return "child";
  if (iso > "2015-12-13") return "junior";
  if (iso > "2013-12-13") return "youth";
  if (iso > "2010-12-13") return "young";
  return "";
}

function daysInMonth(year, month) {
  if (!year || !month) return 31;
  return new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
}

function fillNumberOptions(select, start, end, placeholder, pad) {
  if (!select || select.dataset.ready === "1") return;
  const current = select.value;
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.appendChild(first);
  const step = start <= end ? 1 : -1;
  for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = pad ? String(value).padStart(2, "0") : String(value);
    select.appendChild(option);
  }
  if (current) select.value = current;
  select.dataset.ready = "1";
}

function applyCategory(form, category) {
  const hidden = form.querySelector('input[type="hidden"][name="category"]');
  if (hidden) hidden.value = category || "";
  form.querySelectorAll("#category-options input").forEach((input) => {
    input.checked = input.value === category;
  });
  const result = form.querySelector("#category-result");
  if (result) {
    result.textContent = category ? `年齡分組：${categoryLabel(category)}` : "請先填寫出生年月日";
  }
}

function bindBirthCategory(form) {
  const yearSelect = form.querySelector('select[name="birthYear"]');
  const monthSelect = form.querySelector('select[name="birthMonth"]');
  const daySelect = form.querySelector('select[name="birthDay"]');
  if (!yearSelect || !monthSelect || !daySelect) return;

  fillNumberOptions(yearSelect, 2026, 2008, "年");
  fillNumberOptions(monthSelect, 1, 12, "月", true);

  const refreshDays = () => {
    const year = yearSelect.value;
    const month = monthSelect.value;
    const current = daySelect.value;
    const max = daysInMonth(year, month);
    daySelect.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "日";
    daySelect.appendChild(first);
    for (let day = 1; day <= max; day += 1) {
      const option = document.createElement("option");
      option.value = String(day);
      option.textContent = String(day).padStart(2, "0");
      daySelect.appendChild(option);
    }
    if (current && Number(current) <= max) daySelect.value = current;
  };

  const refreshCategory = () => {
    const year = yearSelect.value;
    const month = monthSelect.value;
    const day = daySelect.value;
    const result = form.querySelector("#category-result");
    if (!year || !month || !day) {
      applyCategory(form, "");
      return;
    }
    if (!isValidDate(year, month, day)) {
      applyCategory(form, "");
      if (result) result.textContent = "出生年月日不正確";
      return;
    }
    const category = categoryFromBirth(year, month, day);
    applyCategory(form, category);
    if (!category && result) result.textContent = "此出生年月日不在本次競賽年齡分組內";
  };

  const refresh = () => {
    refreshDays();
    refreshCategory();
  };

  form.addEventListener("change", (event) => {
    if (["birthYear", "birthMonth", "birthDay"].includes(event.target.name)) refresh();
  });
  refresh();
}

function bindFeeSummary(form, summaryEl, options) {
  const perMatch = !options || options.perMatch !== false;
  const refresh = () => {
    const category = selectedCategory(form) || "child";
    const fee = calcFee(category);
    const note = perMatch ? `<span class="summary-note">／單場</span>` : "";
    summaryEl.innerHTML = `報名費：<strong>${formatFee(fee)}</strong>${note}`;
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

  form.addEventListener("change", refresh);
  refresh();
}

function bindCategoryFields(form) {
  const weightFields = form.querySelector("#weight-fields");
  const weightSelect = form.querySelector('select[name="weightClass"]');

  const refresh = () => {
    const category = selectedCategory(form);
    const gender = form.querySelector('input[name="gender"]:checked')?.value;
    const placeholder = !category
      ? "請先填寫出生年月日"
      : gender
        ? "請選擇體重級別"
        : "請先選擇性別";
    fillSelectOptions(weightSelect, weightOptionsFor(category, gender), placeholder);
    if (weightFields) weightFields.hidden = !category;
  };

  form.addEventListener("change", refresh);
  refresh();
}

function readFormData(form) {
  const fd = new FormData(form);
  const birthYear = String(fd.get("birthYear") || "").trim();
  const birthMonth = String(fd.get("birthMonth") || "").trim();
  const birthDay = String(fd.get("birthDay") || "").trim();
  const birthDate =
    birthYear && birthMonth && birthDay && isValidDate(birthYear, birthMonth, birthDay)
      ? toIsoDate(birthYear, birthMonth, birthDay)
      : "";
  const category = categoryFromBirth(birthYear, birthMonth, birthDay) || String(fd.get("category") || "");
  return {
    name: String(fd.get("name") || "").trim(),
    phone: String(fd.get("phone") || "").trim(),
    email: String(fd.get("email") || "").trim(),
    birthDate,
    category,
    gender: String(fd.get("gender") || "").trim(),
    ageGroup: "",
    weightClass: String(fd.get("weightClass") || "").trim(),
    payment: String(fd.get("payment") || ""),
    last5: String(fd.get("last5") || "").trim(),
  };
}

function validateRegistration(form, data) {
  const last5Error = form.querySelector("#last5-error");
  const emailError = form.querySelector("#email-error");
  const phoneError = form.querySelector("#phone-error");
  const weightError = form.querySelector("#weight-error");
  const genderError = form.querySelector("#gender-error");
  const birthError = form.querySelector("#birth-error");
  let ok = true;

  if (last5Error) last5Error.hidden = true;
  if (emailError) emailError.hidden = true;
  if (phoneError) phoneError.hidden = true;
  if (weightError) weightError.hidden = true;
  if (genderError) genderError.hidden = true;
  if (birthError) birthError.hidden = true;

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

  const birthYear = form.querySelector('select[name="birthYear"]')?.value || "";
  const birthMonth = form.querySelector('select[name="birthMonth"]')?.value || "";
  const birthDay = form.querySelector('select[name="birthDay"]')?.value || "";
  if (form.querySelector('select[name="birthYear"]')) {
    if (!birthYear || !birthMonth || !birthDay) {
      if (birthError) {
        birthError.textContent = "請填寫出生年月日";
        birthError.hidden = false;
      }
      ok = false;
    } else if (!isValidDate(birthYear, birthMonth, birthDay)) {
      if (birthError) {
        birthError.textContent = "出生年月日不正確";
        birthError.hidden = false;
      }
      ok = false;
    } else if (!categoryFromBirth(birthYear, birthMonth, birthDay)) {
      if (birthError) {
        birthError.textContent = "此出生年月日不在本次競賽年齡分組內";
        birthError.hidden = false;
      }
      ok = false;
    }
  }

  if (!getCategory(data.category)) {
    ok = false;
  }

  if (!GENDERS.some((item) => item.value === data.gender)) {
    if (genderError) genderError.hidden = false;
    ok = false;
  }

  if (getCategory(data.category)) {
    const allowed = weightOptionsFor(data.category, data.gender);
    if (!allowed.some((item) => item.value === data.weightClass)) {
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

  if (record.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(record.birthDate)) {
    const [year, month, day] = record.birthDate.split("-");
    setValue('select[name="birthYear"]', String(Number(year)));
    setValue('select[name="birthMonth"]', String(Number(month)));
    form.querySelector('select[name="birthMonth"]')?.dispatchEvent(new Event("change", { bubbles: true }));
    setValue('select[name="birthDay"]', String(Number(day)));
    form.querySelector('select[name="birthDay"]')?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const gender = form.querySelector(`input[name="gender"][value="${record.gender}"]`);
  if (gender) gender.checked = true;

  if (!record.birthDate) {
    const cat = form.querySelector(`input[name="category"][value="${record.category}"]`);
    if (cat) cat.checked = true;
    applyCategory(form, record.category);
  }

  const pay = form.querySelector(`input[name="payment"][value="${record.payment}"]`);
  if (pay) pay.checked = true;

  form.dispatchEvent(new Event("change", { bubbles: true }));

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
  CATEGORIES,
  FEE_TABLE,
  AGE_GROUPS,
  getCategory,
  categoryNeedsBracket,
  ageOptionsFor,
  WEIGHT_CLASSES,
  GENDERS,
  WEIGHT_TABLES,
  weightBand,
  weightOptionsFor,
  genderLabel,
  weightSortIndex,
  calcFee,
  formatFee,
  categoryLabel,
  ageGroupLabel,
  weightClassLabel,
  createRegistration,
  findRegistration,
  updateRegistration,
  listRegistrations,
  bindBirthCategory,
  bindFeeSummary,
  categoryFromBirth,
  applyCategory,
  bindPaymentToggle,
  bindCategoryFields,
  readFormData,
  validateRegistration,
  fillForm,
  setBusy,
  getApiUrl,
};
