import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const PREFERENCES = [
  "Без мяса",
  "Без молочных",
  "Без глютена",
  "Постное",
  "Халяль",
  "Вегетарианское",
];

const emptyForm = {
  allergyIds: [],
  preferences: [],
  notes: "",
};

const parseDietaryPreferences = (value) => {
  if (!value) {
    return { preferences: [], notes: "" };
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed.preferences)) {
      return {
        preferences: parsed.preferences,
        notes: parsed.notes || "",
      };
    }
  } catch {
    // fallback to plain string
  }
  return { preferences: [], notes: value };
};

const serializeDietaryPreferences = (preferences, notes) => {
  const trimmedNotes = notes.trim();
  if (!preferences.length && !trimmedNotes) {
    return null;
  }
  return JSON.stringify({ preferences, notes: trimmedNotes });
};

export default function StudentAllergies() {
  const { token } = useAuth();
  const [allergies, setAllergies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => {
    const selectedAllergies = allergies
      .filter((item) => form.allergyIds.includes(item.id))
      .map((item) => item.name);
    const items = [...selectedAllergies, ...form.preferences];
    return items.length ? items.join(", ") : "Ничего не выбрано";
  }, [allergies, form.allergyIds, form.preferences]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError("");
      setLoadError(false);
      try {
        const allergiesResponse = await apiRequest("/allergies", { token });
        setAllergies(allergiesResponse.items || []);

        const preferencesResponse = await apiRequest("/preferences/me", { token });
        const parsed = parseDietaryPreferences(
          preferencesResponse.dietary_preferences
        );
        setForm({
          allergyIds: (preferencesResponse.allergies || []).map((item) => item.id),
          preferences: parsed.preferences,
          notes: parsed.notes,
        });
      } catch (err) {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const toggleAllergy = (id) => {
    setForm((prev) => {
      const values = new Set(prev.allergyIds);
      if (values.has(id)) {
        values.delete(id);
      } else {
        values.add(id);
      }
      return { ...prev, allergyIds: Array.from(values) };
    });
    if (error) {
      setError("");
    }
    if (success) {
      setSuccess("");
    }
  };

  const togglePreference = (value) => {
    setForm((prev) => {
      const values = new Set(prev.preferences);
      if (values.has(value)) {
        values.delete(value);
      } else {
        values.add(value);
      }
      return { ...prev, preferences: Array.from(values) };
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.allergyIds.length && !form.preferences.length && !form.notes.trim()) {
      setError("Укажите хотя бы один аллерген, предпочтение или комментарий.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await apiRequest("/preferences/me", {
        method: "PUT",
        token,
        body: {
          allergy_ids: form.allergyIds,
          dietary_preferences: serializeDietaryPreferences(
            form.preferences,
            form.notes
          ),
        },
      });
      setSuccess("Данные сохранены. Мы учтем их при подборе меню.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(emptyForm);
    setError("");
    setSuccess("");
  };

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Аллергии и предпочтения</h2>
        <p>
          Укажите аллергены и особенности питания — мы учтем их при подборе блюд.
        </p>
      </header>

      {loading ? (
        <div className="form-hint">Загрузка данных...</div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {loadError && (
            <div className="form-hint">
              Не удалось загрузить сохраненные данные. Можно заполнить вручную и
              сохранить.
            </div>
          )}
          <div className="form-group">
            <h3>Аллергены</h3>
            <div className="option-grid">
              {allergies.map((item) => (
                <label key={item.id} className="option-card">
                  <input
                    type="checkbox"
                    checked={form.allergyIds.includes(item.id)}
                    onChange={() => toggleAllergy(item.id)}
                  />
                  <span>{item.name}</span>
                </label>
              ))}
              {!allergies.length && (
                <div className="form-hint">
                  {loadError
                    ? "Не удалось загрузить список аллергенов."
                    : "Аллергены пока не добавлены администратором."}
                </div>
              )}
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
                    onChange={() => togglePreference(item)}
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
            <button
              type="button"
              className="secondary-button"
              onClick={handleReset}
            >
              Сбросить
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
