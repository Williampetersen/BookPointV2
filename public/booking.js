(function () {
  const triggers = document.querySelectorAll(".bp-booking-trigger");
  if (!triggers.length || !window.BookPointPublic) return;

  const cfg = window.BookPointPublic;
  const i18n = cfg.i18n || {};
  const currencySettings = cfg.currencySettings || {
    currency_symbol_before: cfg.currency || "",
    currency_symbol_after: "Kr",
    currency_symbol_position: "after",
    decimals: 2,
    decimal_separator: ".",
    thousand_separator: ",",
  };
  const settings = cfg.settings || {};
  const helpInfo = settings.help || {};

  const defaults = {
    serviceImg: (cfg.pluginUrl || "/") + "assets/images/service-image.png",
    staffImg: (cfg.pluginUrl || "/") + "assets/images/default-avatar.jpg",
    extraImg: (cfg.pluginUrl || "/") + "assets/images/service-image.png",
  };

  const steps = [
    "Service",
    "Extras",
    "Staff",
    "Date + Time",
    "Your Details",
    "Confirm",
    "Success",
  ];

  const stepDescriptions = {
    1: "Choose a service that fits your needs.",
    2: "Add optional extras to personalize your booking.",
    3: "Pick a staff member you trust.",
    4: "Select a date and available slot.",
    5: "Share your contact details.",
    6: "Review everything before confirming.",
    7: "Booking completed — check your confirmation.",
  };

  const state = {
    step: 1,
    loading: false,
    error: "",
    services: [],
    extras: [],
    staff: [],
    slots: [],
    formFields: { defaults: [], customs: [] },
    formValues: {},
    selected: { service: null, extras: [], staff: null, date: "", slot: null },
    booking: { code: "", status: "" },
    formErrors: {},
  };

  const modalId = "bp-bookpoint-modal";
  let modal = document.getElementById(modalId);

  function formatPrice(amount, settingsOverride) {
    const settingsUsed = settingsOverride || currencySettings;
    const decimals = Number.isFinite(Number(settingsUsed.decimals)) ? Number(settingsUsed.decimals) : 2;
    const decSep = settingsUsed.decimal_separator || ".";
    const thouSep = settingsUsed.thousand_separator || ",";
    const before = settingsUsed.symbol_before || settingsUsed.currency_symbol_before || "";
    const after = settingsUsed.symbol_after || settingsUsed.currency_symbol_after || "";
    const position = settingsUsed.position || settingsUsed.currency_symbol_position || "before";
    const fixed = Number(amount || 0).toFixed(decimals);
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
    const formatted = parts.length > 1 ? parts[0] + decSep + parts[1] : parts[0];
    if (position === "after") return `${formatted}${after}`;
    return `${before}${formatted}${after}`;
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bpFetch(path, opts = {}) {
    const url = (cfg.restUrl || "/wp-json/") + path.replace(/^\//, "");
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (cfg.nonce) headers["X-WP-Nonce"] = cfg.nonce;
    return fetch(url, { ...opts, headers })
      .then((res) => res.json().catch(() => ({})).then((data) => {
        if (!res.ok || data?.ok === false || data?.code) throw new Error(data?.message || i18n.error || "Request failed");
        return data?.data ?? data;
      }));
  }

  function createModal() {
    modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "bp-modal";
    modal.setAttribute("role", "presentation");
    modal.innerHTML = `
      <div class="bp-modal__backdrop" data-bp-close></div>
      <div class="bp-modal__panel" role="dialog" aria-modal="true" aria-label="${esc(i18n.ariaTitle || "BookPoint booking")}">
        <button class="bp-modal__close" data-bp-close aria-label="${esc(i18n.close || "Close")}">&times;</button>
        <div class="bp-modal__body">
          <div class="bp-wizard">
            <section class="bp-wizard__help" id="bpWizardHelp"></section>
            <section class="bp-wizard__main">
              <div class="bp-wizard__head">
                <div>
                  <h2 id="bpModalTitle">BookPoint</h2>
                  <div class="bp-wizard__sub">${esc(cfg.placeholder || "Schedule your appointment")}</div>
                </div>
                <div class="bp-wizard__step" id="bpWizardStepLabel"></div>
              </div>
              <div class="bp-wizard__stepper" id="bpWizardStepper"></div>
              <div class="bp-wizard__content" id="bpWizardContent"></div>
              <div class="bp-mobilebar" id="bpMobileBar"></div>
            </section>
            <section class="bp-wizard__summary" id="bpWizardSummary"></section>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  if (!modal) createModal();
  const helpEl = modal.querySelector("#bpWizardHelp");
  const summaryEl = modal.querySelector("#bpWizardSummary");
  const stepperEl = modal.querySelector("#bpWizardStepper");
  const contentEl = modal.querySelector("#bpWizardContent");
  const mobileBarEl = modal.querySelector("#bpMobileBar");
  const stepLabelEl = modal.querySelector("#bpWizardStepLabel");

  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resetWizard() {
    state.step = 1;
    state.loading = false;
    state.error = "";
    state.extras = [];
    state.staff = [];
    state.slots = [];
    state.formValues = {};
    state.selected = { service: null, extras: [], staff: null, date: "", slot: null };
    state.booking = { code: "", status: "" };
    state.formErrors = {};
  }

  function openModal() {
    resetWizard();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("bp-modal-open");
    Promise.all([ensureServices(), loadFormFields()]).then(render).catch(handleError);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("bp-modal-open");
  }

  triggers.forEach((btn) => {
    btn.addEventListener("click", () => openModal());
  });

  modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-bp-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  function handleError(err) {
    state.loading = false;
    state.error = err?.message || i18n.error || "Something went wrong.";
    render();
  }

  function ensureServices() {
    if (state.services.length) return Promise.resolve();
    state.loading = true;
    render();
    return bpFetch("/bookpoint/v1/services").then((res) => {
      state.services = res || [];
      state.loading = false;
    });
  }

  function loadExtras(serviceId) {
    state.loading = true;
    render();
    return bpFetch(`/bookpoint/v1/extras?service_id=${serviceId}`).then((res) => {
      state.extras = res || [];
      state.loading = false;
    });
  }

  function loadStaff(serviceId) {
    state.loading = true;
    render();
    return bpFetch(`/bookpoint/v1/staff?service_id=${serviceId}`).then((res) => {
      state.staff = res || [];
      state.loading = false;
    });
  }

  function loadSlots() {
    if (!state.selected.service || !state.selected.staff || !state.selected.date) return Promise.resolve();
    state.loading = true;
    render();
    const url =
      `/bookpoint/v1/timeslots?service_id=${state.selected.service.id}` +
      `&staff_id=${state.selected.staff.id}` +
      `&date=${encodeURIComponent(state.selected.date)}`;
    return bpFetch(url).then((res) => {
      state.slots = res || [];
      state.loading = false;
    });
  }

  function loadFormFields() {
    return bpFetch("/bookpoint/v1/settings/form_fields").then((res) => {
      const normalized = res && (res.defaults || res.customs) ? res : { defaults: [], customs: [] };
      state.formFields.defaults = normalized.defaults || [];
      state.formFields.customs = normalized.customs || [];
    });
  }

  function calcExtras() {
    const ids = new Set((state.selected.extras || []).map(String));
    const selected = state.extras.filter((e) => ids.has(String(e.id)));
    const price = selected.reduce((sum, e) => sum + Number(e.price || 0), 0);
    return { selected, price };
  }

  function calcTotal() {
    const base = Number(state.selected.service?.price || 0);
    return base + calcExtras().price;
  }

  function renderHelpPanel() {
    const desc = stepDescriptions[state.step] || "";
    const phone = helpInfo.phone ? `<a href="tel:${esc(helpInfo.phone)}">${esc(helpInfo.phone)}</a>` : "";
    const email = helpInfo.email ? `<a href="mailto:${esc(helpInfo.email)}">${esc(helpInfo.email)}</a>` : "";
    const contactLine = phone || email ? `<div class="bp-help-card__support">Need help? ${phone}${phone && email ? " · " : ""}${email}</div>` : "";

    return `
      <div class="bp-help-card">
        <div class="bp-help-card__icon">
          <span>${state.step}</span>
        </div>
        <div class="bp-help-card__content">
          <div class="bp-help-card__title">${esc(steps[state.step - 1] || "")}</div>
          <div class="bp-help-card__desc">${esc(desc)}</div>
        </div>
      </div>
      ${contactLine}
    `;
  }

  function renderSummaryPanel() {
    const extras = calcExtras().selected;
    const extrasValue = extras.length
      ? extras.map((ex) => `<div class="bp-summary-row bp-summary-row--sub">${esc(ex.name)} · ${formatPrice(ex.price)}</div>`).join("")
      : `<div class="bp-summary-row bp-summary-row--sub">None</div>`;
    const rows = [
      { label: "Service", value: state.selected.service?.name || "—" },
      { label: "Duration", value: state.selected.service ? `${state.selected.service.duration} min` : "—" },
      { label: "Extras", value: extras.length ? `${extras.length} selected` : "None" },
      { label: "Staff", value: state.selected.staff?.name || "—" },
      { label: "Date", value: state.selected.date || "—" },
      { label: "Time", value: state.selected.slot ? `${state.selected.slot.start_time} - ${state.selected.slot.end_time}` : "—" },
    ];

    return `
      <div class="bp-summary-panel">
        <div class="bp-summary-panel__header">
          <div>
            <div class="bp-summary-panel__eyebrow">Booking summary</div>
            <h3 class="bp-summary-panel__title">Total: ${formatPrice(calcTotal())}</h3>
          </div>
          <div class="bp-summary-panel__tag">${esc(steps[state.step - 1] || "")}</div>
        </div>
        <div class="bp-summary-panel__body">
          ${rows
            .map(
              (row) => `
                <div class="bp-summary-row">
                  <span>${esc(row.label)}</span>
                  <strong>${esc(row.value)}</strong>
                </div>
              `,
            )
            .join("")}
          <div class="bp-summary-row bp-summary-row--detail">
            <span>Extras detail</span>
            <div class="bp-summary-row__extras">${extrasValue}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderStepper() {
    return steps
      .map((label, index) => {
        const stepNum = index + 1;
        const isActive = state.step === stepNum;
        const isDone = state.step > stepNum;
        const cls = isActive ? "is-active" : isDone ? "is-done" : "is-future";
        return `
          <button class="bp-step ${cls} ${isDone ? "is-clickable" : ""}" ${isDone ? "" : "disabled"} data-step="${stepNum}">
            <div class="bp-step__num">${stepNum}</div>
            <div class="bp-step__label">${esc(label)}</div>
          </button>
        `;
      })
      .join("");
  }

  function renderSkeletonCards(count, circle = false) {
    const items = Array.from({ length: count })
      .map(
        () => `
          <div class="bp-card bp-skeleton-card">
            <div class="bp-skeleton bp-skeleton-img ${circle ? "is-circle" : ""}"></div>
            <div class="bp-card__body">
              <div class="bp-skeleton bp-skeleton-line"></div>
              <div class="bp-skeleton bp-skeleton-line is-short"></div>
            </div>
          </div>
        `,
      )
      .join("");
    return `<div class="bp-cards">${items}</div>`;
  }

  function renderSkeletonSlots() {
    const items = Array.from({ length: 8 }).map(() => `<div class="bp-skeleton bp-skeleton-slot"></div>`).join("");
    return `<div class="bp-slots">${items}</div>`;
  }

  function renderEmpty(message) {
    return `<div class="bp-empty">${esc(message)}</div>`;
  }

  function renderError() {
    return `
      <div class="bp-error">
        <div>${esc(state.error)}</div>
        <button class="bp-btn bp-btn--ghost" data-retry>Retry</button>
      </div>
    `;
  }

  function renderServiceStep() {
    if (state.loading) {
      return `${renderSkeletonCards(4)}<div class="bp-actions"><button class="bp-btn" disabled>${esc(i18n.next || "Next")}</button></div>`;
    }
    if (!state.services.length) return renderEmpty(i18n.noServices || "No services available.");
    const cards = state.services
      .map((s) => {
        const active = state.selected.service?.id === s.id ? "is-selected" : "";
        const img = s.image_url || defaults.serviceImg;
        return `
          <button class="bp-card ${active}" data-service="${s.id}">
            <img class="bp-card__img" alt="" src="${esc(img)}"/>
            <div class="bp-card__body">
              <div class="bp-card__title">${esc(s.name)}</div>
              <div class="bp-card__meta">${esc(s.duration)} min · ${formatPrice(s.price)}</div>
            </div>
          </button>
        `;
      })
      .join("");
    const disabled = state.selected.service ? "" : "disabled";
    return `
      <div class="bp-cards">${cards}</div>
      <div class="bp-actions">
        <button class="bp-btn" data-next ${disabled}>${esc(i18n.next || "Next")}</button>
      </div>
    `;
  }

  function renderExtrasStep() {
    if (state.loading) {
      return `${renderSkeletonCards(4)}<div class="bp-actions"><button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button><button class="bp-btn" disabled>${esc(i18n.next || "Next")}</button></div>`;
    }
    if (!state.extras.length) {
      return `${renderEmpty(i18n.noExtras || "No extras available.")}<div class="bp-actions"><button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button><button class="bp-btn" data-next>${esc(i18n.next || "Next")}</button></div>`;
    }
    const selectedIds = new Set((state.selected.extras || []).map(String));
    const cards = state.extras
      .map((ex) => {
        const active = selectedIds.has(String(ex.id)) ? "is-selected" : "";
        const img = ex.image_url || defaults.extraImg;
        return `
          <button class="bp-card ${active}" data-extra="${ex.id}">
            <img class="bp-card__img" alt="" src="${esc(img)}"/>
            <div class="bp-card__body">
              <div class="bp-card__title">${esc(ex.name)}</div>
              <div class="bp-card__meta">+${formatPrice(ex.price)} · +${esc(ex.duration)} min</div>
            </div>
          </button>
        `;
      })
      .join("");
    return `
      <div class="bp-cards">${cards}</div>
      <div class="bp-actions">
        <button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button>
        <button class="bp-btn" data-next>${esc(i18n.next || "Next")}</button>
      </div>
    `;
  }

  function renderStaffStep() {
    if (state.loading) {
      return `${renderSkeletonCards(4, true)}<div class="bp-actions"><button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button><button class="bp-btn" disabled>${esc(i18n.next || "Next")}</button></div>`;
    }
    if (!state.staff.length) {
      return `${renderEmpty(i18n.noStaff || "No staff available.")}<div class="bp-actions"><button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button></div>`;
    }
    const cards = state.staff
      .map((st) => {
        const active = state.selected.staff?.id === st.id ? "is-selected" : "";
        const img = st.avatar_url || defaults.staffImg;
        return `
          <button class="bp-card ${active}" data-staff="${st.id}">
            <img class="bp-card__img bp-card__img--circle" alt="" src="${esc(img)}"/>
            <div class="bp-card__body">
              <div class="bp-card__title">${esc(st.name)}</div>
              <div class="bp-card__meta">${esc(st.title || "Team member")}</div>
            </div>
          </button>
        `;
      })
      .join("");
    const disabled = state.selected.staff ? "" : "disabled";
    return `
      <div class="bp-cards">${cards}</div>
      <div class="bp-actions">
        <button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button>
        <button class="bp-btn" data-next ${disabled}>${esc(i18n.next || "Next")}</button>
      </div>
    `;
  }

  function renderDateStep() {
    const today = new Date().toISOString().slice(0, 10);
    const slots = state.slots || [];
    const slotButtons = slots
      .map((slot) => {
        const active = state.selected.slot?.start_time === slot.start_time ? "is-selected" : "";
        return `<button class="bp-slot ${active}" data-slot="${esc(slot.start_time)}">${esc(slot.start_time)} - ${esc(slot.end_time)}</button>`;
      })
      .join("");
    const noSlots = !state.loading && state.selected.date && !slots.length;
    const disabled = state.selected.slot ? "" : "disabled";
    return `
      <div class="bp-form">
        <label>Date</label>
        <input type="date" id="bpDate" min="${esc(today)}" value="${esc(state.selected.date || "")}"/>
        <button class="bp-btn bp-btn--ghost" data-find>Find times</button>
      </div>
      ${state.loading ? renderSkeletonSlots() : `<div class="bp-slots">${slotButtons}</div>`}
      ${noSlots ? renderEmpty(i18n.noSlots || "No slots available.") : ""}
      <div class="bp-actions">
        <button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button>
        <button class="bp-btn" data-next ${disabled}>${esc(i18n.next || "Next")}</button>
      </div>
    `;
  }

  function renderCustomerStep() {
    const errors = state.formErrors || {};
    const fields = [...(state.formFields.defaults || []), ...(state.formFields.customs || [])].filter((field) => {
      if (field.enabled === false || String(field.enabled) === "0") return false;
      return true;
    });
    const fieldHtml = fields
      .map((field) => {
        const key = field.field_key || field.key;
        const value = state.formValues[key] ?? "";
        const widthClass = field.width === "half" ? "" : "bp-field--full";
        const isInvalid = errors[key] ? "is-invalid" : "";
        const errorMsg = isInvalid ? `<div class="bp-help bp-help--error">Required</div>` : "";
        if (field.type === "textarea") {
          return `
            <div class="bp-field ${widthClass} ${isInvalid}">
              <label>${esc(field.label)}</label>
              <textarea data-field="${esc(key)}" placeholder="${esc(field.placeholder || "")}">${esc(value)}</textarea>
              ${errorMsg}
            </div>
          `;
        }
        if (field.type === "select") {
          const options = Array.isArray(field.options) ? field.options : [];
          return `
            <div class="bp-field ${widthClass} ${isInvalid}">
              <label>${esc(field.label)}</label>
              <select data-field="${esc(key)}">
                <option value="">Select...</option>
                ${options
                  .map((opt) => `<option value="${esc(opt)}" ${String(value) === String(opt) ? "selected" : ""}>${esc(opt)}</option>`)
                  .join("")}
              </select>
              ${errorMsg}
            </div>
          `;
        }
        if (field.type === "checkbox") {
          return `
            <div class="bp-field ${widthClass} ${isInvalid}">
              <label class="bp-choice">
                <input type="checkbox" data-field="${esc(key)}" ${value ? "checked" : ""}/>
                <span>${esc(field.label)}</span>
              </label>
              ${errorMsg}
            </div>
          `;
        }
        const inputType = field.type || "text";
        return `
          <div class="bp-field ${widthClass} ${isInvalid}">
            <label>${esc(field.label)}</label>
            <input type="${esc(inputType)}" data-field="${esc(key)}" value="${esc(value)}" placeholder="${esc(field.placeholder || "")}"/>
            ${errorMsg}
          </div>
        `;
      })
      .join("");

    return `
      <div class="bp-form bp-grid">
        ${fieldHtml}
      </div>
      <div class="bp-actions">
        <button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button>
        <button class="bp-btn" data-next>${esc(i18n.next || "Next")}</button>
      </div>
    `;
  }

  function renderConfirmStep() {
    const extras = calcExtras().selected;
    const extrasHtml = extras.length
      ? extras.map((e) => `<span>${esc(e.name)}</span>`).join(", ")
      : "<span>None</span>";
    return `
      <div class="bp-summary">
        <div><strong>Service</strong> ${esc(state.selected.service?.name || "")}</div>
        <div><strong>Extras</strong> ${extrasHtml}</div>
        <div><strong>Staff</strong> ${esc(state.selected.staff?.name || "")}</div>
        <div><strong>Date</strong> ${esc(state.selected.date || "")}</div>
        <div><strong>Time</strong> ${esc(state.selected.slot?.start_time || "")} - ${esc(state.selected.slot?.end_time || "")}</div>
        <div><strong>Total</strong> ${formatPrice(calcTotal())}</div>
      </div>
      <div class="bp-actions">
        <button class="bp-btn bp-btn--ghost" data-back>${esc(i18n.back || "Back")}</button>
        <button class="bp-btn" data-confirm>${esc(i18n.confirm || "Confirm booking")}</button>
      </div>
    `;
  }

  function renderSuccessStep() {
    return `
      <div class="bp-success bp-success--modern">
        <div class="bp-success__icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 16.2L4.9 11.9l1.4-1.4 2.9 2.9 8.5-8.5 1.4 1.4z"/></svg>
        </div>
        <h3>${esc(i18n.successTitle || "Booking received")}</h3>
        <p>${esc(i18n.successMsg || "You’ll receive a confirmation shortly.")}</p>
        <p class="bp-success__code">Code: <strong>${esc(state.booking.code || "")}</strong></p>
        <p>Status: <strong>${esc(state.booking.status || "pending")}</strong></p>
        <div class="bp-summary">
          <div><strong>Service</strong> ${esc(state.selected.service?.name || "")}</div>
          <div><strong>Staff</strong> ${esc(state.selected.staff?.name || "")}</div>
          <div><strong>Date</strong> ${esc(state.selected.date || "")}</div>
          <div><strong>Time</strong> ${esc(state.selected.slot?.start_time || "")} - ${esc(state.selected.slot?.end_time || "")}</div>
          <div><strong>Total</strong> ${formatPrice(calcTotal())}</div>
        </div>
        <div class="bp-actions">
          <button class="bp-btn" data-bp-close>${esc(i18n.close || "Close")}</button>
        </div>
      </div>
    `;
  }

  function renderContent() {
    if (state.error) return renderError();
    switch (state.step) {
      case 1:
        return renderServiceStep();
      case 2:
        return renderExtrasStep();
      case 3:
        return renderStaffStep();
      case 4:
        return renderDateStep();
      case 5:
        return renderCustomerStep();
      case 6:
        return renderConfirmStep();
      case 7:
        return renderSuccessStep();
      default:
        return "";
    }
  }

  function renderMobileBar() {
    if (state.step >= 7) return "";
    const label = state.step === 6 ? (i18n.confirm || "Confirm booking") : (i18n.next || "Next");
    const canNext =
      (state.step === 1 && state.selected.service) ||
      state.step === 2 ||
      (state.step === 3 && state.selected.staff) ||
      (state.step === 4 && state.selected.slot) ||
      state.step === 5 ||
      state.step === 6;
    return `
      <div class="bp-mobilebar__content">
        <div>
          <div class="bp-mobilebar__label">Total</div>
          <div class="bp-mobilebar__value">${formatPrice(calcTotal())}</div>
        </div>
        <button class="bp-btn" data-mobile-next ${canNext ? "" : "disabled"}>${esc(label)}</button>
      </div>
    `;
  }

  function render() {
    helpEl.innerHTML = renderHelpPanel();
    summaryEl.innerHTML = renderSummaryPanel();
    stepperEl.innerHTML = renderStepper();
    stepLabelEl.textContent = steps[state.step - 1] || "";
    const existing = contentEl.querySelector(".bp-step-container");
    if (existing) {
      if (!reducedMotion) existing.classList.add("leaving");
      setTimeout(() => existing.remove(), reducedMotion ? 0 : 180);
    }
    const container = document.createElement("div");
    container.className = "bp-step-container";
    container.innerHTML = renderContent();
    contentEl.appendChild(container);
    if (!reducedMotion) {
      requestAnimationFrame(() => container.classList.add("entering"));
      setTimeout(() => container.classList.remove("entering"), 200);
    }
    mobileBarEl.innerHTML = renderMobileBar();
    bindEvents();
  }

  function bindEvents() {
    stepperEl.querySelectorAll("[data-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = Number(btn.dataset.step);
        if (target < state.step) {
          state.step = target;
          state.error = "";
          render();
        }
      });
    });

    contentEl.querySelectorAll("[data-retry]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        state.error = "";
        await retryCurrent();
      });
    });

    mobileBarEl.querySelectorAll("[data-mobile-next]").forEach((btn) => {
      btn.addEventListener("click", () => handleNext());
    });

    contentEl.querySelectorAll("[data-service]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const service = state.services.find((s) => String(s.id) === String(btn.dataset.service));
        state.selected.service = service || null;
        state.selected.extras = [];
        state.selected.staff = null;
        state.selected.date = "";
        state.selected.slot = null;
        state.extras = [];
        state.staff = [];
        state.slots = [];
        render();
      });
    });

    contentEl.querySelectorAll("[data-extra]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = String(btn.dataset.extra);
        const next = new Set((state.selected.extras || []).map(String));
        if (next.has(id)) next.delete(id);
        else next.add(id);
        state.selected.extras = Array.from(next).map((x) => Number(x));
        render();
      });
    });

    contentEl.querySelectorAll("[data-staff]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const member = state.staff.find((s) => String(s.id) === String(btn.dataset.staff));
        state.selected.staff = member || null;
        render();
      });
    });

    const dateInput = contentEl.querySelector("#bpDate");
    if (dateInput) {
      dateInput.addEventListener("change", () => {
        state.selected.date = dateInput.value;
        state.selected.slot = null;
        state.slots = [];
        render();
      });
    }

    contentEl.querySelectorAll("[data-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slot = state.slots.find((s) => s.start_time === btn.dataset.slot);
        state.selected.slot = slot || null;
        render();
      });
    });

    contentEl.querySelectorAll("[data-field]").forEach((input) => {
      const key = input.dataset.field;
      if (!key) return;
      const handler = () => {
        if (input.type === "checkbox") state.formValues[key] = input.checked;
        else if (input.tagName === "SELECT") state.formValues[key] = input.value;
        else state.formValues[key] = input.value;
      };
      input.addEventListener("change", handler);
      input.addEventListener("input", handler);
    });

    const findBtn = contentEl.querySelector("[data-find]");
    if (findBtn) {
      findBtn.addEventListener("click", async () => {
        state.error = "";
        if (!state.selected.date) {
          state.error = "Please choose a date.";
          render();
          return;
        }
        try {
          await loadSlots();
          render();
        } catch (e) {
          handleError(e);
        }
      });
    }

    contentEl.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.error = "";
        state.formErrors = {};
        state.step = Math.max(1, state.step - 1);
        render();
      });
    });

    contentEl.querySelectorAll("[data-next]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await handleNext();
      });
    });

    const confirmBtn = contentEl.querySelector("[data-confirm]");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        state.error = "";
        state.loading = true;
        render();
        const extrasSelected = calcExtras().selected.map((e) => ({
          id: e.id,
          name: e.name,
          price: e.price,
          duration: e.duration,
        }));
        const payload = {
          service_id: state.selected.service?.id,
          staff_id: state.selected.staff?.id,
          booking_date: state.selected.date,
          start_time: state.selected.slot?.start_time,
          end_time: state.selected.slot?.end_time,
          extras_json: extrasSelected,
          customer_json: state.formValues || {},
          status: "pending",
          subtotal: calcTotal(),
          total: calcTotal(),
          currency: currencySettings.currency_symbol_after || currencySettings.currency_symbol_before || "",
        };
        try {
          const res = await bpFetch("/bookpoint/v1/bookings", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          state.booking.code = res?.booking_code || "";
          state.booking.status = res?.status || "pending";
          state.loading = false;
          state.step = 7;
          render();
        } catch (e) {
          handleError(e);
        }
      });
    }
  }
  async function handleNext() {
    state.error = "";
    state.formErrors = {};

    if (state.step === 1) {
      if (!state.selected.service) return;
      state.step = 2;
      render();
      await loadExtras(state.selected.service.id);
      render();
      return;
    }

    if (state.step === 2) {
      state.step = 3;
      render();
      await loadStaff(state.selected.service.id);
      render();
      return;
    }

    if (state.step === 3) {
      if (!state.selected.staff) return;
      state.step = 4;
      render();
      return;
    }

    if (state.step === 4) {
      if (!state.selected.slot) return;
      state.step = 5;
      render();
      return;
    }

    if (state.step === 5) {
      const fields = [...(state.formFields.defaults || []), ...(state.formFields.customs || [])].filter((field) => {
        if (field.enabled === false || String(field.enabled) === "0") return false;
        return true;
      });
      const errors = {};
      fields.forEach((field) => {
        const key = field.field_key || field.key;
        const isRequired = field.required === true || String(field.required) === "1";
        const value = state.formValues[key];
        if (isRequired && (!value || String(value).trim() === "")) errors[key] = true;
      });
      state.formErrors = errors;
      if (Object.keys(errors).length) {
        render();
        return;
      }
      state.step = 6;
      render();
      return;
    }

    if (state.step === 6) {
      const confirmBtn = contentEl.querySelector("[data-confirm]");
      if (confirmBtn) confirmBtn.click();
    }
  }

  async function retryCurrent() {
    if (state.step === 1) {
      state.services = [];
      await ensureServices();
      render();
      return;
    }
    if (state.step === 2 && state.selected.service) {
      await loadExtras(state.selected.service.id);
      render();
      return;
    }
    if (state.step === 3 && state.selected.service) {
      await loadStaff(state.selected.service.id);
      render();
      return;
    }
    if (state.step === 4) {
      await loadSlots();
      render();
      return;
    }
    render();
  }

  render();
})();
