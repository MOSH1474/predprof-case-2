import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import AdminNav from "../components/AdminNav.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const buildForm = () => ({
  name: "",
  description: "",
});

export default function AdminAllergies() {
  const { token, user } = useAuth();
  const [allergies, setAllergies] = useState([]);
  const [form, setForm] = useState(buildForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(buildForm);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const toast = useToast();

  const loadAllergies = async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/allergies/", { token });
      setAllergies(response.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    loadAllergies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setError("");
    }
    if (success) {
      toast.success(success);
      setSuccess("");
    }
  }, [error, success, toast]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === "cook") {
    return <Navigate to="/cook" replace />;
  }
  if (user?.role && user.role !== "admin") {
    return <Navigate to="/student/menu" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) {
      setError("");
    }
    if (success) {
      setSuccess("");
    }
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
    if (error) {
      setError("");
    }
    if (success) {
      setSuccess("");
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Укажите название аллергена.");
      return;
    }
    setSavingId("create");
    setError("");
    setSuccess("");
    try {
      await apiRequest("/allergies/", {
        method: "POST",
        token,
        body: {
          name,
          description: form.description.trim() || null,
        },
      });
      setSuccess("Аллерген добавлен.");
      setForm(buildForm());
      await loadAllergies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const startEdit = (allergy) => {
    setEditingId(allergy.id);
    setEditForm({
      name: allergy.name || "",
      description: allergy.description || "",
    });
    setError("");
    setSuccess("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(buildForm());
  };

  const handleSave = async (allergyId) => {
    const name = editForm.name.trim();
    if (!name) {
      setError("Укажите название аллергена.");
      return;
    }
    setSavingId(allergyId);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/allergies/${allergyId}`, {
        method: "PUT",
        token,
        body: {
          name,
          description: editForm.description.trim() || null,
        },
      });
      setSuccess("Аллерген обновлен.");
      setEditingId(null);
      await loadAllergies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (allergyId) => {
    if (!window.confirm("Удалить аллерген?")) {
      return;
    }
    setDeletingId(allergyId);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/allergies/${allergyId}`, {
        method: "DELETE",
        token,
      });
      setSuccess("Аллерген удален.");
      await loadAllergies();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Аллергены</h2>
          <p>Управляйте справочником аллергенов.</p>
        </div>
        <div className="summary auth-status">Администратор</div>
      </header>

      <AdminNav />

      <form className="auth-form" onSubmit={handleCreate}>
        <div className="form-group">
          <h3>Новый аллерген</h3>
          <div className="option-grid">
            <label className="form-field">
              Название
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Например: молоко"
                required
              />
            </label>
            <label className="form-field">
              Описание
              <input
                type="text"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="По желанию"
              />
            </label>
          </div>
        </div>

        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={savingId === "create"}
          >
            {savingId === "create" ? "Сохраняем..." : "Добавить аллерген"}
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>Список аллергенов</h3>
        {loading ? (
          <div className="form-hint">Загружаем аллергены...</div>
        ) : (
          <div className="data-grid">
            {allergies.length === 0 && (
              <div className="summary">Пока нет аллергенов.</div>
            )}
            {allergies.map((allergy) => {
              const isEditing = editingId === allergy.id;
              return (
                <article key={allergy.id} className="data-card">
                  <header>
                    <strong>{allergy.name}</strong>
                    <span className="status-pill status-neutral">#{allergy.id}</span>
                  </header>
                  {isEditing ? (
                    <div className="form-group">
                      <div className="option-grid">
                        <label className="form-field">
                          Название
                          <input
                            type="text"
                            name="name"
                            value={editForm.name}
                            onChange={handleEditChange}
                          />
                        </label>
                        <label className="form-field">
                          Описание
                          <input
                            type="text"
                            name="description"
                            value={editForm.description}
                            onChange={handleEditChange}
                          />
                        </label>
                      </div>
                      <div className="button-row" style={{ marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => handleSave(allergy.id)}
                          disabled={savingId === allergy.id}
                        >
                          {savingId === allergy.id ? "Сохраняем..." : "Сохранить"}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={cancelEdit}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    allergy.description && (
                      <div className="summary">{allergy.description}</div>
                    )
                  )}
                  <div className="button-row">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startEdit(allergy)}
                      disabled={isEditing}
                    >
                      {isEditing ? "Редактирование" : "Редактировать"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleDelete(allergy.id)}
                      disabled={deletingId === allergy.id || isEditing}
                    >
                      {deletingId === allergy.id ? "Удаляем..." : "Удалить"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
