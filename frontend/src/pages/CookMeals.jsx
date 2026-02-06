import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import CookNav from "../components/CookNav.jsx";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const MEAL_TYPE_LABELS = {
  breakfast: "Завтрак",
  lunch: "Обед",
};

const ISSUE_STATUS_LABELS = {
  issued: "Ожидает выдачи",
  served: "Выдано",
  confirmed: "Получено",
};

const toLowerSafe = (value) => (value || "").toString().toLowerCase();

const parseDietaryPreferences = (value) => {
  if (!value) {
    return "";
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.preferencesText === "string") {
        return parsed.preferencesText;
      }
      const parts = [];
      if (Array.isArray(parsed.preferences)) {
        parts.push(...parsed.preferences);
      }
      if (typeof parsed.notes === "string" && parsed.notes.trim()) {
        parts.push(parsed.notes.trim());
      }
      if (parts.length) {
        return parts.join(", ");
      }
    }
  } catch {
    // fallback to plain string
  }
  return value;
};

const buildFilters = () => ({
  status: "issued",
  from: "",
  to: "",
});

const buildServeForm = () => ({
  userId: "",
  menuId: "",
});

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("ru-RU");
};

export default function CookMeals() {
  const { token } = useAuth();
  const [issues, setIssues] = useState([]);
  const [menusById, setMenusById] = useState(new Map());
  const [filters, setFilters] = useState(buildFilters);
  const [serveForm, setServeForm] = useState(buildServeForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [servingIssueId, setServingIssueId] = useState(null);
  const [preferencesByUser, setPreferencesByUser] = useState({});
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [usersById, setUsersById] = useState({});
  const [usersLoading, setUsersLoading] = useState(false);
  const toast = useToast();

  const issueStats = useMemo(() => {
    return issues.reduce(
      (acc, issue) => {
        acc.total += 1;
        acc[issue.status] = (acc[issue.status] || 0) + 1;
        return acc;
      },
      { total: 0, issued: 0, served: 0, confirmed: 0 }
    );
  }, [issues]);

  const issueUserIds = useMemo(() => {
    const ids = new Set();
    issues.forEach((issue) => {
      if (issue.user_id) {
        ids.add(issue.user_id);
      }
    });
    return Array.from(ids);
  }, [issues]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const loadMenus = async () => {
      try {
        const response = await apiRequest("/menus/", { token });
        const map = new Map((response.items || []).map((menu) => [menu.id, menu]));
        setMenusById(map);
      } catch {
        setMenusById(new Map());
      }
    };
    loadMenus();
  }, [token]);

  useEffect(() => {
    if (loadError) {
      toast.error(loadError);
      setLoadError("");
    }
    if (actionError) {
      toast.error(actionError);
      setActionError("");
    }
    if (actionSuccess) {
      toast.success(actionSuccess);
      setActionSuccess("");
    }
  }, [actionError, actionSuccess, loadError, toast]);

  const loadIssues = async (nextFilters = filters) => {
    setLoading(true);
    setLoadError("");
    try {
      const query = new URLSearchParams();
      if (nextFilters.status) {
        query.set("status", nextFilters.status);
      }
      if (nextFilters.from) {
        query.set("date_from", nextFilters.from);
      }
      if (nextFilters.to) {
        query.set("date_to", nextFilters.to);
      }
      const suffix = query.toString() ? `?${query}` : "";
      const response = await apiRequest(`/meal-issues/${suffix}`, { token });
      setIssues(response.items || []);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    loadIssues(filters);
  }, [token]);

  useEffect(() => {
    if (!token || issueUserIds.length === 0) {
      return;
    }
    const missing = issueUserIds.filter((id) => !preferencesByUser[id]);
    if (!missing.length) {
      return;
    }
    setPreferencesLoading(true);
    Promise.allSettled(
      missing.map((id) => apiRequest(`/preferences/user/${id}`, { token }))
    )
      .then((results) => {
        setPreferencesByUser((prev) => {
          const next = { ...prev };
          results.forEach((result, index) => {
            const userId = missing[index];
            if (result.status === "fulfilled") {
              next[userId] = result.value;
            } else {
              next[userId] = { error: result.reason?.message || "Не удалось загрузить." };
            }
          });
          return next;
        });
      })
      .finally(() => setPreferencesLoading(false));
  }, [token, issueUserIds.join(",")]);

  useEffect(() => {
    if (!token || issueUserIds.length === 0) {
      return;
    }
    const missing = issueUserIds.filter((id) => !usersById[id]);
    if (!missing.length) {
      return;
    }
    setUsersLoading(true);
    Promise.allSettled(missing.map((id) => apiRequest(`/users/${id}`, { token })))
      .then((results) => {
        setUsersById((prev) => {
          const next = { ...prev };
          results.forEach((result, index) => {
            const userId = missing[index];
            if (result.status === "fulfilled") {
              next[userId] = result.value;
            } else {
              next[userId] = { error: result.reason?.message || "" };
            }
          });
          return next;
        });
      })
      .finally(() => setUsersLoading(false));
  }, [token, issueUserIds.join(",")]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    loadIssues(filters);
  };

  const handleServeChange = (event) => {
    const { name, value } = event.target;
    setServeForm((prev) => ({ ...prev, [name]: value }));
    if (actionError) {
      setActionError("");
    }
    if (actionSuccess) {
      setActionSuccess("");
    }
  };

  const handleServeSubmit = async (event) => {
    event.preventDefault();
    const userId = Number(serveForm.userId);
    const menuId = Number(serveForm.menuId);
    if (!userId || !menuId) {
      setActionError("Укажите ID ученика и ID меню.");
      return;
    }
    setActionError("");
    setActionSuccess("");
    setServingIssueId(`manual-${userId}-${menuId}`);
    try {
      await apiRequest("/meal-issues/serve", {
        method: "POST",
        token,
        body: { user_id: userId, menu_id: menuId },
      });
      setActionSuccess("Выдача отмечена.");
      setServeForm(buildServeForm());
      await loadIssues(filters);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setServingIssueId(null);
    }
  };

  const handleServeIssue = async (issue) => {
    if (!issue) {
      return;
    }
    setServingIssueId(issue.id);
    setActionError("");
    setActionSuccess("");
    try {
      await apiRequest("/meal-issues/serve", {
        method: "POST",
        token,
        body: { user_id: issue.user_id, menu_id: issue.menu_id },
      });
      setActionSuccess(`Выдача ученику #${issue.user_id} отмечена.`);
      await loadIssues(filters);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setServingIssueId(null);
    }
  };

  const renderIssueCard = (issue) => {
    const menu = menusById.get(issue.menu_id);
    const label = ISSUE_STATUS_LABELS[issue.status] || issue.status;
    const canServe = issue.status === "issued";
    const mealLabel = menu ? MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type : "";
    const prefs = preferencesByUser[issue.user_id];
    const userInfo = usersById[issue.user_id];
    const userName = userInfo?.full_name || userInfo?.email || "";
    const allergyNames = prefs?.allergies?.map((item) => item.name).filter(Boolean) || [];
    const dietaryText = prefs?.dietary_preferences
      ? parseDietaryPreferences(prefs.dietary_preferences)
      : "";
    const menuAllergyNames = menu
      ? (menu.menu_items || [])
          .flatMap((item) => item.dish?.allergies || [])
          .map((item) => item.name)
          .filter(Boolean)
      : [];
    const menuAllergySet = new Set(menuAllergyNames.map(toLowerSafe));
    const allergyConflicts = allergyNames.filter((name) =>
      menuAllergySet.has(toLowerSafe(name))
    );
    return (
      <article key={issue.id} className="data-card">
        <header>
          <div>
            <strong>
              {userName ? `Ученик: ${userName} (#${issue.user_id})` : `Ученик #${issue.user_id}`}
            </strong>
            <div className="form-hint">
              Меню #{issue.menu_id}
              {menu && ` · ${mealLabel} · ${formatDate(menu.menu_date)}`}
            </div>
          </div>
          <span className={`status-pill status-${issue.status}`}>{label}</span>
        </header>
        {usersLoading && !userInfo && (
          <div className="form-hint">Загружаем данные ученика...</div>
        )}
        {issue.served_by_id && (
          <div className="summary">Выдано сотрудником #{issue.served_by_id}</div>
        )}
        {preferencesLoading && !prefs && (
          <div className="form-hint">Загружаем предпочтения...</div>
        )}
        {prefs?.error && <div className="form-hint">{prefs.error}</div>}
        {!prefs?.error && (dietaryText || allergyNames.length > 0) && (
          <div className="summary">
            {dietaryText && <span>Предпочтения: {dietaryText}</span>}
            {dietaryText && allergyNames.length > 0 && <span> · </span>}
            {allergyNames.length > 0 && (
              <span>Аллергены: {allergyNames.join(", ")}</span>
            )}
          </div>
        )}
        {allergyConflicts.length > 0 && (
          <div className="form-warning" role="alert">
            Внимание: меню содержит аллергены ученика — {allergyConflicts.join(", ")}.
          </div>
        )}
        <div className="button-row">
          <button
            type="button"
            className={canServe ? "primary-button" : "secondary-button"}
            onClick={() => handleServeIssue(issue)}
            disabled={!canServe || servingIssueId === issue.id}
          >
            {servingIssueId === issue.id ? "Отмечаем..." : "Отметить выдачу"}
          </button>
        </div>
      </article>
    );
  };

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Выдача питания</h2>
        <p>
          Отмечайте выдачу завтраков и обедов. Список формируется из оплаченных
          меню и абонементов.
        </p>
      </header>

      <CookNav />

      <form className="auth-form" onSubmit={handleFilterSubmit}>
        <div className="form-group">
          <h3>Фильтры выдачи</h3>
          <div className="option-grid">
            <label className="form-field">
              Статус
              <select name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">Все</option>
                <option value="issued">Ожидает выдачи</option>
                <option value="served">Выдано</option>
                <option value="confirmed">Получено</option>
              </select>
            </label>
            <label className="form-field">
              Дата от
              <input
                type="date"
                name="from"
                value={filters.from}
                onChange={handleFilterChange}
              />
            </label>
            <label className="form-field">
              Дата до
              <input
                type="date"
                name="to"
                value={filters.to}
                onChange={handleFilterChange}
              />
            </label>
          </div>
        </div>
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Обновляем..." : "Показать"}
          </button>
        </div>
      </form>

      <div className="summary" style={{ marginTop: "1rem" }}>
        Всего: {issueStats.total}. Ожидают: {issueStats.issued}. Выдано:{" "}
        {issueStats.served}. Получено: {issueStats.confirmed}.
      </div>

      <form className="auth-form" onSubmit={handleServeSubmit}>
        <div className="form-group">
          <h3>Быстрая выдача</h3>
          <p className="form-hint">
            Введите идентификаторы ученика и меню, чтобы сразу отметить выдачу.
          </p>
          <div className="option-grid">
            <label className="form-field">
              ID ученика
              <input
                type="number"
                name="userId"
                value={serveForm.userId}
                onChange={handleServeChange}
                min="1"
                placeholder="Например: 12"
                required
              />
            </label>
            <label className="form-field">
              ID меню
              <input
                type="number"
                name="menuId"
                value={serveForm.menuId}
                onChange={handleServeChange}
                min="1"
                placeholder="Например: 34"
                required
              />
            </label>
          </div>
        </div>

<div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={Boolean(servingIssueId)}
          >
            {servingIssueId ? "Отмечаем..." : "Отметить выдачу"}
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>Список выдач</h3>
{loading ? (
          <div className="form-hint">Загружаем выдачи...</div>
        ) : (
          <div className="data-grid">
            {issues.length === 0 && (
              <div className="summary">Нет выдач по выбранным условиям.</div>
            )}
            {issues.map(renderIssueCard)}
          </div>
        )}
      </div>
    </section>
  );
}


