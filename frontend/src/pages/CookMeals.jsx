import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCookData, updateCookData } from "../utils/cookStorage.js";

const MEAL_DEFAULTS = {
  date: "",
  breakfast: "",
  lunch: "",
};

export default function CookMeals() {
  const [mealForm, setMealForm] = useState(MEAL_DEFAULTS);
  const [mealLog, setMealLog] = useState(() => getCookData().mealLog);
  const [mealError, setMealError] = useState("");
  const [mealSuccess, setMealSuccess] = useState("");

  useEffect(() => {
    updateCookData({ mealLog });
  }, [mealLog]);

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

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Учет питания</h2>
        <p>Фиксируйте количество завтраков и обедов.</p>
      </header>

      <div className="button-row">
        <Link to="/cook" className="secondary-button">
          Назад к разделам
        </Link>
        <Link to="/cook/meals/log" className="secondary-button">
          Журнал питания
        </Link>
      </div>

      <form className="auth-form" onSubmit={handleMealSubmit}>
        <div className="form-group">
          <h3>Новая запись</h3>
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
    </section>
  );
}