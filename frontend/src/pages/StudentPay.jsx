import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const MEAL_TYPE_LABELS = {
  breakfast: "Завтрак",
  lunch: "Обед",
};

const buildCard = () => ({
  cardNumber: "",
  cardHolder: "",
  cardExpiry: "",
  cardCvc: "",
});

const buildSubscriptionForm = () => {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 30);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    ...buildCard(),
  };
};

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

const formatMoney = (value, currency = "RUB") => {
  if (value === null || value === undefined) {
    return "—";
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return String(value);
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(parsed);
};

const isWithinPeriod = (dateValue, start, end) => {
  if (!dateValue || !start || !end) {
    return false;
  }
  return dateValue >= start && dateValue <= end;
};

function PaymentCardFields({ values, onChange, disabled = false }) {
  return (
    <div className="option-grid">
      <label className="form-field">
        Номер карты
        <input
          type="text"
          name="cardNumber"
          value={values.cardNumber}
          onChange={onChange}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          autoComplete="cc-number"
          disabled={disabled}
        />
      </label>
      <label className="form-field">
        Имя держателя
        <input
          type="text"
          name="cardHolder"
          value={values.cardHolder}
          onChange={onChange}
          placeholder="Иван Иванов"
          autoComplete="cc-name"
          disabled={disabled}
        />
      </label>
      <label className="form-field">
        Срок действия
        <input
          type="text"
          name="cardExpiry"
          value={values.cardExpiry}
          onChange={onChange}
          placeholder="MM/YY"
          inputMode="numeric"
          autoComplete="cc-exp"
          disabled={disabled}
        />
      </label>
      <label className="form-field">
        CVC
        <input
          type="text"
          name="cardCvc"
          value={values.cardCvc}
          onChange={onChange}
          placeholder="123"
          inputMode="numeric"
          autoComplete="cc-csc"
          disabled={disabled}
        />
      </label>
    </div>
  );
}

export default function StudentPay() {
  const { token, user } = useAuth();
  const [menus, setMenus] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuCard, setMenuCard] = useState(buildCard);
  const [menuPaymentError, setMenuPaymentError] = useState("");
  const [menuPaymentSuccess, setMenuPaymentSuccess] = useState("");
  const [menuPaying, setMenuPaying] = useState(false);

  const [subscriptionForm, setSubscriptionForm] = useState(buildSubscriptionForm);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [subscriptionSuccess, setSubscriptionSuccess] = useState("");
  const [subscriptionPaying, setSubscriptionPaying] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const toast = useToast();

  const sortedMenus = useMemo(() => {
    return [...menus].sort((a, b) => {
      const left = new Date(a.menu_date).getTime();
      const right = new Date(b.menu_date).getTime();
      return right - left;
    });
  }, [menus]);

  const paidMenuIds = useMemo(() => {
    const ids = new Set();
    payments.forEach((payment) => {
      if (
        payment.payment_type === "one_time" &&
        payment.status === "paid" &&
        payment.menu_id
      ) {
        ids.add(payment.menu_id);
      }
    });
    return ids;
  }, [payments]);

  const subscriptionPayments = useMemo(() => {
    return payments.filter(
      (payment) => payment.payment_type === "subscription" && payment.status === "paid"
    );
  }, [payments]);

  const activeSubscription = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const candidates = subscriptionPayments.filter((payment) =>
      isWithinPeriod(today, payment.period_start, payment.period_end)
    );
    if (!candidates.length) {
      return null;
    }
    return candidates.sort((a, b) =>
      a.period_end < b.period_end ? 1 : -1
    )[0];
  }, [subscriptionPayments]);

  const isMenuCoveredBySubscription = (menu) => {
    return subscriptionPayments.some((payment) =>
      isWithinPeriod(menu.menu_date, payment.period_start, payment.period_end)
    );
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setLoadError("");
      let menuItems = [];
      let paymentItems = [];
      let errorMessage = "";

      try {
        const menusResponse = await apiRequest("/menus/", { token });
        menuItems = menusResponse.items || [];
      } catch (err) {
        errorMessage = err.message;
      }

      try {
        const paymentsResponse = await apiRequest("/payments/me", { token });
        paymentItems = paymentsResponse.items || [];
      } catch (err) {
        errorMessage = errorMessage
          ? `${errorMessage}. ${err.message}`
          : err.message;
      }

      setMenus(menuItems);
      setPayments(paymentItems);
      setLoadError(errorMessage);
      setLoading(false);
    };

    loadData();
  }, [token]);

  useEffect(() => {
    if (loadError) {
      toast.error(loadError);
      setLoadError("");
    }
    if (menuPaymentError) {
      toast.error(menuPaymentError);
      setMenuPaymentError("");
    }
    if (menuPaymentSuccess) {
      toast.success(menuPaymentSuccess);
      setMenuPaymentSuccess("");
    }
    if (subscriptionError) {
      toast.error(subscriptionError);
      setSubscriptionError("");
    }
    if (subscriptionSuccess) {
      toast.success(subscriptionSuccess);
      setSubscriptionSuccess("");
    }
  }, [
    loadError,
    menuPaymentError,
    menuPaymentSuccess,
    subscriptionError,
    subscriptionSuccess,
    toast,
  ]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === "cook") {
    return <Navigate to="/cook" replace />;
  }

  const refreshPayments = async () => {
    try {
      const paymentsResponse = await apiRequest("/payments/me", { token });
      setPayments(paymentsResponse.items || []);
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const handleMenuCardChange = (event) => {
    const { name, value } = event.target;
    setMenuCard((prev) => ({ ...prev, [name]: value }));
    if (menuPaymentError) {
      setMenuPaymentError("");
    }
    if (menuPaymentSuccess) {
      setMenuPaymentSuccess("");
    }
  };

  const handleSubscriptionChange = (event) => {
    const { name, value } = event.target;
    setSubscriptionForm((prev) => ({ ...prev, [name]: value }));
    if (subscriptionError) {
      setSubscriptionError("");
    }
    if (subscriptionSuccess) {
      setSubscriptionSuccess("");
    }
  };

  const openMenuPayment = (menu) => {
    setActiveMenuId(menu.id);
    setMenuCard(buildCard());
    setMenuPaymentError("");
    setMenuPaymentSuccess("");
  };

  const closeMenuPayment = () => {
    setActiveMenuId(null);
    setMenuCard(buildCard());
    setMenuPaymentError("");
  };

  const openSubscriptionModal = () => {
    setIsSubscriptionModalOpen(true);
    setSubscriptionError("");
  };

  const closeSubscriptionModal = () => {
    setIsSubscriptionModalOpen(false);
    setSubscriptionError("");
  };

  const handleMenuPayment = async (event, menu) => {
    event.preventDefault();

    if (
      !menuCard.cardNumber.trim() ||
      !menuCard.cardHolder.trim() ||
      !menuCard.cardExpiry.trim() ||
      !menuCard.cardCvc.trim()
    ) {
      setMenuPaymentError("Заполните платежные данные.");
      return;
    }

    setMenuPaying(true);
    setMenuPaymentError("");
    try {
      await apiRequest("/payments/one-time", {
        method: "POST",
        token,
        body: {
          menu_id: menu.id,
        },
      });
      setMenuPaymentSuccess(
        `Оплата за ${MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type} от ${formatDate(
          menu.menu_date
        )} прошла успешно.`
      );
      closeMenuPayment();
      await refreshPayments();
    } catch (err) {
      setMenuPaymentError(err.message);
    } finally {
      setMenuPaying(false);
    }
  };

  const handleSubscriptionSubmit = async (event) => {
    event.preventDefault();

    if (!subscriptionForm.periodStart || !subscriptionForm.periodEnd) {
      setSubscriptionError("Выберите период абонемента.");
      return;
    }

    if (subscriptionForm.periodEnd < subscriptionForm.periodStart) {
      setSubscriptionError("Дата окончания должна быть не раньше даты начала.");
      return;
    }

    if (
      !subscriptionForm.cardNumber.trim() ||
      !subscriptionForm.cardHolder.trim() ||
      !subscriptionForm.cardExpiry.trim() ||
      !subscriptionForm.cardCvc.trim()
    ) {
      setSubscriptionError("Заполните платежные данные.");
      return;
    }

    setSubscriptionPaying(true);
    setSubscriptionError("");
    try {
      const response = await apiRequest("/payments/subscription", {
        method: "POST",
        token,
        body: {
          period_start: subscriptionForm.periodStart,
          period_end: subscriptionForm.periodEnd,
        },
      });
      setSubscriptionSuccess(
        `Абонемент оформлен: ${formatDate(response.period_start)} — ${formatDate(
          response.period_end
        )} на сумму ${formatMoney(response.amount, response.currency)}.`
      );
      setSubscriptionForm(buildSubscriptionForm());
      closeSubscriptionModal();
      await refreshPayments();
    } catch (err) {
      setSubscriptionError(err.message);
    } finally {
      setSubscriptionPaying(false);
    }
  };

  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Оплата питания</h2>
          <p>Оплачивайте разовые меню или оформляйте абонемент.</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" to="/student/menu">
            Меню
          </Link>
          <Link className="secondary-button" to="/student/allergies">
            Аллергии
          </Link>
        </div>
      </header>

      <div className="summary" style={{ marginTop: "1rem" }}>
        {activeSubscription ? (
          <>
            Активный абонемент: {formatDate(activeSubscription.period_start)} —{" "}
            {formatDate(activeSubscription.period_end)}. Меню в этом периоде
            оплачиваются автоматически.
          </>
        ) : (
          <>
            Активного абонемента нет. Можно оформить новый и оплачивать меню без
            разовых платежей.
          </>
        )}
      </div>

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <h3>Абонемент</h3>
        <p className="form-hint">
          Укажите период абонемента и платежные данные. Данные карты остаются на
          экране и не отправляются в бэкенд.
        </p>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="primary-button"
          onClick={openSubscriptionModal}
        >
          Оформить абонемент
        </button>
      </div>

      <div className="form-group" style={{ marginTop: "2rem" }}>
        <h3>Разовые оплаты</h3>
        <p className="form-hint">
          Если меню не входит в период абонемента, его можно оплатить отдельно.
        </p>
      </div>

      {loading ? (
        <div className="form-hint">Загружаем меню...</div>
      ) : (
        <div className="menu-grid">
          {!sortedMenus.length && (
            <div className="summary">Меню пока не опубликовано.</div>
          )}
          {sortedMenus.map((menu) => {
            const coveredBySubscription = isMenuCoveredBySubscription(menu);
            const alreadyPaid = paidMenuIds.has(menu.id);
            const statusLabel = alreadyPaid
              ? "Оплачено"
              : coveredBySubscription
              ? "Оплачено абонементом"
              : "Не оплачено";
            const canPay = !alreadyPaid && !coveredBySubscription && menu.price != null;

            return (
              <article key={menu.id} className="menu-card">
                <div className="menu-card-header">
                  <div>
                    <h3>
                      {MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type} ·{" "}
                      {formatDate(menu.menu_date)}
                    </h3>
                    {menu.title && <p>{menu.title}</p>}
                  </div>
                  {menu.price != null && (
                    <div className="menu-price">{formatMoney(menu.price)}</div>
                  )}
                </div>
                <div className="summary">
                  Статус оплаты: <strong>{statusLabel}</strong>
                </div>
                {menu.price == null && (
                  <div className="form-hint">Цена меню пока не указана.</div>
                )}
                {canPay && (
                  <div className="button-row">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => openMenuPayment(menu)}
                    >
                      Оплатить
                    </button>
                  </div>
                )}
                {activeMenuId === menu.id && (
                  <form
                    className="auth-form"
                    onSubmit={(event) => handleMenuPayment(event, menu)}
                  >
                    <PaymentCardFields
                      values={menuCard}
                      onChange={handleMenuCardChange}
                      disabled={menuPaying}
                    />

                    <div className="form-hint">
                      Это демонстрационная форма. Данные не сохраняются и не
                      отправляются на сервер.
                    </div>

                    <div className="button-row">
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={menuPaying}
                      >
                        {menuPaying ? "Оплачиваем..." : "Оплатить меню"}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={closeMenuPayment}
                        disabled={menuPaying}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}

      {isSubscriptionModalOpen && (
        <div className="modal-backdrop" onClick={closeSubscriptionModal}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Оформление абонемента</h3>
                <p className="form-hint">
                  Период и платежные данные заполняются локально. В бэкенд
                  отправляется только период.
                </p>
              </div>
              <button
                type="button"
                className="secondary-button modal-close"
                onClick={closeSubscriptionModal}
              >
                Закрыть
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubscriptionSubmit}>
              <div className="option-grid">
                <label className="form-field">
                  Дата начала
                  <input
                    type="date"
                    name="periodStart"
                    value={subscriptionForm.periodStart}
                    onChange={handleSubscriptionChange}
                    disabled={subscriptionPaying}
                  />
                </label>
                <label className="form-field">
                  Дата окончания
                  <input
                    type="date"
                    name="periodEnd"
                    value={subscriptionForm.periodEnd}
                    onChange={handleSubscriptionChange}
                    disabled={subscriptionPaying}
                  />
                </label>
              </div>

              <PaymentCardFields
                values={subscriptionForm}
                onChange={handleSubscriptionChange}
                disabled={subscriptionPaying}
              />

                <div className="button-row">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={subscriptionPaying}
                >
                  {subscriptionPaying ? "Оплачиваем..." : "Оплатить абонемент"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeSubscriptionModal}
                  disabled={subscriptionPaying}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  );
}
