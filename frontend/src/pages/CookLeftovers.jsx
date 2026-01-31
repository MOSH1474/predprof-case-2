import { useEffect, useState } from "react";
import CookNav from "../components/CookNav.jsx";
import { getCookData, updateCookData } from "../utils/cookStorage.js";

const LEFTOVER_DEFAULTS = {
  date: "",
  item: "",
  quantity: "",
  unit: "кг",
  notes: "",
};

export default function CookLeftovers() {
  const [leftovers, setLeftovers] = useState(() => getCookData().leftovers);
  const [leftoverForm, setLeftoverForm] = useState(LEFTOVER_DEFAULTS);
  const [leftoverError, setLeftoverError] = useState("");
  const [leftoverSuccess, setLeftoverSuccess] = useState("");

  useEffect(() => {
    updateCookData({ leftovers });
  }, [leftovers]);

  const handleLeftoverChange = (event) => {
    const { name, value } = event.target;
    setLeftoverForm((prev) => ({ ...prev, [name]: value }));
    if (leftoverError) {
      setLeftoverError("");
    }
    if (leftoverSuccess) {
      setLeftoverSuccess("");
    }
  };

  const handleLeftoverSubmit = (event) => {
    event.preventDefault();
    const quantity = Number(leftoverForm.quantity);

    if (!leftoverForm.date || !leftoverForm.item || Number.isNaN(quantity)) {
      setLeftoverError("Заполните дату, блюдо и количество остатка.");
      return;
    }

    if (quantity < 0) {
      setLeftoverError("Количество не может быть отрицательным.");
      return;
    }

    const newEntry = {
      id: Date.now(),
      date: leftoverForm.date,
      item: leftoverForm.item.trim(),
      quantity,
      unit: leftoverForm.unit.trim() || "шт",
      notes: leftoverForm.notes.trim(),
    };

    setLeftovers((prev) => [newEntry, ...prev]);
    setLeftoverForm(LEFTOVER_DEFAULTS);
    setLeftoverSuccess("Данные об остатках сохранены.");
  };

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Контроль остатков</h2>
        <p>Отмечайте остатки блюд после выдачи, чтобы планировать меню.</p>
      </header>

      <CookNav />

      <form className="auth-form" onSubmit={handleLeftoverSubmit}>
        <div className="form-group">
          <h3>Новый остаток</h3>
          <div className="option-grid">
            <label className="form-field">
              Дата
              <input
                type="date"
                name="date"
                value={leftoverForm.date}
                onChange={handleLeftoverChange}
                required
              />
            </label>
            <label className="form-field">
              Блюдо
              <input
                type="text"
                name="item"
                value={leftoverForm.item}
                onChange={handleLeftoverChange}
                placeholder="Например: плов"
                required
              />
            </label>
            <label className="form-field">
              Количество
              <input
                type="number"
                name="quantity"
                min="0"
                value={leftoverForm.quantity}
                onChange={handleLeftoverChange}
                placeholder="0"
                required
              />
            </label>
            <label className="form-field">
              Единица измерения
              <input
                type="text"
                name="unit"
                value={leftoverForm.unit}
                onChange={handleLeftoverChange}
                placeholder="кг"
              />
            </label>
          </div>
        </div>

        <label className="form-field">
          Комментарий
          <textarea
            rows="3"
            name="notes"
            value={leftoverForm.notes}
            onChange={handleLeftoverChange}
            placeholder="Например: остаток после 2 смены"
          />
        </label>

        {leftoverError && (
          <div className="form-error" role="alert">
            {leftoverError}
          </div>
        )}
        {leftoverSuccess && <div className="form-success">{leftoverSuccess}</div>}

        <div className="button-row">
          <button type="submit" className="primary-button">
            Сохранить остаток
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>История остатков</h3>
        <div className="option-grid">
          {leftovers.length === 0 && (
            <div className="summary">Пока нет записей об остатках.</div>
          )}
          {leftovers.map((entry) => (
            <div key={entry.id} className="option-card">
              <strong>{entry.item}</strong>
              <span>
                {entry.quantity} {entry.unit}
              </span>
              <span>Дата: {entry.date}</span>
              {entry.notes && <span>Комментарий: {entry.notes}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
