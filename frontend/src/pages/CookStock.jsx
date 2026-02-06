import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import CookNav from "../components/CookNav.jsx";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const buildProductForm = () => ({
  name: "",
  unit: "",
  category: "",
});

const buildProductEditForm = (product) => ({
  name: product?.name || "",
  unit: product?.unit || "",
  category: product?.category || "",
  isActive: product?.is_active ?? true,
});

const buildTransactionForm = () => ({
  productId: "",
  direction: "in",
  quantity: "",
  reason: "",
});

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ru-RU");
};

export default function CookStock() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [productForm, setProductForm] = useState(buildProductForm);
  const [productEditForm, setProductEditForm] = useState(buildProductEditForm);
  const [editingProductId, setEditingProductId] = useState(null);
  const [savingProductId, setSavingProductId] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [transactionForm, setTransactionForm] = useState(buildTransactionForm);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const productMap = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [productsResponse, stockResponse, transactionsResponse] = await Promise.all([
        apiRequest("/products/", { token }),
        apiRequest("/products/stock", { token }),
        apiRequest("/inventory-transactions/", { token }),
      ]);
      setProducts(productsResponse.items || []);
      setStockItems(stockResponse.items || []);
      setTransactions((transactionsResponse.items || []).slice(0, 10));
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

  const handleProductChange = (event) => {
    const { name, value } = event.target;
    setProductForm((prev) => ({ ...prev, [name]: value }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const handleProductEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProductEditForm((prev) => ({
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

  const startProductEdit = (product) => {
    setEditingProductId(product.id);
    setProductEditForm(buildProductEditForm(product));
    setFormError("");
    setFormSuccess("");
  };

  const cancelProductEdit = () => {
    setEditingProductId(null);
    setProductEditForm(buildProductEditForm());
  };

  const handleTransactionChange = (event) => {
    const { name, value } = event.target;
    setTransactionForm((prev) => ({ ...prev, [name]: value }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const handleProductEditSave = async (productId) => {
    const name = productEditForm.name.trim();
    const unit = productEditForm.unit.trim();
    if (!name || !unit) {
      setFormError("Укажите название и единицу измерения.");
      return;
    }
    setSavingProductId(productId);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest(`/products/${productId}`, {
        method: "PUT",
        token,
        body: {
          name,
          unit,
          category: productEditForm.category.trim() || null,
          is_active: Boolean(productEditForm.isActive),
        },
      });
      setFormSuccess("Продукт обновлен.");
      setEditingProductId(null);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSavingProductId(null);
    }
  };

  const handleProductDelete = async (productId) => {
    if (!productId) {
      return;
    }
    if (!window.confirm("Удалить продукт? Это действие необратимо.")) {
      return;
    }
    setDeletingProductId(productId);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest(`/products/${productId}`, {
        method: "DELETE",
        token,
      });
      setFormSuccess("Продукт удален.");
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    if (!productForm.name.trim() || !productForm.unit.trim()) {
      setFormError("Укажите название продукта и единицу измерения.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest("/products/", {
        method: "POST",
        token,
        body: {
          name: productForm.name.trim(),
          unit: productForm.unit.trim(),
          category: productForm.category.trim() || null,
          is_active: true,
        },
      });
      setFormSuccess("Продукт добавлен в каталог.");
      setProductForm(buildProductForm());
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransactionSubmit = async (event) => {
    event.preventDefault();
    const productId = Number(transactionForm.productId);
    const quantity = Number(transactionForm.quantity);
    if (!productId || Number.isNaN(quantity) || quantity <= 0) {
      setFormError("Укажите продукт и количество для операции склада.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest("/inventory-transactions/", {
        method: "POST",
        token,
        body: {
          product_id: productId,
          quantity,
          direction: transactionForm.direction,
          reason: transactionForm.reason.trim() || null,
        },
      });
      setFormSuccess("Операция склада сохранена.");
      setTransactionForm((prev) => ({
        ...prev,
        quantity: "",
        reason: "",
      }));
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Остатки и склад</h2>
        <p>Контролируйте остатки продуктов и фиксируйте движения склада.</p>
      </header>

      <CookNav />
<div className="form-group">
        <h3>Остатки на складе</h3>
        {loading ? (
          <div className="form-hint">Загружаем склад...</div>
        ) : (
          <div className="data-grid">
            {stockItems.length === 0 && (
              <div className="summary">Пока нет данных по продуктам.</div>
            )}
            {stockItems.map((item) => (
              <div key={item.id} className="data-card">
                <header>
                  <strong>{item.name}</strong>
                  <span className="status-pill status-neutral">
                    {Number(item.stock).toFixed(3)} {item.unit}
                  </span>
                </header>
                {item.category && <div className="form-hint">Категория: {item.category}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="auth-form" onSubmit={handleTransactionSubmit}>
        <div className="form-group">
          <h3>Операция склада</h3>
          <div className="option-grid">
            <label className="form-field">
              Продукт
              <select
                name="productId"
                value={transactionForm.productId}
                onChange={handleTransactionChange}
                required
              >
                <option value="">Выберите продукт</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.unit})
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Тип операции
              <select
                name="direction"
                value={transactionForm.direction}
                onChange={handleTransactionChange}
              >
                <option value="in">Приход</option>
                <option value="out">Расход</option>
              </select>
            </label>
            <label className="form-field">
              Количество
              <input
                type="number"
                name="quantity"
                min="0"
                step="0.001"
                value={transactionForm.quantity}
                onChange={handleTransactionChange}
                placeholder="0.000"
                required
              />
            </label>
          </div>
        </div>

        <label className="form-field">
          Причина
          <input
            type="text"
            name="reason"
            value={transactionForm.reason}
            onChange={handleTransactionChange}
            placeholder="Например: списание на завтраки"
          />
        </label>
<div className="button-row">
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Сохраняем..." : "Сохранить операцию"}
          </button>
        </div>
      </form>

      <form className="auth-form" onSubmit={handleProductSubmit}>
        <div className="form-group">
          <h3>Добавить продукт</h3>
          <div className="option-grid">
            <label className="form-field">
              Название
              <input
                type="text"
                name="name"
                value={productForm.name}
                onChange={handleProductChange}
                placeholder="Например: крупа гречневая"
                required
              />
            </label>
            <label className="form-field">
              Единица измерения
              <input
                type="text"
                name="unit"
                value={productForm.unit}
                onChange={handleProductChange}
                placeholder="кг"
                required
              />
            </label>
            <label className="form-field">
              Категория
              <input
                type="text"
                name="category"
                value={productForm.category}
                onChange={handleProductChange}
                placeholder="Например: бакалея"
              />
            </label>
          </div>
        </div>
<div className="button-row">
          <button type="submit" className="secondary-button" disabled={submitting}>
            {submitting ? "Добавляем..." : "Добавить продукт"}
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>Каталог продуктов</h3>
        {loading ? (
          <div className="form-hint">Загружаем продукты...</div>
        ) : (
          <div className="data-grid">
            {products.length === 0 && (
              <div className="summary">Пока нет продуктов в каталоге.</div>
            )}
            {products.map((product) => {
              const isEditing = editingProductId === product.id;
              return (
                <article key={product.id} className="data-card">
                  <header>
                    <strong>{product.name}</strong>
                    <span className="status-pill status-neutral">
                      {product.is_active ? "Активно" : "Неактивно"}
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
                            value={productEditForm.name}
                            onChange={handleProductEditChange}
                          />
                        </label>
                        <label className="form-field">
                          Единица
                          <input
                            type="text"
                            name="unit"
                            value={productEditForm.unit}
                            onChange={handleProductEditChange}
                          />
                        </label>
                        <label className="form-field">
                          Категория
                          <input
                            type="text"
                            name="category"
                            value={productEditForm.category}
                            onChange={handleProductEditChange}
                          />
                        </label>
                        <label className="form-field">
                          Активно
                          <input
                            type="checkbox"
                            name="isActive"
                            checked={productEditForm.isActive}
                            onChange={handleProductEditChange}
                          />
                        </label>
                      </div>
                      <div className="button-row" style={{ marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => handleProductEditSave(product.id)}
                          disabled={savingProductId === product.id}
                        >
                          {savingProductId === product.id ? "Сохраняем..." : "Сохранить"}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={cancelProductEdit}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {product.category && (
                        <div className="form-hint">Категория: {product.category}</div>
                      )}
                      <div className="summary">Единица: {product.unit}</div>
                    </>
                  )}
                  <div className="button-row">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startProductEdit(product)}
                      disabled={isEditing}
                    >
                      {isEditing ? "Редактирование" : "Редактировать"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleProductDelete(product.id)}
                      disabled={deletingProductId === product.id || isEditing}
                    >
                      {deletingProductId === product.id ? "Удаляем..." : "Удалить"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="form-group">
        <h3>Последние операции</h3>
        <div className="data-grid">
          {transactions.length === 0 && (
            <div className="summary">Пока нет операций склада.</div>
          )}
          {transactions.map((item) => {
            const product = productMap.get(item.product_id);
            const name = product?.name || `Продукт #${item.product_id}`;
            const unit = product?.unit || "";
            return (
              <div key={item.id} className="data-card">
                <header>
                  <strong>{name}</strong>
                  <span
                    className={`status-pill status-${item.direction === "in" ? "success" : "danger"}`}
                  >
                    {item.direction === "in" ? "+" : "-"}
                    {Number(item.quantity).toFixed(3)} {unit}
                  </span>
                </header>
                <div className="form-hint">{formatDateTime(item.created_at)}</div>
                {item.reason && <div className="summary">{item.reason}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


