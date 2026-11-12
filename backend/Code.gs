/**
 * Jabari 巴西柔術館內賽報名 API
 * 部署：試算表 → Apps Script → 貼上此檔 → 網頁應用程式（任何人）
 * 更新後請：部署 → 管理部署作業 → 編輯 → 新版本 → 部署
 */

var SHEET_NAME = "registrations";
var CATEGORIES = {
  child: { label: "兒童組", fee: 500, ages: ["4-5", "6-7", "8-9", "10-11"] },
  junior: { label: "少年組", fee: 500, ages: ["12-13", "14-15"] },
  youth: { label: "青少年組", fee: 500, ages: ["16-17"] },
  young: { label: "青年組", fee: 500, ages: [] },
};
var KNOWN_CATEGORIES = {
  adult: true,
  child: true,
  junior: true,
  youth: true,
  young: true,
};
var WEIGHT_CLASSES = [
  "20-25",
  "25-30",
  "30-35",
  "35-40",
  "40-45",
  "45-50",
  "50-55",
  "55-60",
  "60-65",
  "65-70",
];
var WEIGHT_TABLES = {
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
var HEADERS = [
  "id",
  "name",
  "phone",
  "email",
  "category",
  "ageGroup",
  "weightClass",
  "payment",
  "last5",
  "fee",
  "createdAt",
  "updatedAt",
  "gender",
];

function doGet(e) {
  return handleRequest(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  var payload = {};
  try {
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return json_({ ok: false, error: "無效的 JSON" });
  }
  return handleRequest(payload);
}

function handleRequest(payload) {
  try {
    var action = String(payload.action || "").trim();
    if (action === "create") return createRegistration_(payload);
    if (action === "find") return findRegistration_(payload);
    if (action === "update") return updateRegistration_(payload);
    if (action === "list") return listRegistrations_();
    if (action === "ping") {
      return json_({ ok: true, message: "Jabari BJJ API ready", version: "inhouse-v1" });
    }
    return json_({ ok: false, error: "未知的 action" });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty("SPREADSHEET_ID");
  var ss = null;

  if (savedId) {
    try {
      ss = SpreadsheetApp.openById(savedId);
    } catch (err) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    ss = SpreadsheetApp.create("Jabari-BJJ-Registrations");
  }

  props.setProperty("SPREADSHEET_ID", ss.getId());
  return ss;
}

function getSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setNumberFormat("@");
    return sheet;
  }

  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  var width = Math.max(sheet.getLastColumn(), HEADERS.length);
  var headerRange = sheet.getRange(1, 1, 1, width);
  var current = headerRange.getValues()[0];
  var first = String(current[0] || "").trim().toLowerCase();

  // 舊版欄位（含 dates）→ 重建表頭並保留可對應資料較複雜，這裡確保至少有新表頭寬度
  if (first !== "id") {
    sheet.clear();
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setNumberFormat("@");
    return;
  }

  if (sheet.getLastColumn() < HEADERS.length) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    var needsUpdate = false;
    for (var i = 0; i < HEADERS.length; i++) {
      if (String(current[i] || "") !== HEADERS[i]) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate && String(current[4] || "") === "dates") {
      // 舊表頭仍是 dates 結構：改寫表頭為新結構（既有列需人工或重新報名）
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
  }
}

function calcFee_(category) {
  if (CATEGORIES[category]) return CATEGORIES[category].fee;
  return 500;
}

function normalizeName_(value) {
  return String(value || "")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone_(value) {
  var phone = String(value == null ? "" : value)
    .trim()
    .replace(/\.0$/, "");
  if (/^9\d{8}$/.test(phone)) phone = "0" + phone;
  return phone;
}

function rowToRecord_(row) {
  // 新結構：id name phone email category ageGroup weightClass payment last5 fee createdAt updatedAt
  // 舊結構：id name phone email dates category payment last5 fee createdAt updatedAt
  var category = "";
  var ageGroup = "";
  var weightClass = "";
  var payment = "";
  var last5 = "";
  var fee = 0;
  var createdAt = "";
  var updatedAt = "";

  if (KNOWN_CATEGORIES[row[4]]) {
    category = row[4];
    ageGroup = row[5] || "";
    weightClass = row[6] || "";
    payment = row[7];
    last5 = row[8];
    fee = Number(row[9]) || 0;
    createdAt = row[10];
    updatedAt = row[11];
  } else {
    category = row[5];
    payment = row[6];
    last5 = row[7];
    fee = Number(row[8]) || 0;
    createdAt = row[9];
    updatedAt = row[10];
    ageGroup = row[11] || "";
    weightClass = row[12] || "";
  }

  return {
    id: normalizeName_(row[0]) || normalizeName_(row[1]),
    name: normalizeName_(row[1]) || normalizeName_(row[0]),
    phone: normalizePhone_(row[2]),
    email: row[3] || "",
    category: category,
    ageGroup: String(ageGroup || ""),
    weightClass: String(weightClass || ""),
    gender: KNOWN_CATEGORIES[row[4]] ? String(row[12] || "") : "",
    payment: payment,
    last5: last5 ? String(last5).replace(/\.0$/, "") : "",
    fee: fee,
    createdAt: createdAt,
    updatedAt: updatedAt,
  };
}

function namesMatch_(a, b) {
  return normalizeName_(a) === normalizeName_(b) && normalizeName_(a) !== "";
}

function findRowIndex_(sheet, name) {
  var values = sheet.getDataRange().getValues();
  var target = normalizeName_(name);
  if (!target) return null;

  for (var i = 1; i < values.length; i++) {
    if (namesMatch_(values[i][1], target) || namesMatch_(values[i][0], target)) {
      return { index: i + 1, record: rowToRecord_(values[i]) };
    }
  }
  return null;
}

function writeRecordRow_(sheet, rowIndex, record) {
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setNumberFormat("@");
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([
    [
      String(record.id),
      String(record.name),
      String(record.phone),
      String(record.email || ""),
      String(record.category),
      String(record.ageGroup || ""),
      String(record.weightClass || ""),
      String(record.payment),
      String(record.last5 || ""),
      String(record.fee),
      String(record.createdAt),
      String(record.updatedAt),
      String(record.gender || ""),
    ],
  ]);
}

function createRegistration_(payload) {
  var data = normalizeData_(payload);
  var validation = validateData_(data);
  if (!validation.ok) return json_(validation);

  var sheet = getSheet_();
  if (findRowIndex_(sheet, data.name)) {
    return json_({ ok: false, error: "此姓名已報名過，請改至「修改資料」頁面更新" });
  }

  var now = new Date().toISOString();
  var record = {
    id: data.name,
    name: data.name,
    phone: data.phone,
    email: data.email,
    category: data.category,
    ageGroup: data.ageGroup,
    weightClass: data.weightClass,
    gender: data.gender,
    payment: data.payment,
    last5: data.last5,
    fee: calcFee_(data.category),
    createdAt: now,
    updatedAt: now,
  };

  writeRecordRow_(sheet, sheet.getLastRow() + 1, record);
  sendNoticeEmail_(record, "create");
  return json_({ ok: true, record: record });
}

function findRegistration_(payload) {
  var sheet = getSheet_();
  var name = payload.name || payload.id || payload.lookupName;
  var found = findRowIndex_(sheet, name);
  if (!found) return json_({ ok: false, error: "找不到報名資料" });
  return json_({ ok: true, record: found.record });
}

function updateRegistration_(payload) {
  var data = normalizeData_(payload);
  var validation = validateData_(data);
  if (!validation.ok) return json_(validation);

  var sheet = getSheet_();
  var lookupName = payload.lookupName || payload.name || payload.id;
  var found = findRowIndex_(sheet, lookupName);
  if (!found) return json_({ ok: false, error: "找不到報名資料" });

  if (!namesMatch_(data.name, found.record.name) && findRowIndex_(sheet, data.name)) {
    return json_({ ok: false, error: "此姓名已有其他報名資料" });
  }

  var now = new Date().toISOString();
  var record = {
    id: data.name,
    name: data.name,
    phone: data.phone,
    email: data.email,
    category: data.category,
    ageGroup: data.ageGroup,
    weightClass: data.weightClass,
    gender: data.gender,
    payment: data.payment,
    last5: data.last5,
    fee: calcFee_(data.category),
    createdAt: found.record.createdAt,
    updatedAt: now,
  };

  writeRecordRow_(sheet, found.index, record);
  sendNoticeEmail_(record, "update");
  return json_({ ok: true, record: record });
}

function listRegistrations_() {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var records = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][1] && !values[i][0]) continue;
    var record = rowToRecord_(values[i]);
    records.push({
      name: record.name,
      category: record.category,
      ageGroup: record.ageGroup,
      weightClass: record.weightClass,
      gender: record.gender,
    });
  }
  return json_({ ok: true, records: records });
}

