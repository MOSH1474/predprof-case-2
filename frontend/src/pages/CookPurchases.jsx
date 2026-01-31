import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCookData, updateCookData } from "../utils/cookStorage.js";

const REQUEST_DEFAULTS = {
  product: "",
  quantity: "",
  unit: "кг",
  reason: "",
};

export default function CookPurchases() {
  const [requests, setRequests] = useState(() => getCookData().requests);
  const [requestForm, setRequestForm] = useState(REQUEST_DEFAULTS);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  useEffect(() => {
    updateCookData({ requests });
  }, [requests]);

  const handleRequestChange = (event) => {
    const { name, value } = event.target;
    setRequestForm((prev) => ({ ...prev, [name]: value }));
    if (requestError) {
      setRequestError("");
    }
    if (requestSuccess) {
      setRequestSuccess("");
    }
  };

  const handleRequestSubmit = (event) => {
    event.preventDefault();
    const quantity = Number(requestForm.quantity);

    if (!requestForm.product || Number.isNaN(quantity)) {
      setRequestError("Укажите продукт и количество для заявки.");
      return;
    }

    if (quantity <= 0) {
      setRequestError("Количество должно быть больше нуля.");
      return;
    }

    const newRequest = {
      id: Date.now(),
      product: requestForm.product.trim(),
      quantity,
      unit: requestForm.unit.trim() || "шт",
      reason: requestForm.reason.trim(),
      createdAt: new Date().toLocaleDateString("ru-RU"),
    };

    setRequests((prev) => [newRequest, ...prev]);
    setRequestForm(REQUEST_DEFAULTS);
    setRequestSuccess("Заявка на закупку отправлена.");
  };

  return (
    <section className="page">
      <header className="auth-header">
        <h2>Закупки кухни</h2>
        <p>Оформляйте заявки и следите за историей закупок.</p>
      </header>

      <div className="button-row">
        <Link to="/cook" className="secondary-button">
          Назад к разделам
        </Link>
      </div>

      <form className="auth-form" onSubmit={handleRequestSubmit}>
        <div className="form-group">
          <h3>Заявка на закупку</h3>
          <p>Оформляйте запросы на пополнение продуктов для кухни.</p>
          <div className="option-grid">
            <label className="form-field">
              Продукт
              <input
                type="text"
                name="product"
                value={requestForm.product}
                onChange={handleRequestChange}
                placeholder="Например: крупа гречневая"
                required
              />
            </label>
            <label className="form-field">
              Количество
              <input
                type="number"
                name="quantity"
                min="0"
                value={requestForm.quantity}
                onChange={handleRequestChange}
                placeholder="0"
                required
              />
            </label>
            <label className="form-field">
              Единица измерения
              <input
                type="text"
                name="unit"
                value={requestForm.unit}
                onChange={handleRequestChange}
                placeholder="кг"
              />
            </label>
          </div>
        </div>

        <label className="form-field">
          Комментарий
          <textarea
            rows="3"
            name="reason"
            value={requestForm.reason}
            onChange={handleRequestChange}
            placeholder="Например: нужно пополнить склад к понедельнику"
          />
        </label>

        {requestError && (
          <div className="form-error" role="alert">
            {requestError}
          </div>
        )}
        {requestSuccess && <div className="form-success">{requestSuccess}</div>}

        <div className="button-row">
          <button type="submit" className="primary-button">
            Отправить заявку
          </button>
        </div>
      </form>

      <div className="form-group">
        <h3>История заявок</h3>
        <div className="option-grid">
          {requests.length === 0 && (
            <div className="summary">Пока нет заявок на закупку.</div>
          )}
          {requests.map((entry) => (
            <div key={entry.id} className="option-card">
              <strong>{entry.product}</strong>
              <span>
                {entry.quantity} {entry.unit}
              </span>
              <span>Дата: {entry.createdAt}</span>
              {entry.reason && <span>Комментарий: {entry.reason}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}