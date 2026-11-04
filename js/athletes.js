(() => {
  const body = document.getElementById("athletes-body");
  const countEl = document.getElementById("list-count");
  const errorEl = document.getElementById("list-error");
  const filterEl = document.getElementById("category-filter");

  let records = [];

  function render() {
    const filter = filterEl.value;
    const filtered =
      filter === "all" ? records : records.filter((item) => item.category === filter);

    countEl.textContent = `共 ${filtered.length} 位選手`;

    if (!filtered.length) {
      body.innerHTML = `<tr><td colspan="5">${records.length ? "此組別尚無選手" : "目前尚無報名資料"}</td></tr>`;
      return;
    }

    body.innerHTML = filtered
      .map((item, index) => {
        const isChild = item.category === "child";
        return `<tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(BjjStore.categoryLabel(item.category))}</td>
          <td>${isChild ? escapeHtml(BjjStore.ageGroupLabel(item.ageGroup)) : "—"}</td>
          <td>${isChild ? escapeHtml(BjjStore.weightClassLabel(item.weightClass)) : "—"}</td>
        </tr>`;
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function load() {
    errorEl.hidden = true;
    try {
      records = await BjjStore.listRegistrations();
      render();
    } catch (err) {
      body.innerHTML = `<tr><td colspan="5">無法載入名單</td></tr>`;
      countEl.textContent = "共 0 位選手";
      errorEl.textContent = err.message || "載入失敗，請稍後再試";
      errorEl.hidden = false;
    }
  }

  filterEl.addEventListener("change", render);
  load();
})();