function normalizeData_(payload) {
  var category = String(payload.category || "").trim();
  var payment = String(payload.payment || "").trim();
  return {
    name: normalizeName_(payload.name),
    phone: normalizePhone_(payload.phone),
    email: String(payload.email || "").trim(),
    category: category,
    gender: String(payload.gender || "").trim(),
    ageGroup: "",
    weightClass: String(payload.weightClass || "").trim(),
    payment: payment,
    last5: payment === "transfer" ? String(payload.last5 || "").trim() : "",
  };
}

function validateData_(data) {
  if (!data.name) return { ok: false, error: "請填寫姓名" };
  if (data.phone && !/^09\d{8}$/.test(data.phone)) {
    return { ok: false, error: "手機格式不正確" };
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { ok: false, error: "電子信箱格式不正確" };
  }
  var spec = CATEGORIES[data.category];
  if (!spec) {
    return { ok: false, error: "組別不正確" };
  }
  if (data.gender !== "male" && data.gender !== "female") {
    return { ok: false, error: "請選擇男子組或女子組" };
  }
  var allowedWeights = weightOptionsFor_(data.category, data.gender);
  if (allowedWeights.indexOf(data.weightClass) < 0) {
    return { ok: false, error: "請選擇體重級別" };
  }
  if (data.payment !== "transfer" && data.payment !== "counter") {
    return { ok: false, error: "繳費方式不正確" };
  }
  if (data.payment === "transfer" && !/^\d{5}$/.test(data.last5)) {
    return { ok: false, error: "請填寫匯款末五碼" };
  }
  return { ok: true };
}

