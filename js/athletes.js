(() => {
  const root = document.getElementById("athletes-root");
  const countEl = document.getElementById("list-count");
  const errorEl = document.getElementById("list-error");
  const filterEl = document.getElementById("category-filter");
  const filterStatusEl = document.getElementById("filter-status");

  let records = [];

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
    if (raw === "adult" || raw === "成人" || raw === "成人組") return "adult";
    return raw;
  }

  function sortIndex(list, value) {
    const index = list.findIndex((item) => item.value === value);
    return index < 0 ? 999 : index;
  }

  function compareChildren(a, b) {
    const ageDiff =
      sortIndex(BjjStore.AGE_GROUPS, a.ageGroup) - sortIndex(BjjStore.AGE_GROUPS, b.ageGroup);
    if (ageDiff !== 0) return ageDiff;
    const weightDiff =
      sortIndex(BjjStore.WEIGHT_CLASSES, a.weightClass) -
      sortIndex(BjjStore.WEIGHT_CLASSES, b.weightClass);
    if (weightDiff !== 0) return weightDiff;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
  }

  function groupChildren(children) {
    const map = new Map();
    children.forEach((athlete) => {
      const key = `${athlete.ageGroup || ""}__${athlete.weightClass || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          ageGroup: athlete.ageGroup || "",
          weightClass: athlete.weightClass || "",
          athletes: [],
        });
      }
      map.get(key).athletes.push(athlete);
    });

    return [...map.values()]
      .map((group) => {
        group.athletes.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
        );
        return group;
      })
      .sort((a, b) => compareChildren(a, b));
  }

  function renderNameList(athletes) {
    if (!athletes.length) {
      return `<p class="empty-note">尚無選手</p>`;
    }
    return `<ol class="athlete-names">${athletes
      .map((item) => `<li>${escapeHtml(item.name)}</li>`)
      .join("")}</ol>`;
  }

  function renderChildSection(children) {
    const groups = groupChildren(children);
    if (!groups.length) {
      return `<section class="division-block" data-division="child">
        <header class="division-header">
          <h2>兒童組</h2>
          <span>0 人</span>
        </header>
        <p class="empty-note">尚無兒童組選手</p>
      </section>`;
    }

    const groupsHtml = groups
      .map((group) => {
        const ageLabel = BjjStore.ageGroupLabel(group.ageGroup) || "未填年齡";
        const weightLabel = BjjStore.weightClassLabel(group.weightClass) || "未填體重";
        return `<article class="bracket-group">
          <h3>
            <span>${escapeHtml(ageLabel)}</span>
            <span class="bracket-sep">／</span>
            <span>${escapeHtml(weightLabel)}</span>
            <span class="bracket-count">${group.athletes.length} 人</span>
          </h3>
          ${renderNameList(group.athletes)}
        </article>`;
      })
      .join("");

    return `<section class="division-block" data-division="child">
      <header class="division-header">
        <h2>兒童組</h2>
        <span>${children.length} 人 · ${groups.length} 個級別</span>
      </header>
      <div class="bracket-grid">${groupsHtml}</div>
    </section>`;
  }

  function renderAdultSection(adults) {
    const sorted = [...adults].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
    );

    return `<section class="division-block" data-division="adult">
      <header class="division-header">
        <h2>成人組</h2>
        <span>${sorted.length} 人</span>
      </header>
      ${renderNameList(sorted)}
    </section>`;
  }

  function filterLabel(filter) {
    if (filter === "child") return "兒童組";
    if (filter === "adult") return "成人組";
    return "全部";
  }

  function render() {
    if (!filterEl || !root || !countEl) return;

    const filter = filterEl.value || "all";
    const children = records.filter((item) => normalizeCategory(item.category) === "child");
    const adults = records.filter((item) => normalizeCategory(item.category) === "adult");

    const showChildren = filter === "all" || filter === "child";
    const showAdults = filter === "all" || filter === "adult";
    const visibleChildren = showChildren ? children : [];
    const visibleAdults = showAdults ? adults : [];

    if (filterStatusEl) {
      filterStatusEl.textContent = `目前顯示：${filterLabel(filter)}`;
    }

    if (filter === "all") {
      countEl.textContent = `共 ${records.length} 位選手（兒童組 ${children.length}／成人組 ${adults.length}）`;
    } else if (filter === "child") {
      countEl.textContent = `兒童組 ${children.length} 位選手`;
    } else {
      countEl.textContent = `成人組 ${adults.length} 位選手`;
    }

    if (!records.length) {
      root.innerHTML = `<p class="empty-note">目前尚無報名資料</p>`;
      root.dataset.filter = filter;
      return;
    }

    let html = "";

    if (filter === "child") {
      html = children.length
        ? renderChildSection(children)
        : `<p class="empty-note">兒童組目前尚無選手</p>`;
    } else if (filter === "adult") {
      html = adults.length
        ? renderAdultSection(adults)
        : `<p class="empty-note">成人組目前尚無選手</p>`;
    } else {
      if (children.length) html += renderChildSection(children);
      if (adults.length) html += renderAdultSection(adults);
      if (!children.length && !adults.length) {
        html = `<p class="empty-note">目前尚無報名資料</p>`;
      } else if (!children.length) {
        html = `${renderChildSection([])}${html}`;
      } else if (!adults.length) {
        html = `${html}${renderAdultSection([])}`;
      }
    }

    root.innerHTML = html;
    root.dataset.filter = filter;
    root.classList.remove("is-updating");
    void root.offsetWidth;
    root.classList.add("is-updating");
  }

  function onFilterChange() {
    render();
  }

  async function load() {
    if (errorEl) errorEl.hidden = true;
    root.innerHTML = `<p class="empty-note">載入中…</p>`;
    try {
      records = await BjjStore.listRegistrations();
      render();
    } catch (err) {
      records = [];
      root.innerHTML = "";
      countEl.textContent = "共 0 位選手";
      if (errorEl) {
        errorEl.textContent = err.message || "載入失敗，請稍後再試";
        errorEl.hidden = false;
      }
    }
  }

  if (filterEl) {
    filterEl.addEventListener("change", onFilterChange);
    filterEl.addEventListener("input", onFilterChange);
  }

  load();
})();
