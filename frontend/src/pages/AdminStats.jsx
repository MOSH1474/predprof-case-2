import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import AdminNav from "../components/AdminNav.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const PAYMENT_STATUS_LABELS = {
  pending: "Ожидает оплаты",
  paid: "Оплачено",
  failed: "Ошибка оплаты",
  refunded: "Возврат",
};

const PAYMENT_TYPE_LABELS = {
  one_time: "Разовый платеж",
  subscription: "Абонемент",
};

const ATTENDANCE_STATUS_LABELS = {
  issued: "Ожидает выдачи",
  served: "Выдано",
  confirmed: "Подтверждено",
};

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

const buildQuery = ({ dateFrom, dateTo }) => {
  const params = new URLSearchParams();
  if (dateFrom) {
    params.set("date_from", dateFrom);
  }
  if (dateTo) {
    params.set("date_to", dateTo);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

const buildPeriodLabel = (from, to, format) => {
  if (!from && !to) {
    return "За все время";
  }
  if (from && to) {
    return `Период: с ${format(from)} по ${format(to)}`;
  }
  if (from) {
    return `Период: с ${format(from)} по текущий момент`;
  }
  return `Период: до ${format(to)}`;
};

export default function AdminStats() {
  const { token, user } = useAuth();
  const [paymentFilters, setPaymentFilters] = useState({ from: "", to: "" });
  const [attendanceFilters, setAttendanceFilters] = useState({
    from: "",
    to: "",
  });
  const [paymentStats, setPaymentStats] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [attendanceError, setAttendanceError] = useState("");

  const loadPaymentStats = async (filters = paymentFilters) => {
    if (!token) {
      return;
    }
    setPaymentLoading(true);
    setPaymentError("");
    try {
      const query = buildQuery({
        dateFrom: formatDateTimeParam(filters.from),
        dateTo: formatDateTimeParam(filters.to),
      });
      const response = await apiRequest(`/admin/stats/payments${query}`, { token });
      setPaymentStats(response);
    } catch (error) {
      setPaymentError(error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const loadAttendanceStats = async (filters = attendanceFilters) => {
    if (!token) {
      return;
    }
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const query = buildQuery({
        dateFrom: filters.from,
        dateTo: filters.to,
      });
      const response = await apiRequest(`/admin/stats/attendance${query}`, { token });
      setAttendanceStats(response);
    } catch (error) {
      setAttendanceError(error.message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    loadPaymentStats();
    loadAttendanceStats();
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === "cook") {
    return <Navigate to="/cook" replace />;
  }
  if (user?.role && user.role !== "admin") {
    return <Navigate to="/student/menu" replace />;
  }

  const adminLabel = user?.full_name || user?.email;
  const paymentPeriodLabel = buildPeriodLabel(
    paymentFilters.from,
    paymentFilters.to,
    formatDateTime
  );
  const attendancePeriodLabel = buildPeriodLabel(
    attendanceFilters.from,
    attendanceFilters.to,
    formatDate
  );

  const handlePaymentChange = (event) => {
    const { name, value } = event.target;
    setPaymentFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleAttendanceChange = (event) => {
    const { name, value } = event.target;
    setAttendanceFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaymentSubmit = (event) => {
    event.preventDefault();
    loadPaymentStats();
  };

  const handleAttendanceSubmit = (event) => {
    event.preventDefault();
    loadAttendanceStats();
  };

  const resetPayments = () => {
    const next = { from: "", to: "" };
    setPaymentFilters(next);
    loadPaymentStats(next);
  };

  const resetAttendance = () => {
    const next = { from: "", to: "" };
    setAttendanceFilters(next);
    loadAttendanceStats(next);
  };

  const paymentStatusItems = paymentStats?.by_status || [];
  const paymentTypeItems = paymentStats?.by_type || [];
  const attendanceItems = attendanceStats?.by_status || [];

  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Статистика оплат и посещаемости</h2>
          <p>Анализируйте оплату питания и получение блюд за период.</p>
        </div>
        <div className="summary auth-status">
          {adminLabel ? `Администратор: ${adminLabel}` : "Администратор"}
        </div>
      </header>

      <AdminNav />

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <h3>Оплаты</h3>
        <p className="form-hint">
          Фильтрация идет по времени создания оплаты.
        </p>
      </div>

      <form className="auth-form" onSubmit={handlePaymentSubmit}>
        <div className="option-grid">
          <label className="form-field">
            С
            <input
              type="datetime-local"
              name="from"
              value={paymentFilters.from}
              onChange={handlePaymentChange}
            />
          </label>
          <label className="form-field">
            По
            <input
              type="datetime-local"
              name="to"
              value={paymentFilters.to}
              onChange={handlePaymentChange}
            />
          </label>
        </div>

        <div className="button-row">
          <button type="submit" className="primary-button" disabled={paymentLoading}>
            {paymentLoading ? "Загружаем..." : "Показать"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={resetPayments}
            disabled={paymentLoading}
          >
            Сбросить
          </button>
        </div>
        <div className="summary">{paymentPeriodLabel}</div>
      </form>

      {paymentError && (
        <div className="form-error" role="alert">
          {paymentError}
        </div>
      )}

      {paymentStats && (
        <>
          <div className="option-grid" style={{ marginTop: "1rem" }}>
            <div className="option-card">
              <strong>Всего оплат</strong>
              <span>{paymentStats.total_count}</span>
            </div>
            <div className="option-card">
              <strong>Сумма оплат</strong>
              <span>{formatMoney(paymentStats.total_amount)}</span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "1.5rem" }}>
            <h3>По статусу</h3>
            {paymentStatusItems.length === 0 ? (
              <div className="summary">Нет данных за выбранный период.</div>
            ) : (
              <div className="option-grid">
                {paymentStatusItems.map((item) => (
                  <div key={item.status} className="option-card">
                    <strong>
                      {PAYMENT_STATUS_LABELS[item.status] || item.status}
                    </strong>
                    <span>Количество: {item.count}</span>
                    <span>Сумма: {formatMoney(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginTop: "1.5rem" }}>
            <h3>По типу оплаты</h3>
            {paymentTypeItems.length === 0 ? (
              <div className="summary">Нет данных за выбранный период.</div>
            ) : (
              <div className="option-grid">
                {paymentTypeItems.map((item) => (
                  <div key={item.payment_type} className="option-card">
                    <strong>
                      {PAYMENT_TYPE_LABELS[item.payment_type] || item.payment_type}
                    </strong>
                    <span>Количество: {item.count}</span>
                    <span>Сумма: {formatMoney(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="form-group" style={{ marginTop: "2rem" }}>
        <h3>Посещаемость</h3>
        <p className="form-hint">
          Фильтрация идет по датам меню.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleAttendanceSubmit}>
        <div className="option-grid">
          <label className="form-field">
            С
            <input
              type="date"
              name="from"
              value={attendanceFilters.from}
              onChange={handleAttendanceChange}
            />
          </label>
          <label className="form-field">
            По
            <input
              type="date"
              name="to"
              value={attendanceFilters.to}
              onChange={handleAttendanceChange}
            />
          </label>
        </div>

        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={attendanceLoading}
          >
            {attendanceLoading ? "Загружаем..." : "Показать"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={resetAttendance}
            disabled={attendanceLoading}
          >
            Сбросить
          </button>
        </div>
        <div className="summary">{attendancePeriodLabel}</div>
      </form>

      {attendanceError && (
        <div className="form-error" role="alert">
          {attendanceError}
        </div>
      )}

      {attendanceStats && (
        <>
          <div className="option-grid" style={{ marginTop: "1rem" }}>
            <div className="option-card">
              <strong>Всего выдач</strong>
              <span>{attendanceStats.total_count}</span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "1.5rem" }}>
            <h3>По статусу</h3>
            {attendanceItems.length === 0 ? (
              <div className="summary">Нет данных за выбранный период.</div>
            ) : (
              <div className="option-grid">
                {attendanceItems.map((item) => (
                  <div key={item.status} className="option-card">
                    <strong>
                      {ATTENDANCE_STATUS_LABELS[item.status] || item.status}
                    </strong>
                    <span>Количество: {item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
