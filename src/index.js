import "./admin.css";
import { createRoot } from "@wordpress/element";

function apiFetch(path, options = {}) {
  return window.fetch(`${BOOKPOINT_ADMIN.restUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-WP-Nonce": BOOKPOINT_ADMIN.nonce,
      ...(options.headers || {}),
    },
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || "Request failed";
      throw new Error(msg);
    }
    return json;
  });
}

function App() {
  const [items, setItems] = wp.element.useState([]);
  const [loading, setLoading] = wp.element.useState(true);
  const [err, setErr] = wp.element.useState("");
  const [form, setForm] = wp.element.useState({
    name: "",
    duration_minutes: 60,
    price: 0,
    is_active: 1,
  });

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await apiFetch("/services");
      setItems(res.data || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  wp.element.useEffect(() => {
    load();
  }, []);

  async function createService() {
    setErr("");
    try {
      await apiFetch("/services", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", duration_minutes: 60, price: 0, is_active: 1 });
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function toggleActive(svc) {
    setErr("");
    try {
      await apiFetch(`/services/${svc.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: svc.is_active ? 0 : 1 }),
      });
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function delService(id) {
    if (!confirm("Delete this service?")) return;
    setErr("");
    try {
      await apiFetch(`/services/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="bp-card">
      <h2 style={{ marginTop: 0 }}>Services</h2>

      {err ? (
        <div style={{ padding: 10, border: "1px solid #ef4444", borderRadius: 10, marginBottom: 10 }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      <div className="bp-row">
        <input
          style={{ minWidth: 260 }}
          placeholder="Service name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="number"
          min="5"
          step="5"
          placeholder="Duration"
          value={form.duration_minutes}
          onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
        />
        <button className="bp-btn bp-btn-primary" onClick={createService}>
          Add Service
        </button>
        <button className="bp-btn" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <table className="bp-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Duration</th>
            <th>Price</th>
            <th>Status</th>
            <th style={{ width: 240 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan="6">{loading ? "Loading..." : "No services yet."}</td>
            </tr>
          ) : (
            items.map((svc) => (
              <tr key={svc.id}>
                <td>{svc.id}</td>
                <td><b>{svc.name}</b></td>
                <td>{svc.duration_minutes} min</td>
                <td>{Number(svc.price).toFixed(2)}</td>
                <td>
                  <span className="bp-badge">{svc.is_active ? "Active" : "Disabled"}</span>
                </td>
                <td>
                  <button className="bp-btn" onClick={() => toggleActive(svc)}>
                    {svc.is_active ? "Disable" : "Enable"}
                  </button>{" "}
                  <button className="bp-btn" onClick={() => delService(svc.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p style={{ marginTop: 14, color: "#6b7280" }}>
        Stage 2: Services CRUD ✅ (Next: Staff + schedules)
      </p>
    </div>
  );
}

const el = document.getElementById("bookpoint-admin-root");
if (el) createRoot(el).render(<App />);
