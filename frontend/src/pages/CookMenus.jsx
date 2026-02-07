import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import CookNav from "../components/CookNav.jsx";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const MEAL_TYPE_LABELS = {
  breakfast: "Завтрак",
  lunch: "Обед",
};

const MENU_PRICE_MAX = 99999999.99;

const buildDishForm = () => ({
  name: "",
  description: "",
  allergyIds: [],
});

const buildDishEditForm = (dish) => ({
  name: dish?.name || "",
  description: dish?.description || "",
  isActive: dish?.is_active ?? true,
  allergyIds: dish?.allergies?.map((item) => item.id) || [],
});

const buildMenuForm = () => ({
  menuDate: "",
  mealType: "breakfast",
  title: "",
  price: "",
});

const buildMenuEditForm = (menu) => ({
  menuDate: menu?.menu_date || "",
  mealType: menu?.meal_type || "breakfast",
  title: menu?.title || "",
  price: menu?.price ?? "",
});

const buildMenuItemForm = () => ({
  dishId: "",
  portionSize: "",
  plannedQty: "",
  remainingQty: "",
});

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("ru-RU");
};

const normalizeNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function CookMenus() {
  const { token } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [menus, setMenus] = useState([]);
  const [dishForm, setDishForm] = useState(buildDishForm);
  const [menuForm, setMenuForm] = useState(buildMenuForm);
  const [menuItemForm, setMenuItemForm] = useState(buildMenuItemForm);
  const [menuItems, setMenuItems] = useState([]);
  const [menuEdits, setMenuEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [savingMenuId, setSavingMenuId] = useState(null);
  const [savingMenuDetailsId, setSavingMenuDetailsId] = useState(null);
  const [deletingMenuId, setDeletingMenuId] = useState(null);
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuEditForm, setMenuEditForm] = useState(buildMenuEditForm);
  const [deletingDishId, setDeletingDishId] = useState(null);
  const [editingDishId, setEditingDishId] = useState(null);
  const [dishEditForm, setDishEditForm] = useState(buildDishEditForm);
  const [savingDishId, setSavingDishId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const dishMap = useMemo(() => {
    return new Map(dishes.map((dish) => [dish.id, dish]));
  }, [dishes]);

  const usedDishIds = useMemo(() => {
    const ids = new Set();
    menus.forEach((menu) => {
      (menu.menu_items || []).forEach((item) => {
        if (item.dish?.id) {
          ids.add(item.dish.id);
        }
      });
    });
    return ids;
  }, [menus]);

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [dishesResponse, menusResponse, allergiesResponse] = await Promise.all([
        apiRequest("/dishes/", { token }),
        apiRequest("/menus/", { token }),
        apiRequest("/allergies/", { token }),
      ]);
      setDishes(dishesResponse.items || []);
      setMenus(menusResponse.items || []);
      setAllergies(allergiesResponse.items || []);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    loadData();
  }, [token]);

  useEffect(() => {
    if (loadError) {
      toast.error(loadError);
      setLoadError("");
    }
    if (formError) {
      toast.error(formError);
      setFormError("");
    }
    if (formSuccess) {
      toast.success(formSuccess);
      setFormSuccess("");
    }
  }, [formError, formSuccess, loadError, toast]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleDishChange = (event) => {
    const { name, value } = event.target;
    setDishForm((prev) => ({ ...prev, [name]: value }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const handleDishEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setDishEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const toggleDishAllergy = (id) => {
    setDishForm((prev) => {
      const next = new Set(prev.allergyIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, allergyIds: Array.from(next) };
    });
  };

  const toggleDishEditAllergy = (id) => {
    setDishEditForm((prev) => {
      const next = new Set(prev.allergyIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, allergyIds: Array.from(next) };
    });
  };

  const startDishEdit = (dish) => {
    setEditingDishId(dish.id);
    setDishEditForm(buildDishEditForm(dish));
    setFormError("");
    setFormSuccess("");
  };

  const cancelDishEdit = () => {
    setEditingDishId(null);
    setDishEditForm(buildDishEditForm());
  };

  const handleMenuChange = (event) => {
    const { name, value } = event.target;
    setMenuForm((prev) => ({ ...prev, [name]: value }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const handleMenuEditChange = (event) => {
    const { name, value } = event.target;
    setMenuEditForm((prev) => ({ ...prev, [name]: value }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const startMenuEdit = (menu) => {
    setEditingMenuId(menu.id);
    setMenuEditForm(buildMenuEditForm(menu));
    setFormError("");
    setFormSuccess("");
  };

  const cancelMenuEdit = () => {
    setEditingMenuId(null);
    setMenuEditForm(buildMenuEditForm());
  };

  const handleMenuItemChange = (event) => {
    const { name, value } = event.target;
    setMenuItemForm((prev) => ({ ...prev, [name]: value }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const handleAddMenuItem = () => {
    const dishId = Number(menuItemForm.dishId);
    if (!dishId) {
      setFormError("Выберите блюдо для позиции меню.");
      return;
    }
    if (menuItems.some((item) => item.dishId === dishId)) {
      setFormError("Это блюдо уже добавлено в меню.");
      return;
    }
    setMenuItems((prev) => [
      ...prev,
      {
        id: `${dishId}-${Date.now()}`,
        dishId,
        portionSize: menuItemForm.portionSize,
        plannedQty: menuItemForm.plannedQty,
        remainingQty: menuItemForm.remainingQty,
      },
    ]);
    setMenuItemForm(buildMenuItemForm());
  };

  const handleRemoveMenuItem = (id) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDishSubmit = async (event) => {
    event.preventDefault();
    if (!dishForm.name.trim()) {
      setFormError("Укажите название блюда.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest("/dishes/", {
        method: "POST",
        token,
        body: {
          name: dishForm.name.trim(),
          description: dishForm.description.trim() || null,
          allergy_ids: dishForm.allergyIds.length ? dishForm.allergyIds : null,
        },
      });
      setFormSuccess("Блюдо добавлено.");
      setDishForm(buildDishForm());
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDishEditSave = async (dishId) => {
    const name = dishEditForm.name.trim();
    if (!name) {
      setFormError("Укажите название блюда.");
      return;
    }
    setSavingDishId(dishId);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest(`/dishes/${dishId}`, {
        method: "PUT",
        token,
        body: {
          name,
          description: dishEditForm.description.trim() || null,
          is_active: Boolean(dishEditForm.isActive),
          allergy_ids: dishEditForm.allergyIds,
        },
      });
      setFormSuccess("Блюдо обновлено.");
      setEditingDishId(null);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSavingDishId(null);
    }
  };

  const handleMenuSubmit = async (event) => {
    event.preventDefault();
    if (!menuForm.menuDate) {
      setFormError("Укажите дату меню.");
      return;
    }
    if (!menuItems.length) {
      setFormError("Добавьте хотя бы одно блюдо в меню.");
      return;
    }
    const priceValue = menuForm.price === "" ? null : Number(menuForm.price);
    if (priceValue !== null) {
      if (Number.isNaN(priceValue) || priceValue < 0) {
        setFormError("Цена должна быть неотрицательной.");
        return;
      }
      if (priceValue > MENU_PRICE_MAX) {
        setFormError("Цена не может превышать 99 999 999.99.");
        return;
      }
    }
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest("/menus/", {
        method: "POST",
        token,
        body: {
          menu_date: menuForm.menuDate,
          meal_type: menuForm.mealType,
          title: menuForm.title.trim() || null,
          price: priceValue,
          items: menuItems.map((item) => ({
            dish_id: item.dishId,
            portion_size: item.portionSize ? item.portionSize : null,
            planned_qty: normalizeNumber(item.plannedQty),
            remaining_qty: normalizeNumber(item.remainingQty),
          })),
        },
      });
      setFormSuccess("Меню создано.");
      setMenuForm(buildMenuForm());
      setMenuItems([]);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMenuDetailsSave = async (menu) => {
    if (!menuEditForm.menuDate) {
      setFormError("Укажите дату меню.");
      return;
    }
    if (!menuEditForm.mealType) {
      setFormError("Укажите тип приема пищи.");
      return;
    }
    const priceValue = menuEditForm.price === "" ? null : Number(menuEditForm.price);
    if (priceValue !== null && (Number.isNaN(priceValue) || priceValue < 0)) {
      setFormError("Цена должна быть неотрицательной.");
      return;
    }
    if (priceValue !== null && priceValue > MENU_PRICE_MAX) {
      setFormError("Цена не может превышать 99 999 999.99.");
      return;
    }
    setSavingMenuDetailsId(menu.id);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest(`/menus/${menu.id}`, {
        method: "PUT",
        token,
        body: {
          menu_date: menuEditForm.menuDate,
          meal_type: menuEditForm.mealType,
          title: menuEditForm.title.trim() || null,
          price: priceValue,
        },
      });
      setFormSuccess(`Меню #${menu.id} обновлено.`);
      setEditingMenuId(null);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSavingMenuDetailsId(null);
    }
  };

  const handleRemainingChange = (menuId, itemId, value) => {
    setMenuEdits((prev) => ({
      ...prev,
      [menuId]: {
        ...(prev[menuId] || {}),
        [itemId]: value,
      },
    }));
  };

  const handleSaveMenu = async (menu) => {
    const edits = menuEdits[menu.id] || {};
    if (Object.keys(edits).length === 0) {
      setFormError("");
      setFormSuccess("зменений нет.");
      return;
    }
    let validationError = "";
    const updatedItems = menu.menu_items.map((item) => {
      const overrideRaw = edits[item.id];
      const override = overrideRaw === undefined ? item.remaining_qty : Number(overrideRaw);
      const planned = item.planned_qty;
      if (overrideRaw !== undefined) {
        if (Number.isNaN(override) || override < 0) {
          validationError = "Остаток должен быть неотрицательным числом.";
        }
        if (planned != null && override > planned) {
          validationError = "Остаток не может превышать план.";
        }
      }
      return {
        dish_id: item.dish.id,
        portion_size: item.portion_size,
        planned_qty: planned,
        remaining_qty: override,
      };
    });

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSavingMenuId(menu.id);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest(`/menus/${menu.id}`, {
        method: "PUT",
        token,
        body: {
          items: updatedItems,
        },
      });
      setFormSuccess(`Меню от ${formatDate(menu.menu_date)} обновлено.`);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSavingMenuId(null);
    }
  };

  const handleDeleteMenu = async (menuId) => {
    if (!menuId) {
      return;
    }
    if (!window.confirm("Удалить меню? Это действие необратимо.")) {
      return;
    }
    setDeletingMenuId(menuId);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest(`/menus/${menuId}`, {
        method: "DELETE",
        token,
      });
      setFormSuccess(`Меню #${menuId} удалено.`);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setDeletingMenuId(null);
    }
  };

  const handleDeleteDish = async (dishId) => {
    if (!dishId) {
      return;
    }
    if (!window.confirm("Удалить блюдо? Если оно используется в меню, удаление будет запрещено.")) {
      return;
    }
    setDeletingDishId(dishId);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest(`/dishes/${dishId}`, {
        method: "DELETE",
        token,
      });
      setFormSuccess(`Блюдо #${dishId} удалено.`);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setDeletingDishId(null);
    }
  };

  const renderMenuCard = (menu) => {
    const isEditing = editingMenuId === menu.id;
    return (
      <article key={menu.id} className="data-card">
        <header>
          <strong>
            {MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type} ·{" "}
            {formatDate(menu.menu_date)}
          </strong>
          <span className="status-pill status-neutral">Меню #{menu.id}</span>
        </header>
        {isEditing ? (
          <div className="form-group">
            <div className="option-grid">
              <label className="form-field">
                Дата
                <input
                  type="date"
                  name="menuDate"
                  value={menuEditForm.menuDate}
                  onChange={handleMenuEditChange}
                />
              </label>
              <label className="form-field">
                Тип
                <select
                  name="mealType"
                  value={menuEditForm.mealType}
                  onChange={handleMenuEditChange}
                >
                  <option value="breakfast">Завтрак</option>
                  <option value="lunch">Обед</option>
                </select>
              </label>
              <label className="form-field">
                Заголовок
                <input
                  type="text"
                  name="title"
                  value={menuEditForm.title}
                  onChange={handleMenuEditChange}
                  placeholder="Например: Меню для 5А"
                />
              </label>
              <label className="form-field">
                Цена (₽)
                <input
                  type="number"
                  name="price"
                  min="0"
                max="99999999.99"
                  step="0.01"
                  value={menuEditForm.price}
                  onChange={handleMenuEditChange}
                  placeholder="0.00"
                />
              </label>
            </div>
            <div className="button-row" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="primary-button"
                onClick={() => handleMenuDetailsSave(menu)}
                disabled={savingMenuDetailsId === menu.id}
              >
                {savingMenuDetailsId === menu.id ? "Сохраняем..." : "Сохранить параметры"}
              </button>
              <button type="button" className="secondary-button" onClick={cancelMenuEdit}>
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            {menu.title && <div className="summary">{menu.title}</div>}
            {menu.price != null && <div className="summary">Цена: {menu.price} ₽</div>}
          </>
        )}
        <div className="data-list">
          {menu.menu_items.map((item) => {
            const remainingValue =
              menuEdits[menu.id]?.[item.id] ?? item.remaining_qty ?? "";
            return (
              <div key={item.id} className="data-list-row">
                <span>{item.dish?.name || `Блюдо #${item.dish?.id}`}</span>
                <span>
                  План: {item.planned_qty ?? "—"} · Остаток:{" "}
                  <input
                    type="number"
                    min="0"
                    value={remainingValue}
                    onChange={(event) =>
                      handleRemainingChange(menu.id, item.id, event.target.value)
                    }
                    className="compact-input"
                  />
                </span>
              </div>
            );
          })}
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => startMenuEdit(menu)}
            disabled={isEditing}
          >
            {isEditing ? "Редактирование" : "Редактировать"}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => handleSaveMenu(menu)}
            disabled={savingMenuId === menu.id}
          >
            {savingMenuId === menu.id ? "Сохраняем..." : "Сохранить остатки"}
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={() => handleDeleteMenu(menu.id)}
            disabled={deletingMenuId === menu.id}
          >
            {deletingMenuId === menu.id ? "Удаляем..." : "Удалить меню"}
          </button>
        </div>
      </article>
    );
  };

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Меню и блюда</h2>
        <p>Создавайте блюда, формируйте меню и обновляйте остатки готовых блюд.</p>
      </header>

      <CookNav />
<form className="auth-form" onSubmit={handleDishSubmit}>
        <div className="form-group">
          <h3>Новое блюдо</h3>
          <div className="option-grid">
            <label className="form-field">
              Название
              <input
                type="text"
                name="name"
                value={dishForm.name}
                onChange={handleDishChange}
                placeholder="Например: борщ"
                required
              />
            </label>
            <label className="form-field">
              Описание
              <input
                type="text"
                name="description"
                value={dishForm.description}
                onChange={handleDishChange}
                placeholder="По желанию"
              />
            </label>
          </div>
          <div className="form-group" style={{ marginTop: "0.75rem" }}>
            <h4 style={{ margin: "0 0 0.5rem" }}>Аллергены</h4>
            <div className="option-grid">
              {allergies.length === 0 && (
                <div className="form-hint">Аллергены пока не добавлены.</div>
              )}
              {allergies.map((item) => (
                <label key={item.id} className="option-card">
                  <input
                    type="checkbox"
                    checked={dishForm.allergyIds.includes(item.id)}
                    onChange={() => toggleDishAllergy(item.id)}
                  />
                  <span>{item.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

<div className="button-row">
          <button type="submit" className="secondary-button" disabled={submitting}>
            {submitting ? "Сохраняем..." : "Добавить блюдо"}
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>Список блюд</h3>
        {loading ? (
          <div className="form-hint">Загружаем блюда...</div>
        ) : (
          <div className="data-grid">
            {dishes.length === 0 && (
              <div className="summary">Пока нет блюд в справочнике.</div>
            )}
              {dishes.map((dish) => {
                const isUsed = usedDishIds.has(dish.id);
                const isEditing = editingDishId === dish.id;
                return (
                  <article key={dish.id} className="data-card">
                    <header>
                      <strong>{dish.name}</strong>
                      <span className="status-pill status-neutral">
                        {dish.is_active ? "Активно" : "Неактивно"}
                      </span>
                    </header>
                  {isEditing ? (
                    <div className="form-group">
                      <div className="option-grid">
                        <label className="form-field">
                          Название
                          <input
                            type="text"
                            name="name"
                            value={dishEditForm.name}
                            onChange={handleDishEditChange}
                          />
                        </label>
                        <label className="form-field">
                          Описание
                          <input
                            type="text"
                            name="description"
                            value={dishEditForm.description}
                            onChange={handleDishEditChange}
                          />
                        </label>
                        <label className="form-field">
                          Активно
                          <input
                            type="checkbox"
                            name="isActive"
                            checked={dishEditForm.isActive}
                            onChange={handleDishEditChange}
                          />
                        </label>
                      </div>
                      <div className="form-group" style={{ marginTop: "0.75rem" }}>
                        <h4 style={{ margin: "0 0 0.5rem" }}>Аллергены</h4>
                        <div className="option-grid">
                          {allergies.length === 0 && (
                            <div className="form-hint">Аллергены пока не добавлены.</div>
                          )}
                          {allergies.map((item) => (
                            <label key={item.id} className="option-card">
                              <input
                                type="checkbox"
                                checked={dishEditForm.allergyIds.includes(item.id)}
                                onChange={() => toggleDishEditAllergy(item.id)}
                              />
                              <span>{item.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="button-row" style={{ marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => handleDishEditSave(dish.id)}
                            disabled={savingDishId === dish.id}
                          >
                            {savingDishId === dish.id ? "Сохраняем..." : "Сохранить"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={cancelDishEdit}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      dish.description && <div className="summary">{dish.description}</div>
                    )}
                    {dish.allergies?.length > 0 && (
                      <div className="form-hint">
                        Аллергены: {dish.allergies.map((item) => item.name).join(", ")}
                      </div>
                    )}
                    <div className="button-row">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => startDishEdit(dish)}
                        disabled={isEditing}
                      >
                        {isEditing ? "Редактирование" : "Редактировать"}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleDeleteDish(dish.id)}
                        disabled={deletingDishId === dish.id || isUsed || isEditing}
                      >
                        {deletingDishId === dish.id ? "Удаляем..." : "Удалить"}
                      </button>
                      {isUsed && (
                        <span className="form-hint">
                        Блюдо используется в меню.
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <form className="auth-form" onSubmit={handleMenuSubmit}>
        <div className="form-group">
          <h3>Создать меню</h3>
          <div className="option-grid">
            <label className="form-field">
              Дата
              <input
                type="date"
                name="menuDate"
                value={menuForm.menuDate}
                onChange={handleMenuChange}
                required
              />
            </label>
            <label className="form-field">
              Тип
              <select name="mealType" value={menuForm.mealType} onChange={handleMenuChange}>
                <option value="breakfast">Завтрак</option>
                <option value="lunch">Обед</option>
              </select>
            </label>
            <label className="form-field">
              Заголовок
              <input
                type="text"
                name="title"
                value={menuForm.title}
                onChange={handleMenuChange}
                placeholder="Например: Меню для 5А"
              />
            </label>
            <label className="form-field">
              Цена (₽)
              <input
                type="number"
                name="price"
                min="0"
                max="99999999.99"
                step="0.01"
                value={menuForm.price}
                onChange={handleMenuChange}
                placeholder="0.00"
              />
            </label>
          </div>
        </div>

        <div className="form-group">
          <h3>Позиции меню</h3>
          <div className="option-grid">
            <label className="form-field">
              Блюдо
              <select
                name="dishId"
                value={menuItemForm.dishId}
                onChange={handleMenuItemChange}
              >
                <option value="">Выберите блюдо</option>
                {dishes.map((dish) => (
                  <option key={dish.id} value={dish.id}>
                    {dish.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Порция
              <input
                type="number"
                name="portionSize"
                min="0"
                step="0.01"
                value={menuItemForm.portionSize}
                onChange={handleMenuItemChange}
                placeholder="0.00"
              />
            </label>
            <label className="form-field">
              План
              <input
                type="number"
                name="plannedQty"
                min="0"
                value={menuItemForm.plannedQty}
                onChange={handleMenuItemChange}
                placeholder="0"
              />
            </label>
            <label className="form-field">
              Остаток
              <input
                type="number"
                name="remainingQty"
                min="0"
                value={menuItemForm.remainingQty}
                onChange={handleMenuItemChange}
                placeholder="0"
              />
            </label>
          </div>
          <div className="button-row" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="secondary-button" onClick={handleAddMenuItem}>
              Добавить позицию
            </button>
          </div>
        </div>

        {menuItems.length > 0 && (
          <div className="form-group">
            <h3>Состав меню</h3>
            <div className="data-grid">
              {menuItems.map((item) => {
                const dish = dishMap.get(item.dishId);
                return (
                  <div key={item.id} className="data-card">
                    <header>
                      <strong>{dish?.name || `Блюдо #${item.dishId}`}</strong>
                      <span className="status-pill status-neutral">
                        План: {item.plannedQty || "—"}
                      </span>
                    </header>
                    <div className="summary">
                      Порция: {item.portionSize || "—"} · Остаток:{" "}
                      {item.remainingQty || "—"}
                    </div>
                    <div className="button-row">
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleRemoveMenuItem(item.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

<div className="button-row">
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Сохраняем..." : "Создать меню"}
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>Текущие меню</h3>
        {loading ? (
          <div className="form-hint">Загружаем меню...</div>
        ) : (
          <div className="data-grid">
            {menus.length === 0 && (
              <div className="summary">Пока нет опубликованных меню.</div>
            )}
            {menus.map(renderMenuCard)}
          </div>
        )}
      </div>
    </section>
  );
}


