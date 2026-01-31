import { useState } from "react";
import { Link } from "react-router-dom";
import { getCookData } from "../utils/cookStorage.js";

export default function CookMealLog() {
  const [mealLog] = useState(() => getCookData().mealLog);

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Журнал питания</h2>
        <p>История выдачи завтраков и обедов.</p>
      </header>

      <div className="button-row">
        <Link to="/cook" className="secondary-button">
          Назад к разделам
        </Link>
        <Link to="/cook/meals" className="secondary-button">
          Учет питания
        </Link>
      </div>

      <div className="form-group">
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
    </section>
  );
}