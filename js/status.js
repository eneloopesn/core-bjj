(() => {
  const root = document.getElementById("status-root");
  const countEl = document.getElementById("status-count");
  const errorEl = document.getElementById("status-error");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function textOrDash(value) {
    const text = String(value || "").trim();
    return text ? escapeHtml(text) : "—";
  }

  function genderText(gender) {
    if (gender === "male") return "男";
    if (gender === "female") return "女";
    return "—";
  }

  function birthText(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}/${match[2]}/${match[3]}`;
    return text || "—";
  }

  function paymentText(record) {
    if (record.payment === "counter") return "櫃檯付款";
    if (record.payment === "transfer") {
      const last5 = String(record.last5 || "").trim();
      return last5 ? `匯款（末五碼 ${last5}）` : "匯款";
    }
    return "—";
  }

  function weightText(record) {
    if (!record.weightClass) return "—";
    return BjjStore.weightClassLabel(record.weightClass, record.category, record.gender) || "—";
  }

  function registrationTime(record) {
    const time = Date.parse(record.createdAt || "");
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  }

  function render(records) {
    const sorted = [...records].sort((a, b) => registrationTime(a) - registrationTime(b));
    if (countEl) countEl.textContent = `共 ${sorted.length} 筆報名`;
    if (!sorted.length) {
      root.innerHTML = `<p class="empty-note">目前尚無報名資料</p>`;
      return;
    }

    const rows = sorted
      .map(
        (record) => `<tr>
          <td>${textOrDash(record.name)}</td>
          <td>${textOrDash(record.phone)}</td>
          <td>${textOrDash(record.email)}</td>
          <td>${escapeHtml(BjjStore.categoryLabel(record.category))}</td>
          <td>${escapeHtml(weightText(record))}</td>
          <td>${escapeHtml(genderText(record.gender))}</td>
          <td>${escapeHtml(paymentText(record))}</td>
          <td>${escapeHtml(birthText(record.birthDate))}</td>
        </tr>`
      )
      .join("");

    root.innerHTML = `<table class="status-table">
      <thead>
        <tr>
          <th>姓名</th>
          <th>手機號碼</th>
          <th>電子信箱</th>
          <th>組別</th>
          <th>體重量級</th>
          <th>性別</th>
          <th>付款方式</th>
          <th>出生年月日</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  async function load() {
    if (errorEl) errorEl.hidden = true;
    root.innerHTML = `<p class="empty-note">載入中…</p>`;
    try {
      const records = await BjjStore.listRegistrationStatus();
      render(records);
    } catch (err) {
      root.innerHTML = "";
      if (countEl) countEl.textContent = "共 0 筆報名";
      if (errorEl) {
        errorEl.textContent = err.message || "載入失敗，請稍後再試";
        errorEl.hidden = false;
      }
    }
  }

  load();
})();
