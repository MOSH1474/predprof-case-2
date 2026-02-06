import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import CookNav from "../components/CookNav.jsx";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const buildItemForm = () => ({
  productId: "",
  quantity: "",
  unitPrice: "",
});

const buildRequestForm = () => ({
  note: "",
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

export default function CookPurchases() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [itemForm, setItemForm] = useState(buildItemForm);
  const [requestForm, setRequestForm] = useState(buildRequestForm);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
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
      const [productsResponse, requestsResponse] = await Promise.all([
        apiRequest("/products/", { token }),
        apiRequest("/purchase-requests/", { token }),
      ]);
      setProducts(productsResponse.items || []);
      setRequests(requestsResponse.items || []);
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

  const handleItemChange = (event) => {
    const { name, value } = event.target;
    setItemForm((prev) => ({ ...prev, [name]: value }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const handleRequestChange = (event) => {
    const { name, value } = event.target;
    setRequestForm((prev) => ({ ...prev, [name]: value }));
    if (formError) {
      setFormError("");
    }
    if (formSuccess) {
      setFormSuccess("");
    }
  };

  const handleAddItem = () => {
    const productId = Number(itemForm.productId);
    const quantity = Number(itemForm.quantity);
    const unitPrice = itemForm.unitPrice ? Number(itemForm.unitPrice) : null;
    if (!productId || Number.isNaN(quantity) || quantity <= 0) {
      setFormError("Выберите продукт и укажите количество.");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: `${productId}-${Date.now()}`,
        productId,
        quantity,
        unitPrice: unitPrice && unitPrice >= 0 ? unitPrice : null,
      },
    ]);
    setItemForm(buildItemForm());
    setFormError("");
  };

  const handleRemoveItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmitRequest = async (event) => {
    event.preventDefault();
    if (items.length === 0) {
      setFormError("Добавьте хотя бы одну позицию для заявки.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      await apiRequest("/purchase-requests/", {
        method: "POST",
        token,
        body: {
          note: requestForm.note.trim() || null,
          items: items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
        },
      });
      setFormSuccess("Заявка отправлена.");
      setItems([]);
      setRequestForm(buildRequestForm());
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
        <h2>Закупки кухни</h2>
        <p>Создавайте заявки на закупку продуктов и отслеживайте их статус.</p>
      </header>

      <CookNav />
<form className="auth-form" onSubmit={handleSubmitRequest}>
        <div className="form-group">
          <h3>Новая заявка</h3>
          <div className="option-grid">
            <label className="form-field">
              Продукт
              <select
                name="productId"
                value={itemForm.productId}
                onChange={handleItemChange}
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
              Количество
              <input
                type="number"
                name="quantity"
                min="0"
                step="0.001"
                value={itemForm.quantity}
                onChange={handleItemChange}
                placeholder="0.000"
              />
            </label>
            <label className="form-field">
              Цена за единицу (опционально)
              <input
                type="number"
                name="unitPrice"
                min="0"
                step="0.01"
                value={itemForm.unitPrice}
                onChange={handleItemChange}
                placeholder="0.00"
              />
            </label>
          </div>
          <div className="button-row" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="secondary-button" onClick={handleAddItem}>
              Добавить позицию
            </button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="form-group">
            <h3>Позиции заявки</h3>
            <div className="data-grid">
              {items.map((item) => {
                const product = productMap.get(item.productId);
                return (
                  <div key={item.id} className="data-card">
                    <header>
                      <strong>{product?.name || `Продукт #${item.productId}`}</strong>
                      <span className="status-pill status-neutral">
                        {Number(item.quantity).toFixed(3)} {product?.unit || ""}
                      </span>
                    </header>
                    {item.unitPrice !== null && (
                      <div className="summary">
                        Цена: {Number(item.unitPrice).toFixed(2)} ₽
                      </div>
                    )}
                    <div className="button-row">
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleRemoveItem(item.id)}
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

        <label className="form-field">
          Комментарий
          <textarea
            rows="3"
            name="note"
            value={requestForm.note}
            onChange={handleRequestChange}
            placeholder="Например: нужно пополнить склад к понедельнику"
          />
        </label>

<div className="button-row">
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Отправляем..." : "Отправить заявку"}
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>История заявок</h3>
        {loading ? (
          <div className="form-hint">Загружаем заявки...</div>
        ) : (
          <div className="data-grid">
            {requests.length === 0 && (
              <div className="summary">Пока нет заявок на закупку.</div>
            )}
            {requests.map((request) => (
              <div key={request.id} className="data-card">
                <header>
                  <strong>Заявка #{request.id}</strong>
                  <span className={`status-pill status-${request.status}`}>
                    {request.status === "pending"
                      ? "На рассмотрении"
                      : request.status === "approved"
                      ? "Одобрена"
                      : "Отклонена"}
                  </span>
                </header>
                <div className="form-hint">{formatDateTime(request.requested_at)}</div>
                {request.note && <div className="summary">{request.note}</div>}
                <div className="data-list">
                  {request.items.map((item) => (
                    <div key={item.id} className="data-list-row">
                      <span>{item.product.name}</span>
                      <span>
                        {Number(item.quantity).toFixed(3)} {item.product.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


