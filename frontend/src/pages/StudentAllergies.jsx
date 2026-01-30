import { useMemo, useState } from "react";

const STORAGE_KEY = "canteen_student_preferences";

const ALLERGENS = [
  "Молоко",
  "Яйца",
  "Орехи",
  "Рыба",
  "Глютен",
  "Соя",
  "Морепродукты",
  "Мед",
  "Кунжут",
  "Шоколад",
];

const PREFERENCES = [
  "Без мяса",
  "Без молочных",
  "Без глютена",
  "Постное",
  "Халяль",
  "Вегетарианское",
];

const getInitialState = () => {
  if (typeof window === "undefined") {
    return { allergens: [], preferences: [], notes: "" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { allergens: [], preferences: [], notes: "" };
  } catch {
    return { allergens: [], preferences: [], notes: "" };
  }
};

export default function StudentAllergies() {
  const [form, setForm] = useState(getInitialState);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const summary = useMemo(() => {
    const items = [...form.allergens, ...form.preferences];
    return items.length ? items.join(", ") : "Ничего не выбрано";
  }, [form.allergens, form.preferences]);

  const toggleValue = (group, value) => {
    setForm((prev) => {
      const values = new Set(prev[group]);
      if (values.has(value)) {
        values.delete(value);
      } else {
        values.add(value);
      }
      return { ...prev, [group]: Array.from(values) };
    });
    if (error) {
      setError("");
    }
    if (success) {
      setSuccess("");
    }
  };

  const handleNotesChange = (event) => {
    setForm((prev) => ({ ...prev, notes: event.target.value }));
    if (error) {
      setError("");
    }
    if (success) {
      setSuccess("");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.allergens.length && !form.preferences.length && !form.notes.trim()) {
      setError("Укажите хотя бы один аллерген, предпочтение или комментарий.");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    }

    setSuccess("Данные сохранены. Мы учтем их при подборе меню.");
  };

  const handleReset = () => {
    setForm({ allergens: [], preferences: [], notes: "" });
    setError("");
    setSuccess("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Аллергии и предпочтения</h2>
        <p>
          Укажите аллергены и особенности питания — мы учтем их при подборе блюд.
        </p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <h3>Аллергены</h3>
          <div className="option-grid">
            {ALLERGENS.map((item) => (
              <label key={item} className="option-card">
                <input
                  type="checkbox"
                  checked={form.allergens.includes(item)}
                  onChange={() => toggleValue("allergens", item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <h3>Пищевые предпочтения</h3>
          <div className="option-grid">
            {PREFERENCES.map((item) => (
              <label key={item} className="option-card">
                <input
                  type="checkbox"
                  checked={form.preferences.includes(item)}
                  onChange={() => toggleValue("preferences", item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="form-field">
          Другое / комментарий
          <textarea
            rows="4"
            value={form.notes}
            onChange={handleNotesChange}
            placeholder="Например: аллергия на яблоки, непереносимость лактозы..."
          />
        </label>

        <div className="summary">Выбрано: {summary}</div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {success && <div className="form-success">{success}</div>}

        <div className="button-row">
          <button type="button" className="secondary-button" onClick={handleReset}>
            Сбросить
          </button>
          <button type="submit" className="primary-button">
            Сохранить
          </button>
        </div>
      </form>
    </section>
  );
}
