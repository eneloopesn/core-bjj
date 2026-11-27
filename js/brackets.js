(() => {
  const MODE = document.body.dataset.bracketMode === "view" ? "view" : "edit";
  const root = document.getElementById("bracket-root");
  const errorEl = document.getElementById("bracket-error");
  const statusEl = document.getElementById("save-status");
  const STORAGE_KEY = "bjj-bracket-orders";

  let records = [];
  let orders = {};

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

  function readLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
      if (!parsed || typeof parsed !== "object") return { orders: {}, updatedAt: "" };
      return {
        orders: parsed.orders || {},
        updatedAt: parsed.updatedAt || "",
      };
    } catch {
      return { orders: {}, updatedAt: "" };
    }
  }

  function writeLocal(updatedAt) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ orders, updatedAt: updatedAt || new Date().toISOString() })
    );
  }

  function pickState(remote, local) {
    const remoteTime = Date.parse(remote && remote.updatedAt) || 0;
    const localTime = Date.parse(local && local.updatedAt) || 0;
    if (remoteTime > 0 && remoteTime >= localTime) return remote;
    if (localTime > 0) return local;
    return { orders: {}, updatedAt: "" };
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function groupKey(category, gender, weightClass) {
    return `${category}__${gender || ""}__${weightClass || ""}`;
  }

  function groupAthletes(list) {
    const map = new Map();
    list.forEach((record) => {
      const category = normalizeCategory(record.category);
      if (categoryOrder(category) === 100) return;
      const key = groupKey(category, record.gender, record.weightClass);
      if (!map.has(key)) {
        map.set(key, {
          key,
          category,
          gender: record.gender || "",
          weightClass: record.weightClass || "",
          athletes: [],
        });
      }
      map.get(key).athletes.push(record);
    });

    return [...map.values()].sort((a, b) => {
      const categoryDiff = categoryOrder(a.category) - categoryOrder(b.category);
      if (categoryDiff !== 0) return categoryDiff;
      const genderDiff = String(a.gender).localeCompare(String(b.gender));
      if (genderDiff !== 0) return genderDiff;
      return BjjStore.weightSortIndex(a.weightClass) - BjjStore.weightSortIndex(b.weightClass);
    });
  }

  function resolveOrder(athletes, savedNames) {
    const remaining = [...athletes].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
    );
    const ordered = [];
    (savedNames || []).forEach((name) => {
      const index = remaining.findIndex((item) => item.name === name);
      if (index >= 0) ordered.push(remaining.splice(index, 1)[0]);
    });
    return ordered.concat(remaining);
  }

  function buildNode(slots) {
    const count = slots.length;
    if (count <= 1) return { kind: "solo", slot: slots[0] || null, count };
    if (count === 2) return { kind: "match", left: slots[0], right: slots[1], count };
    if (count === 3) {
      return {
        kind: "seed",
        count,
        seed: slots[0],
        prelim: { kind: "match", left: slots[1], right: slots[2], count: 2 },
      };
    }
    const leftCount = Math.floor(count / 2);
    return {
      kind: "split",
      count,
      leftCount,
      rightCount: count - leftCount,
      left: buildNode(slots.slice(0, leftCount)),
      right: buildNode(slots.slice(leftCount)),
    };
  }

  function formatText(count) {
    if (count <= 1) return "僅 1 人，不排對戰";
    if (count === 2) return "單場對戰";
    if (count === 3) return "3 人，含 1 位種子";
    const leftCount = Math.floor(count / 2);
    return `分成 ${leftCount} 人與 ${count - leftCount} 人`;
  }

  function sideHtml(group, side) {
    if (side.bye) return `<p class="bye-label">輪空</p>`;
    if (MODE === "view") return `<p class="match-name">${escapeHtml(side.name)}</p>`;
    const options = resolveOrder(group.athletes, orders[group.key])
      .map(
        (athlete, index) =>
          `<option value="${index}"${index === side.index ? " selected" : ""}>${escapeHtml(athlete.name || "未填姓名")}</option>`
      )
      .join("");
    return `<select data-group="${escapeHtml(group.key)}" data-seed="${side.index}" aria-label="對戰選手">${options}</select>`;
  }

  function renderMatch(group, match, label) {
    return `<article class="match-card">
      <p class="match-label">${escapeHtml(label)}</p>
      <div class="match-row">
        ${sideHtml(group, match.left)}
        <span class="match-vs">vs</span>
        ${sideHtml(group, match.right)}
      </div>
    </article>`;
  }

  function renderAdvance(label, leftText, rightText) {
    return `<article class="match-card">
      <p class="match-label">${escapeHtml(label)}</p>
      <div class="match-row">
        <p class="bye-label">${escapeHtml(leftText)}</p>
        <span class="match-vs">vs</span>
        <p class="bye-label">${escapeHtml(rightText)}</p>
      </div>
    </article>`;
  }

  function renderNode(group, node, title) {
    if (!node || node.kind === "solo") {
      if (!node || !node.slot) return "";
      return `<div class="pool">${title ? `<h3>${escapeHtml(title)}</h3>` : ""}${sideHtml(group, node.slot)}</div>`;
    }
    if (node.kind === "match") {
      return `<div class="pool">${title ? `<h3>${escapeHtml(title)}</h3>` : ""}${renderMatch(group, node, "對戰")}</div>`;
    }
    if (node.kind === "seed") {
      return `<div class="pool">
        ${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
        <article class="match-card">
          <p class="match-label">種子選手</p>
          ${sideHtml(group, node.seed)}
        </article>
        ${renderMatch(group, node.prelim, "預賽")}
        <article class="match-card">
          <p class="match-label">種子戰</p>
          <div class="match-row">
            <p class="bye-label">預賽勝方</p>
            <span class="match-vs">vs</span>
            <p class="match-name">${escapeHtml(node.seed.name)}</p>
          </div>
        </article>
      </div>`;
    }
    return `<div class="pool">
      ${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
      <div class="pool-columns">
        ${renderNode(group, node.left, `第 1 組 ${node.leftCount} 人`)}
        ${renderNode(group, node.right, `第 2 組 ${node.rightCount} 人`)}
      </div>
      ${renderAdvance("分組勝方", "第 1 組勝方", "第 2 組勝方")}
    </div>`;
  }

  function renderPlan(group, ordered) {
    const slots = ordered.map((athlete, index) => ({
      name: athlete.name || "未填姓名",
      index,
    }));
    const node = buildNode(slots);
    if (node.kind === "solo") return sideHtml(group, node.slot);
    if (node.kind === "match") return renderMatch(group, node, "對戰");
    return renderNode(group, node, "");
  }

  function renderGroup(group) {
    const ordered = resolveOrder(group.athletes, orders[group.key]);
    orders[group.key] = ordered.map((athlete) => athlete.name || "");
    const gender = BjjStore.genderLabel(group.gender) || "未填性別";
    const weight = group.weightClass
      ? BjjStore.weightClassLabel(group.weightClass, group.category, group.gender)
      : "未填體重";
    const title = `${BjjStore.categoryLabel(group.category)}／${gender}／${weight}`;
    const format = formatText(ordered.length);
    const body = ordered.length
      ? renderPlan(group, ordered)
      : `<p class="empty-note">尚無選手</p>`;

    return `<section class="bracket-block">
      <div class="bracket-meta">
        <h2>${escapeHtml(title)}</h2>
        <span>${ordered.length} 人${format ? ` · ${escapeHtml(format)}` : ""}</span>
      </div>
      ${body}
    </section>`;
  }

  function render() {
    const groups = groupAthletes(records);
    if (!groups.length) {
      root.innerHTML = `<p class="empty-note">目前尚無報名資料</p>`;
      return;
    }
    root.innerHTML = `<div class="bracket-list">${groups.map(renderGroup).join("")}</div>`;
  }

  async function persist() {
    const updatedAt = new Date().toISOString();
    writeLocal(updatedAt);
    if (MODE !== "edit") return;
    setStatus("儲存中…");
    try {
      const saved = await BjjStore.saveBrackets(orders);
      writeLocal(saved.updatedAt || updatedAt);
      setStatus("已儲存，對戰表頁會顯示這份安排");
    } catch {
      setStatus("已存在這台裝置。線上尚未更新，其他裝置可能還看不到。");
    }
  }

  function onChange(event) {
    const select = event.target.closest("select[data-seed]");
    if (!select || MODE !== "edit") return;
    const key = select.dataset.group;
    const from = Number(select.dataset.seed);
    const to = Number(select.value);
    const names = (orders[key] || []).slice();
    if (!names.length || from === to || Number.isNaN(from) || Number.isNaN(to)) return;
    const current = names[from];
    names[from] = names[to];
    names[to] = current;
    orders[key] = names;
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
        remote = await BjjStore.loadBrackets();
      } catch {
        remote = null;
      }
      const chosen = pickState(remote, readLocal());
      orders = chosen.orders || {};
      render();
      if (MODE === "edit") setStatus(chosen.updatedAt ? "已載入先前的安排" : "尚未調整，目前是預設對戰");
    } catch (err) {
      records = [];
      root.innerHTML = "";
      if (errorEl) {
        errorEl.textContent = err.message || "載入失敗，請稍後再試";
        errorEl.hidden = false;
      }
    }
  }

  if (MODE === "edit") root.addEventListener("change", onChange);
  load();
})();
