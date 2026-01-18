
(function () {
  const root = document.getElementById("bookpoint-admin-app");
  if (!root || !window.BookPointAdmin || !window.wp || !wp.element) return;

  const cfg = window.BookPointAdmin;
  const { createElement: h, useState, useEffect } = wp.element;

  async function bpFetch(path, opts = {}) {
    const url = (cfg.restUrl || "/wp-json/") + path.replace(/^\//, "");
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    headers["X-WP-Nonce"] = cfg.nonce;
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

  function defaultFields() {
    return [
      { key: "first_name", label: "First Name", placeholder: "Jane", type: "text", required: true, enabled: true, width: "half" },
      { key: "last_name", label: "Last Name", placeholder: "Doe", type: "text", required: true, enabled: true, width: "half" },
      { key: "email", label: "Email Address", placeholder: "you@email.com", type: "email", required: true, enabled: true, width: "full" },
      { key: "phone", label: "Phone Number", placeholder: "+1 555 555 5555", type: "tel", required: true, enabled: true, width: "full" },
      { key: "comments", label: "Comments", placeholder: "Anything else?", type: "textarea", required: false, enabled: true, width: "full" }
    ];
  }

  const weekdays = [
    { key: 1, label: "Mon" },
    { key: 2, label: "Tue" },
    { key: 3, label: "Wed" },
    { key: 4, label: "Thu" },
    { key: 5, label: "Fri" },
    { key: 6, label: "Sat" },
    { key: 0, label: "Sun" }
  ];

  function defaultWeeklyHours() {
    const hours = {};
    weekdays.forEach((day) => {
      hours[day.key] = { enabled: false, start: "09:00", end: "17:00" };
    });
    return hours;
  }

  function formatPrice(amount, settings = {}) {
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

  function defaultWorkspace() {
    return {
      default_status: "pending",
      time_system: "24",
      currency_symbol_before: "",
      currency_symbol_after: "Kr",
      currency_symbol_position: "after",
      decimals: 2,
      decimal_separator: ".",
      thousand_separator: ","
    };
  }

  function App() {
    const [page, setPage] = useState("services");
    const [search, setSearch] = useState("");
    const [services, setServices] = useState([]);
    const [staff, setStaff] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [extras, setExtras] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [settings, setSettings] = useState({});
    const [formFields, setFormFields] = useState({ defaults: [], customs: [] });
    const [emailSettings, setEmailSettings] = useState({});
    const [emailRules, setEmailRules] = useState([]);

    const [serviceId, setServiceId] = useState(null);
    const [staffId, setStaffId] = useState(null);
    const [extraId, setExtraId] = useState(null);

    const [serviceForm, setServiceForm] = useState(null);
    const [staffForm, setStaffForm] = useState(null);
    const [extraForm, setExtraForm] = useState(null);
    const [availabilityForm, setAvailabilityForm] = useState({ staff_id: "", date: "", start_time: "", end_time: "", available: 1, note: "" });
    const [workspaceForm, setWorkspaceForm] = useState(defaultWorkspace());

    const [serviceDirty, setServiceDirty] = useState(false);
    const [staffDirty, setStaffDirty] = useState(false);
    const [extraDirty, setExtraDirty] = useState(false);
    const [workspaceDirty, setWorkspaceDirty] = useState(false);

    useEffect(() => {
      if (page === "services") {
        loadServices();
        loadStaff();
        loadSettings();
      }
      if (page === "staff") {
        loadStaff();
        loadServices();
        loadAvailability();
      }
      if (page === "availability") {
        loadAvailability();
        loadStaff();
      }
      if (page === "extras") {
        loadExtras();
        loadServices();
        loadSettings();
      }
      if (page === "appointments") {
        loadBookings();
        loadSettings();
      }
      if (page === "workspace" || page === "email_settings" || page === "email_rules") loadSettings();
      if (page === "form_fields") {
        loadFormFields();
      }
    }, [page]);

    useEffect(() => {
      const current = services.find((s) => String(s.id) === String(serviceId));
      if (current) {
        setServiceForm({ ...current });
        setServiceDirty(false);
      }
    }, [serviceId, services]);

    useEffect(() => {
      const current = staff.find((s) => String(s.id) === String(staffId));
      if (current) {
        setStaffForm({
          ...current,
          days_off_json: current.days_off_json || [],
          services_json: current.services_json || []
        });
        setStaffDirty(false);
      }
    }, [staffId, staff]);

    useEffect(() => {
      const current = extras.find((x) => String(x.id) === String(extraId));
      if (current) {
        setExtraForm({ ...current });
        setExtraDirty(false);
      }
    }, [extraId, extras]);

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
      const res = await bpFetch("/bookpoint/v1/availability");
      setAvailability(res || []);
    }

    async function loadExtras() {
      const res = await bpFetch("/bookpoint/v1/extras?include_inactive=1");
      setExtras(res || []);
      if (!extraId && res[0]) setExtraId(res[0].id);
    }

    async function loadBookings() {
      const res = await bpFetch("/bookpoint/v1/bookings");
      setBookings(res.items || []);
    }

    async function loadSettings() {
      const res = await bpFetch("/bookpoint/v1/settings");
      setSettings(res || {});
      setWorkspaceForm({ ...defaultWorkspace(), ...(res.workspace || {}) });
      setEmailSettings(res.email_settings || {});
      setEmailRules(res.email_rules || []);
    }

    async function loadFormFields() {
      const res = await bpFetch("/bookpoint/v1/form-fields");
      setFormFields(res || { defaults: [], customs: [] });
    }

    function filtered(items) {
      if (!search) return items;
      return items.filter((x) => JSON.stringify(x).toLowerCase().includes(search.toLowerCase()));
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
          navButton("email_rules", "Email Automations")
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

    function Topbar() {
      return h("header", { className: "bp-topbar" },
        h("input", {
          className: "bp-search",
          placeholder: cfg.placeholder || "Search",
          value: search,
          onChange: (e) => setSearch(e.target.value)
        }),
        h("div", { className: "bp-user" }, "Admin")
      );
    }
    function ServicePage() {
      const list = filtered(services);
      const current = serviceForm || {
        id: null,
        name: "",
        duration: 60,
        price: "0",
        image_url: "",
        buffer_before: 0,
        buffer_after: 0,
        capacity_min: 1,
        capacity_max: 1,
        active: 1
      };


      return h("div", { className: "bp-grid" },
        h("div", { className: "bp-left" },
          h("div", { className: "bp-card bp-sticky" },
            h("div", { className: "bp-headrow" },
              h("div", null,
                h("h2", { className: "bp-h2" }, "Services"),
                h("div", { className: "bp-muted" }, "Define durations, buffers, capacity, and staff.")
              ),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await loadServices(); await loadStaff(); } }, "Refresh"),
                h("button", { className: "bp-btn", onClick: () => { setServiceId(null); setServiceForm(null); setServiceDirty(false); } }, "+ New")
              )
            )
          ),
          h("div", { className: "bp-list" },
            list.map((s) => h("div", { className: "bp-click", key: s.id, onClick: () => setServiceId(s.id) },
              h("div", { className: `bp-item ${String(s.id) === String(serviceId) ? "is-active" : ""}` },
                h("img", { className: "bp-item-thumb", src: s.image_url || imgFallback("service"), alt: "" }),
                  h("div", { className: "bp-item-body" },
                    h("div", { className: "bp-item-title" }, s.name),
                    h("div", { className: "bp-item-sub" }, `Duration: ${s.duration}m | ${formatPrice(s.price, workspaceForm)}`)
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
                } }, "Delete") : null,
                h("button", { className: "bp-btn", disabled: !serviceDirty && current.id, onClick: async () => {
                  const payload = { ...current };
                  if (current.id) {
                    await bpFetch(`/bookpoint/v1/services/${current.id}`, { method: "PUT", body: JSON.stringify(payload) });
                  } else {
                    const res = await bpFetch("/bookpoint/v1/services", { method: "POST", body: JSON.stringify(payload) });
                    setServiceId(res.id);
                  }
                  await loadServices();
                  setServiceDirty(false);
                } }, "Save Changes")
              )
            ),
            h("div", { className: "bp-section" },
              h("div", { className: "bp-grid3" },
                h("div", null, h("label", { className: "bp-label" }, "Service name"), h("input", { className: "bp-input", value: current.name, onChange: (e) => { setServiceForm({ ...current, name: e.target.value }); setServiceDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Duration (minutes)"), h("input", { className: "bp-input", type: "number", value: current.duration, onChange: (e) => { setServiceForm({ ...current, duration: Number(e.target.value) }); setServiceDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Price"), h("input", { className: "bp-input", type: "number", value: current.price, onChange: (e) => { setServiceForm({ ...current, price: e.target.value }); setServiceDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Active"), h("select", { className: "bp-input", value: current.active, onChange: (e) => { setServiceForm({ ...current, active: Number(e.target.value) }); setServiceDirty(true); } },
                  h("option", { value: 1 }, "Active"),
                  h("option", { value: 0 }, "Inactive")
                ))
              ),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Buffer before (min)"), h("input", { className: "bp-input", type: "number", value: current.buffer_before, onChange: (e) => { setServiceForm({ ...current, buffer_before: Number(e.target.value) }); setServiceDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Buffer after (min)"), h("input", { className: "bp-input", type: "number", value: current.buffer_after, onChange: (e) => { setServiceForm({ ...current, buffer_after: Number(e.target.value) }); setServiceDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Capacity min"), h("input", { className: "bp-input", type: "number", value: current.capacity_min, onChange: (e) => { setServiceForm({ ...current, capacity_min: Number(e.target.value) }); setServiceDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Capacity max"), h("input", { className: "bp-input", type: "number", value: current.capacity_max, onChange: (e) => { setServiceForm({ ...current, capacity_max: Number(e.target.value) }); setServiceDirty(true); } }))
              ),
              h("div", { className: "bp-imgbox" },
                h("img", { className: "bp-imgthumb", src: current.image_url || imgFallback("service"), alt: "" }),
                h("div", null,
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => pickMedia((att) => { setServiceForm({ ...current, image_url: att.url || "" }); setServiceDirty(true); }) }, "Change image"),
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => { setServiceForm({ ...current, image_url: "" }); setServiceDirty(true); } }, "Remove")
                )
              )
            ),
          )
        )
      );
    }

    function StaffPage() {
      const list = filtered(staff);
      const current = staffForm || {
        id: null,
        name: "",
        title: "",
        bio: "",
        avatar_url: "",
        days_off_json: [],
        services_json: [],
        use_custom_schedule: 0,
        active: 1
      };

      const serviceChecks = services.map((sv) => h("label", { className: "bp-checkcard", key: sv.id },
        h("input", {
          type: "checkbox",
          checked: (current.services_json || []).includes(Number(sv.id)),
          onChange: (e) => {
            const next = new Set((current.services_json || []).map(Number));
            if (e.target.checked) next.add(Number(sv.id));
            else next.delete(Number(sv.id));
            setStaffForm({ ...current, services_json: Array.from(next) });
            setStaffDirty(true);
          }
        }),
        h("span", null, sv.name)
      ));

      return h("div", { className: "bp-grid" },
        h("div", { className: "bp-left" },
          h("div", { className: "bp-card bp-sticky" },
            h("div", { className: "bp-headrow" },
              h("div", null,
                h("h2", { className: "bp-h2" }, "Staff"),
                h("div", { className: "bp-muted" }, "Profiles, bios, and linked services.")
              ),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await loadStaff(); await loadServices(); await loadAvailability(); } }, "Refresh"),
                h("button", { className: "bp-btn", onClick: () => { setStaffId(null); setStaffForm(null); setStaffDirty(false); } }, "+ New")
              )
            )
          ),
          h("div", { className: "bp-list" },
            list.map((s) => h("div", { className: "bp-click", key: s.id, onClick: () => setStaffId(s.id) },
              h("div", { className: `bp-item ${String(s.id) === String(staffId) ? "is-active" : ""}` },
                h("img", { className: "bp-item-thumb", src: s.avatar_url || imgFallback("staff"), alt: "" }),
                  h("div", { className: "bp-item-body" },
                    h("div", { className: "bp-item-title" }, s.name),
                    h("div", { className: "bp-item-sub" }, `Services: ${(s.services_json || []).length}`)
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
                  if (!confirm("Delete this staff?")) return;
                  await bpFetch(`/bookpoint/v1/staff/${current.id}`, { method: "DELETE" });
                  await loadStaff();
                } }, "Delete") : null,
                h("button", { className: "bp-btn", disabled: !staffDirty && current.id, onClick: async () => {
                  const payload = { ...current };
                  if (current.id) {
                    await bpFetch(`/bookpoint/v1/staff/${current.id}`, { method: "PUT", body: JSON.stringify(payload) });
                  } else {
                    const res = await bpFetch("/bookpoint/v1/staff", { method: "POST", body: JSON.stringify(payload) });
                    setStaffId(res.id);
                  }
                  await loadStaff();
                  setStaffDirty(false);
                } }, "Save Changes")
              )
            ),
            h("div", { className: "bp-section" },
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Name"), h("input", { className: "bp-input", value: current.name, onChange: (e) => { setStaffForm({ ...current, name: e.target.value }); setStaffDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Title"), h("input", { className: "bp-input", value: current.title, onChange: (e) => { setStaffForm({ ...current, title: e.target.value }); setStaffDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Active"), h("select", { className: "bp-input", value: current.active, onChange: (e) => { setStaffForm({ ...current, active: Number(e.target.value) }); setStaffDirty(true); } },
                  h("option", { value: 1 }, "Active"),
                  h("option", { value: 0 }, "Inactive")
                )),
                h("div", null, h("label", { className: "bp-label" }, "Use custom schedule"), h("select", { className: "bp-input", value: current.use_custom_schedule, onChange: (e) => { setStaffForm({ ...current, use_custom_schedule: Number(e.target.value) }); setStaffDirty(true); } },
                  h("option", { value: 0 }, "No"),
                  h("option", { value: 1 }, "Yes")
                ))
              ),
              h("label", { className: "bp-label" }, "Bio"),
              h("textarea", { className: "bp-textarea", value: current.bio, onChange: (e) => { setStaffForm({ ...current, bio: e.target.value }); setStaffDirty(true); } }),
              h("div", { className: "bp-imgbox" },
                h("img", { className: "bp-imgthumb", src: current.avatar_url || imgFallback("staff"), alt: "" }),
                h("div", null,
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => pickMedia((att) => { setStaffForm({ ...current, avatar_url: att.url || "" }); setStaffDirty(true); }) }, "Change avatar"),
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => { setStaffForm({ ...current, avatar_url: "" }); setStaffDirty(true); } }, "Remove")
                )
              )
            ),
            h("div", { className: "bp-section" },
              h("h3", { className: "bp-h3" }, "Services offered"),
              h("div", { className: "bp-checkgrid" }, serviceChecks)
            ),
            h("div", { className: "bp-section" },
              h("h3", { className: "bp-h3" }, "Days off JSON"),
              h("div", { className: "bp-muted" }, "Store staff day/time off ranges as JSON."),
              h("textarea", {
                className: "bp-textarea",
                value: JSON.stringify(current.days_off_json || [], null, 2),
                onChange: (e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || "[]");
                    setStaffForm({ ...current, days_off_json: parsed });
                    setStaffDirty(true);
                  } catch (err) {
                    // ignore invalid JSON edits
                  }
                }
              })
            )
          )
        )
      );
    }
    function AvailabilityPage() {
      const list = filtered(availability);
      return h("div", { className: "bp-grid" },
        h("div", { className: "bp-left" },
          h("div", { className: "bp-card bp-sticky" },
            h("div", { className: "bp-headrow" },
              h("div", null,
                h("h2", { className: "bp-h2" }, "Availability"),
                h("div", { className: "bp-muted" }, "Add date-based availability blocks.")
              ),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await loadAvailability(); await loadStaff(); } }, "Refresh")
              )
            )
          ),
          h("div", { className: "bp-list" },
            list.map((a) => {
              const staffName = staff.find((s) => String(s.id) === String(a.staff_id))?.name || "Staff";
              return h("div", { className: "bp-click", key: a.id },
                h("div", { className: "bp-item" },
                  h("div", { className: "bp-item-body" },
                    h("div", { className: "bp-item-title" }, staffName),
                    h("div", { className: "bp-item-sub" }, `${a.date} ${a.start_time}-${a.end_time} (${a.available ? "Available" : "Unavailable"})`)
                  )
                ),
                h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => {
                  if (!confirm("Delete this block?")) return;
                  await bpFetch(`/bookpoint/v1/availability/${a.id}`, { method: "DELETE" });
                  await loadAvailability();
                } }, "Delete")
              );
            })
          )
        ),
        h("div", { className: "bp-right" },
          h("div", { className: "bp-card" },
            h("div", { className: "bp-headrow" },
              h("h2", { className: "bp-h2" }, "Add Availability"),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn", onClick: async () => {
                  await bpFetch("/bookpoint/v1/availability", { method: "POST", body: JSON.stringify(availabilityForm) });
                  setAvailabilityForm({ staff_id: "", date: "", start_time: "", end_time: "", available: 1, note: "" });
                  await loadAvailability();
                } }, "Save Changes")
              )
            ),
            h("div", { className: "bp-section" },
              h("div", { className: "bp-grid2" },
                h("div", null,
                  h("label", { className: "bp-label" }, "Staff"),
                  h("select", { className: "bp-input", value: availabilityForm.staff_id, onChange: (e) => setAvailabilityForm({ ...availabilityForm, staff_id: Number(e.target.value) }) },
                    h("option", { value: "" }, "Select staff"),
                    staff.map((s) => h("option", { key: s.id, value: s.id }, s.name))
                  )
                ),
                h("div", null,
                  h("label", { className: "bp-label" }, "Date"),
                  h("input", { className: "bp-input", type: "date", value: availabilityForm.date, onChange: (e) => setAvailabilityForm({ ...availabilityForm, date: e.target.value }) })
                )
              ),
              h("div", { className: "bp-grid2" },
                h("div", null,
                  h("label", { className: "bp-label" }, "Start"),
                  h("input", { className: "bp-input", type: "time", value: availabilityForm.start_time, onChange: (e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value }) })
                ),
                h("div", null,
                  h("label", { className: "bp-label" }, "End"),
                  h("input", { className: "bp-input", type: "time", value: availabilityForm.end_time, onChange: (e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value }) })
                )
              ),
              h("label", { className: "bp-label" }, "Available"),
              h("select", { className: "bp-input", value: availabilityForm.available, onChange: (e) => setAvailabilityForm({ ...availabilityForm, available: Number(e.target.value) }) },
                h("option", { value: 1 }, "Yes"),
                h("option", { value: 0 }, "No")
              ),
              h("label", { className: "bp-label" }, "Note"),
              h("textarea", { className: "bp-textarea", value: availabilityForm.note, onChange: (e) => setAvailabilityForm({ ...availabilityForm, note: e.target.value }) })
            )
          )
        )
      );
    }

    function ExtrasPage() {
      const list = filtered(extras);
      const current = extraForm || { id: null, service_id: services[0]?.id || "", name: "", price: "0", duration: 0, image_url: "", active: 1 };

      return h("div", { className: "bp-grid" },
        h("div", { className: "bp-left" },
          h("div", { className: "bp-card bp-sticky" },
            h("div", { className: "bp-headrow" },
              h("div", null,
                h("h2", { className: "bp-h2" }, "Service Extras"),
                h("div", { className: "bp-muted" }, "Optional add-ons tied to services.")
              ),
              h("div", { className: "bp-actions" },
                h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await loadExtras(); await loadServices(); } }, "Refresh"),
                h("button", { className: "bp-btn", onClick: () => { setExtraId(null); setExtraForm(null); setExtraDirty(false); } }, "+ New")
              )
            )
          ),
          h("div", { className: "bp-list" },
            list.map((eItem) => {
              const svc = services.find((s) => String(s.id) === String(eItem.service_id));
              return h("div", { className: "bp-click", key: eItem.id, onClick: () => setExtraId(eItem.id) },
                h("div", { className: `bp-item ${String(eItem.id) === String(extraId) ? "is-active" : ""}` },
                  h("img", { className: "bp-item-thumb", src: eItem.image_url || imgFallback("service"), alt: "" }),
                  h("div", { className: "bp-item-body" },
                    h("div", { className: "bp-item-title" }, eItem.name),
                    h("div", { className: "bp-item-sub" }, `${svc ? svc.name : "Service"} | ${formatPrice(eItem.price, workspaceForm)}`)
                  )
                )
              );
            })
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
                } }, "Delete") : null,
                h("button", { className: "bp-btn", disabled: !extraDirty && current.id, onClick: async () => {
                  const payload = { ...current };
                  if (current.id) {
                    await bpFetch(`/bookpoint/v1/extras/${current.id}`, { method: "PUT", body: JSON.stringify(payload) });
                  } else {
                    const res = await bpFetch("/bookpoint/v1/extras", { method: "POST", body: JSON.stringify(payload) });
                    setExtraId(res.id);
                  }
                  await loadExtras();
                  setExtraDirty(false);
                } }, "Save Changes")
              )
            ),
            h("div", { className: "bp-section" },
              h("label", { className: "bp-label" }, "Service"),
              h("select", { className: "bp-input", value: current.service_id, onChange: (e) => { setExtraForm({ ...current, service_id: Number(e.target.value) }); setExtraDirty(true); } },
                services.map((s) => h("option", { key: s.id, value: s.id }, s.name))
              ),
              h("div", { className: "bp-grid2" },
                h("div", null, h("label", { className: "bp-label" }, "Name"), h("input", { className: "bp-input", value: current.name, onChange: (e) => { setExtraForm({ ...current, name: e.target.value }); setExtraDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Price"), h("input", { className: "bp-input", type: "number", value: current.price, onChange: (e) => { setExtraForm({ ...current, price: e.target.value }); setExtraDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Duration (min)"), h("input", { className: "bp-input", type: "number", value: current.duration, onChange: (e) => { setExtraForm({ ...current, duration: Number(e.target.value) }); setExtraDirty(true); } })),
                h("div", null, h("label", { className: "bp-label" }, "Active"), h("select", { className: "bp-input", value: current.active, onChange: (e) => { setExtraForm({ ...current, active: Number(e.target.value) }); setExtraDirty(true); } },
                  h("option", { value: 1 }, "Active"),
                  h("option", { value: 0 }, "Inactive")
                ))
              ),
              h("div", { className: "bp-imgbox" },
                h("img", { className: "bp-imgthumb", src: current.image_url || imgFallback("service"), alt: "" }),
                h("div", null,
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => pickMedia((att) => { setExtraForm({ ...current, image_url: att.url || "" }); setExtraDirty(true); }) }, "Change image"),
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: () => { setExtraForm({ ...current, image_url: "" }); setExtraDirty(true); } }, "Remove")
                )
              )
            )
          )
        )
      );
    }

    function AppointmentsPage() {
      const list = filtered(bookings);
      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Appointments"),
            h("div", { className: "bp-muted" }, "Approve or cancel bookings.")
          ),
          h("button", { className: "bp-btn", onClick: () => loadBookings() }, "Refresh")
        ),
        h("div", { className: "bp-tablewrap" },
          h("table", { className: "bp-table" },
            h("thead", null,
              h("tr", null,
                ["Code", "Status", "Service", "Staff", "Date", "Start", "End", "Customer", "Email", "Phone", "Extras", "Total", "Created", "Actions"].map((th) => h("th", { key: th }, th))
              )
            ),
            h("tbody", null,
              list.length === 0 ? h("tr", null, h("td", { colSpan: 14 }, "No bookings found.")) : null,
              list.map((b) => h("tr", { key: b.id },
                h("td", null, b.booking_code),
                h("td", null, b.status),
                h("td", null, b.service_name || b.service_id),
                h("td", null, b.staff_name || b.staff_id),
                h("td", null, b.booking_date),
                h("td", null, b.start_time),
                h("td", null, b.end_time),
                h("td", null, `${b.customer_first_name || ""} ${b.customer_last_name || ""}`.trim()),
                h("td", null, b.customer_email),
                h("td", null, b.customer_phone),
                h("td", null, b.extras_json || ""),
                h("td", null, formatPrice(b.total || 0, workspaceForm)),
                h("td", null, b.created_at),
                h("td", null,
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await bpFetch(`/bookpoint/v1/bookings/${b.id}`, { method: "PUT", body: JSON.stringify({ status: "approved" }) }); loadBookings(); } }, "Approve"),
                  h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await bpFetch(`/bookpoint/v1/bookings/${b.id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }); loadBookings(); } }, "Cancel")
                )
              ))
            )
          )
        )
      );
    }
    function WorkspacePage() {
      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Workspace"),
            h("div", { className: "bp-muted" }, "Status, time system, and currency defaults.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await loadSettings(); } }, "Refresh"),
            h("button", { className: "bp-btn", disabled: !workspaceDirty, onClick: async () => {
              const payload = { ...settings, workspace: workspaceForm, email_settings: emailSettings, email_rules: emailRules };
              await bpFetch("/bookpoint/v1/settings", { method: "PUT", body: JSON.stringify(payload) });
              setWorkspaceDirty(false);
              await loadSettings();
            } }, "Save Changes")
          )
        ),
        h("div", { className: "bp-section" },
          h("div", { className: "bp-grid2" },
            h("div", null, h("label", { className: "bp-label" }, "Default status"), h("input", { className: "bp-input", value: workspaceForm.default_status, onChange: (e) => { setWorkspaceForm({ ...workspaceForm, default_status: e.target.value }); setWorkspaceDirty(true); } })),
            h("div", null, h("label", { className: "bp-label" }, "Time system"), h("select", { className: "bp-input", value: workspaceForm.time_system, onChange: (e) => { setWorkspaceForm({ ...workspaceForm, time_system: e.target.value }); setWorkspaceDirty(true); } },
              h("option", { value: "12" }, "12-hour"),
              h("option", { value: "24" }, "24-hour")
            ))
          )
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Currency & Price"),
          h("div", { className: "bp-grid2" },
            h("div", null, h("label", { className: "bp-label" }, "Symbol before price"), h("input", { className: "bp-input", value: workspaceForm.currency_symbol_before, onChange: (e) => { setWorkspaceForm({ ...workspaceForm, currency_symbol_before: e.target.value }); setWorkspaceDirty(true); } })),
            h("div", null, h("label", { className: "bp-label" }, "Symbol after price"), h("input", { className: "bp-input", value: workspaceForm.currency_symbol_after, onChange: (e) => { setWorkspaceForm({ ...workspaceForm, currency_symbol_after: e.target.value }); setWorkspaceDirty(true); } }))
          ),
          h("div", { className: "bp-grid2" },
            h("div", null, h("label", { className: "bp-label" }, "Currency symbol position"), h("select", { className: "bp-input", value: workspaceForm.currency_symbol_position, onChange: (e) => { setWorkspaceForm({ ...workspaceForm, currency_symbol_position: e.target.value }); setWorkspaceDirty(true); } },
              h("option", { value: "before" }, "Before price"),
              h("option", { value: "after" }, "After price")
            )),
            h("div", null, h("label", { className: "bp-label" }, "Decimals"), h("input", { className: "bp-input", type: "number", value: workspaceForm.decimals, onChange: (e) => { setWorkspaceForm({ ...workspaceForm, decimals: Number(e.target.value) }); setWorkspaceDirty(true); } }))
          ),
          h("div", { className: "bp-grid2" },
            h("div", null, h("label", { className: "bp-label" }, "Decimal separator"), h("input", { className: "bp-input", value: workspaceForm.decimal_separator, onChange: (e) => { setWorkspaceForm({ ...workspaceForm, decimal_separator: e.target.value }); setWorkspaceDirty(true); } })),
            h("div", null, h("label", { className: "bp-label" }, "Thousand separator"), h("input", { className: "bp-input", value: workspaceForm.thousand_separator, onChange: (e) => { setWorkspaceForm({ ...workspaceForm, thousand_separator: e.target.value }); setWorkspaceDirty(true); } }))
          )
        )
      );
    }

    function FormFieldsPage() {
      const defaults = formFields.defaults || [];
      const customs = formFields.customs || [];

      const defaultSeed = [
        { field_key: "first_name", label: "First Name", type: "text", placeholder: "Jane", required: 1, enabled: 1, sort_order: 1, is_default: 1 },
        { field_key: "last_name", label: "Last Name", type: "text", placeholder: "Doe", required: 1, enabled: 1, sort_order: 2, is_default: 1 },
        { field_key: "email", label: "Email Address", type: "email", placeholder: "you@email.com", required: 1, enabled: 1, sort_order: 3, is_default: 1 },
        { field_key: "phone", label: "Phone Number", type: "tel", placeholder: "+1 555 555 5555", required: 1, enabled: 1, sort_order: 4, is_default: 1 },
        { field_key: "note", label: "Note", type: "textarea", placeholder: "Anything else?", required: 0, enabled: 1, sort_order: 5, is_default: 1 }
      ];

      async function saveAll() {
        const all = [...defaults.map((f) => ({ ...f, is_default: 1 })), ...customs.map((f) => ({ ...f, is_default: 0 }))];
        for (const field of all) {
          const payload = {
            label: field.label,
            type: field.type,
            placeholder: field.placeholder || "",
            required: field.required ? 1 : 0,
            enabled: field.enabled ? 1 : 0,
            sort_order: Number(field.sort_order || 0),
            is_default: field.is_default ? 1 : 0
          };
          if (field.id) {
            await bpFetch(`/bookpoint/v1/form-fields/${field.id}`, { method: "PUT", body: JSON.stringify(payload) });
          } else {
            const fieldKey = field.field_key || `cf_${Math.random().toString(36).slice(2, 10)}`;
            await bpFetch("/bookpoint/v1/form-fields", { method: "POST", body: JSON.stringify({ ...payload, field_key: fieldKey }) });
          }
        }
        await loadFormFields();
      }

      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Form Fields"),
            h("div", { className: "bp-muted" }, "Default and custom customer fields.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await loadFormFields(); } }, "Refresh"),
            h("button", { className: "bp-btn", onClick: async () => { await saveAll(); } }, "Save Changes")
          )
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Default Fields"),
          defaults.length === 0 ? h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => {
            for (const seed of defaultSeed) {
              await bpFetch("/bookpoint/v1/form-fields", { method: "POST", body: JSON.stringify(seed) });
            }
            await loadFormFields();
          } }, "Seed Default Fields") : null,
          defaults.map((field, idx) => h("div", { className: "bp-field-row", key: field.id || field.field_key || idx },
            h("div", { className: "bp-field-cell bp-field-cell--key" },
              h("div", { className: "bp-item-title" }, field.label),
              h("div", { className: "bp-item-sub" }, field.field_key)
            ),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Label"), h("input", {
              className: "bp-input",
              value: field.label,
              onChange: (e) => {
                const next = [...defaults];
                next[idx] = { ...field, label: e.target.value };
                setFormFields({ defaults: next, customs });
              }
            })),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Placeholder"), h("input", {
              className: "bp-input",
              value: field.placeholder || "",
              onChange: (e) => {
                const next = [...defaults];
                next[idx] = { ...field, placeholder: e.target.value };
                setFormFields({ defaults: next, customs });
              }
            })),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Type"), h("input", {
              className: "bp-input",
              value: field.type || "text",
              onChange: (e) => {
                const next = [...defaults];
                next[idx] = { ...field, type: e.target.value };
                setFormFields({ defaults: next, customs });
              }
            })),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Required"), h("select", {
              className: "bp-input",
              value: field.required ? "1" : "0",
              onChange: (e) => {
                const next = [...defaults];
                next[idx] = { ...field, required: e.target.value === "1" };
                setFormFields({ defaults: next, customs });
              }
            }, h("option", { value: "1" }, "Yes"), h("option", { value: "0" }, "No"))),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Enabled"), h("select", {
              className: "bp-input",
              value: field.enabled ? "1" : "0",
              onChange: (e) => {
                const next = [...defaults];
                next[idx] = { ...field, enabled: e.target.value === "1" };
                setFormFields({ defaults: next, customs });
              }
            }, h("option", { value: "1" }, "Yes"), h("option", { value: "0" }, "No"))),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Sort"), h("input", {
              className: "bp-input",
              type: "number",
              value: field.sort_order || 0,
              onChange: (e) => {
                const next = [...defaults];
                next[idx] = { ...field, sort_order: Number(e.target.value) };
                setFormFields({ defaults: next, customs });
              }
            }))
          ))
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Custom Fields"),
          h("button", { className: "bp-btn bp-btn--ghost", onClick: () => {
            const newField = { field_key: `cf_${Math.random().toString(36).slice(2, 10)}`, label: "New Field", placeholder: "", type: "text", required: false, enabled: true, sort_order: customs.length + defaults.length + 1 };
            setFormFields({ defaults, customs: [newField, ...customs] });
          } }, "Add Custom Field"),
          customs.map((field, idx) => h("div", { className: "bp-field-row", key: field.id || field.field_key || idx },
            h("div", { className: "bp-field-cell bp-field-cell--key" },
              h("div", { className: "bp-item-title" }, field.label),
              h("div", { className: "bp-item-sub" }, field.field_key)
            ),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Label"), h("input", {
              className: "bp-input",
              value: field.label,
              onChange: (e) => {
                const next = [...customs];
                next[idx] = { ...field, label: e.target.value };
                setFormFields({ defaults, customs: next });
              }
            })),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Placeholder"), h("input", {
              className: "bp-input",
              value: field.placeholder || "",
              onChange: (e) => {
                const next = [...customs];
                next[idx] = { ...field, placeholder: e.target.value };
                setFormFields({ defaults, customs: next });
              }
            })),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Type"), h("input", {
              className: "bp-input",
              value: field.type || "text",
              onChange: (e) => {
                const next = [...customs];
                next[idx] = { ...field, type: e.target.value };
                setFormFields({ defaults, customs: next });
              }
            })),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Required"), h("select", {
              className: "bp-input",
              value: field.required ? "1" : "0",
              onChange: (e) => {
                const next = [...customs];
                next[idx] = { ...field, required: e.target.value === "1" };
                setFormFields({ defaults, customs: next });
              }
            }, h("option", { value: "1" }, "Yes"), h("option", { value: "0" }, "No"))),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Enabled"), h("select", {
              className: "bp-input",
              value: field.enabled ? "1" : "0",
              onChange: (e) => {
                const next = [...customs];
                next[idx] = { ...field, enabled: e.target.value === "1" };
                setFormFields({ defaults, customs: next });
              }
            }, h("option", { value: "1" }, "Yes"), h("option", { value: "0" }, "No"))),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Sort"), h("input", {
              className: "bp-input",
              type: "number",
              value: field.sort_order || 0,
              onChange: (e) => {
                const next = [...customs];
                next[idx] = { ...field, sort_order: Number(e.target.value) };
                setFormFields({ defaults, customs: next });
              }
            })),
            h("div", { className: "bp-field-cell" }, h("label", { className: "bp-field-label" }, "Delete"), h("button", {
              className: "bp-btn bp-btn--ghost",
              onClick: async () => {
                if (!field.id) {
                  const next = customs.filter((_, cidx) => cidx !== idx);
                  setFormFields({ defaults, customs: next });
                  return;
                }
                if (!confirm("Delete this field?")) return;
                await bpFetch(`/bookpoint/v1/form-fields/${field.id}`, { method: "DELETE" });
                await loadFormFields();
              }
            }, "Delete"))
          ))
        ),
        h("div", { className: "bp-section" },
          h("h3", { className: "bp-h3" }, "Smart Variables"),
          h("div", { className: "bp-muted" }, "Use these in email templates."),
          h("div", null, [
            "{{booking_code}}",
            "{{service_name}}",
            "{{staff_name}}",
            "{{start_date}}",
            "{{start_time}}",
            "{{end_time}}",
            ...customs.map((f) => `{{${f.field_key}}}`)
          ].join(" "))
        )
      );
    }

    function EmailSettingsPage() {
      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Email Settings"),
            h("div", { className: "bp-muted" }, "Sender and notification defaults.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await loadSettings(); } }, "Refresh"),
            h("button", { className: "bp-btn", onClick: async () => {
              const payload = { ...settings, email_settings: emailSettings, workspace: workspaceForm, email_rules: emailRules };
              await bpFetch("/bookpoint/v1/settings", { method: "PUT", body: JSON.stringify(payload) });
              await loadSettings();
            } }, "Save Changes")
          )
        ),
        h("div", { className: "bp-grid2" },
          h("div", null, h("label", { className: "bp-label" }, "Use WordPress Mailer"), h("select", { className: "bp-input", value: emailSettings.use_wp_mail ? "1" : "0", onChange: (e) => setEmailSettings({ ...emailSettings, use_wp_mail: e.target.value === "1" }) }, h("option", { value: "1" }, "Yes"), h("option", { value: "0" }, "No"))),
          h("div", null, h("label", { className: "bp-label" }, "From name"), h("input", { className: "bp-input", value: emailSettings.from_name || "", onChange: (e) => setEmailSettings({ ...emailSettings, from_name: e.target.value }) })),
          h("div", null, h("label", { className: "bp-label" }, "From email"), h("input", { className: "bp-input", value: emailSettings.from_email || "", onChange: (e) => setEmailSettings({ ...emailSettings, from_email: e.target.value }) })),
          h("div", null, h("label", { className: "bp-label" }, "Admin notification email"), h("input", { className: "bp-input", value: emailSettings.admin_notification_email || "", onChange: (e) => setEmailSettings({ ...emailSettings, admin_notification_email: e.target.value }) }))
        )
      );
    }

    function EmailRulesPage() {
      const rules = emailRules || [];
      return h("div", { className: "bp-card" },
        h("div", { className: "bp-headrow" },
          h("div", null,
            h("h2", { className: "bp-h2" }, "Email Automations"),
            h("div", { className: "bp-muted" }, "Trigger emails on booking events.")
          ),
          h("div", { className: "bp-actions" },
            h("button", { className: "bp-btn bp-btn--ghost", onClick: async () => { await loadSettings(); } }, "Refresh"),
            h("button", { className: "bp-btn", onClick: () => {
              const next = [{ id: `rule_${Date.now()}`, enabled: true, event: "booking_created", recipient: "customer", subject: "Booking {{booking_code}}", body: "Thanks for booking {{service_name}}." }, ...rules];
              setEmailRules(next);
            } }, "Add Rule"),
            h("button", { className: "bp-btn", onClick: async () => {
              const payload = { ...settings, email_rules: rules, workspace: workspaceForm, email_settings: emailSettings };
              await bpFetch("/bookpoint/v1/settings", { method: "PUT", body: JSON.stringify(payload) });
              await loadSettings();
            } }, "Save Changes")
          )
        ),
        rules.map((rule, idx) => h("div", { className: "bp-section", key: rule.id },
          h("div", { className: "bp-grid2" },
            h("div", null, h("label", { className: "bp-label" }, "Enabled"), h("select", { className: "bp-input", value: rule.enabled ? "1" : "0", onChange: (e) => {
              const next = [...rules];
              next[idx] = { ...rule, enabled: e.target.value === "1" };
              setEmailRules(next);
            } }, h("option", { value: "1" }, "Yes"), h("option", { value: "0" }, "No"))),
            h("div", null, h("label", { className: "bp-label" }, "Event"), h("select", { className: "bp-input", value: rule.event, onChange: (e) => {
              const next = [...rules];
              next[idx] = { ...rule, event: e.target.value };
              setEmailRules(next);
            } },
              h("option", { value: "booking_created" }, "booking_created"),
              h("option", { value: "booking_approved" }, "booking_approved"),
              h("option", { value: "booking_cancelled" }, "booking_cancelled")
            )),
            h("div", null, h("label", { className: "bp-label" }, "Recipient"), h("select", { className: "bp-input", value: rule.recipient, onChange: (e) => {
              const next = [...rules];
              next[idx] = { ...rule, recipient: e.target.value };
              setEmailRules(next);
            } },
              h("option", { value: "customer" }, "Customer"),
              h("option", { value: "admin" }, "Admin"),
              h("option", { value: "custom" }, "Custom")
            ))
          ),
          rule.recipient === "custom" ? h("div", null, h("label", { className: "bp-label" }, "Custom email"), h("input", { className: "bp-input", value: rule.custom_email || "", onChange: (e) => {
            const next = [...rules];
            next[idx] = { ...rule, custom_email: e.target.value };
            setEmailRules(next);
          } })) : null,
          h("label", { className: "bp-label" }, "Subject"),
          h("input", { className: "bp-input", value: rule.subject || "", onChange: (e) => {
            const next = [...rules];
            next[idx] = { ...rule, subject: e.target.value };
            setEmailRules(next);
          } }),
          h("label", { className: "bp-label" }, "Body"),
          h("textarea", { className: "bp-textarea", value: rule.body || "", onChange: (e) => {
            const next = [...rules];
            next[idx] = { ...rule, body: e.target.value };
            setEmailRules(next);
          } })
        ))
      );
    }

    let content = null;
    if (page === "services") content = h(ServicePage);
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
        h(Topbar),
        h("section", { className: "bp-content" },
          h("div", { className: "bp-page" }, content)
        )
      )
    );
  }

  wp.element.render(h(App), root);
})();
