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
    if (raw === "junior" || raw === "少年" || raw === "少年組") return "junior";
    if (raw === "youth" || raw === "青少年" || raw === "青少年組") return "youth";
    if (raw === "young" || raw === "青年" || raw === "青年組") return "young";
    if (raw === "adult" || raw === "成人" || raw === "成人組") return "adult";
    return raw;
  }

  function sortIndex(list, value) {
    const index = list.findIndex((item) => item.value === value);
    return index < 0 ? 999 : index;
  }

  function compareChildren(a, b) {
    const genderDiff = String(a.gender || "").localeCompare(String(b.gender || ""));
    if (genderDiff !== 0) return genderDiff;
    const ageDiff =
      sortIndex(BjjStore.AGE_GROUPS, a.ageGroup) - sortIndex(BjjStore.AGE_GROUPS, b.ageGroup);
    if (ageDiff !== 0) return ageDiff;
    const weightDiff = BjjStore.weightSortIndex(a.weightClass) - BjjStore.weightSortIndex(b.weightClass);
    if (weightDiff !== 0) return weightDiff;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
  }

  function groupChildren(children) {
    const map = new Map();
    children.forEach((athlete) => {
      const key = `${athlete.gender || ""}__${athlete.ageGroup || ""}__${athlete.weightClass || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          gender: athlete.gender || "",
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

  function renderBracketSection(categoryValue, athletes) {
    const label = BjjStore.categoryLabel(categoryValue);
    const groups = groupChildren(athletes);
    if (!groups.length) {
      return `<section class="division-block" data-division="${escapeHtml(categoryValue)}">
        <header class="division-header">
          <h2>${escapeHtml(label)}</h2>
          <span>0 人</span>
        </header>
        <p class="empty-note">尚無${escapeHtml(label)}選手</p>
      </section>`;
    }

    const groupsHtml = groups
      .map((group) => {
        const parts = [];
        const genderText = BjjStore.genderLabel(group.gender);
        if (genderText) parts.push(genderText);
        if (group.ageGroup) parts.push(BjjStore.ageGroupLabel(group.ageGroup));
        parts.push(BjjStore.weightClassLabel(group.weightClass) || "未填體重");
        const title = parts
          .map((part) => `<span>${escapeHtml(part)}</span>`)
          .join('<span class="bracket-sep">／</span>');
        return `<article class="bracket-group">
          <h3>
            ${title}
            <span class="bracket-count">${group.athletes.length} 人</span>
          </h3>
          ${renderNameList(group.athletes)}
        </article>`;
      })
      .join("");

    return `<section class="division-block" data-division="${escapeHtml(categoryValue)}">
      <header class="division-header">
        <h2>${escapeHtml(label)}</h2>
        <span>${athletes.length} 人 · ${groups.length} 個級別</span>
      </header>
      <div class="bracket-grid">${groupsHtml}</div>
    </section>`;
  }

  function renderNameSection(categoryValue, athletes) {
    const label = BjjStore.categoryLabel(categoryValue);
    const sorted = [...athletes].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
    );

    return `<section class="division-block" data-division="${escapeHtml(categoryValue)}">
      <header class="division-header">
        <h2>${escapeHtml(label)}</h2>
        <span>${sorted.length} 人</span>
      </header>
      ${sorted.length ? renderNameList(sorted) : `<p class="empty-note">尚無${escapeHtml(label)}選手</p>`}
    </section>`;
  }

  function renderCategorySection(categoryValue, athletes) {
    if (categoryValue !== "adult") {
      return renderBracketSection(categoryValue, athletes);
    }
    return renderNameSection(categoryValue, athletes);
  }

  function filterLabel(filter) {
    if (filter === "all") return "全部";
    return BjjStore.categoryLabel(filter);
  }

  function render() {
    if (!filterEl || !root || !countEl) return;

    const filter = filterEl.value || "all";
    const grouped = new Map(BjjStore.CATEGORIES.map((item) => [item.value, []]));
    const legacyAdults = [];

    records.forEach((item) => {
      const category = normalizeCategory(item.category);
      if (grouped.has(category)) grouped.get(category).push(item);
      else if (category === "adult") legacyAdults.push(item);
    });

    if (filterStatusEl) {
      filterStatusEl.textContent = `目前顯示：${filterLabel(filter)}`;
    }

    const summary = BjjStore.CATEGORIES.map(
      (item) => `${item.label} ${grouped.get(item.value).length}`
    ).join("／");
    const legacyNote = legacyAdults.length ? `／成人組 ${legacyAdults.length}` : "";

    if (filter === "all") {
      countEl.textContent = `共 ${records.length} 位選手（${summary}${legacyNote}）`;
    } else if (filter === "adult") {
      countEl.textContent = `成人組 ${legacyAdults.length} 位選手`;
    } else {
      const selected = grouped.get(filter) || [];
      countEl.textContent = `${filterLabel(filter)} ${selected.length} 位選手`;
    }

    if (!records.length) {
      root.innerHTML = `<p class="empty-note">目前尚無報名資料</p>`;
      root.dataset.filter = filter;
      return;
    }

    let html = "";
    if (filter === "all") {
      html = BjjStore.CATEGORIES.map((item) =>
        renderCategorySection(item.value, grouped.get(item.value))
      ).join("");
      if (legacyAdults.length) html += renderNameSection("adult", legacyAdults);
    } else if (filter === "adult") {
      html = legacyAdults.length
        ? renderNameSection("adult", legacyAdults)
        : `<p class="empty-note">成人組目前尚無選手</p>`;
    } else {
      const selected = grouped.get(filter) || [];
      html = selected.length
        ? renderCategorySection(filter, selected)
        : `<p class="empty-note">${filterLabel(filter)}目前尚無選手</p>`;
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
