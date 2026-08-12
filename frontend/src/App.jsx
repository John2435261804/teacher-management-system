import { useEffect, useState } from "react";


const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const EMPTY_FORM = {
  name: "",
  email: "",
  subject: "",
  status: "active",
  phone: "",
};

const EMPTY_FILTERS = {
  search: "",
  status: "",
  subject: "",
};

const EMPTY_DASHBOARD = {
  total_teachers: 0,
  active_teachers: 0,
  inactive_teachers: 0,
  teachers_by_subject: [],
};


function getApiError(data, fallbackMessage) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((error) => error.msg.replace("Value error, ", ""))
      .join(" ");
  }

  return fallbackMessage;
}


function App() {
  const [teachers, setTeachers] = useState([]);
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  async function loadTeachers(activeFilters = filters) {
    setLoading(true);

    const parameters = new URLSearchParams();
    if (activeFilters.search.trim()) {
      parameters.set("search", activeFilters.search.trim());
    }
    if (activeFilters.status) {
      parameters.set("status", activeFilters.status);
    }
    if (activeFilters.subject) {
      parameters.set("subject", activeFilters.subject);
    }

    const queryString = parameters.toString();
    const url = `${API_URL}/teachers${queryString ? `?${queryString}` : ""}`;

    try {
      const response = await fetch(url);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getApiError(data, "Could not load teachers."));
      }

      setTeachers(data);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "Could not connect to FastAPI. Check that the backend is running."
            : error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);

    try {
      const response = await fetch(`${API_URL}/dashboard`);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getApiError(data, "Could not load dashboard."));
      }

      setDashboard(data);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "Could not connect to FastAPI. Check that the backend is running."
            : error.message,
      });
    } finally {
      setDashboardLoading(false);
    }
  }

  async function refreshData() {
    await Promise.all([loadTeachers(), loadDashboard()]);
  }

  useEffect(() => {
    loadTeachers(EMPTY_FILTERS);
    loadDashboard();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    setFeedback(null);
    await loadTeachers(filters);
  }

  async function handleClearFilters() {
    setFilters(EMPTY_FILTERS);
    setFeedback(null);
    await loadTeachers(EMPTY_FILTERS);
  }

  function handleEdit(teacher) {
    setEditingId(teacher.id);
    setForm({
      name: teacher.name,
      email: teacher.email,
      subject: teacher.subject,
      status: teacher.status,
      phone: teacher.phone ?? "",
    });
    setFeedback({
      type: "info",
      message: `Editing teacher "${teacher.name}".`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback({ type: "info", message: "Edit cancelled." });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const isEditing = editingId !== null;
    const url = isEditing
      ? `${API_URL}/teachers/${editingId}`
      : `${API_URL}/teachers`;
    const method = isEditing ? "PUT" : "POST";

    setFeedback({
      type: "info",
      message: isEditing ? "Updating teacher..." : "Saving teacher...",
    });

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          phone: form.phone || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            `Could not ${isEditing ? "update" : "create"} teacher.`,
          ),
        );
      }

      setEditingId(null);
      setForm(EMPTY_FORM);
      await refreshData();
      setFeedback({
        type: "success",
        message: `Teacher "${data.name}" was ${isEditing ? "updated" : "created"}.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "Could not connect to FastAPI."
            : error.message,
      });
    }
  }

  async function handleDelete(teacher) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${teacher.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setFeedback({
      type: "info",
      message: `Deleting teacher "${teacher.name}"...`,
    });

    try {
      const response = await fetch(`${API_URL}/teachers/${teacher.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getApiError(data, "Could not delete teacher."));
      }

      if (editingId === teacher.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }

      await refreshData();
      setFeedback({
        type: "success",
        message: `Teacher "${teacher.name}" was deleted.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "Could not connect to FastAPI."
            : error.message,
      });
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">FASTAPI · REACT · POSTGRESQL</p>
          <h1>Teacher Management System</h1>
          <p className="subtitle">
            Manage teacher records, search the directory, and view a simple
            staffing overview.
          </p>
        </div>
      </header>

      {feedback && (
        <div className={`feedback ${feedback.type}`} role="status">
          {feedback.message}
        </div>
      )}

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-label">Overview</p>
            <h2>Dashboard</h2>
          </div>
          {dashboardLoading && <span className="muted">Refreshing...</span>}
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Total Teachers</span>
            <strong>{dashboard.total_teachers}</strong>
          </article>
          <article className="stat-card active-stat">
            <span>Active Teachers</span>
            <strong>{dashboard.active_teachers}</strong>
          </article>
          <article className="stat-card inactive-stat">
            <span>Inactive Teachers</span>
            <strong>{dashboard.inactive_teachers}</strong>
          </article>
        </div>

        <div className="subject-summary">
          <h3>Teachers by Subject</h3>
          {dashboard.teachers_by_subject.length === 0 ? (
            <p className="muted">No subject data yet.</p>
          ) : (
            <div className="subject-list">
              {dashboard.teachers_by_subject.map((item) => (
                <div className="subject-item" key={item.subject}>
                  <span>{item.subject}</span>
                  <strong>{item.teacher_count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-label">Teacher form</p>
            <h2>{editingId === null ? "Add Teacher" : "Edit Teacher"}</h2>
          </div>
          {editingId !== null && (
            <span className="editing-badge">Editing ID {editingId}</span>
          )}
        </div>

        <form className="teacher-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              maxLength="100"
              required
            />
          </label>

          <label>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              maxLength="254"
              required
            />
          </label>

          <label>
            Subject
            <input
              name="subject"
              value={form.subject}
              onChange={handleChange}
              maxLength="100"
              required
            />
          </label>

          <label>
            Status
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label>
            Phone <span className="muted">(optional)</span>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              maxLength="30"
            />
          </label>

          <div className="form-actions full-width">
            <button className="primary-button" type="submit">
              {editingId === null ? "Add Teacher" : "Save Changes"}
            </button>

            {editingId !== null && (
              <button
                className="secondary-button"
                type="button"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-label">Directory</p>
            <h2>Teachers</h2>
          </div>
          <span className="result-count">{teachers.length} shown</span>
        </div>

        <form className="filter-form" onSubmit={handleFilterSubmit}>
          <label>
            Search name or email
            <input
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="e.g. alice"
            />
          </label>

          <label>
            Status
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label>
            Subject
            <select
              name="subject"
              value={filters.subject}
              onChange={handleFilterChange}
            >
              <option value="">All subjects</option>
              {dashboard.teachers_by_subject.map((item) => (
                <option value={item.subject} key={item.subject}>
                  {item.subject}
                </option>
              ))}
            </select>
          </label>

          <div className="filter-actions">
            <button className="primary-button" type="submit">
              Apply Filters
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={handleClearFilters}
            >
              Clear
            </button>
          </div>
        </form>

        {loading ? (
          <p className="empty-state">Loading teachers...</p>
        ) : teachers.length === 0 ? (
          <p className="empty-state">No teachers match these filters.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Phone</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="teacher-name">{teacher.name}</td>
                    <td>{teacher.email}</td>
                    <td>{teacher.subject}</td>
                    <td>
                      <span className={`status-badge ${teacher.status}`}>
                        {teacher.status}
                      </span>
                    </td>
                    <td>{teacher.phone || "—"}</td>
                    <td>
                      {new Date(teacher.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => handleEdit(teacher)}
                        >
                          Edit
                        </button>
                        <button
                          className="small-button danger-button"
                          type="button"
                          onClick={() => handleDelete(teacher)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}


export default App;
