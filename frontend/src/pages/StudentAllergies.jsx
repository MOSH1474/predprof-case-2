import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const emptyForm = {
  allergyIds: [],
  preferencesText: "",
};

const parseDietaryPreferences = (value) => {
  if (!value) {
    return "";
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.preferencesText === "string") {
        return parsed.preferencesText;
      }
      const parts = [];
      if (Array.isArray(parsed.preferences)) {
        parts.push(...parsed.preferences);
      }
      if (typeof parsed.notes === "string" && parsed.notes.trim()) {
        parts.push(parsed.notes.trim());
      }
      if (parts.length) {
        return parts.join(", ");
      }
    }
  } catch {
    // fallback to plain string
  }
  return value;
};

const serializeDietaryPreferences = (preferencesText) => {
  const trimmed = preferencesText.trim();
  return trimmed ? trimmed : null;
};

export default function StudentAllergies() {
  const { token, user } = useAuth();
  const [allergies, setAllergies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedAllergies = useMemo(() => {
    return allergies
      .filter((item) => form.allergyIds.includes(item.id))
      .map((item) => item.name);
  }, [allergies, form.allergyIds]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError("");
      setLoadError(false);
      try {
        const allergiesResponse = await apiRequest("/allergies/", { token });
        setAllergies(allergiesResponse.items || []);

        const preferencesResponse = await apiRequest("/preferences/me", { token });
        setForm({
          allergyIds: (preferencesResponse.allergies || []).map((item) => item.id),
          preferencesText: parseDietaryPreferences(
            preferencesResponse.dietary_preferences
          ),
        });
      } catch {
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
  if (user?.role === "cook") {
    return <Navigate to="/cook" replace />;
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

  const handlePreferenceChange = (event) => {
    setForm((prev) => ({ ...prev, preferencesText: event.target.value }));
    if (error) {
      setError("");
    }
    if (success) {
      setSuccess("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.allergyIds.length && !form.preferencesText.trim()) {
      setError("Укажите хотя бы один аллерген или предпочтение.");
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
          dietary_preferences: serializeDietaryPreferences(form.preferencesText),
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
      <header className="auth-header page-header-row">
        <div>
          <h2>Пищевые предпочтения</h2>
          <p>
            Укажите аллергены и особенности питания — мы учтем их при подборе блюд.
          </p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" to="/student/menu">
            К меню
          </Link>
        </div>
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
            {selectedAllergies.length > 0 && (
              <div className="summary">
                Выбрано: {selectedAllergies.join(", ")}
              </div>
            )}
          </div>

          <label className="form-field">
            Предпочтения и ограничения
            <textarea
              rows="4"
              name="preferencesText"
              value={form.preferencesText}
              onChange={handlePreferenceChange}
              placeholder="Например: без мяса, без глютена, постное"
            />
          </label>

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
