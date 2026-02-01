import { useState } from "react";
import CookNav from "../components/CookNav.jsx";
import { getCookData } from "../utils/cookStorage.js";

export default function CookMealLog() {
  const [mealLog] = useState(() => getCookData().mealLog);

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Журнал питания</h2>
        <p>История выдачи завтраков и обедов.</p>
      </header>

      <CookNav />

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
