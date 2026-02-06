import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import AdminNav from "../components/AdminNav.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const MEAL_TYPE_LABELS = {
  breakfast: "Завтрак",
  lunch: "Обед",
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

const buildQuery = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      query.set(key, value);
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes('"') || text.includes(";") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildCsv = (rows) => {
  const content = rows.map((row) => row.map(csvEscape).join(";")).join("\n");
  return `\uFEFF${content}`;
};

const downloadCsv = (filename, rows) => {
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function AdminReports() {
  const { token, user } = useAuth();
  const [nutritionFilters, setNutritionFilters] = useState({
    from: "",
    to: "",
    mealType: "",
  });
  const [expenseFilters, setExpenseFilters] = useState({
    from: "",
    to: "",
    productId: "",
  });
  const [nutritionReport, setNutritionReport] = useState(null);
  const [expenseReport, setExpenseReport] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [nutritionError, setNutritionError] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [productError, setProductError] = useState("");
  const toast = useToast();

  const adminLabel = user?.full_name || user?.email;

  const loadNutritionReport = async (filters = nutritionFilters) => {
    if (!token) {
      return;
    }
    setLoadingNutrition(true);
    setNutritionError("");
    try {
      const query = buildQuery({
        date_from: filters.from,
        date_to: filters.to,
        meal_type: filters.mealType,
      });
      const response = await apiRequest(`/admin/reports/nutrition${query}`, {
        token,
      });
      setNutritionReport(response);
    } catch (error) {
      setNutritionError(error.message);
    } finally {
      setLoadingNutrition(false);
    }
  };

  const loadExpenseReport = async (filters = expenseFilters) => {
    if (!token) {
      return;
    }
    setLoadingExpense(true);
    setExpenseError("");
    try {
      const query = buildQuery({
        date_from: filters.from,
        date_to: filters.to,
        product_id: filters.productId,
      });
      const response = await apiRequest(`/admin/reports/expenses${query}`, { token });
      setExpenseReport(response);
    } catch (error) {
      setExpenseError(error.message);
    } finally {
      setLoadingExpense(false);
    }
  };

  const loadProducts = async () => {
    if (!token) {
      return;
    }
    setLoadingProducts(true);
    setProductError("");
    try {
      const response = await apiRequest("/products/", { token });
      setProducts(response.items || []);
    } catch (error) {
      setProductError(error.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    loadNutritionReport();
    loadExpenseReport();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (nutritionError) {
      toast.error(nutritionError);
      setNutritionError("");
    }
    if (expenseError) {
      toast.error(expenseError);
      setExpenseError("");
    }
    if (productError) {
      toast.error(productError);
      setProductError("");
    }
  }, [expenseError, nutritionError, productError, toast]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === "cook") {
    return <Navigate to="/cook" replace />;
  }
  if (user?.role && user.role !== "admin") {
    return <Navigate to="/student/menu" replace />;
  }

  const nutritionTotals = useMemo(() => {
    if (!nutritionReport?.items) {
      return { issued: 0, served: 0, confirmed: 0 };
    }
    return nutritionReport.items.reduce(
      (acc, item) => {
        acc.issued += Number(item.issued) || 0;
        acc.served += Number(item.served) || 0;
        acc.confirmed += Number(item.confirmed) || 0;
        return acc;
      },
      { issued: 0, served: 0, confirmed: 0 }
    );
  }, [nutritionReport]);

  const handleNutritionChange = (event) => {
    const { name, value } = event.target;
    setNutritionFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleExpenseChange = (event) => {
    const { name, value } = event.target;
    setExpenseFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleNutritionSubmit = (event) => {
    event.preventDefault();
    loadNutritionReport();
  };

  const handleExpenseSubmit = (event) => {
    event.preventDefault();
    loadExpenseReport();
  };

  const resetNutrition = () => {
    const next = { from: "", to: "", mealType: "" };
    setNutritionFilters(next);
    loadNutritionReport(next);
  };

  const resetExpense = () => {
    const next = { from: "", to: "", productId: "" };
    setExpenseFilters(next);
    loadExpenseReport(next);
  };

  const nutritionCsv = useMemo(() => {
    if (!nutritionReport?.items) {
      return [];
    }
    const rows = [
      [
        "Дата меню",
        "Тип приема пищи",
        "Ожидает выдачи",
        "Выдано",
        "Подтверждено",
        "того",
      ],
    ];
    nutritionReport.items.forEach((item) => {
      const total = (item.issued || 0) + (item.served || 0) + (item.confirmed || 0);
      rows.push([
        formatDate(item.menu_date),
        MEAL_TYPE_LABELS[item.meal_type] || item.meal_type,
        item.issued,
        item.served,
        item.confirmed,
        total,
      ]);
    });
    rows.push([
      "того",
      "",
      nutritionTotals.issued,
      nutritionTotals.served,
      nutritionTotals.confirmed,
      nutritionReport.total_count,
    ]);
    return rows;
  }, [nutritionReport, nutritionTotals]);

  const expenseCsv = useMemo(() => {
    if (!expenseReport?.items) {
      return [];
    }
    const rows = [
      ["ID продукта", "Название", "Общее количество", "Общая сумма"],
    ];
    expenseReport.items.forEach((item) => {
      rows.push([
        item.product_id,
        item.product_name,
        item.total_quantity,
        item.total_amount,
      ]);
    });
    rows.push([
      "",
      "того",
      expenseReport.total_quantity,
      expenseReport.total_amount,
    ]);
    return rows;
  }, [expenseReport]);

  const handleNutritionExport = () => {
    if (!nutritionCsv.length) {
      return;
    }
    const range = [
      nutritionFilters.from || "all",
      nutritionFilters.to || "all",
    ].join("_");
    downloadCsv(`nutrition_report_${range}.csv`, nutritionCsv);
  };

  const handleExpenseExport = () => {
    if (!expenseCsv.length) {
      return;
    }
    const range = [
      expenseFilters.from || "all",
      expenseFilters.to || "all",
    ].join("_");
    downloadCsv(`expense_report_${range}.csv`, expenseCsv);
  };

  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Отчеты по питанию и затратам</h2>
          <p>Формируйте отчеты для контроля выдачи и закупок.</p>
        </div>
        <div className="summary auth-status">
          {adminLabel ? `Администратор: ${adminLabel}` : "Администратор"}
        </div>
      </header>

      <AdminNav />

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <h3>Отчет по питанию</h3>
        <p className="form-hint">
          Группировка по дате меню и типу приема пищи.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleNutritionSubmit}>
        <div className="option-grid">
          <label className="form-field">
            С
            <input
              type="date"
              name="from"
              value={nutritionFilters.from}
              onChange={handleNutritionChange}
            />
          </label>
          <label className="form-field">
            По
            <input
              type="date"
              name="to"
              value={nutritionFilters.to}
              onChange={handleNutritionChange}
            />
          </label>
          <label className="form-field">
            Тип приема пищи
            <select
              name="mealType"
              value={nutritionFilters.mealType}
              onChange={handleNutritionChange}
            >
              <option value="">Все</option>
              <option value="breakfast">Завтрак</option>
              <option value="lunch">Обед</option>
            </select>
          </label>
        </div>

        <div className="button-row">
          <button type="submit" className="primary-button" disabled={loadingNutrition}>
            {loadingNutrition ? "Формируем..." : "Показать"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleNutritionExport}
            disabled={!nutritionReport || !nutritionReport.items?.length}
          >
            Скачать CSV
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={resetNutrition}
            disabled={loadingNutrition}
          >
            Сбросить
          </button>
        </div>
      </form>
{nutritionReport && (
        <>
          <div className="option-grid" style={{ marginTop: "1rem" }}>
            <div className="option-card">
              <strong>Всего выдач</strong>
              <span>{nutritionReport.total_count}</span>
            </div>
            <div className="option-card">
              <strong>Ожидает</strong>
              <span>{nutritionTotals.issued}</span>
            </div>
            <div className="option-card">
              <strong>Выдано</strong>
              <span>{nutritionTotals.served}</span>
            </div>
            <div className="option-card">
              <strong>Подтверждено</strong>
              <span>{nutritionTotals.confirmed}</span>
            </div>
          </div>

          <div className="menu-grid" style={{ marginTop: "1.5rem" }}>
            {nutritionReport.items.length === 0 && (
              <div className="summary">Данных за выбранный период нет.</div>
            )}
            {nutritionReport.items.map((item) => (
              <article
                key={`${item.menu_date}-${item.meal_type}`}
                className="menu-card"
              >
                <div className="menu-card-header">
                  <div>
                    <h3>
                      {formatDate(item.menu_date)} ·{" "}
                      {MEAL_TYPE_LABELS[item.meal_type] || item.meal_type}
                    </h3>
                  </div>
                  <div className="menu-price">
                    {item.issued + item.served + item.confirmed}
                  </div>
                </div>
                <div className="menu-meta">
                  <span>Ожидает: {item.issued}</span>
                  <span>Выдано: {item.served}</span>
                  <span>Подтверждено: {item.confirmed}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="form-group" style={{ marginTop: "2rem" }}>
        <h3>Отчет по затратам</h3>
        <p className="form-hint">
          Учитываются только согласованные заявки на закупку.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleExpenseSubmit}>
        <div className="option-grid">
          <label className="form-field">
            С
            <input
              type="date"
              name="from"
              value={expenseFilters.from}
              onChange={handleExpenseChange}
            />
          </label>
          <label className="form-field">
            По
            <input
              type="date"
              name="to"
              value={expenseFilters.to}
              onChange={handleExpenseChange}
            />
          </label>
          <label className="form-field">
            Продукт
            <select
              name="productId"
              value={expenseFilters.productId}
              onChange={handleExpenseChange}
            >
              <option value="">Все продукты</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            {loadingProducts && (
              <span className="form-hint">Загружаем список продуктов...</span>
            )}
</label>
        </div>

        <div className="button-row">
          <button type="submit" className="primary-button" disabled={loadingExpense}>
            {loadingExpense ? "Формируем..." : "Показать"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleExpenseExport}
            disabled={!expenseReport || !expenseReport.items?.length}
          >
            Скачать CSV
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={resetExpense}
            disabled={loadingExpense}
          >
            Сбросить
          </button>
        </div>
      </form>
{expenseReport && (
        <>
          <div className="option-grid" style={{ marginTop: "1rem" }}>
            <div className="option-card">
              <strong>того количество</strong>
              <span>{expenseReport.total_quantity}</span>
            </div>
            <div className="option-card">
              <strong>того сумма</strong>
              <span>{formatMoney(expenseReport.total_amount)}</span>
            </div>
          </div>

          <div className="menu-grid" style={{ marginTop: "1.5rem" }}>
            {expenseReport.items.length === 0 && (
              <div className="summary">Данных за выбранный период нет.</div>
            )}
            {expenseReport.items.map((item) => (
              <article key={item.product_id} className="menu-card">
                <div className="menu-card-header">
                  <div>
                    <h3>{item.product_name}</h3>
                    <p>Продукт #{item.product_id}</p>
                  </div>
                  <div className="menu-price">
                    {formatMoney(item.total_amount)}
                  </div>
                </div>
                <div className="menu-meta">
                  <span>Количество: {item.total_quantity}</span>
                  <span>Сумма: {formatMoney(item.total_amount)}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}


