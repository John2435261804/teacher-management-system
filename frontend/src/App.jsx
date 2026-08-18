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
      .map((error) => {
        const message = error.msg.replace("Value error, ", "");

        if (message === "Field required") {
          return "请填写所有必填项";
        }
        if (message.startsWith("String should have at most")) {
          return "输入内容超过允许长度";
        }
        if (message.startsWith("String should have at least")) {
          return "输入内容过短";
        }

        return message;
      })
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
        throw new Error(getApiError(data, "无法加载教师列表。"));
      }

      setTeachers(data);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "无法连接 FastAPI，请确认后端服务已经启动。"
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
        throw new Error(getApiError(data, "无法加载数据看板。"));
      }

      setDashboard(data);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "无法连接 FastAPI，请确认后端服务已经启动。"
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
      message: `正在编辑教师“${teacher.name}”。`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback({ type: "info", message: "已取消编辑。" });
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
      message: isEditing ? "正在更新教师信息……" : "正在保存教师信息……",
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
            isEditing ? "无法更新教师信息。" : "无法添加教师。",
          ),
        );
      }

      setEditingId(null);
      setForm(EMPTY_FORM);
      await refreshData();
      setFeedback({
        type: "success",
        message: `教师“${data.name}”${isEditing ? "更新" : "添加"}成功。`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "无法连接 FastAPI。"
            : error.message,
      });
    }
  }

  async function handleDelete(teacher) {
    const confirmed = window.confirm(
      `确定要删除教师“${teacher.name}”吗？`,
    );

    if (!confirmed) {
      return;
    }

    setFeedback({
      type: "info",
      message: `正在删除教师“${teacher.name}”……`,
    });

    try {
      const response = await fetch(`${API_URL}/teachers/${teacher.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getApiError(data, "无法删除教师。"));
      }

      if (editingId === teacher.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }

      await refreshData();
      setFeedback({
        type: "success",
        message: `教师“${teacher.name}”删除成功。`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "无法连接 FastAPI。"
            : error.message,
      });
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">FASTAPI · REACT · POSTGRESQL</p>
          <h1>教师管理系统</h1>
          <p className="subtitle">
            管理教师档案、搜索教师名录，并查看简明的师资概览。
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
            <p className="section-label">概览</p>
            <h2>数据看板</h2>
          </div>
          {dashboardLoading && <span className="muted">刷新中……</span>}
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>教师总数</span>
            <strong>{dashboard.total_teachers}</strong>
          </article>
          <article className="stat-card active-stat">
            <span>在职教师</span>
            <strong>{dashboard.active_teachers}</strong>
          </article>
          <article className="stat-card inactive-stat">
            <span>非在职教师</span>
            <strong>{dashboard.inactive_teachers}</strong>
          </article>
        </div>

        <div className="subject-summary">
          <h3>各学科教师人数</h3>
          {dashboard.teachers_by_subject.length === 0 ? (
            <p className="muted">暂无学科数据。</p>
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
            <p className="section-label">教师信息</p>
            <h2>{editingId === null ? "添加教师" : "编辑教师"}</h2>
          </div>
          {editingId !== null && (
            <span className="editing-badge">正在编辑 ID {editingId}</span>
          )}
        </div>

        <form className="teacher-form" onSubmit={handleSubmit}>
          <label>
            姓名
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              maxLength="100"
              required
            />
          </label>

          <label>
            邮箱
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
            授课科目
            <input
              name="subject"
              value={form.subject}
              onChange={handleChange}
              maxLength="100"
              required
            />
          </label>

          <label>
            状态
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="active">在职</option>
              <option value="inactive">非在职</option>
            </select>
          </label>

          <label>
            电话 <span className="muted">（选填）</span>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              maxLength="30"
            />
          </label>

          <div className="form-actions full-width">
            <button className="primary-button" type="submit">
              {editingId === null ? "添加教师" : "保存修改"}
            </button>

            {editingId !== null && (
              <button
                className="secondary-button"
                type="button"
                onClick={handleCancelEdit}
              >
                取消
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-label">教师名录</p>
            <h2>教师列表</h2>
          </div>
          <span className="result-count">当前显示 {teachers.length} 位</span>
        </div>

        <form className="filter-form" onSubmit={handleFilterSubmit}>
          <label>
            搜索姓名或邮箱
            <input
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="例如：张老师"
            />
          </label>

          <label>
            状态
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="">全部状态</option>
              <option value="active">在职</option>
              <option value="inactive">非在职</option>
            </select>
          </label>

          <label>
            授课科目
            <select
              name="subject"
              value={filters.subject}
              onChange={handleFilterChange}
            >
              <option value="">全部学科</option>
              {dashboard.teachers_by_subject.map((item) => (
                <option value={item.subject} key={item.subject}>
                  {item.subject}
                </option>
              ))}
            </select>
          </label>

          <div className="filter-actions">
            <button className="primary-button" type="submit">
              应用筛选
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={handleClearFilters}
            >
              清除
            </button>
          </div>
        </form>

        {loading ? (
          <p className="empty-state">正在加载教师列表……</p>
        ) : teachers.length === 0 ? (
          <p className="empty-state">没有教师符合当前筛选条件。</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>邮箱</th>
                  <th>授课科目</th>
                  <th>状态</th>
                  <th>电话</th>
                  <th>创建时间</th>
                  <th>操作</th>
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
                        {teacher.status === "active" ? "在职" : "非在职"}
                      </span>
                    </td>
                    <td>{teacher.phone || "—"}</td>
                    <td>
                      {new Date(teacher.created_at).toLocaleDateString("zh-CN")}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => handleEdit(teacher)}
                        >
                          编辑
                        </button>
                        <button
                          className="small-button danger-button"
                          type="button"
                          onClick={() => handleDelete(teacher)}
                        >
                          删除
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
