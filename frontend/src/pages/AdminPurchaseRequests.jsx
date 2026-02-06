import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import AdminNav from "../components/AdminNav.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const STATUS_LABELS = {
  pending: "Ожидает решения",
  approved: "Согласована",
  rejected: "Отклонена",
};

const STATUS_OPTIONS = [
  { value: "", label: "Все" },
  { value: "pending", label: "Ожидает решения" },
  { value: "approved", label: "Согласована" },
  { value: "rejected", label: "Отклонена" },
];

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ru-RU");
};

const formatMoney = (value) => {
  if (value === null || value === undefined) {
    return "—";
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return String(value);
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatDateTimeParam = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
};

const buildQuery = ({ status, dateFrom, dateTo, requestedById }) => {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  if (dateFrom) {
    params.set("date_from", dateFrom);
  }
  if (dateTo) {
    params.set("date_to", dateTo);
  }
  if (requestedById) {
    params.set("requested_by_id", requestedById);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

const calcRequestTotal = (items) => {
  if (!Array.isArray(items)) {
    return null;
  }
  let hasPrice = false;
  const total = items.reduce((acc, item) => {
    const price = item.unit_price;
    if (price === null || price === undefined) {
      return acc;
    }
    const qty = Number(item.quantity);
    const unitPrice = Number(price);
    if (!Number.isNaN(qty) && !Number.isNaN(unitPrice)) {
      hasPrice = true;
      return acc + qty * unitPrice;
    }
    return acc;
  }, 0);
  return hasPrice ? total : null;
};

export default function AdminPurchaseRequests() {
  const { token, user } = useAuth();
  const [filters, setFilters] = useState({
    status: "pending",
    from: "",
    to: "",
    requestedById: "",
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [decidingIds, setDecidingIds] = useState({});
  const toast = useToast();

  const adminLabel = user?.full_name || user?.email;

  const loadRequests = async (nextFilters = filters) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query = buildQuery({
        status: nextFilters.status,
        dateFrom: formatDateTimeParam(nextFilters.from),
        dateTo: formatDateTimeParam(nextFilters.to),
        requestedById: nextFilters.requestedById,
      });
      const response = await apiRequest(`/purchase-requests/${query}`, { token });
      setRequests(response.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setError("");
    }
    if (decisionError) {
      toast.error(decisionError);
      setDecisionError("");
    }
  }, [decisionError, error, toast]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === "cook") {
    return <Navigate to="/cook" replace />;
  }
  if (user?.role && user.role !== "admin") {
    return <Navigate to="/student/menu" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    loadRequests();
  };

  const resetFilters = () => {
    const next = { status: "pending", from: "", to: "", requestedById: "" };
    setFilters(next);
    loadRequests(next);
  };

  const makeDecision = async (requestId, status) => {
    if (!token) {
      return;
    }
    setDecisionError("");
    setDecidingIds((prev) => ({ ...prev, [requestId]: true }));
    try {
      const updated = await apiRequest(
        `/purchase-requests/${requestId}/decision`,
        {
          method: "POST",
          token,
          body: { status },
        }
      );
      setRequests((prev) =>
        prev.map((item) => (item.id === requestId ? updated : item))
      );
    } catch (err) {
      setDecisionError(err.message);
    } finally {
      setDecidingIds((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const statusSummary = useMemo(() => {
    const statusLabel =
      STATUS_OPTIONS.find((option) => option.value === filters.status)?.label ||
      "Все";
    const parts = [statusLabel];
    if (filters.from) {
      parts.push(`с ${formatDateTime(filters.from)}`);
    }
    if (filters.to) {
      parts.push(`по ${formatDateTime(filters.to)}`);
    }
    if (filters.requestedById) {
      parts.push(`повар #${filters.requestedById}`);
    }
    return parts.join(" · ");
  }, [filters]);

  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Согласование заявок на закупки</h2>
          <p>Проверяйте заявки поваров и принимайте решения.</p>
        </div>
        <div className="summary auth-status">
          {adminLabel ? `Администратор: ${adminLabel}` : "Администратор"}
        </div>
      </header>

      <AdminNav />

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <h3>Фильтр заявок</h3>
          <div className="option-grid">
            <label className="form-field">
              Статус
              <select
                name="status"
                value={filters.status}
                onChange={handleChange}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              С
              <input
                type="datetime-local"
                name="from"
                value={filters.from}
                onChange={handleChange}
              />
            </label>
            <label className="form-field">
              По
              <input
                type="datetime-local"
                name="to"
                value={filters.to}
                onChange={handleChange}
              />
            </label>
            <label className="form-field">
              ID повара
              <input
                type="number"
                name="requestedById"
                min="1"
                value={filters.requestedById}
                onChange={handleChange}
                placeholder="Например: 3"
              />
            </label>
          </div>
        </div>

        <div className="button-row">
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Загружаем..." : "Показать"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={resetFilters}
            disabled={loading}
          >
            Сбросить
          </button>
        </div>
        <div className="summary">{statusSummary}</div>
      </form>

      {loading ? (
        <div className="form-hint">Загрузка заявок...</div>
      ) : (
        <div className="menu-grid" style={{ marginTop: "1.5rem" }}>
          {requests.length === 0 && (
            <div className="summary">Заявок по выбранным условиям нет.</div>
          )}
          {requests.map((request) => {
            const total = calcRequestTotal(request.items);
            const isPending = request.status === "pending";
            return (
              <article key={request.id} className="menu-card">
                <div className="menu-card-header">
                  <div>
                    <h3>Заявка #{request.id}</h3>
                    <p>
                      {STATUS_LABELS[request.status] || request.status} ·{" "}
                      {formatDateTime(request.requested_at)}
                    </p>
                  </div>
                  <div className="summary">
                    Повар #{request.requested_by_id}
                  </div>
                </div>

                {request.note && (
                  <div className="form-hint">Комментарий: {request.note}</div>
                )}

                <div className="menu-items">
                  {request.items.map((item) => (
                    <div key={item.id} className="menu-item">
                      <div>
                        <strong>{item.product?.name || "Продукт"}</strong>
                        <p className="form-hint">
                          Количество: {item.quantity} {item.product?.unit}
                        </p>
                      </div>
                      <div className="menu-meta">
                        <span>
                          Цена: {formatMoney(item.unit_price)}
                        </span>
                        {item.product?.category && (
                          <span>Категория: {item.product.category}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="button-row">
                  <div className="summary">
                    Сумма заявки: {formatMoney(total)}
                  </div>
                  {request.decided_at && (
                    <div className="summary">
                      Решение от {formatDateTime(request.decided_at)}
                    </div>
                  )}
                </div>

                {isPending && (
                  <div className="button-row">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => makeDecision(request.id, "approved")}
                      disabled={decidingIds[request.id]}
                    >
                      Согласовать
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => makeDecision(request.id, "rejected")}
                      disabled={decidingIds[request.id]}
                    >
                      Отклонить
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
