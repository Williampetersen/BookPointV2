
(function () {
  const root = document.getElementById("bookpoint-admin-app");
  if (!root || !window.BookPointAdmin || !window.wp || !wp.element) return;

  const cfg = window.BookPointAdmin;
  const { createElement: h, useState, useEffect, useRef } = wp.element;

  async function bpFetch(path, opts = {}) {
    const url = (cfg.restUrl || "/wp-json/") + path.replace(/^\//, "");
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    headers["X-WP-Nonce"] = cfg.nonce;
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false || data?.code) {
      const msg = data?.message || "Request failed";
      throw new Error(msg);
    }
    return data?.data ?? data;
  }

  function imgFallback(type) {
    if (type === "staff") return `${cfg.pluginUrl}assets/images/default-avatar.jpg`;
    return `${cfg.pluginUrl}assets/images/service-image.png`;
  }

  function pickMedia(onPick) {
    if (!window.wp || !wp.media) {
      alert("WP Media not available");
      return;
    }
    const frame = wp.media({ title: "Select Image", multiple: false, library: { type: "image" } });
    frame.on("select", () => {
      const att = frame.state().get("selection").first().toJSON();
      onPick(att);
    });
    frame.open();
  }

  function formatPrice(amount, settings = {}) {
    const decimals = Number.isFinite(Number(settings.decimals)) ? Number(settings.decimals) : 2;
    const decSep = settings.decimal_separator || ".";
    const thouSep = settings.thousand_separator || ",";
    const before = settings.symbol_before || settings.currency_symbol_before || "";
    const after = settings.symbol_after || settings.currency_symbol_after || "";
    const position = settings.position || settings.currency_symbol_position || "before";
    const fixed = Number(amount || 0).toFixed(decimals);
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
    const formatted = parts.length > 1 ? parts[0] + decSep + parts[1] : parts[0];
    if (position === "after") return `${formatted}${after}`;
    return `${before}${formatted}${after}`;
  }

  function defaultFormFields() {
    return {
      defaults: [
        { field_key: "first_name", label: "First Name", placeholder: "", type: "text", required: true, enabled: true, width: "half" },
        { field_key: "last_name", label: "Last Name", placeholder: "", type: "text", required: true, enabled: true, width: "half" },
        { field_key: "email", label: "Email Address", placeholder: "", type: "email", required: true, enabled: true, width: "full" },
        { field_key: "phone", label: "Phone Number", placeholder: "", type: "tel", required: false, enabled: true, width: "full" },
        { field_key: "comments", label: "Comments", placeholder: "", type: "textarea", required: false, enabled: true, width: "full" }
      ],
      customs: []
    };
  }

  function generateFieldKey(label, existing) {
    const base = (label || "custom_field").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    let key = `cf_${base}`;
    const suffix = Math.random().toString(36).slice(2, 8);
    key = `${key}_${suffix}`;
    const used = new Set(existing || []);
    while (used.has(key)) {
      const alt = Math.random().toString(36).slice(2, 8);
      key = `cf_${base}_${alt}`;
    }
    return key;
  }

  function App() {
    const [page, setPage] = useState("services");

    const [services, setServices] = useState([]);
    const [staff, setStaff] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [extras, setExtras] = useState([]);
    const [bookings, setBookings] = useState([]);

    const [serviceId, setServiceId] = useState(null);
    const [staffId, setStaffId] = useState(null);
    const [extraId, setExtraId] = useState(null);
    const [ruleId, setRuleId] = useState(null);

    const [serviceForm, setServiceForm] = useState(null);
    const [staffForm, setStaffForm] = useState(null);
    const [extraForm, setExtraForm] = useState(null);
    const [availabilityForm, setAvailabilityForm] = useState({ staff_id: "", date: "", start_time: "", end_time: "", is_available: 1, note: "" });
    const [availabilityFilters, setAvailabilityFilters] = useState({ staff_id: "", from: "", to: "" });
    const [extraServiceId, setExtraServiceId] = useState("");

    const [workspace, setWorkspace] = useState({});
    const [currency, setCurrency] = useState({});
    const [datetime, setDatetime] = useState({});
    const [emailSettings, setEmailSettings] = useState({ enabled: false });
    const [formFields, setFormFields] = useState(defaultFormFields());
    const [emailRules, setEmailRules] = useState([]);

    const [fieldTab, setFieldTab] = useState("defaults");
    const [showTokenPicker, setShowTokenPicker] = useState(false);

    const [dirty, setDirty] = useState({});
    const [saved, setSaved] = useState({});
    const [toasts, setToasts] = useState([]);
    const toastId = useRef(1);
    const focusedField = useRef(null);

    useEffect(() => {
      if (page === "services") loadServices();
      if (page === "staff") { loadStaff(); loadServices(); }
      if (page === "availability") { loadStaff(); loadAvailability(); }
      if (page === "extras") { loadServices(); loadExtras(); }
      if (page === "appointments") { loadBookings(); loadServices(); loadStaff(); }
      if (page === "workspace") loadWorkspace();
      if (page === "form_fields") loadFormFields();
      if (page === "email_settings") loadEmailSettings();
      if (page === "email_rules") { loadEmailRules(); loadFormFields(); }
    }, [page]);

    useEffect(() => {
      const current = services.find((s) => String(s.id) === String(serviceId));
      if (current) setServiceForm({ ...current });
      else if (serviceId === null) setServiceForm(null);
    }, [serviceId, services]);

    useEffect(() => {
      const current = staff.find((s) => String(s.id) === String(staffId));
      if (current) {
        setStaffForm({ ...current, service_ids: current.service_ids || [], days_off_json: normalizeDaysOff(current.days_off_json) });
      } else if (staffId === null) {
        setStaffForm(null);
      }
    }, [staffId, staff]);

    useEffect(() => {
      const current = extras.find((x) => String(x.id) === String(extraId));
      if (current) setExtraForm({ ...current });
      else if (extraId === null) setExtraForm(null);
    }, [extraId, extras]);

    useEffect(() => {
      if (!emailRules.length) return;
      if (ruleId === null && emailRules[0]) setRuleId(emailRules[0].id);
    }, [emailRules, ruleId]);

    function normalizeDaysOff(data) {
      const base = { weekly: { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false }, blocks: [] };
      if (!data || typeof data !== "object") return base;
      const weekly = { ...base.weekly, ...(data.weekly || {}) };
      const blocks = Array.isArray(data.blocks) ? data.blocks : [];
      return { weekly, blocks };
    }

    function pushToast(type, text) {
      const id = toastId.current++;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    }

    function markDirty(key) {
      setDirty((prev) => ({ ...prev, [key]: true }));
      setSaved((prev) => ({ ...prev, [key]: false }));
    }

    function markSaved(key) {
      setDirty((prev) => ({ ...prev, [key]: false }));
      setSaved((prev) => ({ ...prev, [key]: true }));
      pushToast("ok", "Changes saved.");
    }

    async function loadServices() {
      const res = await bpFetch("/bookpoint/v1/services?include_inactive=1");
      setServices(res || []);
      if (!serviceId && res[0]) setServiceId(res[0].id);
    }

    async function loadStaff() {
      const res = await bpFetch("/bookpoint/v1/staff?include_inactive=1");
      setStaff(res || []);
      if (!staffId && res[0]) setStaffId(res[0].id);
    }

    async function loadAvailability() {
      const params = new URLSearchParams();
      if (availabilityFilters.staff_id) params.set("staff_id", availabilityFilters.staff_id);
      if (availabilityFilters.from) params.set("from", availabilityFilters.from);
      if (availabilityFilters.to) params.set("to", availabilityFilters.to);
      const res = await bpFetch(`/bookpoint/v1/availability?${params.toString()}`);
      setAvailability(res || []);
    }

    async function loadExtras() {
      const params = new URLSearchParams();
      params.set("include_inactive", "1");
      if (extraServiceId) params.set("service_id", extraServiceId);
      const res = await bpFetch(`/bookpoint/v1/extras?${params.toString()}`);
      setExtras(res || []);
      if (!extraId && res[0]) setExtraId(res[0].id);
    }

    async function loadBookings() {
      const res = await bpFetch("/bookpoint/v1/bookings");
      setBookings(res || []);
    }

    async function loadWorkspace() {
      const res = await bpFetch("/bookpoint/v1/settings/workspace");
      const cur = await bpFetch("/bookpoint/v1/settings/currency");
      const dt = await bpFetch("/bookpoint/v1/settings/datetime");
      setWorkspace(res || {});
      setCurrency(cur || {});
      setDatetime(dt || {});
    }

    async function loadFormFields() {
      const res = await bpFetch("/bookpoint/v1/settings/form_fields");
      const normalized = res && (res.defaults || res.customs) ? res : defaultFormFields();
      if (!normalized.defaults || !normalized.defaults.length) normalized.defaults = defaultFormFields().defaults;
      if (!normalized.customs) normalized.customs = [];
      setFormFields(normalized);
    }

    async function loadEmailSettings() {
      const res = await bpFetch("/bookpoint/v1/settings/email");
      setEmailSettings(res || {});
    }

    async function loadEmailRules() {
      const res = await bpFetch("/bookpoint/v1/settings/email_rules");
      setEmailRules(Array.isArray(res) ? res : []);
    }

    function Sidebar() {
      const navButton = (key, label) => h("button", { className: `bp-nav-item ${page === key ? "is-active" : ""}`, onClick: () => setPage(key) }, label);
      return h("aside", { className: "bp-sidebar" },
        h("div", { className: "bp-brand" },
          h("div", { className: "bp-logo" }),
          h("div", { className: "bp-brand-name" }, "BookPoint")
        ),
        h("nav", { className: "bp-nav" },
          navButton("services", "Services"),
          navButton("staff", "Staff"),
          navButton("availability", "Availability"),
          navButton("extras", "Service Extras"),
          navButton("appointments", "Appointments"),
          h("div", { className: "bp-nav-section" }, "Settings"),
          navButton("workspace", "Workspace"),
          navButton("form_fields", "Form Fields"),
          navButton("email_settings", "Email Settings"),
          navButton("email_rules", "Email Automation")
        ),
        h("a", { className: "bp-backwp", href: cfg.adminUrl, title: "Click to go back to WordPress" },
          h("img", { className: "bp-wpicon", alt: "WP", src: `${cfg.pluginUrl}assets/images/wordpress-logo.png` }),
          h("div", null,
            h("div", { className: "bp-backwp-text" }, "Back to WordPress"),
            h("small", null, "Manage plugins, posts, and pages")
          )
        )
      );
    }

    function Toasts() {
      return h("div", { className: "bp-toasts" },
        toasts.map((t) => h("div", { key: t.id, className: `bp-toast ${t.type === "ok" ? "bp-toast--ok" : "bp-toast--bad"}` }, t.text))
      );
    }

    function SaveButton({ section, onSave }) {
      const isDirty = !!dirty[section];
      const isSaved = !!saved[section];
      const label = isSaved && !isDirty ? "Saved" : "Save Changes";
      return h("button", {
        className: `bp-btn ${isSaved && !isDirty ? "bp-btn--saved" : ""}`,
        disabled: !isDirty,
        onClick: async () => {
          try {
            await onSave();
            markSaved(section);
          } catch (e) {
            pushToast("bad", e.message || "Save failed");
          }
        }
      }, label);
    }

    function ServicesPage() {
      const current = serviceForm || { name: "", duration: 60, price: "0", buffer_before: 0, buffer_after: 0, capacity_min: 1, capacity_max: 1, image_url: "", is_active: 1 };

      return h("div", { className: "bp-grid" },
        h("div", { className: "bp-left" },
          h("div", { className: "bp-card bp-sticky" },
            h("div", { className: "bp-headrow" },
              h("div", null,
                h("h2", { className: "bp-h2" }, "Services"),
                h("div", { className: "bp-muted" }, "Define services and pricing.")
              ),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadServices() }, "Refresh"),
                h("button", { className: "bp-btn", onClick: () => { setServiceId(null); setServiceForm({}); } }, "+ New")
              )
            )
          ),
          h("div", { className: "bp-list" },
            services.map((s) => h("div", { className: "bp-click", key: s.id, onClick: () => setServiceId(s.id) },
              h("div", { className: `bp-item ${String(s.id) === String(serviceId) ? "is-active" : ""}` },
                h("img", { className: "bp-item-thumb", src: s.image_url || imgFallback("service"), alt: "" }),
                h("div", { className: "bp-item-body" },
                  h("div", { className: "bp-item-title" }, s.name || "Untitled"),
                  h("div", { className: "bp-item-sub" }, `Duration: ${s.duration}m | ${formatPrice(s.price, currency)}`)
                )
              )
            ))
          )
        ),
        h("div", { className: "bp-right" },
          h("div", { className: "bp-card" },
            h("div", { className: "bp-headrow" },
              h("h2", { className: "bp-h2" }, current.id ? "Edit Service" : "New Service"),
              h("div", { className: "bp-actions" },
                current.id ? h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => {
                  if (!confirm("Delete this service?")) return;
                  await bpFetch(`/bookpoint/v1/services/${current.id}`, { method: "DELETE" });
                  await loadServices();
                  setServiceId(null);
                } }, "Delete") : null,
                h(SaveButton, { section: "services", onSave: async () => {
                  const payload = { ...current };
                  if (current.id) {
                    await bpFetch(`/bookpoint/v1/services/${current.id}`, { method: "PUT", body: JSON.stringify(payload) });
                  } else {
                    const res = await bpFetch("/bookpoint/v1/services", { method: "POST", body: JSON.stringify(payload) });
                    setServiceId(res.id);
                  }
                  await loadServices();
                } })
              )
            ),
            h("div", { className: "bp-section" },
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Service name"), h("input", { className: "bp-input", value: current.name || "", onChange: (e) => { setServiceForm({ ...current, name: e.target.value }); markDirty("services"); } })),
                h("div", null, h("label", { className: "bp-label" }, "Duration (minutes)"), h("input", { className: "bp-input", type: "number", value: current.duration, onChange: (e) => { setServiceForm({ ...current, duration: Number(e.target.value) }); markDirty("services"); } }))
              ),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Price"), h("input", { className: "bp-input", type: "number", value: current.price, onChange: (e) => { setServiceForm({ ...current, price: e.target.value }); markDirty("services"); } })),
                h("div", null, h("label", { className: "bp-label" }, "Active"), h("select", { className: "bp-input", value: current.is_active ?? 1, onChange: (e) => { setServiceForm({ ...current, is_active: Number(e.target.value) }); markDirty("services"); } },
                  h("option", { value: 1 }, "Active"),
                  h("option", { value: 0 }, "Inactive")
                ))
              ),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Buffer before (min)"), h("input", { className: "bp-input", type: "number", value: current.buffer_before || 0, onChange: (e) => { setServiceForm({ ...current, buffer_before: Number(e.target.value) }); markDirty("services"); } })),
                h("div", null, h("label", { className: "bp-label" }, "Buffer after (min)"), h("input", { className: "bp-input", type: "number", value: current.buffer_after || 0, onChange: (e) => { setServiceForm({ ...current, buffer_after: Number(e.target.value) }); markDirty("services"); } }))
              ),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Capacity min"), h("input", { className: "bp-input", type: "number", value: current.capacity_min || 1, onChange: (e) => { setServiceForm({ ...current, capacity_min: Number(e.target.value) }); markDirty("services"); } })),
                h("div", null, h("label", { className: "bp-label" }, "Capacity max"), h("input", { className: "bp-input", type: "number", value: current.capacity_max || 1, onChange: (e) => { setServiceForm({ ...current, capacity_max: Number(e.target.value) }); markDirty("services"); } }))
              ),
              h("label", { className: "bp-label" }, "Image URL"),
              h("input", { className: "bp-input", value: current.image_url || "", onChange: (e) => { setServiceForm({ ...current, image_url: e.target.value }); markDirty("services"); } }),
              h("div", { className: "bp-imgbox" },
                h("img", { className: "bp-imgthumb", src: current.image_url || imgFallback("service"), alt: "" }),
                h("div", null,
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => pickMedia((att) => { setServiceForm({ ...current, image_url: att.url || "" }); markDirty("services"); }) }, "Choose image"),
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => { setServiceForm({ ...current, image_url: "" }); markDirty("services"); } }, "Remove")
                )
              )
            )
          )
        )
      );
    }

    function StaffPage() {
      const current = staffForm || { name: "", title: "", bio: "", avatar_url: "", is_active: 1, use_custom_schedule: 0, service_ids: [], days_off_json: normalizeDaysOff(null) };
      const daysOff = normalizeDaysOff(current.days_off_json);

      return h("div", { className: "bp-grid" },
        h("div", { className: "bp-left" },
          h("div", { className: "bp-card bp-sticky" },
            h("div", { className: "bp-headrow" },
              h("div", null,
                h("h2", { className: "bp-h2" }, "Staff"),
                h("div", { className: "bp-muted" }, "Manage staff profiles and schedules.")
              ),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadStaff() }, "Refresh"),
                h("button", { className: "bp-btn", onClick: () => { setStaffId(null); setStaffForm({}); } }, "+ New")
              )
            )
          ),
          h("div", { className: "bp-list" },
            staff.map((s) => h("div", { className: "bp-click", key: s.id, onClick: () => setStaffId(s.id) },
              h("div", { className: `bp-item ${String(s.id) === String(staffId) ? "is-active" : ""}` },
                h("img", { className: "bp-item-thumb", src: s.avatar_url || imgFallback("staff"), alt: "" }),
                h("div", { className: "bp-item-body" },
                  h("div", { className: "bp-item-title" }, s.name || "Unnamed"),
                  h("div", { className: "bp-item-sub" }, s.title || "Staff")
                )
              )
            ))
          )
        ),
        h("div", { className: "bp-right" },
          h("div", { className: "bp-card" },
            h("div", { className: "bp-headrow" },
              h("h2", { className: "bp-h2" }, current.id ? "Edit Staff" : "New Staff"),
              h("div", { className: "bp-actions" },
                current.id ? h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => {
                  if (!confirm("Delete this staff member?")) return;
                  await bpFetch(`/bookpoint/v1/staff/${current.id}`, { method: "DELETE" });
                  await loadStaff();
                  setStaffId(null);
                } }, "Delete") : null,
                h(SaveButton, { section: "staff", onSave: async () => {
                  const payload = { ...current, days_off_json: daysOff };
                  if (current.id) {
                    await bpFetch(`/bookpoint/v1/staff/${current.id}`, { method: "PUT", body: JSON.stringify(payload) });
                  } else {
                    const res = await bpFetch("/bookpoint/v1/staff", { method: "POST", body: JSON.stringify(payload) });
                    setStaffId(res.id);
                  }
                  if (current.id) await bpFetch(`/bookpoint/v1/staff/${current.id}/services`, { method: "POST", body: JSON.stringify({ service_ids: payload.service_ids || [] }) });
                  await loadStaff();
                } })
              )
            ),
            h("div", { className: "bp-section" },
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Name"), h("input", { className: "bp-input", value: current.name || "", onChange: (e) => { setStaffForm({ ...current, name: e.target.value }); markDirty("staff"); } })),
                h("div", null, h("label", { className: "bp-label" }, "Title"), h("input", { className: "bp-input", value: current.title || "", onChange: (e) => { setStaffForm({ ...current, title: e.target.value }); markDirty("staff"); } }))
              ),
              h("label", { className: "bp-label" }, "Bio"),
              h("textarea", { className: "bp-textarea", value: current.bio || "", onChange: (e) => { setStaffForm({ ...current, bio: e.target.value }); markDirty("staff"); } }),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Active"), h("select", { className: "bp-input", value: current.is_active ?? 1, onChange: (e) => { setStaffForm({ ...current, is_active: Number(e.target.value) }); markDirty("staff"); } },
                  h("option", { value: 1 }, "Active"),
                  h("option", { value: 0 }, "Inactive")
                )),
                h("div", null, h("label", { className: "bp-label" }, "Custom schedule"), h("select", { className: "bp-input", value: current.use_custom_schedule ?? 0, onChange: (e) => { setStaffForm({ ...current, use_custom_schedule: Number(e.target.value) }); markDirty("staff"); } },
                  h("option", { value: 0 }, "Use global"),
                  h("option", { value: 1 }, "Custom")
                ))
              ),
              h("label", { className: "bp-label" }, "Avatar URL"),
              h("input", { className: "bp-input", value: current.avatar_url || "", onChange: (e) => { setStaffForm({ ...current, avatar_url: e.target.value }); markDirty("staff"); } }),
              h("div", { className: "bp-imgbox" },
                h("img", { className: "bp-imgthumb", src: current.avatar_url || imgFallback("staff"), alt: "" }),
                h("div", null,
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => pickMedia((att) => { setStaffForm({ ...current, avatar_url: att.url || "" }); markDirty("staff"); }) }, "Choose avatar"),
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => { setStaffForm({ ...current, avatar_url: "" }); markDirty("staff"); } }, "Remove")
                )
              )
            ),
            h("div", { className: "bp-section" },
              h("h3", { className: "bp-h3" }, "Weekly off days"),
              h("div", { className: "bp-checkgrid" },
                ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, idx) => h("label", { key: label, className: "bp-checkcard" },
                  h("input", { type: "checkbox", checked: !!daysOff.weekly[idx], onChange: (e) => {
                    const next = normalizeDaysOff(daysOff);
                    next.weekly[idx] = e.target.checked;
                    setStaffForm({ ...current, days_off_json: next });
                    markDirty("staff");
                  } }),
                  h("span", null, label)
                ))
              )
            ),
            h("div", { className: "bp-section" },
              h("h3", { className: "bp-h3" }, "Day off blocks"),
              h("div", { className: "bp-grid3" },
                h("input", { className: "bp-input", type: "date", value: availabilityForm.date || "", onChange: (e) => setAvailabilityForm({ ...availabilityForm, date: e.target.value }) }),
                h("input", { className: "bp-input", type: "time", value: availabilityForm.start_time || "", onChange: (e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value }) }),
                h("input", { className: "bp-input", type: "time", value: availabilityForm.end_time || "", onChange: (e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value }) })
              ),
              h("button", { className: "bp-btn bp-btn--ghost", onClick: () => {
                if (!availabilityForm.date || !availabilityForm.start_time || !availabilityForm.end_time) return;
                const next = normalizeDaysOff(daysOff);
                next.blocks = [...next.blocks, { date: availabilityForm.date, start: availabilityForm.start_time, end: availabilityForm.end_time }];
                setStaffForm({ ...current, days_off_json: next });
                setAvailabilityForm({ ...availabilityForm, date: "", start_time: "", end_time: "" });
                markDirty("staff");
              } }, "Add day off"),
              h("div", { className: "bp-list" },
                daysOff.blocks.map((block, idx) => h("div", { key: idx, className: "bp-item" },
                  h("div", { className: "bp-item-body" },
                    h("div", { className: "bp-item-title" }, `${block.date} ${block.start || ""} - ${block.end || ""}`)
                  ),
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => {
                    const next = normalizeDaysOff(daysOff);
                    next.blocks = next.blocks.filter((_, i) => i !== idx);
                    setStaffForm({ ...current, days_off_json: next });
                    markDirty("staff");
                  } }, "Remove")
                ))
              )
            ),
            h("div", { className: "bp-section" },
              h("h3", { className: "bp-h3" }, "Services offered"),
              h("div", { className: "bp-checkgrid" },
                services.map((svc) => {
                  const checked = (current.service_ids || []).includes(svc.id);
                  return h("label", { key: svc.id, className: "bp-checkcard" },
                    h("input", { type: "checkbox", checked, onChange: (e) => {
                      const next = new Set(current.service_ids || []);
                      if (e.target.checked) next.add(svc.id);
                      else next.delete(svc.id);
                      setStaffForm({ ...current, service_ids: Array.from(next) });
                      markDirty("staff");
                    } }),
                    h("img", { className: "bp-item-thumb", src: svc.image_url || imgFallback("service"), alt: "" }),
                    h("span", null, svc.name)
                  );
                })
              )
            )
          )
        )
      );
    }

    function AvailabilityPage() {
      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Availability"),
            h("div", { className: "bp-muted" }, "Add availability and exceptions.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadAvailability() }, "Refresh")
          )
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Filters"),
          h("div", { className: "bp-grid3" },
            h("select", { className: "bp-input", value: availabilityFilters.staff_id || "", onChange: (e) => { setAvailabilityFilters({ ...availabilityFilters, staff_id: e.target.value }); } },
              h("option", { value: "" }, "All staff"),
              staff.map((s) => h("option", { key: s.id, value: s.id }, s.name))
            ),
            h("input", { className: "bp-input", type: "date", value: availabilityFilters.from || "", onChange: (e) => setAvailabilityFilters({ ...availabilityFilters, from: e.target.value }) }),
            h("input", { className: "bp-input", type: "date", value: availabilityFilters.to || "", onChange: (e) => setAvailabilityFilters({ ...availabilityFilters, to: e.target.value }) })
          ),
          h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadAvailability() }, "Apply filters")
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Add block"),
          h("div", { className: "bp-grid3" },
            h("select", { className: "bp-input", value: availabilityForm.staff_id || "", onChange: (e) => setAvailabilityForm({ ...availabilityForm, staff_id: e.target.value }) },
              h("option", { value: "" }, "Select staff"),
              staff.map((s) => h("option", { key: s.id, value: s.id }, s.name))
            ),
            h("input", { className: "bp-input", type: "date", value: availabilityForm.date || "", onChange: (e) => setAvailabilityForm({ ...availabilityForm, date: e.target.value }) }),
            h("select", { className: "bp-input", value: availabilityForm.is_available ?? 1, onChange: (e) => setAvailabilityForm({ ...availabilityForm, is_available: Number(e.target.value) }) },
              h("option", { value: 1 }, "Available"),
              h("option", { value: 0 }, "Unavailable")
            )
          ),
          h("div", { className: "bp-grid3" },
            h("input", { className: "bp-input", type: "time", value: availabilityForm.start_time || "", onChange: (e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value }) }),
            h("input", { className: "bp-input", type: "time", value: availabilityForm.end_time || "", onChange: (e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value }) }),
            h("input", { className: "bp-input", placeholder: "Note", value: availabilityForm.note || "", onChange: (e) => setAvailabilityForm({ ...availabilityForm, note: e.target.value }) })
          ),
          h("button", { className: "bp-btn", onClick: async () => {
            if (!availabilityForm.staff_id || !availabilityForm.date || !availabilityForm.start_time || !availabilityForm.end_time) return;
            await bpFetch("/bookpoint/v1/availability", { method: "POST", body: JSON.stringify(availabilityForm) });
            setAvailabilityForm({ staff_id: "", date: "", start_time: "", end_time: "", is_available: 1, note: "" });
            await loadAvailability();
            pushToast("ok", "Availability saved.");
          } }, "Add block")
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Blocks"),
          h("div", { className: "bp-list" },
            availability.map((b) => h("div", { key: b.id, className: "bp-item" },
              h("div", { className: "bp-item-body" },
                h("div", { className: "bp-item-title" }, `${b.date} ${b.start_time} - ${b.end_time}`),
                h("div", { className: "bp-item-sub" }, `${b.is_available ? "Available" : "Unavailable"} ${b.note || ""}`)
              ),
              h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => {
                await bpFetch(`/bookpoint/v1/availability/${b.id}`, { method: "DELETE" });
                await loadAvailability();
              } }, "Delete")
            ))
          )
        )
      );
    }

    function ExtrasPage() {
      const current = extraForm || { service_id: extraServiceId || "", name: "", price: 0, duration: 0, image_url: "", is_active: 1 };

      return h("div", { className: "bp-grid" },
        h("div", { className: "bp-left" },
          h("div", { className: "bp-card bp-sticky" },
            h("div", { className: "bp-headrow" },
              h("div", null,
                h("h2", { className: "bp-h2" }, "Service Extras"),
                h("div", { className: "bp-muted" }, "Add extras for services.")
              ),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadExtras() }, "Refresh"),
                h("button", { className: "bp-btn", onClick: () => { setExtraId(null); setExtraForm({}); } }, "+ New")
              )
            ),
            h("div", { className: "bp-section" },
              h("label", { className: "bp-label" }, "Filter by service"),
              h("select", { className: "bp-input", value: extraServiceId || "", onChange: (e) => { setExtraServiceId(e.target.value); markDirty("extras_filter"); } },
                h("option", { value: "" }, "All services"),
                services.map((s) => h("option", { key: s.id, value: s.id }, s.name))
              ),
              h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadExtras() }, "Apply")
            )
          ),
          h("div", { className: "bp-list" },
            extras.map((x) => h("div", { className: "bp-click", key: x.id, onClick: () => setExtraId(x.id) },
              h("div", { className: `bp-item ${String(x.id) === String(extraId) ? "is-active" : ""}` },
                h("img", { className: "bp-item-thumb", src: x.image_url || imgFallback("service"), alt: "" }),
                h("div", { className: "bp-item-body" },
                  h("div", { className: "bp-item-title" }, x.name || "Untitled"),
                  h("div", { className: "bp-item-sub" }, `+${formatPrice(x.price, currency)} | +${x.duration}m`)
                )
              )
            ))
          )
        ),
        h("div", { className: "bp-right" },
          h("div", { className: "bp-card" },
            h("div", { className: "bp-headrow" },
              h("h2", { className: "bp-h2" }, current.id ? "Edit Extra" : "New Extra"),
              h("div", { className: "bp-actions" },
                current.id ? h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => {
                  if (!confirm("Delete this extra?")) return;
                  await bpFetch(`/bookpoint/v1/extras/${current.id}`, { method: "DELETE" });
                  await loadExtras();
                  setExtraId(null);
                } }, "Delete") : null,
                h(SaveButton, { section: "extras", onSave: async () => {
                  const payload = { ...current };
                  if (current.id) {
                    await bpFetch(`/bookpoint/v1/extras/${current.id}`, { method: "PUT", body: JSON.stringify(payload) });
                  } else {
                    const res = await bpFetch("/bookpoint/v1/extras", { method: "POST", body: JSON.stringify(payload) });
                    setExtraId(res.id);
                  }
                  await loadExtras();
                } })
              )
            ),
            h("div", { className: "bp-section" },
              h("label", { className: "bp-label" }, "Service"),
              h("select", { className: "bp-input", value: current.service_id || "", onChange: (e) => { setExtraForm({ ...current, service_id: Number(e.target.value) }); markDirty("extras"); } },
                h("option", { value: "" }, "Select service"),
                services.map((s) => h("option", { key: s.id, value: s.id }, s.name))
              ),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Name"), h("input", { className: "bp-input", value: current.name || "", onChange: (e) => { setExtraForm({ ...current, name: e.target.value }); markDirty("extras"); } })),
                h("div", null, h("label", { className: "bp-label" }, "Active"), h("select", { className: "bp-input", value: current.is_active ?? 1, onChange: (e) => { setExtraForm({ ...current, is_active: Number(e.target.value) }); markDirty("extras"); } },
                  h("option", { value: 1 }, "Active"),
                  h("option", { value: 0 }, "Inactive")
                ))
              ),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Price"), h("input", { className: "bp-input", type: "number", value: current.price, onChange: (e) => { setExtraForm({ ...current, price: e.target.value }); markDirty("extras"); } })),
                h("div", null, h("label", { className: "bp-label" }, "Extra duration (min)"), h("input", { className: "bp-input", type: "number", value: current.duration, onChange: (e) => { setExtraForm({ ...current, duration: Number(e.target.value) }); markDirty("extras"); } }))
              ),
              h("label", { className: "bp-label" }, "Image URL"),
              h("input", { className: "bp-input", value: current.image_url || "", onChange: (e) => { setExtraForm({ ...current, image_url: e.target.value }); markDirty("extras"); } }),
              h("div", { className: "bp-imgbox" },
                h("img", { className: "bp-imgthumb", src: current.image_url || imgFallback("service"), alt: "" }),
                h("div", null,
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => pickMedia((att) => { setExtraForm({ ...current, image_url: att.url || "" }); markDirty("extras"); }) }, "Choose image"),
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => { setExtraForm({ ...current, image_url: "" }); markDirty("extras"); } }, "Remove")
                )
              )
            )
          )
        )
      );
    }

    function AppointmentsPage() {
      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Appointments"),
            h("div", { className: "bp-muted" }, "Recent bookings and status updates.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadBookings() }, "Refresh")
          )
        ),
        h("div", { className: "bp-tablewrap" },
          h("table", { className: "bp-table" },
            h("thead", null,
              h("tr", null,
                h("th", null, "Code"),
                h("th", null, "Service"),
                h("th", null, "Staff"),
                h("th", null, "Date"),
                h("th", null, "Time"),
                h("th", null, "Customer"),
                h("th", null, "Status"),
                h("th", null, "Actions")
              )
            ),
            h("tbody", null,
              bookings.map((b) => {
                let customer = {};
                if (b.customer_json) {
                  try { customer = JSON.parse(b.customer_json); } catch (e) { customer = {}; }
                }
                const serviceName = services.find((s) => s.id === b.service_id)?.name || "";
                const staffName = staff.find((s) => s.id === b.staff_id)?.name || "";
                return h("tr", { key: b.id },
                  h("td", null, b.booking_code),
                  h("td", null, serviceName),
                  h("td", null, staffName),
                  h("td", null, b.booking_date),
                  h("td", null, `${b.start_time} - ${b.end_time}`),
                  h("td", null, `${customer.first_name || ""} ${customer.last_name || ""}`.trim()),
                  h("td", null, h("span", { className: "bp-badge" }, b.status)),
                  h("td", null,
                    h("select", { className: "bp-input", value: b.status, onChange: async (e) => {
                      const next = e.target.value;
                      await bpFetch(`/bookpoint/v1/bookings/${b.id}`, { method: "PUT", body: JSON.stringify({ status: next }) });
                      await loadBookings();
                    } },
                      h("option", { value: "pending" }, "Pending"),
                      h("option", { value: "approved" }, "Approved"),
                      h("option", { value: "cancelled" }, "Cancelled")
                    )
                  )
                );
              })
            )
          )
        )
      );
    }

    function WorkspacePage() {
      const cur = currency || {};
      const dt = datetime || {};
      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Workspace"),
            h("div", { className: "bp-muted" }, "General settings and currency.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadWorkspace() }, "Refresh"),
            h(SaveButton, { section: "workspace", onSave: async () => {
              await bpFetch("/bookpoint/v1/settings/workspace", { method: "POST", body: JSON.stringify(workspace) });
              await bpFetch("/bookpoint/v1/settings/currency", { method: "POST", body: JSON.stringify(cur) });
              await bpFetch("/bookpoint/v1/settings/datetime", { method: "POST", body: JSON.stringify(dt) });
              await loadWorkspace();
            } })
          )
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Business"),
          h("div", { className: "bp-grid2" },
            h("div", null, h("label", { className: "bp-label" }, "Business name"), h("input", { className: "bp-input", value: workspace.business_name || "", onChange: (e) => { setWorkspace({ ...workspace, business_name: e.target.value }); markDirty("workspace"); } })),
            h("div", null, h("label", { className: "bp-label" }, "Support email"), h("input", { className: "bp-input", value: workspace.support_email || "", onChange: (e) => { setWorkspace({ ...workspace, support_email: e.target.value }); markDirty("workspace"); } }))
          )
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Currency & Price"),
          h("div", { className: "bp-grid3" },
            h("div", null, h("label", { className: "bp-label" }, "Symbol before price"), h("input", { className: "bp-input", value: cur.symbol_before || "", onChange: (e) => { setCurrency({ ...cur, symbol_before: e.target.value }); markDirty("workspace"); } })),
            h("div", null, h("label", { className: "bp-label" }, "Symbol after price"), h("input", { className: "bp-input", value: cur.symbol_after || "", onChange: (e) => { setCurrency({ ...cur, symbol_after: e.target.value }); markDirty("workspace"); } })),
            h("div", null, h("label", { className: "bp-label" }, "Position"), h("select", { className: "bp-input", value: cur.position || "after", onChange: (e) => { setCurrency({ ...cur, position: e.target.value }); markDirty("workspace"); } },
              h("option", { value: "before" }, "Before"),
              h("option", { value: "after" }, "After")
            ))
          ),
          h("div", { className: "bp-grid3" },
            h("div", null, h("label", { className: "bp-label" }, "Decimals"), h("input", { className: "bp-input", type: "number", value: cur.decimals ?? 2, onChange: (e) => { setCurrency({ ...cur, decimals: Number(e.target.value) }); markDirty("workspace"); } })),
            h("div", null, h("label", { className: "bp-label" }, "Decimal separator"), h("input", { className: "bp-input", value: cur.decimal_separator || ".", onChange: (e) => { setCurrency({ ...cur, decimal_separator: e.target.value }); markDirty("workspace"); } })),
            h("div", null, h("label", { className: "bp-label" }, "Thousand separator"), h("input", { className: "bp-input", value: cur.thousand_separator || ",", onChange: (e) => { setCurrency({ ...cur, thousand_separator: e.target.value }); markDirty("workspace"); } }))
          )
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Date & Time"),
          h("div", { className: "bp-grid3" },
            h("div", null, h("label", { className: "bp-label" }, "Date format"), h("input", { className: "bp-input", value: dt.date_format || "Y-m-d", onChange: (e) => { setDatetime({ ...dt, date_format: e.target.value }); markDirty("workspace"); } })),
            h("div", null, h("label", { className: "bp-label" }, "Time format"), h("select", { className: "bp-input", value: dt.time_format || "24", onChange: (e) => { setDatetime({ ...dt, time_format: e.target.value }); markDirty("workspace"); } },
              h("option", { value: "24" }, "24 hour"),
              h("option", { value: "12" }, "12 hour")
            )),
            h("div", null, h("label", { className: "bp-label" }, "Slot interval (min)"), h("input", { className: "bp-input", type: "number", value: dt.slot_interval ?? 30, onChange: (e) => { setDatetime({ ...dt, slot_interval: Number(e.target.value) }); markDirty("workspace"); } }))
          )
        )
      );
    }

    function FormFieldsPage() {
      const defaults = formFields.defaults || [];
      const customs = formFields.customs || [];

      function updateDefault(idx, patch) {
        const next = defaults.map((f, i) => i === idx ? { ...f, ...patch } : f);
        setFormFields({ ...formFields, defaults: next });
        markDirty("form_fields");
      }

      function updateCustom(idx, patch) {
        const next = customs.map((f, i) => i === idx ? { ...f, ...patch } : f);
        setFormFields({ ...formFields, customs: next });
        markDirty("form_fields");
      }

      function addCustomField() {
        const label = "New field";
        const existing = customs.map((f) => f.field_key || f.key);
        const key = generateFieldKey(label, existing);
        const next = [...customs, { field_key: key, label, placeholder: "", type: "text", required: false, enabled: true, width: "full", options: [] }];
        setFormFields({ ...formFields, customs: next });
        markDirty("form_fields");
        setFieldTab("customs");
      }

      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Form Fields"),
            h("div", { className: "bp-muted" }, "Manage default and custom fields.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadFormFields() }, "Refresh"),
            h(SaveButton, { section: "form_fields", onSave: async () => {
              await bpFetch("/bookpoint/v1/settings/form_fields", { method: "POST", body: JSON.stringify(formFields) });
              await loadFormFields();
            } })
          )
        ),
        h("div", { className: "bp-tabs" },
          h("button", { className: `bp-tab ${fieldTab === "defaults" ? "is-active" : ""}`, onClick: () => setFieldTab("defaults") }, "Default Fields"),
          h("button", { className: `bp-tab ${fieldTab === "customs" ? "is-active" : ""}`, onClick: () => setFieldTab("customs") }, "Custom Fields")
        ),
        fieldTab === "defaults" ? h("div", { className: "bp-field-list" },
          defaults.map((field, idx) => h("div", { key: field.field_key, className: "bp-field-row" },
            h("div", { className: "bp-field-cell--key" },
              h("div", { className: "bp-field-label" }, "Key"),
              h("strong", null, field.field_key)
            ),
            h("div", null, h("div", { className: "bp-field-label" }, "Label"), h("input", { className: "bp-input", value: field.label || "", onChange: (e) => updateDefault(idx, { label: e.target.value }) })),
            h("div", null, h("div", { className: "bp-field-label" }, "Placeholder"), h("input", { className: "bp-input", value: field.placeholder || "", onChange: (e) => updateDefault(idx, { placeholder: e.target.value }) })),
            h("div", null, h("div", { className: "bp-field-label" }, "Type"), h("select", { className: "bp-input", value: field.type || "text", onChange: (e) => updateDefault(idx, { type: e.target.value }) },
              h("option", { value: "text" }, "Text"),
              h("option", { value: "email" }, "Email"),
              h("option", { value: "tel" }, "Phone"),
              h("option", { value: "textarea" }, "Textarea")
            )),
            h("div", null, h("div", { className: "bp-field-label" }, "Required"), h("select", { className: "bp-input", value: field.required ? "1" : "0", onChange: (e) => updateDefault(idx, { required: e.target.value === "1" }) },
              h("option", { value: "1" }, "Yes"),
              h("option", { value: "0" }, "No")
            )),
            h("div", null, h("div", { className: "bp-field-label" }, "Enabled"), h("select", { className: "bp-input", value: field.enabled ? "1" : "0", onChange: (e) => updateDefault(idx, { enabled: e.target.value === "1" }) },
              h("option", { value: "1" }, "Yes"),
              h("option", { value: "0" }, "No")
            )),
            h("div", null, h("div", { className: "bp-field-label" }, "Width"), h("select", { className: "bp-input", value: field.width || "full", onChange: (e) => updateDefault(idx, { width: e.target.value }) },
              h("option", { value: "full" }, "Full"),
              h("option", { value: "half" }, "Half")
            ))
          ))
        ) : h("div", null,
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn", onClick: addCustomField }, "Add custom field")
          ),
          h("div", { className: "bp-field-list" },
            customs.map((field, idx) => h("div", { key: field.field_key, className: "bp-field-row" },
              h("div", { className: "bp-field-cell--key" },
                h("div", { className: "bp-field-label" }, "Key"),
                h("strong", null, field.field_key)
              ),
              h("div", null, h("div", { className: "bp-field-label" }, "Label"), h("input", { className: "bp-input", value: field.label || "", onChange: (e) => updateCustom(idx, { label: e.target.value }) })),
              h("div", null, h("div", { className: "bp-field-label" }, "Placeholder"), h("input", { className: "bp-input", value: field.placeholder || "", onChange: (e) => updateCustom(idx, { placeholder: e.target.value }) })),
              h("div", null, h("div", { className: "bp-field-label" }, "Type"), h("select", { className: "bp-input", value: field.type || "text", onChange: (e) => updateCustom(idx, { type: e.target.value }) },
                h("option", { value: "text" }, "Text"),
                h("option", { value: "textarea" }, "Textarea"),
                h("option", { value: "select" }, "Select"),
                h("option", { value: "checkbox" }, "Checkbox"),
                h("option", { value: "radio" }, "Radio"),
                h("option", { value: "date" }, "Date")
              )),
              h("div", null, h("div", { className: "bp-field-label" }, "Required"), h("select", { className: "bp-input", value: field.required ? "1" : "0", onChange: (e) => updateCustom(idx, { required: e.target.value === "1" }) },
                h("option", { value: "1" }, "Yes"),
                h("option", { value: "0" }, "No")
              )),
              h("div", null, h("div", { className: "bp-field-label" }, "Enabled"), h("select", { className: "bp-input", value: field.enabled ? "1" : "0", onChange: (e) => updateCustom(idx, { enabled: e.target.value === "1" }) },
                h("option", { value: "1" }, "Yes"),
                h("option", { value: "0" }, "No")
              )),
              h("div", null, h("div", { className: "bp-field-label" }, "Width"), h("select", { className: "bp-input", value: field.width || "full", onChange: (e) => updateCustom(idx, { width: e.target.value }) },
                h("option", { value: "full" }, "Full"),
                h("option", { value: "half" }, "Half")
              )),
              h("div", null,
                h("div", { className: "bp-field-label" }, "Options"),
                h("input", { className: "bp-input", value: Array.isArray(field.options) ? field.options.join(", ") : "", onChange: (e) => updateCustom(idx, { options: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }) })
              ),
              h("div", null,
                h("div", { className: "bp-field-label" }, "Delete"),
                h("button", { className: "bp-btn bp-btn--ghost", onClick: () => {
                  const next = customs.filter((_, i) => i !== idx);
                  setFormFields({ ...formFields, customs: next });
                  markDirty("form_fields");
                } }, "Remove")
              )
            ))
          )
        )
      );
    }

    function EmailSettingsPage() {
      const current = emailSettings || {};
      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Email Settings"),
            h("div", { className: "bp-muted" }, "Configure email sender and admin notifications.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadEmailSettings() }, "Refresh"),
            h(SaveButton, { section: "email_settings", onSave: async () => {
              await bpFetch("/bookpoint/v1/settings/email", { method: "POST", body: JSON.stringify(current) });
              await loadEmailSettings();
            } })
          )
        ),
        h("div", { className: "bp-section" },
          h("div", { className: "bp-grid2" },
            h("div", null, h("label", { className: "bp-label" }, "Enable emails"), h("select", { className: "bp-input", value: current.enabled ? "1" : "0", onChange: (e) => { setEmailSettings({ ...current, enabled: e.target.value === "1" }); markDirty("email_settings"); } },
              h("option", { value: "1" }, "Enabled"),
              h("option", { value: "0" }, "Disabled")
            )),
            h("div", null, h("label", { className: "bp-label" }, "Admin recipient email"), h("input", { className: "bp-input", value: current.admin_recipient_email || "", onChange: (e) => { setEmailSettings({ ...current, admin_recipient_email: e.target.value }); markDirty("email_settings"); } }))
          ),
          h("div", { className: "bp-grid2" },
            h("div", null, h("label", { className: "bp-label" }, "From name"), h("input", { className: "bp-input", value: current.from_name || "", onChange: (e) => { setEmailSettings({ ...current, from_name: e.target.value }); markDirty("email_settings"); } })),
            h("div", null, h("label", { className: "bp-label" }, "From email"), h("input", { className: "bp-input", value: current.from_email || "", onChange: (e) => { setEmailSettings({ ...current, from_email: e.target.value }); markDirty("email_settings"); } }))
          ),
          h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => {
            try {
              await bpFetch("/bookpoint/v1/email/test", { method: "POST", body: JSON.stringify({}) });
              pushToast("ok", "Test email sent.");
            } catch (e) {
              pushToast("bad", e.message || "Test failed");
            }
          } }, "Send test email")
        )
      );
    }

    function EmailRulesPage() {
      const rules = emailRules || [];
      const current = rules.find((r) => r.id === ruleId) || rules[0] || null;

      function updateCurrent(patch) {
        const next = rules.map((r) => r.id === current.id ? { ...r, ...patch } : r);
        setEmailRules(next);
        markDirty("email_rules");
      }

      function addRule() {
        const id = `rule_${Date.now()}`;
        const next = [...rules, { id, enabled: true, name: "New rule", event: "booking_created", recipient: "customer", subject: "New booking", body: "" }];
        setEmailRules(next);
        setRuleId(id);
        markDirty("email_rules");
      }

      const customTokens = (formFields.customs || []).map((f) => `{{${f.field_key || f.key}}}`);
      const tokens = [
        "{{booking_id}}",
        "{{booking_code}}",
        "{{booking_status}}",
        "{{start_date}}",
        "{{start_time}}",
        "{{end_time}}",
        "{{total}}",
        "{{service_name}}",
        "{{service_duration}}",
        "{{service_price}}",
        "{{staff_name}}",
        "{{staff_title}}",
        "{{customer_first_name}}",
        "{{customer_last_name}}",
        "{{customer_email}}",
        "{{customer_phone}}",
        "{{customer_comments}}"
      ].concat(customTokens);

      function insertToken(token) {
        if (!focusedField.current || !current) return;
        const { field } = focusedField.current;
        if (field === "subject") updateCurrent({ subject: (current.subject || "") + token });
        if (field === "body") updateCurrent({ body: (current.body || "") + token });
        setShowTokenPicker(false);
      }

      return h("div", { className: "bp-grid" },
        h("div", { className: "bp-left" },
          h("div", { className: "bp-card bp-sticky" },
            h("div", { className: "bp-headrow" },
              h("div", null,
                h("h2", { className: "bp-h2" }, "Email Automation"),
                h("div", { className: "bp-muted" }, "Send emails on booking events.")
              ),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: () => loadEmailRules() }, "Refresh"),
                h("button", { className: "bp-btn", onClick: addRule }, "+ New"),
                h(SaveButton, { section: "email_rules", onSave: async () => {
                  await bpFetch("/bookpoint/v1/settings/email_rules", { method: "POST", body: JSON.stringify(rules) });
                  await loadEmailRules();
                } })
              )
            ),
            h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => {
              try {
                await bpFetch("/bookpoint/v1/automation/test", { method: "POST", body: JSON.stringify({}) });
                pushToast("ok", "Automation test sent.");
              } catch (e) {
                pushToast("bad", e.message || "Test failed");
              }
            } }, "Run automation test")
          ),
          h("div", { className: "bp-list" },
            rules.map((r) => h("div", { className: "bp-click", key: r.id, onClick: () => setRuleId(r.id) },
              h("div", { className: `bp-item ${String(r.id) === String(current?.id) ? "is-active" : ""}` },
                h("div", { className: "bp-item-body" },
                  h("div", { className: "bp-item-title" }, r.name || "Rule"),
                  h("div", { className: "bp-item-sub" }, r.event || "")
                )
              )
            ))
          )
        ),
        h("div", { className: "bp-right" },
          current ? h("div", { className: "bp-card" },
            h("div", { className: "bp-headrow" },
              h("h2", { className: "bp-h2" }, current.name || "Rule"),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: () => {
                  const next = rules.filter((r) => r.id !== current.id);
                  setEmailRules(next);
                  setRuleId(next[0]?.id || null);
                  markDirty("email_rules");
                } }, "Delete")
              )
            ),
            h("div", { className: "bp-section" },
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Enabled"), h("select", { className: "bp-input", value: current.enabled ? "1" : "0", onChange: (e) => updateCurrent({ enabled: e.target.value === "1" }) },
                  h("option", { value: "1" }, "Enabled"),
                  h("option", { value: "0" }, "Disabled")
                )),
                h("div", null, h("label", { className: "bp-label" }, "Name"), h("input", { className: "bp-input", value: current.name || "", onChange: (e) => updateCurrent({ name: e.target.value }) }))
              ),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Event"), h("select", { className: "bp-input", value: current.event || "booking_created", onChange: (e) => updateCurrent({ event: e.target.value }) },
                  h("option", { value: "booking_created" }, "booking_created"),
                  h("option", { value: "booking_approved" }, "booking_approved"),
                  h("option", { value: "booking_cancelled" }, "booking_cancelled")
                )),
                h("div", null, h("label", { className: "bp-label" }, "Recipient"), h("select", { className: "bp-input", value: current.recipient || "customer", onChange: (e) => updateCurrent({ recipient: e.target.value }) },
                  h("option", { value: "customer" }, "Customer"),
                  h("option", { value: "admin" }, "Admin"),
                  h("option", { value: "staff" }, "Staff")
                ))
              ),
              h("label", { className: "bp-label" }, "Subject"),
              h("input", { className: "bp-input", value: current.subject || "", onChange: (e) => updateCurrent({ subject: e.target.value }), onFocus: () => { focusedField.current = { field: "subject" }; } }),
              h("label", { className: "bp-label" }, "Body"),
              h("textarea", { className: "bp-textarea", value: current.body || "", onChange: (e) => updateCurrent({ body: e.target.value }), onFocus: () => { focusedField.current = { field: "body" }; } }),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: () => setShowTokenPicker(true) }, "Insert variable")
              )
            )
          ) : h("div", { className: "bp-card" }, h("div", null, "Select a rule"))
        ),
        showTokenPicker ? h("div", { className: "bp-modal" },
          h("div", { className: "bp-modal__panel" },
            h("div", { className: "bp-headrow" },
              h("h3", { className: "bp-h3" }, "Smart Variables"),
              h("button", { className: "bp-btn bp-btn--ghost", onClick: () => setShowTokenPicker(false) }, "Close")
            ),
            h("div", { className: "bp-list" },
              tokens.map((t) => h("button", { key: t, className: "bp-btn bp-btn--ghost", onClick: () => insertToken(t) }, t))
            )
          )
        ) : null
      );
    }

    let content = null;
    if (page === "services") content = h(ServicesPage);
    if (page === "staff") content = h(StaffPage);
    if (page === "availability") content = h(AvailabilityPage);
    if (page === "extras") content = h(ExtrasPage);
    if (page === "appointments") content = h(AppointmentsPage);
    if (page === "workspace") content = h(WorkspacePage);
    if (page === "form_fields") content = h(FormFieldsPage);
    if (page === "email_settings") content = h(EmailSettingsPage);
    if (page === "email_rules") content = h(EmailRulesPage);

    return h("div", { className: "bp-shell" },
      h(Sidebar),
      h("main", { className: "bp-main" },
        h("div", { className: "bp-content" }, content)
      ),
      h(Toasts)
    );
  }

  wp.element.render(h(App), root);
})();
