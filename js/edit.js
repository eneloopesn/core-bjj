(() => {
  const lookupForm = document.getElementById("lookup-form");
  const editForm = document.getElementById("edit-form");
  const lookupError = document.getElementById("lookup-error");
  const formError = document.getElementById("form-error");
  const summary = document.getElementById("fee-summary");
  const savedDialog = document.getElementById("saved-dialog");
  const cancelBtn = document.getElementById("cancel-edit");
  const lookupBtn = lookupForm.querySelector('button[type="submit"]');
  const saveBtn = editForm.querySelector('button[type="submit"]');
  const lookupNameInput = lookupForm.querySelector('input[name="name"]');

  let currentName = null;

  BjjStore.bindFeeSummary(editForm, summary);
  BjjStore.bindPaymentToggle(editForm);

  const params = new URLSearchParams(location.search);
  if (params.get("name")) {
    lookupNameInput.value = params.get("name");
  }

  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    lookupError.hidden = true;
    if (formError) formError.hidden = true;

    if (!lookupForm.checkValidity()) {
      lookupForm.reportValidity();
      return;
    }

    const name = lookupNameInput.value.trim();

    try {
      BjjStore.setBusy(lookupBtn, true, "查詢中…");
      const record = await BjjStore.findRegistration(name);
      currentName = record.name;
      BjjStore.fillForm(editForm, record);
      editForm.hidden = false;
      editForm.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      editForm.hidden = true;
      lookupError.textContent = err.message || "找不到符合的報名資料，請確認姓名。";
      lookupError.hidden = false;
    } finally {
      BjjStore.setBusy(lookupBtn, false);
    }
  });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentName) return;
    if (formError) formError.hidden = true;

    const data = BjjStore.readFormData(editForm);
    if (!BjjStore.validateRegistration(editForm, data)) return;

    try {
      BjjStore.setBusy(saveBtn, true, "儲存中…");
      const updated = await BjjStore.updateRegistration(currentName, data);
      currentName = updated.name;
      lookupNameInput.value = updated.name;
      const mailNote = document.getElementById("saved-mail-note");
      if (mailNote) {
        mailNote.hidden = !updated.email;
      }
      savedDialog.showModal();
    } catch (err) {
      if (formError) {
        formError.textContent = err.message || "儲存失敗，請稍後再試";
        formError.hidden = false;
      }
    } finally {
      BjjStore.setBusy(saveBtn, false);
    }
  });

  cancelBtn.addEventListener("click", () => {
    editForm.hidden = true;
    currentName = null;
    editForm.reset();
    if (formError) formError.hidden = true;
  });
})();
