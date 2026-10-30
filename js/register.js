(() => {
  const form = document.getElementById("reg-form");
  const summary = document.getElementById("fee-summary");
  const dialog = document.getElementById("success-dialog");
  const successId = document.getElementById("success-id");
  const formError = document.getElementById("form-error");
  const submitBtn = form.querySelector('button[type="submit"]');

  BjjStore.bindFeeSummary(form, summary);
  BjjStore.bindPaymentToggle(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (formError) formError.hidden = true;

    const data = BjjStore.readFormData(form);
    if (!BjjStore.validateRegistration(form, data)) return;

    try {
      BjjStore.setBusy(submitBtn, true, "送出中…");
      const record = await BjjStore.createRegistration(data);
      successId.textContent = record.id;
      const mailNote = document.getElementById("success-mail-note");
      if (mailNote) {
        mailNote.hidden = !record.email;
      }
      dialog.showModal();
    } catch (err) {
      if (formError) {
        formError.textContent = err.message || "報名失敗，請稍後再試";
        formError.hidden = false;
      }
    } finally {
      BjjStore.setBusy(submitBtn, false);
    }
  });

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "edit") {
      location.href = "edit.html";
      return;
    }
    if (dialog.returnValue === "home") {
      location.href = "index.html";
      return;
    }
    form.reset();
    form.dispatchEvent(new Event("change", { bubbles: true }));
  });
})();
