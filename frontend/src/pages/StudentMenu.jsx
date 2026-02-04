import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const MEAL_TYPE_LABELS = {
  breakfast: "Завтрак",
  lunch: "Обед",
};

const MEAL_ISSUE_STATUS_LABELS = {
  issued: "Ожидает выдачи",
  served: "Выдано",
  confirmed: "Получено",
};

const buildCard = () => ({
  cardNumber: "",
  cardHolder: "",
  cardExpiry: "",
  cardCvc: "",
});

const buildSubscriptionForm = () => {
  return buildSubscriptionFormFromDate(new Date());
};

const buildSubscriptionFormFromDate = (startDate) => {
  const start = new Date();
  if (startDate instanceof Date && !Number.isNaN(startDate.getTime())) {
    start.setTime(startDate.getTime());
  }
  const end = new Date();
  end.setTime(start.getTime());
  end.setDate(end.getDate() + 30);
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

const addDays = (value, days) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setDate(date.getDate() + days);
  return date;
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

export default function StudentMenu() {
  const { token, user } = useAuth();
  const [menus, setMenus] = useState([]);
  const [payments, setPayments] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");

  const [activeMenu, setActiveMenu] = useState(null);
  const [menuCard, setMenuCard] = useState(buildCard);
  const [menuPaymentError, setMenuPaymentError] = useState("");
  const [menuPaymentSuccess, setMenuPaymentSuccess] = useState("");
  const [menuPaying, setMenuPaying] = useState(false);

  const [subscriptionForm, setSubscriptionForm] = useState(buildSubscriptionForm);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [subscriptionSuccess, setSubscriptionSuccess] = useState("");
  const [subscriptionPaying, setSubscriptionPaying] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  const sortedMenus = useMemo(() => {
    return [...menus].sort((a, b) => {
      const left = new Date(a.menu_date).getTime();
      const right = new Date(b.menu_date).getTime();
      return right - left;
    });
  }, [menus]);

  const issueMap = useMemo(() => {
    return new Map(issues.map((issue) => [issue.menu_id, issue]));
  }, [issues]);

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

  const upcomingSubscription = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const candidates = subscriptionPayments.filter(
      (payment) => payment.period_start && payment.period_start > today
    );
    if (!candidates.length) {
      return null;
    }
    return candidates.sort((a, b) =>
      a.period_start > b.period_start ? 1 : -1
    )[0];
  }, [subscriptionPayments]);

  const latestSubscription = useMemo(() => {
    if (!subscriptionPayments.length) {
      return null;
    }
    return [...subscriptionPayments].sort((a, b) =>
      a.period_end < b.period_end ? 1 : -1
    )[0];
  }, [subscriptionPayments]);

  const isMenuCoveredBySubscription = (menu) => {
    return subscriptionPayments.some((payment) =>
      isWithinPeriod(menu.menu_date, payment.period_start, payment.period_end)
    );
  };

  const isMenuPaid = (menu) => {
    return (
      issueMap.has(menu.id) ||
      paidMenuIds.has(menu.id) ||
      isMenuCoveredBySubscription(menu)
    );
  };

  const isMenuReceived = (menu) => {
    const issue = issueMap.get(menu.id);
    return issue?.status === "confirmed";
  };

  const unpaidMenus = useMemo(
    () => sortedMenus.filter((menu) => !isMenuPaid(menu)),
    [sortedMenus, issueMap, paidMenuIds, subscriptionPayments]
  );

  const issuedMenus = useMemo(
    () =>
      sortedMenus.filter((menu) => isMenuPaid(menu) && !isMenuReceived(menu)),
    [sortedMenus, issueMap, paidMenuIds, subscriptionPayments]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setLoadError("");
      const results = await Promise.allSettled([
        apiRequest("/menus/", { token }),
        apiRequest("/payments/me", { token }),
        apiRequest("/meal-issues/me", { token }),
      ]);

      const [menusResult, paymentsResult, issuesResult] = results;
      const errors = [];

      if (menusResult.status === "fulfilled") {
        setMenus(menusResult.value.items || []);
      } else {
        errors.push(menusResult.reason?.message || "Не удалось загрузить меню.");
      }

      if (paymentsResult.status === "fulfilled") {
        setPayments(paymentsResult.value.items || []);
      } else {
        errors.push(paymentsResult.reason?.message || "Не удалось загрузить оплаты.");
      }

      if (issuesResult.status === "fulfilled") {
        setIssues(issuesResult.value.items || []);
      } else {
        errors.push(
          issuesResult.reason?.message || "Не удалось загрузить данные по выдачам."
        );
      }

      setLoadError(errors.join(" "));
      setLoading(false);
    };

    loadData();
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === "cook") {
    return <Navigate to="/cook" replace />;
  }

  const refreshPaymentsAndIssues = async () => {
    try {
      const [paymentsResponse, issuesResponse] = await Promise.all([
        apiRequest("/payments/me", { token }),
        apiRequest("/meal-issues/me", { token }),
      ]);
      setPayments(paymentsResponse.items || []);
      setIssues(issuesResponse.items || []);
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
  };

  const handleSubscriptionChange = (event) => {
    const { name, value } = event.target;
    setSubscriptionForm((prev) => ({ ...prev, [name]: value }));
    if (subscriptionError) {
      setSubscriptionError("");
    }
  };

  const openMenuPayment = (menu) => {
    setActiveMenu(menu);
    setMenuCard(buildCard());
    setMenuPaymentError("");
  };

  const closeMenuPayment = () => {
    setActiveMenu(null);
    setMenuCard(buildCard());
    setMenuPaymentError("");
  };

  const openSubscriptionModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    let startDate = new Date();
    if (latestSubscription?.period_end && latestSubscription.period_end >= today) {
      const nextStart = addDays(latestSubscription.period_end, 1);
      if (nextStart) {
        startDate = nextStart;
      }
    }
    setSubscriptionForm(buildSubscriptionFormFromDate(startDate));
    setIsSubscriptionModalOpen(true);
    setSubscriptionError("");
  };

  const closeSubscriptionModal = () => {
    setIsSubscriptionModalOpen(false);
    setSubscriptionError("");
  };

  const handleMenuPayment = async (event) => {
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

    if (!activeMenu) {
      setMenuPaymentError("Выберите меню для оплаты.");
      return;
    }

    setMenuPaying(true);
    setMenuPaymentError("");
    try {
      await apiRequest("/payments/one-time", {
        method: "POST",
        token,
        body: {
          menu_id: activeMenu.id,
        },
      });
      setMenuPaymentSuccess(
        `Оплата за ${MEAL_TYPE_LABELS[activeMenu.meal_type] || activeMenu.meal_type} от ${formatDate(
          activeMenu.menu_date
        )} прошла успешно.`
      );
      closeMenuPayment();
      await refreshPaymentsAndIssues();
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
      await refreshPaymentsAndIssues();
    } catch (err) {
      setSubscriptionError(err.message);
    } finally {
      setSubscriptionPaying(false);
    }
  };

  const handleMealReceive = (menu) => {
    const label = MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type;
    setNotice(`Отметка получения (${label}) пока в разработке.`);
  };

  const renderMenuCard = (menu, { showPay }) => {
    const issue = issueMap.get(menu.id);
    const coveredBySubscription = isMenuCoveredBySubscription(menu);
    const statusLabel = issue
      ? MEAL_ISSUE_STATUS_LABELS[issue.status] || issue.status
      : coveredBySubscription
      ? "Оплачено абонементом (ввод карты не нужен)"
      : paidMenuIds.has(menu.id)
      ? "Оплачено"
      : "Не оплачено";

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
          Статус: <strong>{statusLabel}</strong>
        </div>
        <div className="menu-items">
          {(menu.menu_items || []).map((item) => (
            <div key={item.id} className="menu-item">
              <div>
                <strong>{item.dish?.name || "Блюдо"}</strong>
                {item.dish?.description && (
                  <p className="form-hint">{item.dish.description}</p>
                )}
              </div>
              <div className="menu-meta">
                {item.portion_size != null && <span>Порция: {item.portion_size}</span>}
                {item.planned_qty != null && <span>План: {item.planned_qty}</span>}
                {item.remaining_qty != null && (
                  <span>Осталось: {item.remaining_qty}</span>
                )}
              </div>
            </div>
          ))}
          {(!menu.menu_items || menu.menu_items.length === 0) && (
            <div className="summary">Позиции меню не заполнены.</div>
          )}
        </div>
        {menu.price == null && (
          <div className="form-hint">Цена меню пока не указана.</div>
        )}
        <div className="button-row">
          {showPay && menu.price != null && (
            <button
              type="button"
              className="primary-button"
              onClick={() => openMenuPayment(menu)}
            >
              Оплатить
            </button>
          )}
          {!showPay && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleMealReceive(menu)}
            >
              Получить прием пищи
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Меню и оплата</h2>
          <p>Выбирайте меню, оплачивайте разово или оформляйте абонемент.</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" to="/student/allergies">
            Аллергии
          </Link>
          <button
            type="button"
            className="primary-button"
            onClick={openSubscriptionModal}
          >
            Оформить абонемент
          </button>
        </div>
      </header>

      {loadError && (
        <div className="form-error" role="alert" style={{ marginTop: "1rem" }}>
          {loadError}
        </div>
      )}

      {activeSubscription ? (
        <div className="summary" style={{ marginTop: "0.75rem" }}>
          Активный абонемент: {formatDate(activeSubscription.period_start)} —{" "}
          {formatDate(activeSubscription.period_end)}
        </div>
      ) : upcomingSubscription ? (
        <div className="summary" style={{ marginTop: "0.75rem" }}>
          Уже оформлен абонемент: {formatDate(upcomingSubscription.period_start)} —{" "}
          {formatDate(upcomingSubscription.period_end)} (еще не активен).
        </div>
      ) : (
        <div className="summary" style={{ marginTop: "0.75rem" }}>
          Абонемент не активен. Можно оформить на этой странице.
        </div>
      )}

      {subscriptionSuccess && (
        <div className="form-success" style={{ marginTop: "1rem" }}>
          {subscriptionSuccess}
        </div>
      )}

      {menuPaymentSuccess && (
        <div className="form-success" style={{ marginTop: "1rem" }}>
          {menuPaymentSuccess}
        </div>
      )}

      {notice && <div className="form-hint">{notice}</div>}

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <h3>Доступные меню</h3>
        <p className="form-hint">Выберите меню и оплатите его разово.</p>
      </div>

      {loading ? (
        <div className="form-hint">Загрузка меню...</div>
      ) : (
        <div className="menu-grid">
          {unpaidMenus.length === 0 && (
            <div className="summary">
              Все меню уже оплачены. Если меню покрыто абонементом, повторная оплата
              не требуется.
            </div>
          )}
          {unpaidMenus.map((menu) => renderMenuCard(menu, { showPay: true }))}
        </div>
      )}

      <div className="form-group" style={{ marginTop: "2rem" }}>
        <h3>Готовящиеся меню</h3>
        <p className="form-hint">
          Здесь показываются меню, которые уже оплачены и ожидают выдачи.
        </p>
      </div>

      <div className="menu-grid">
        {issuedMenus.length === 0 ? (
          <div className="summary">Пока нет оплаченных меню.</div>
        ) : (
          issuedMenus.map((menu) => renderMenuCard(menu, { showPay: false }))
        )}
      </div>

      {activeMenu && (
        <div className="modal-backdrop" onClick={closeMenuPayment}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Оплата меню</h3>
                <p className="form-hint">
                  {MEAL_TYPE_LABELS[activeMenu.meal_type] || activeMenu.meal_type} ·{" "}
                  {formatDate(activeMenu.menu_date)}
                </p>
              </div>
              <button
                type="button"
                className="secondary-button modal-close"
                onClick={closeMenuPayment}
              >
                Закрыть
              </button>
            </div>

            <form className="auth-form" onSubmit={handleMenuPayment}>
              <PaymentCardFields
                values={menuCard}
                onChange={handleMenuCardChange}
                disabled={menuPaying}
              />

              <div className="form-hint">
                Это демонстрационная форма. Данные не сохраняются и не
                отправляются на сервер.
              </div>

              {menuPaymentError && (
                <div className="form-error" role="alert">
                  {menuPaymentError}
                </div>
              )}

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
          </div>
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
              {latestSubscription && (
                <div className="summary">
                  Последний абонемент: {formatDate(latestSubscription.period_start)} —{" "}
                  {formatDate(latestSubscription.period_end)}. Новый период должен быть
                  после этой даты.
                </div>
              )}
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

              {subscriptionError && (
                <div className="form-error" role="alert">
                  {subscriptionError}
                </div>
              )}

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
