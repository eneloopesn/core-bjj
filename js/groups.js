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

  function visibleAthletes(filter, grouped, legacyAdults) {
    if (filter === "all") {
      return BjjStore.CATEGORIES.flatMap((item) => grouped.get(item.value)).concat(legacyAdults);
    }
    if (filter === "adult") return legacyAdults;
    return grouped.get(filter) || [];
  }

  function tableRows(athletes) {
    const rows = [];
    buildGroups(athletes).forEach((categoryGroup) => {
      const categoryLabel = BjjStore.categoryLabel(categoryGroup.value);
      categoryGroup.genders.forEach((genderGroup) => {
        const genderLabel = BjjStore.genderLabel(genderGroup.value) || "—";
        genderGroup.weights.forEach((weightGroup) => {
          const weightLabel = weightGroup.value
            ? BjjStore.weightClassLabel(weightGroup.value, categoryGroup.value, genderGroup.value)
            : "未填體重";
          const names = weightGroup.names.filter(Boolean).join("、");
          rows.push([
            categoryLabel,
            genderLabel,
            weightLabel || "未填體重",
            weightGroup.names.length,
            names || "—",
          ]);
        });
      });
    });
    return rows;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let crc = i;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
      }
      table[i] = crc >>> 0;
    }
    return table;
  })();

  function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i += 1) {
      crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) {
    return [value & 255, (value >> 8) & 255];
  }

  function u32(value) {
    return [value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255];
  }

  function concatBytes(parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function storeZip(files) {
    const encoder = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    files.forEach((file) => {
      const name = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const local = new Uint8Array([
        ...u32(0x04034b50),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(crc),
        ...u32(data.length),
        ...u32(data.length),
        ...u16(name.length),
        ...u16(0),
      ]);
      locals.push(concatBytes([local, name, data]));
      const central = new Uint8Array([
        ...u32(0x02014b50),
        ...u16(20),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(crc),
        ...u32(data.length),
        ...u32(data.length),
        ...u16(name.length),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
      ]);
      centrals.push(concatBytes([central, name]));
      offset += local.length + name.length + data.length;
    });
    const centralDir = concatBytes(centrals);
    const end = new Uint8Array([
      ...u32(0x06054b50),
      ...u16(0),
      ...u16(0),
      ...u16(files.length),
      ...u16(files.length),
      ...u32(centralDir.length),
      ...u32(offset),
      ...u16(0),
    ]);
    return concatBytes([...locals, centralDir, end]);
  }

  function xmlEscape(value) {
    return String(value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function columnName(index) {
    let number = index + 1;
    let name = "";
    while (number > 0) {
      const remainder = (number - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      number = Math.floor((number - 1) / 26);
    }
    return name;
  }

  function workbookBytes(rows) {
    const encoder = new TextEncoder();
    const table = [["組別", "性別", "體重量級", "人數", "選手"], ...rows];
    const sheetRows = table
      .map((row, rowIndex) => {
        const cells = row
          .map((value, columnIndex) => {
            const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
            if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
          })
          .join("");
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="12" customWidth="1"/>
    <col min="3" max="3" width="24" customWidth="1"/>
    <col min="4" max="4" width="8" customWidth="1"/>
    <col min="5" max="5" width="48" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
    const files = [
      {
        name: "[Content_Types].xml",
        data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
      },
      {
        name: "_rels/.rels",
        data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
      },
      {
        name: "xl/workbook.xml",
        data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="分組表" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
      },
      { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheet) },
    ];
    return storeZip(files);
  }

  function downloadExcel(rows, filename) {
    const bytes = workbookBytes(rows);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  const exportBtn = document.getElementById("export-excel");

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
      if (exportBtn) exportBtn.disabled = true;
      root.innerHTML = `<p class="empty-note">目前尚無報名資料</p>`;
      root.dataset.filter = filter;
      return;
    }

    const visible = visibleAthletes(filter, grouped, legacyAdults);
    if (exportBtn) exportBtn.disabled = visible.length === 0;

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

  function exportCurrent() {
    if (!exportBtn || exportBtn.disabled) return;
    const filter = filterEl ? filterEl.value || "all" : "all";
    const grouped = new Map(BjjStore.CATEGORIES.map((item) => [item.value, []]));
    const legacyAdults = [];
    records.forEach((item) => {
      const category = normalizeCategory(item.category);
      if (grouped.has(category)) grouped.get(category).push(item);
      else if (category === "adult") legacyAdults.push(item);
    });
    const visible = visibleAthletes(filter, grouped, legacyAdults);
    const rows = tableRows(visible);
    if (!rows.length) return;
    const suffix = filter === "all" ? "" : `-${filterLabel(filter)}`;
    downloadExcel(rows, `分組表${suffix}.xlsx`);
  }

  if (filterEl) {
    filterEl.addEventListener("change", onFilterChange);
    filterEl.addEventListener("input", onFilterChange);
  }
  if (exportBtn) exportBtn.addEventListener("click", exportCurrent);

  load();
})();
