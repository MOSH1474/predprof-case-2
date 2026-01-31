import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const STORAGE_KEY = "canteen_cook_data";

const MEAL_DEFAULTS = {
  date: "",
  breakfast: "",
  lunch: "",
};

const BALANCE_DEFAULTS = {
  name: "",
  unit: "кг",
  balance: "",
  prepared: "",
};

const INITIAL_STOCK = [
  { id: 1, name: "Крупы", unit: "кг", balance: 24, prepared: 6 },
  { id: 2, name: "Овощи", unit: "кг", balance: 18, prepared: 4 },
  { id: 3, name: "Мясо", unit: "кг", balance: 12, prepared: 3 },
  { id: 4, name: "Молочные продукты", unit: "л", balance: 30, prepared: 8 },
];

const REQUEST_DEFAULTS = {
  product: "",
  quantity: "",
  unit: "кг",
  reason: "",
};

const getInitialData = () => {
  if (typeof window === "undefined") {
    return { mealLog: [], stock: INITIAL_STOCK, requests: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { mealLog: [], stock: INITIAL_STOCK, requests: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      mealLog: Array.isArray(parsed.mealLog) ? parsed.mealLog : [],
      stock: Array.isArray(parsed.stock) ? parsed.stock : INITIAL_STOCK,
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    };
  } catch {
    return { mealLog: [], stock: INITIAL_STOCK, requests: [] };
  }
};

export default function Cook() {
  const { user, isAuthenticated } = useAuth();
  const [mealForm, setMealForm] = useState(MEAL_DEFAULTS);
  const [mealLog, setMealLog] = useState(() => getInitialData().mealLog);
  const [mealError, setMealError] = useState("");
  const [mealSuccess, setMealSuccess] = useState("");

  const [stock, setStock] = useState(() => getInitialData().stock);
  const [stockForm, setStockForm] = useState(BALANCE_DEFAULTS);
  const [stockError, setStockError] = useState("");
  const [stockSuccess, setStockSuccess] = useState("");

  const [requests, setRequests] = useState(() => getInitialData().requests);
  const [requestForm, setRequestForm] = useState(REQUEST_DEFAULTS);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const payload = JSON.stringify({ mealLog, stock, requests });
    window.localStorage.setItem(STORAGE_KEY, payload);
  }, [mealLog, stock, requests]);

  const mealTotals = useMemo(() => {
    return mealLog.reduce(
      (acc, entry) => {
        acc.breakfast += entry.breakfast;
        acc.lunch += entry.lunch;
        return acc;
      },
      { breakfast: 0, lunch: 0 }
    );
  }, [mealLog]);

  const handleMealChange = (event) => {
    const { name, value } = event.target;
    setMealForm((prev) => ({ ...prev, [name]: value }));
    if (mealError) {
      setMealError("");
    }
    if (mealSuccess) {
      setMealSuccess("");
    }
  };

  const handleMealSubmit = (event) => {
    event.preventDefault();
    const breakfast = Number(mealForm.breakfast);
    const lunch = Number(mealForm.lunch);

    if (!mealForm.date || Number.isNaN(breakfast) || Number.isNaN(lunch)) {
      setMealError("Заполните дату и количество приемов пищи.");
      return;
    }

    if (breakfast < 0 || lunch < 0) {
      setMealError("Количество не может быть отрицательным.");
      return;
    }

    setMealLog((prev) => [
      {
        id: Date.now(),
        date: mealForm.date,
        breakfast,
        lunch,
      },
      ...prev,
    ]);

    setMealForm(MEAL_DEFAULTS);
    setMealSuccess("Данные о питании сохранены.");
  };

  const handleStockChange = (event) => {
    const { name, value } = event.target;
    setStockForm((prev) => ({ ...prev, [name]: value }));
    if (stockError) {
      setStockError("");
    }
    if (stockSuccess) {
      setStockSuccess("");
    }
  };

  const handleStockSubmit = (event) => {
    event.preventDefault();
    const balance = Number(stockForm.balance);
    const prepared = Number(stockForm.prepared);

    if (!stockForm.name || Number.isNaN(balance) || Number.isNaN(prepared)) {
      setStockError("Укажите продукт, остаток и приготовлено.");
      return;
    }

    if (balance < 0 || prepared < 0) {
      setStockError("Значения не могут быть отрицательными.");
      return;
    }

    const newItem = {
      id: Date.now(),
      name: stockForm.name.trim(),
      unit: stockForm.unit.trim() || "шт",
      balance,
      prepared,
    };

    setStock((prev) => [newItem, ...prev]);
    setStockForm(BALANCE_DEFAULTS);
    setStockSuccess("Продукт добавлен в учет.");
  };

  const handleRequestChange = (event) => {
    const { name, value } = event.target;
    setRequestForm((prev) => ({ ...prev, [name]: value }));
    if (requestError) {
      setRequestError("");
    }
    if (requestSuccess) {
      setRequestSuccess("");
    }
  };

  const handleRequestSubmit = (event) => {
    event.preventDefault();
    const quantity = Number(requestForm.quantity);

    if (!requestForm.product || Number.isNaN(quantity)) {
      setRequestError("Укажите продукт и количество для заявки.");
      return;
    }

    if (quantity <= 0) {
      setRequestError("Количество должно быть больше нуля.");
      return;
    }

    const newRequest = {
      id: Date.now(),
      product: requestForm.product.trim(),
      quantity,
      unit: requestForm.unit.trim() || "шт",
      reason: requestForm.reason.trim(),
      createdAt: new Date().toLocaleDateString("ru-RU"),
    };

    setRequests((prev) => [newRequest, ...prev]);
    setRequestForm(REQUEST_DEFAULTS);
    setRequestSuccess("Заявка на закупку отправлена.");
  };

  const handleQuickUpdate = (id, field, value) => {
    setStock((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: Math.max(0, Number(value) || 0),
            }
          : item
      )
    );
  };

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Рабочее место повара</h2>
        <p>
          Учет питания, контроль остатков и приготовленных блюд в школьной
          столовой.
        </p>
      </header>

      <div className="summary">
        Авторизация: {isAuthenticated ? `вошли как ${user?.name}` : "нет"}
      </div>

      <form className="auth-form" onSubmit={handleMealSubmit}>
        <div className="form-group">
          <h3>Учет выданных приемов пищи</h3>
          <p>
            Фиксируйте количество порций завтрака и обеда, чтобы сверять нагрузку
            кухни.
          </p>
          <div className="option-grid">
            <label className="form-field">
              Дата
              <input
                type="date"
                name="date"
                value={mealForm.date}
                onChange={handleMealChange}
                required
              />
            </label>
            <label className="form-field">
              Завтраки
              <input
                type="number"
                name="breakfast"
                min="0"
                value={mealForm.breakfast}
                onChange={handleMealChange}
                placeholder="0"
                required
              />
            </label>
            <label className="form-field">
              Обеды
              <input
                type="number"
                name="lunch"
                min="0"
                value={mealForm.lunch}
                onChange={handleMealChange}
                placeholder="0"
                required
              />
            </label>
          </div>
        </div>

        <div className="summary">
          Итого за период: завтраков {mealTotals.breakfast}, обедов {mealTotals.lunch}.
        </div>

        {mealError && (
          <div className="form-error" role="alert">
            {mealError}
          </div>
        )}
        {mealSuccess && <div className="form-success">{mealSuccess}</div>}

        <div className="button-row">
          <button type="submit" className="primary-button">
            Сохранить учет
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>Журнал питания</h3>
        <div className="option-grid">
          {mealLog.length === 0 && (
            <div className="summary">Пока нет записей по выдаче блюд.</div>
          )}
          {mealLog.map((entry) => (
            <div key={entry.id} className="option-card">
              <strong>{entry.date}</strong>
              <span>Завтраки: {entry.breakfast}</span>
              <span>Обеды: {entry.lunch}</span>
            </div>
          ))}
        </div>
      </div>

      <form className="auth-form" onSubmit={handleStockSubmit}>
        <div className="form-group">
          <h3>Контроль остатков и приготовленных блюд</h3>
          <p>
            Добавляйте продукты и фиксируйте их остаток и количество приготовленных
            порций.
          </p>
          <div className="option-grid">
            <label className="form-field">
              Продукт
              <input
                type="text"
                name="name"
                value={stockForm.name}
                onChange={handleStockChange}
                placeholder="Например: рис"
                required
              />
            </label>
            <label className="form-field">
              Единица измерения
              <input
                type="text"
                name="unit"
                value={stockForm.unit}
                onChange={handleStockChange}
                placeholder="кг"
              />
            </label>
            <label className="form-field">
              Остаток
              <input
                type="number"
                name="balance"
                min="0"
                value={stockForm.balance}
                onChange={handleStockChange}
                placeholder="0"
                required
              />
            </label>
            <label className="form-field">
              Приготовлено
              <input
                type="number"
                name="prepared"
                min="0"
                value={stockForm.prepared}
                onChange={handleStockChange}
                placeholder="0"
                required
              />
            </label>
          </div>
        </div>

        {stockError && (
          <div className="form-error" role="alert">
            {stockError}
          </div>
        )}
        {stockSuccess && <div className="form-success">{stockSuccess}</div>}

        <div className="button-row">
          <button type="submit" className="primary-button">
            Добавить продукт
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>Текущие остатки</h3>
        <div className="option-grid">
          {stock.map((item) => (
            <div key={item.id} className="option-card">
              <strong>{item.name}</strong>
              <span>
                Остаток: {item.balance} {item.unit}
              </span>
              <span>
                Приготовлено: {item.prepared} {item.unit}
              </span>
              <div className="button-row stock-update">
                <label className="form-field">
                  Обновить остаток
                  <input
                    type="number"
                    min="0"
                    value={item.balance}
                    onChange={(event) =>
                      handleQuickUpdate(item.id, "balance", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  Обновить приготовлено
                  <input
                    type="number"
                    min="0"
                    value={item.prepared}
                    onChange={(event) =>
                      handleQuickUpdate(item.id, "prepared", event.target.value)
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form className="auth-form" onSubmit={handleRequestSubmit}>
        <div className="form-group">
          <h3>Заявка на закупку</h3>
          <p>Оформляйте запросы на пополнение продуктов для кухни.</p>
          <div className="option-grid">
            <label className="form-field">
              Продукт
              <input
                type="text"
                name="product"
                value={requestForm.product}
                onChange={handleRequestChange}
                placeholder="Например: крупа гречневая"
                required
              />
            </label>
            <label className="form-field">
              Количество
              <input
                type="number"
                name="quantity"
                min="0"
                value={requestForm.quantity}
                onChange={handleRequestChange}
                placeholder="0"
                required
              />
            </label>
            <label className="form-field">
              Единица измерения
              <input
                type="text"
                name="unit"
                value={requestForm.unit}
                onChange={handleRequestChange}
                placeholder="кг"
              />
            </label>
          </div>
        </div>

        <label className="form-field">
          Комментарий
          <textarea
            rows="3"
            name="reason"
            value={requestForm.reason}
            onChange={handleRequestChange}
            placeholder="Например: нужно пополнить склад к понедельнику"
          />
        </label>

        {requestError && (
          <div className="form-error" role="alert">
            {requestError}
          </div>
        )}
        {requestSuccess && <div className="form-success">{requestSuccess}</div>}

        <div className="button-row">
          <button type="submit" className="primary-button">
            Отправить заявку
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>История заявок</h3>
        <div className="option-grid">
          {requests.length === 0 && (
            <div className="summary">Пока нет заявок на закупку.</div>
          )}
          {requests.map((entry) => (
            <div key={entry.id} className="option-card">
              <strong>{entry.product}</strong>
              <span>
                {entry.quantity} {entry.unit}
              </span>
              <span>Дата: {entry.createdAt}</span>
              {entry.reason && <span>Комментарий: {entry.reason}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
