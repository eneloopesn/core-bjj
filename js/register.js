(() => {
  const form = document.getElementById("reg-form");
  const summary = document.getElementById("fee-summary");
  const dialog = document.getElementById("success-dialog");
  const successName = document.getElementById("success-name");
  const formError = document.getElementById("form-error");
  const closedNote = document.getElementById("reg-closed");
  const intro = document.querySelector(".page-intro p");
  const submitBtn = form.querySelector('button[type="submit"]');
  const closesAt = window.BJJ_REGISTRATION_CLOSES_AT;

  function isRegistrationClosed() {
    return Number.isFinite(closesAt) && Date.now() >= closesAt;
  }

  function showClosed() {
    document.documentElement.classList.add("reg-closed");
    form.hidden = true;
    if (intro) intro.hidden = true;
    if (closedNote) closedNote.hidden = false;
  }

  if (isRegistrationClosed()) showClosed();

  BjjStore.bindBirthCategory(form);
  BjjStore.bindFeeSummary(form, summary, { perMatch: false });
  BjjStore.bindPaymentToggle(form);
  BjjStore.bindCategoryFields(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isRegistrationClosed()) {
      showClosed();
      return;
    }
    if (formError) formError.hidden = true;

    const data = BjjStore.readFormData(form);
    if (!BjjStore.validateRegistration(form, data)) return;

    try {
      BjjStore.setBusy(submitBtn, true, "送出中…");
      const record = await BjjStore.createRegistration(data);
      successName.textContent = record.name;
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
    if (dialog.returnValue === "list") {
      location.href = "athletes.html";
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
