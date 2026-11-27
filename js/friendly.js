(() => {
  const root = document.getElementById("friendly-root");
  const errorEl = document.getElementById("friendly-error");
  const statusEl = document.getElementById("save-status");
  const countEl = document.getElementById("friendly-count");
  const addBtn = document.getElementById("add-match");
  const STORAGE_KEY = "bjj-friendly-matches";

  let records = [];
  let matches = [];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeCategory(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "child" || raw === "兒童" || raw === "兒童組") return "child";
    if (raw === "junior" || raw === "少年" || raw === "少年組") return "junior";
    if (raw === "youth" || raw === "青少年" || raw === "青少年組") return "youth";
    if (raw === "young" || raw === "青年" || raw === "青年組") return "young";
    if (raw === "adult" || raw === "成人" || raw === "成人組") return "adult";
    return raw;
  }

  function categoryOrder(value) {
    const index = BjjStore.CATEGORIES.findIndex((item) => item.value === value);
    if (index >= 0) return index;
    if (value === "adult") return 99;
    return 100;
  }

  function athleteKey(record) {
    return String(record.id || record.name || "");
  }

  function newId() {
    return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function readLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
      if (!parsed || typeof parsed !== "object") return { matches: [], updatedAt: "" };
      return {
        matches: Array.isArray(parsed.matches) ? parsed.matches : [],
        updatedAt: parsed.updatedAt || "",
      };
    } catch {
      return { matches: [], updatedAt: "" };
    }
  }

  function writeLocal(updatedAt) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ matches, updatedAt: updatedAt || new Date().toISOString() })
    );
  }

  function pickState(remote, local) {
    const remoteTime = Date.parse(remote && remote.updatedAt) || 0;
    const localTime = Date.parse(local && local.updatedAt) || 0;
    if (remoteTime > 0 && remoteTime >= localTime) return remote;
    if (localTime > 0) return local;
    return { matches: [], updatedAt: "" };
  }

  function groupAthletes(list) {
    const map = new Map();
    list.forEach((record) => {
      const category = normalizeCategory(record.category);
      if (categoryOrder(category) === 100) return;
      const key = `${category}__${record.gender || ""}__${record.weightClass || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          category,
          gender: record.gender || "",
          weightClass: record.weightClass || "",
          athletes: [],
        });
      }
      map.get(key).athletes.push(record);
    });
    return [...map.values()];
  }

  function soloAthletes() {
    return groupAthletes(records)
      .filter((group) => group.athletes.length === 1)
      .map((group) => group.athletes[0])
      .sort((a, b) => {
        const categoryDiff =
          categoryOrder(normalizeCategory(a.category)) - categoryOrder(normalizeCategory(b.category));
        if (categoryDiff !== 0) return categoryDiff;
        const genderDiff = String(a.gender || "").localeCompare(String(b.gender || ""));
        if (genderDiff !== 0) return genderDiff;
        const weightDiff = BjjStore.weightSortIndex(a.weightClass) - BjjStore.weightSortIndex(b.weightClass);
        if (weightDiff !== 0) return weightDiff;
        return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
      });
  }

  function labelFor(athlete) {
    const category = normalizeCategory(athlete.category);
    const gender = BjjStore.genderLabel(athlete.gender) || "未填性別";
    const weight = athlete.weightClass
      ? BjjStore.weightClassLabel(athlete.weightClass, category, athlete.gender)
      : "未填體重";
    const name = athlete.name || "未填姓名";
    return `${name}（${BjjStore.categoryLabel(category)}／${gender}／${weight}）`;
  }

  function takenIds(exceptId) {
    const taken = new Set();
    matches.forEach((match) => {
      [match.left, match.right].forEach((id) => {
        if (id && id !== exceptId) taken.add(id);
      });
    });
    return taken;
  }

  function optionsHtml(current) {
    const solos = soloAthletes();
    const known = new Set(solos.map(athleteKey));
    const taken = takenIds(current);
    let html = `<option value="">請選擇選手</option>`;
    solos.forEach((athlete) => {
      const id = athleteKey(athlete);
      if (taken.has(id)) return;
      html += `<option value="${escapeHtml(id)}"${id === current ? " selected" : ""}>${escapeHtml(labelFor(athlete))}</option>`;
    });
    if (current && !known.has(current)) {
      const record = records.find((item) => athleteKey(item) === current);
      const text = record ? `${labelFor(record)}（已不是單人組別）` : "此選手已不在名單";
      html += `<option value="${escapeHtml(current)}" selected>${escapeHtml(text)}</option>`;
    }
    return html;
  }

  function renderMatch(match, index) {
    return `<article class="match-card friendly-match">
      <p class="match-label">第 ${index + 1} 場</p>
      <div class="friendly-row">
        <select data-match="${escapeHtml(match.id)}" data-side="left" aria-label="第 ${index + 1} 場選手一">${optionsHtml(match.left || "")}</select>
        <span class="match-vs">vs</span>
        <select data-match="${escapeHtml(match.id)}" data-side="right" aria-label="第 ${index + 1} 場選手二">${optionsHtml(match.right || "")}</select>
        <button type="button" class="btn btn-ghost" data-remove="${escapeHtml(match.id)}">刪除此場比賽</button>
      </div>
    </article>`;
  }

  function render() {
    const solos = soloAthletes();
    if (countEl) countEl.textContent = `可選選手 ${solos.length} 位（各組只有一位）`;
    if (!matches.length) {
      root.innerHTML = `<p class="empty-note">尚未安排友誼賽。請按「新增一場比賽」。</p>`;
      return;
    }
    root.innerHTML = `<div class="friendly-list">${matches.map(renderMatch).join("")}</div>`;
  }

  async function persist() {
    const updatedAt = new Date().toISOString();
    writeLocal(updatedAt);
    setStatus("儲存中…");
    try {
      const saved = await BjjStore.saveFriendly(matches);
      writeLocal(saved.updatedAt || updatedAt);
      setStatus("已儲存");
    } catch {
      setStatus("已存在這台裝置。線上尚未更新，其他裝置可能還看不到。");
    }
  }

  function onAdd() {
    matches.push({ id: newId(), left: "", right: "" });
    render();
    persist();
  }

  function onClick(event) {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    matches = matches.filter((item) => item.id !== button.dataset.remove);
    render();
    persist();
  }

  function onChange(event) {
    const select = event.target.closest("select[data-match]");
    if (!select) return;
    const match = matches.find((item) => item.id === select.dataset.match);
    if (!match) return;
    const side = select.dataset.side === "right" ? "right" : "left";
    match[side] = select.value;
    if (match.left && match.left === match.right) match[side] = "";
    render();
    persist();
  }

  async function load() {
    if (errorEl) errorEl.hidden = true;
    root.innerHTML = `<p class="empty-note">載入中…</p>`;
    try {
      records = await BjjStore.listRegistrations();
      let remote = null;
      try {
        remote = await BjjStore.loadFriendly();
      } catch {
        remote = null;
      }
      const chosen = pickState(remote, readLocal());
      matches = (chosen.matches || [])
        .filter((item) => item && item.id)
        .map((item) => ({
          id: String(item.id),
          left: String(item.left || ""),
          right: String(item.right || ""),
        }));
      render();
      setStatus(chosen.updatedAt ? "已載入先前的安排" : "尚未安排友誼賽");
    } catch (err) {
      records = [];
      matches = [];
      root.innerHTML = "";
      if (countEl) countEl.textContent = "";
      if (errorEl) {
        errorEl.textContent = err.message || "載入失敗，請稍後再試";
        errorEl.hidden = false;
      }
      setStatus("");
    }
  }

  addBtn.addEventListener("click", onAdd);
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  load();
})();