function categoryNeedsBracket_(category) {
  return Boolean(CATEGORIES[category] && CATEGORIES[category].ages.length);
}

function categoryLabel_(category) {
  if (CATEGORIES[category]) return CATEGORIES[category].label;
  if (category === "adult") return "成人組";
  return category || "—";
}

function ageLabel_(value) {
  var map = {
    "4-5": "4～5 歲",
    "6-7": "6～7 歲",
    "8-9": "8～9 歲",
    "10-11": "10～11 歲",
    "12-13": "12～13 歲",
    "14-15": "14～15 歲",
    "16-17": "16～17 歲",
  };
  return map[value] || value || "—";
}

function weightBand_(category) {
  if (category === "child" || category === "junior") return "kids";
  if (category === "youth") return "youth";
  if (category === "young") return "young";
  return "";
}

function weightOptionsFor_(category, gender) {
  var band = weightBand_(category);
  if (!WEIGHT_TABLES[gender] || !WEIGHT_TABLES[gender][band]) return [];
  return WEIGHT_TABLES[gender][band];
}

function genderLabel_(gender) {
  if (gender === "male") return "男子組";
  if (gender === "female") return "女子組";
  return "";
}

function weightTokenLabel_(value) {
  var text = String(value || "");
  var open = text.match(/^o(\d+)$/);
  if (open) return open[1] + "kg~";
  var under = text.match(/^u(\d+)$/);
  if (under) return "~" + under[1] + "kg";
  if (!text) return "—";
  return text.replace("-", "～") + " kg";
}

function rangeStart_(kg) {
  return ((Math.round(Number(kg) * 100) + 1) / 100).toFixed(2);
}

function weightRangeLabel_(codes, index) {
  var value = String(codes[index] || "");
  var open = value.match(/^o(\d+)$/);
  var under = value.match(/^u(\d+)$/);
  var previous = index > 0 ? String(codes[index - 1]).match(/(\d+)$/) : null;
  var previousKg = previous ? Number(previous[1]) : null;
  if (index === 0 && under) return "~" + under[1] + "kg";
  if (under && previousKg !== null) return rangeStart_(previousKg) + "~" + under[1] + "kg";
  if (open && previousKg !== null) return rangeStart_(previousKg) + "kg以上";
  return weightTokenLabel_(value);
}

function weightLabel_(value, category, gender) {
  var list = weightOptionsFor_(category, gender);
  for (var i = 0; i < list.length; i++) {
    if (list[i] === value) return "量級-" + (i + 1) + " " + weightRangeLabel_(list, i);
  }
  return weightTokenLabel_(value);
}

function paymentLabel_(payment) {
  return payment === "transfer" ? "匯款" : "櫃檯付款";
}

function sendNoticeEmail_(record, type) {
  if (!record.email) return;
  var isCreate = type === "create";
  var subject = isCreate
    ? "【Jabari 館內賽】報名成功通知 " + record.name
    : "【Jabari 館內賽】報名資料已更新 " + record.name;
  var lines = [
    isCreate ? "您好，已收到您的館內賽報名。" : "您好，您的館內賽報名資料已更新。",
    "",
    "姓名：" + record.name,
  ];
  if (record.phone) lines.push("手機：" + record.phone);
  lines.push("組別：" + categoryLabel_(record.category));
  if (record.gender) lines.push("性別組別：" + genderLabel_(record.gender));
  if (record.weightClass) {
    lines.push("體重級別：" + weightLabel_(record.weightClass, record.category, record.gender));
  }
  lines = lines.concat([
    "繳費方式：" +
      paymentLabel_(record.payment) +
      (record.last5 ? "（末五碼 " + record.last5 + "）" : ""),
    "報名費：NT$ " + record.fee + "",
    "",
    "如需修改資料，請至網站「修改資料」頁面，使用姓名查詢。",
    "",
    "Jabari 巴西柔術館內賽",
  ]);

  MailApp.sendEmail({
    to: record.email,
    subject: subject,
    body: lines.join("\n"),
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
