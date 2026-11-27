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

  function categoryOrder(value) {
    const index = BjjStore.CATEGORIES.findIndex((item) => item.value === value);
    if (index >= 0) return index;
    if (value === "adult") return 99;
    return 100;
  }

  function compareAthletes(a, b) {
    const categoryDiff = categoryOrder(normalizeCategory(a.category)) - categoryOrder(normalizeCategory(b.category));
    if (categoryDiff !== 0) return categoryDiff;
    return compareChildren(a, b);
  }

  function buildGroups(athletes) {
    const categories = [];
    [...athletes].sort(compareAthletes).forEach((athlete) => {
      const category = normalizeCategory(athlete.category);
      let categoryGroup = categories[categories.length - 1];
      if (!categoryGroup || categoryGroup.value !== category) {
        categoryGroup = { value: category, genders: [] };
        categories.push(categoryGroup);
      }

      const gender = athlete.gender || "";
      let genderGroup = categoryGroup.genders[categoryGroup.genders.length - 1];
      if (!genderGroup || genderGroup.value !== gender) {
        genderGroup = { value: gender, weights: [] };
        categoryGroup.genders.push(genderGroup);
      }

      const weightClass = athlete.weightClass || "";
      let weightGroup = genderGroup.weights[genderGroup.weights.length - 1];
      if (!weightGroup || weightGroup.value !== weightClass) {
        weightGroup = { value: weightClass, names: [] };
        genderGroup.weights.push(weightGroup);
      }
      weightGroup.names.push(athlete.name || "");
    });
    return categories;
  }

  function renderAthleteTable(athletes) {
    const categories = buildGroups(athletes);
    const body = categories
      .map((categoryGroup) => {
        const categoryRows = categoryGroup.genders.reduce(
          (total, genderGroup) => total + genderGroup.weights.length,
          0
        );
        let categoryStarted = false;
        return categoryGroup.genders
          .map((genderGroup) => {
            let genderStarted = false;
            return genderGroup.weights
              .map((weightGroup) => {
                const names = weightGroup.names
                  .filter(Boolean)
                  .map((name) => escapeHtml(name))
                  .join("、");
                const weightLabel = weightGroup.value
                  ? BjjStore.weightClassLabel(weightGroup.value, categoryGroup.value, genderGroup.value)
                  : "未填體重";
                const cells = [];
                if (!categoryStarted) {
                  cells.push(
                    `<th scope="rowgroup" rowspan="${categoryRows}">${escapeHtml(BjjStore.categoryLabel(categoryGroup.value))}</th>`
                  );
                  categoryStarted = true;
                }
                if (!genderStarted) {
                  cells.push(
                    `<td class="gender-cell" rowspan="${genderGroup.weights.length}">${escapeHtml(BjjStore.genderLabel(genderGroup.value) || "—")}</td>`
                  );
                  genderStarted = true;
                }
                cells.push(`<td class="weight-cell">${escapeHtml(weightLabel || "未填體重")}</td>`);
                cells.push(`<td class="count-cell">${weightGroup.names.length}</td>`);
                cells.push(`<td class="name-cell">${names || "—"}</td>`);
                return `<tr>${cells.join("")}</tr>`;
              })
              .join("");
          })
          .join("");
      })
      .join("");

    return `<div class="athlete-scroll"><table class="athlete-table">
      <thead>
        <tr>
          <th scope="col">組別</th>
          <th scope="col">性別</th>
          <th scope="col">體重量級</th>
          <th scope="col">人數</th>
          <th scope="col">選手</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table></div>`;
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

    let visible = [];
    if (filter === "all") {
      visible = BjjStore.CATEGORIES.flatMap((item) => grouped.get(item.value));
      visible.push(...legacyAdults);
    } else if (filter === "adult") {
      visible = legacyAdults;
    } else {
      visible = grouped.get(filter) || [];
    }

    const html = visible.length
      ? renderAthleteTable(visible)
      : `<p class="empty-note">${filter === "all" ? "目前尚無報名資料" : `${filterLabel(filter)}目前尚無選手`}</p>`;

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
