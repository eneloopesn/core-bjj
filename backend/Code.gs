/**
 * CORE 巴西柔術報名 API
 * 建議：從 Google 試算表 → 擴充功能 → Apps Script 貼上此檔後部署為「網頁應用程式」
 * 執行身分：我本人 / 存取權：任何人
 * 重要：修改程式後請「部署 → 管理部署作業 → 編輯 → 新版本 → 部署」
 */

var SHEET_NAME = "registrations";
var FEE_TABLE = {
  adult: { one: 800, two: 1400 },
  child: { one: 500, two: 900 },
};
var DATE_LABELS = {
  "2026-11-13": "11/13（五）",
  "2026-11-14": "11/14（六）",
};

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
    if (action === "ping") return json_({ ok: true, message: "CORE BJJ API ready", version: "name-lookup-v2" });
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
    ss = SpreadsheetApp.create("CORE-BJJ-Registrations");
  }

  props.setProperty("SPREADSHEET_ID", ss.getId());
  return ss;
}

function getSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "id",
      "name",
      "phone",
      "email",
      "dates",
      "category",
      "payment",
      "last5",
      "fee",
      "createdAt",
      "updatedAt",
    ]);
    sheet.getRange("A:K").setNumberFormat("@");
  }
  return sheet;
}

function calcFee_(category, dates) {
  var count = dates && dates.length ? dates.length : 0;
  if (!count || !FEE_TABLE[category]) return 0;
  var tier = FEE_TABLE[category];
  return count >= 2 ? tier.two : tier.one;
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

function parseDates_(value) {
  if (Object.prototype.toString.call(value) === "[object Array]") {
    return value
      .map(function (item) {
        return normalizeDateToken_(item);
      })
      .filter(Boolean);
  }
  if (Object.prototype.toString.call(value) === "[object Date]") {
    var one = normalizeDateToken_(value);
    return one ? [one] : [];
  }
  if (!value) return [];
  return String(value)
    .split(",")
    .map(function (s) {
      return normalizeDateToken_(s);
    })
    .filter(Boolean);
}

function normalizeDateToken_(value) {
  if (value == null || value === "") return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "Asia/Taipei", "yyyy-MM-dd");
  }
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone() || "Asia/Taipei", "yyyy-MM-dd");
  }
  return text;
}

function rowToRecord_(row) {
  return {
    id: normalizeName_(row[0]) || normalizeName_(row[1]),
    name: normalizeName_(row[1]) || normalizeName_(row[0]),
    phone: normalizePhone_(row[2]),
    email: row[3] || "",
    dates: parseDates_(row[4]),
    category: row[5],
    payment: row[6],
    last5: row[7] ? String(row[7]).replace(/\.0$/, "") : "",
    fee: Number(row[8]) || 0,
    createdAt: row[9],
    updatedAt: row[10],
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
    var idCell = values[i][0];
    var nameCell = values[i][1];
    if (namesMatch_(nameCell, target) || namesMatch_(idCell, target)) {
      return { index: i + 1, record: rowToRecord_(values[i]) };
    }
  }
  return null;
}

function writeRecordRow_(sheet, rowIndex, record) {
  sheet.getRange(rowIndex, 1, 1, 11).setNumberFormat("@");
  sheet.getRange(rowIndex, 1, 1, 11).setValues([
    [
      String(record.id),
      String(record.name),
      String(record.phone),
      String(record.email || ""),
      record.dates.join(","),
      String(record.category),
      String(record.payment),
      String(record.last5 || ""),
      String(record.fee),
      String(record.createdAt),
      String(record.updatedAt),
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
    dates: data.dates,
    category: data.category,
    payment: data.payment,
    last5: data.last5,
    fee: calcFee_(data.category, data.dates),
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
    dates: data.dates,
    category: data.category,
    payment: data.payment,
    last5: data.last5,
    fee: calcFee_(data.category, data.dates),
    createdAt: found.record.createdAt,
    updatedAt: now,
  };

  writeRecordRow_(sheet, found.index, record);
  sendNoticeEmail_(record, "update");
  return json_({ ok: true, record: record });
}

function normalizeData_(payload) {
  var dates = parseDates_(payload.dates);
  var payment = String(payload.payment || "").trim();
  return {
    name: normalizeName_(payload.name),
    phone: normalizePhone_(payload.phone),
    email: String(payload.email || "").trim(),
    dates: dates,
    category: String(payload.category || "").trim(),
    payment: payment,
    last5: payment === "transfer" ? String(payload.last5 || "").trim() : "",
  };
}

function validateData_(data) {
  if (!data.name) return { ok: false, error: "請填寫姓名" };
  if (!/^09\d{8}$/.test(data.phone)) return { ok: false, error: "手機格式不正確" };
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { ok: false, error: "電子信箱格式不正確" };
  }
  if (!data.dates.length) return { ok: false, error: "請至少選擇一天場次" };
  if (data.category !== "adult" && data.category !== "child") {
    return { ok: false, error: "身分不正確" };
  }
  if (data.payment !== "transfer" && data.payment !== "counter") {
    return { ok: false, error: "繳費方式不正確" };
  }
  if (data.payment === "transfer" && !/^\d{5}$/.test(data.last5)) {
    return { ok: false, error: "請填寫匯款末五碼" };
  }
  return { ok: true };
}

function categoryLabel_(category) {
  return category === "child" ? "兒童（12 歲以下）" : "成人（12 歲以上）";
}

function paymentLabel_(payment) {
  return payment === "transfer" ? "匯款" : "櫃檯付款";
}

function datesLabel_(dates) {
  return dates
    .map(function (d) {
      return DATE_LABELS[d] || d;
    })
    .join("、");
}

function sendNoticeEmail_(record, type) {
  if (!record.email) return;
  var isCreate = type === "create";
  var subject = isCreate
    ? "【CORE BJJ】報名成功通知 " + record.name
    : "【CORE BJJ】報名資料已更新 " + record.name;
  var body = [
    isCreate ? "您好，已收到您的報名。" : "您好，您的報名資料已更新。",
    "",
    "姓名：" + record.name,
    "手機：" + record.phone,
    "場次：" + datesLabel_(record.dates),
    "身分：" + categoryLabel_(record.category),
    "繳費方式：" +
      paymentLabel_(record.payment) +
      (record.last5 ? "（末五碼 " + record.last5 + "）" : ""),
    "費用：NT$ " + record.fee,
    "",
    "如需修改資料，請至網站「修改資料」頁面，使用姓名查詢。",
    "",
    "CORE 巴西柔術體驗營",
  ].join("\n");

  MailApp.sendEmail({
    to: record.email,
    subject: subject,
    body: body,
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
