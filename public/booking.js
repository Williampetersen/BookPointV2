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
    thousand_separator: ","
  };
  const assets = (cfg.pluginUrl || "/") + "assets/";

  const defaults = {
    serviceImg: assets + "images/service-image.png",
    staffImg: assets + "images/default-avatar.jpg",
    extraImg: assets + "images/service-image.png",
  };

  async function bpFetch(path, opts = {}) {
    const url = (cfg.restUrl || "/wp-json/") + path.replace(/^\//, "");
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (cfg.nonce) headers["X-WP-Nonce"] = cfg.nonce;
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.code || data?.message && data?.message !== "" || data?.ok === false) {
      const msg = data?.message || "Request failed";
      throw new Error(msg);
    }
    return data?.data ?? data;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatPrice(amount, settings = currencySettings) {
    const decimals = Number.isFinite(Number(settings.decimals)) ? Number(settings.decimals) : 2;
    const decSep = settings.decimal_separator || ".";
    const thouSep = settings.thousand_separator || ",";
    const before = settings.currency_symbol_before || "";
    const after = settings.currency_symbol_after || "";
    const position = settings.currency_symbol_position || "before";
    const fixed = Number(amount || 0).toFixed(decimals);
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
    const formatted = parts.length > 1 ? parts[0] + decSep + parts[1] : parts[0];
    if (position === "after") return `${formatted}${after}`;
    return `${before}${formatted}${after}`;
  }

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
    selected: {
      service: null,
      extras: [],
      staff: null,
      date: "",
      slot: null,
    },
    booking: {
      code: "",
      status: "",
    },
    formErrors: {},
  };

  const modalId = "bp-booking-modal";
  let modal = document.getElementById(modalId);

  if (!modal) {
    modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "bp-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="bp-modal__backdrop" data-bp-close></div>
      <div class="bp-modal__panel" role="dialog" aria-modal="true" aria-labelledby="bpModalTitle">
        <button class="bp-modal__close" data-bp-close aria-label="${esc(i18n.close || "Close")}">&times;</button>
        <div class="bp-modal__body">
          <div class="bp-wizard">
            <aside class="bp-wizard__aside" id="bpWizardAside"></aside>
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
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const asideEl = modal.querySelector("#bpWizardAside");
  const stepperEl = modal.querySelector("#bpWizardStepper");
  const contentEl = modal.querySelector("#bpWizardContent");
  const stepLabelEl = modal.querySelector("#bpWizardStepLabel");
  const mobileBarEl = modal.querySelector("#bpMobileBar");

  const steps = ["Service", "Extras", "Staff", "Date + Time", "Your Details", "Confirm", "Success"];
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

  triggers.forEach((btn) => btn.addEventListener("click", openModal));
  modal.addEventListener("click", (e) => { if (e.target.matches("[data-bp-close]")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });

  function handleError(err) {
    state.loading = false;
    state.error = err?.message || "Something went wrong.";
    render();
  }

  async function ensureServices() {
    if (state.services.length) return;
    state.loading = true;
    render();
    const res = await bpFetch("/bookpoint/v1/public/services");
    state.services = res || [];
    state.loading = false;
  }

  async function loadExtras(serviceId) {
    state.loading = true;
    render();
    const res = await bpFetch(`/bookpoint/v1/public/extras?service_id=${serviceId}`);
    state.extras = res || [];
    state.loading = false;
  }

  async function loadStaff(serviceId) {
    state.loading = true;
    render();
    const res = await bpFetch(`/bookpoint/v1/public/staff?service_id=${serviceId}`);
    state.staff = res || [];
    state.loading = false;
  }

  async function loadSlots() {
    if (!state.selected.service || !state.selected.staff || !state.selected.date) return;
    state.loading = true;
    render();
    const extras = (state.selected.extras || []).join(",");
    const url =
      `/bookpoint/v1/public/timeslots?service_id=${state.selected.service.id}` +
      `&staff_id=${state.selected.staff.id}` +
      `&date=${encodeURIComponent(state.selected.date)}` +
      `&extras=${encodeURIComponent(extras)}`;
    const res = await bpFetch(url);
    state.slots = res || [];
    state.loading = false;
  }

  async function loadFormFields() {
    state.formFields = {
      defaults: [
        { field_key: "first_name", label: "First Name", placeholder: "Jane", type: "text", required: true, enabled: true, width: "half" },
        { field_key: "last_name", label: "Last Name", placeholder: "Doe", type: "text", required: true, enabled: true, width: "half" },
        { field_key: "email", label: "Email Address", placeholder: "you@email.com", type: "email", required: true, enabled: true, width: "full" },
        { field_key: "phone", label: "Phone Number", placeholder: "+1 555 555 5555", type: "tel", required: true, enabled: true, width: "full" },
        { field_key: "note", label: "Note", placeholder: "Anything else?", type: "textarea", required: false, enabled: true, width: "full" }
      ],
      customs: []
    };
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

  function renderAside() {
    const extras = calcExtras();
    const summary = [
      { label: "Service", value: state.selected.service?.name || "-" },
      { label: "Extras", value: extras.selected.length ? `${extras.selected.length} selected` : "-" },
      { label: "Staff", value: state.selected.staff?.name || "-" },
      { label: "Date", value: state.selected.date || "-" },
      { label: "Time", value: state.selected.slot?.start_time || "-" },
      { label: "Total", value: formatPrice(calcTotal()) },
    ];

    return `
      <div class="bp-aside__brand">
        <div class="bp-aside__eyebrow">BookPoint</div>
        <h3 class="bp-aside__title">${esc(steps[state.step - 1] || "")}</h3>
      </div>
      <div class="bp-aside__summary">
        <div class="bp-aside__summary-title">Booking summary</div>
        ${summary
          .map(
            (row) => `
            <div class="bp-aside__row">
              <span>${esc(row.label)}</span>
              <strong>${esc(row.value)}</strong>
            </div>
          `
          )
          .join("")}
      </div>
    `;
  }

  function renderStepper() {
    return steps
      .map((label, index) => {
        const stepNum = index + 1;
        const cls = state.step === stepNum ? "is-active" : state.step > stepNum ? "is-done" : "is-future";
        const clickable = state.step > stepNum ? "is-clickable" : "";
        return `
          <button class="bp-step ${cls} ${clickable}" data-step="${stepNum}" ${state.step > stepNum ? "" : "disabled"}>
            <div class="bp-step__num">${stepNum}</div>
            <div class="bp-step__label">${esc(label)}</div>
          </button>
        `;
      })
      .join("");
  }

  function renderEmpty(message) {
    return `<div class="bp-empty">${esc(message)}</div>`;
  }

  function renderLoader() {
    return `
      <div class="bp-loader">
        <div class="bp-spinner"></div>
        <div>${esc(i18n.loading || "Loading...")}</div>
      </div>
    `;
  }

  function renderError() {
    return `
      <div class="bp-error">
        <div>${esc(state.error)}</div>
        <button class="bp-btn bp-btn--ghost" data-retry>Retry</button>
      </div>
    `;
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
        `
      )
      .join("");
    return `<div class="bp-cards">${items}</div>`;
  }

  function renderSkeletonSlots() {
    const items = Array.from({ length: 8 })
      .map(() => `<div class="bp-skeleton bp-skeleton-slot"></div>`)
      .join("");
    return `<div class="bp-slots">${items}</div>`;
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
              <div class="bp-card__meta">${esc(s.duration)} min | ${formatPrice(s.price)}</div>
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

    const selected = new Set((state.selected.extras || []).map(String));
    const cards = state.extras
      .map((ex) => {
        const active = selected.has(String(ex.id)) ? "is-selected" : "";
        const img = ex.image_url || defaults.extraImg;
        return `
          <button class="bp-card ${active}" data-extra="${ex.id}">
            <img class="bp-card__img" alt="" src="${esc(img)}"/>
            <div class="bp-card__body">
              <div class="bp-card__title">${esc(ex.name)}</div>
              <div class="bp-card__meta">+${formatPrice(ex.price)} | +${esc(ex.duration)} min</div>
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
    const dateValue = state.selected.date || "";
    const today = new Date().toISOString().slice(0, 10);
    const slots = state.slots || [];
    const slotButtons = slots
      .map((slot) => {
        const active = state.selected.slot?.start_time === slot.start_time ? "is-selected" : "";
        return `
          <button class="bp-slot ${active}" data-slot="${esc(slot.start_time)}">
            ${esc(slot.start_time)} - ${esc(slot.end_time)}
          </button>
        `;
      })
      .join("");

    const noSlots = !state.loading && state.selected.date && !slots.length;
    const disabled = state.selected.slot ? "" : "disabled";

    return `
      <div class="bp-form">
        <label>Date</label>
        <input type="date" id="bpDate" min="${esc(today)}" value="${esc(dateValue)}"/>
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
    const fields = [...(state.formFields.defaults || []), ...(state.formFields.customs || [])].filter((f) => f.enabled);
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
                ${options.map((opt) => `<option value="${esc(opt)}" ${String(value) === String(opt) ? "selected" : ""}>${esc(opt)}</option>`).join("")}
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
      <div class="bp-success">
        <div class="bp-success__icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 16.2L4.9 11.9l1.4-1.4 2.9 2.9 8.5-8.5 1.4 1.4z"/></svg>
        </div>
        <h3>Booking received</h3>
        <p>Code: <strong>${esc(state.booking.code || "")}</strong></p>
        <p>Status: <strong>${esc(state.booking.status || "pending")}</strong></p>
        <div class="bp-summary">
          <div><strong>Service</strong> ${esc(state.selected.service?.name || "")}</div>
          <div><strong>Staff</strong> ${esc(state.selected.staff?.name || "")}</div>
          <div><strong>Date</strong> ${esc(state.selected.date || "")}</div>
          <div><strong>Time</strong> ${esc(state.selected.slot?.start_time || "")} - ${esc(state.selected.slot?.end_time || "")}</div>
        </div>
        <div class="bp-actions">
          <button class="bp-btn" data-bp-close>${esc(i18n.close || "Close")}</button>
        </div>
      </div>
    `;
  }

  function renderContent() {
    if (state.error) return renderError();
    if (state.step === 1) return renderServiceStep();
    if (state.step === 2) return renderExtrasStep();
    if (state.step === 3) return renderStaffStep();
    if (state.step === 4) return renderDateStep();
    if (state.step === 5) return renderCustomerStep();
    if (state.step === 6) return renderConfirmStep();
    if (state.step === 7) return renderSuccessStep();
    return "";
  }

  function renderMobileBar() {
    if (state.step >= 7) return "";
    const label = state.step === 6 ? (i18n.confirm || "Confirm booking") : (i18n.next || "Next");
    const canNext =
      (state.step === 1 && state.selected.service) ||
      (state.step === 2) ||
      (state.step === 3 && state.selected.staff) ||
      (state.step === 4 && state.selected.slot) ||
      (state.step === 5) ||
      (state.step === 6);
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
    asideEl.innerHTML = renderAside();
    stepperEl.innerHTML = renderStepper();
    stepLabelEl.textContent = steps[state.step - 1] || "";
    const html = renderContent();
    const existing = contentEl.querySelector(".bp-step-container");
    if (existing) {
      if (!reducedMotion) existing.classList.add("leaving");
      setTimeout(() => existing.remove(), reducedMotion ? 0 : 180);
    }
    const container = document.createElement("div");
    container.className = "bp-step-container";
    container.innerHTML = html;
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
      btn.addEventListener("click", () => {
        handleNext();
      });
    });

    contentEl.querySelectorAll("[data-service]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const service = state.services.find((s) => String(s.id) === String(btn.dataset.service));
        state.selected.service = service || null;
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
        const staff = state.staff.find((s) => String(s.id) === String(btn.dataset.staff));
        state.selected.staff = staff || null;
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
        if (input.type === "checkbox") {
          state.formValues[key] = input.checked;
        } else if (input.tagName === "SELECT") {
          state.formValues[key] = input.value;
        } else {
          state.formValues[key] = input.value;
        }
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
        const payload = {
          service_id: state.selected.service?.id,
          staff_id: state.selected.staff?.id,
          booking_date: state.selected.date,
          start_time: state.selected.slot?.start_time,
          end_time: state.selected.slot?.end_time,
          extras_json: state.selected.extras,
          customer_first_name: state.formValues.first_name || "",
          customer_last_name: state.formValues.last_name || "",
          customer_email: state.formValues.email || "",
          customer_phone: state.formValues.phone || "",
          customer_note: state.formValues.note || "",
          status: "pending",
          total: calcTotal(),
        };
        try {
          const res = await bpFetch("/bookpoint/v1/public/bookings", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          state.booking.code = res?.booking_code || "";
          state.booking.status = "pending";
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
      const fields = [...(state.formFields.defaults || []), ...(state.formFields.customs || [])].filter((f) => f.enabled);
      const errors = {};
      fields.forEach((field) => {
        if (!field.required) return;
        const key = field.field_key || field.key;
        const value = state.formValues[key];
        if (!value || String(value).trim() === "") errors[key] = true;
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
})();
