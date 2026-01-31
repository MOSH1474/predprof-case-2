import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCookData, updateCookData } from "../utils/cookStorage.js";

const BALANCE_DEFAULTS = {
  name: "",
  unit: "кг",
  balance: "",
  prepared: "",
};

export default function CookStockNew() {
  const [stock, setStock] = useState(() => getCookData().stock);
  const [stockForm, setStockForm] = useState(BALANCE_DEFAULTS);
  const [stockError, setStockError] = useState("");
  const [stockSuccess, setStockSuccess] = useState("");

  useEffect(() => {
    updateCookData({ stock });
  }, [stock]);

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

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Добавление продуктов</h2>
        <p>Создайте новую позицию для учета остатков.</p>
      </header>

      <div className="button-row">
        <Link to="/cook" className="secondary-button">
          Назад к разделам
        </Link>
        <Link to="/cook/stock" className="secondary-button">
          Текущие остатки
        </Link>
      </div>

      <form className="auth-form" onSubmit={handleStockSubmit}>
        <div className="form-group">
          <h3>Новая позиция</h3>
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
    </section>
  );
}