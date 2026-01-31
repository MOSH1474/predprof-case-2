import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCookData, updateCookData } from "../utils/cookStorage.js";

export default function CookStock() {
  const [stock, setStock] = useState(() => getCookData().stock);

  useEffect(() => {
    updateCookData({ stock });
  }, [stock]);

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
        <h2>Текущие остатки</h2>
        <p>Контроль остатков и приготовленных блюд.</p>
      </header>

      <div className="button-row">
        <Link to="/cook" className="secondary-button">
          Назад к разделам
        </Link>
        <Link to="/cook/stock/new" className="secondary-button">
          Добавить продукт
        </Link>
      </div>

      <div className="form-group">
        <div className="option-grid stock-scroll">
          {stock.length === 0 && (
            <div className="summary">Пока нет данных по остаткам.</div>
          )}
          {stock.map((item) => (
            <div key={item.id} className="option-card stock-card">
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
    </section>
  );
}