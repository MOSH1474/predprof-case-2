import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { playNotificationSound } from "../utils/notificationSound.js";

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

const toLocalDateValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 10);
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
    periodStart: toLocalDateValue(start),
    periodEnd: toLocalDateValue(end),
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

const mergeIssues = (prev, incoming) => {
  const map = new Map(prev.map((issue) => [issue.id, issue]));
  incoming.forEach((issue) => {
    map.set(issue.id, { ...map.get(issue.id), ...issue });
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

const getLatestIssueTimestamp = (issues) => {
  if (!issues.length) {
    return null;
  }
  let latest = issues[0].served_at || issues[0].created_at;
  issues.forEach((issue) => {
    const candidate = issue.served_at || issue.created_at;
    if (candidate && new Date(candidate) > new Date(latest)) {
      latest = candidate;
    }
  });
  return latest;
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
  const [preferences, setPreferences] = useState(null);
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mealConfirmError, setMealConfirmError] = useState("");
  const [mealConfirmSuccess, setMealConfirmSuccess] = useState("");
  const [confirmingMenuId, setConfirmingMenuId] = useState(null);
  const lastIssueCheckRef = useRef(new Date().toISOString());

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

  const [historyTab, setHistoryTab] = useState("pending");

  const [reviewsModalMenu, setReviewsModalMenu] = useState(null);
  const [reviewsByDish, setReviewsByDish] = useState(new Map());
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");

  const [activeReviewForm, setActiveReviewForm] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState("");
  const [reviewNotice, setReviewNotice] = useState(null);
  const toast = useToast();

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

  const allergyIdSet = useMemo(() => {
    return new Set((preferences?.allergies || []).map((item) => item.id));
  }, [preferences]);

  const myReviewMap = useMemo(() => {
    return new Map(
      myReviews.map((review) => [`${review.menu_id || "none"}-${review.dish_id}`, review])
    );
  }, [myReviews]);

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
    const today = toLocalDateValue();
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
    const today = toLocalDateValue();
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

  const subscriptionStatus = activeSubscription
    ? "active"
    : upcomingSubscription
    ? "upcoming"
    : "inactive";

  const subscriptionText = activeSubscription
    ? `Активный абонемент: ${formatDate(activeSubscription.period_start)} — ${formatDate(
        activeSubscription.period_end
      )}`
    : upcomingSubscription
    ? `Уже оформлен абонемент: ${formatDate(
        upcomingSubscription.period_start
      )} — ${formatDate(upcomingSubscription.period_end)} (еще не активен).`
    : "Абонемент не активен. Можно оформить на этой странице.";

  const isMenuCoveredBySubscription = (menu) => {
    return subscriptionPayments.some((payment) =>
      isWithinPeriod(menu.menu_date, payment.period_start, payment.period_end)
    );
  };

  const isMenuPaid = (menu) => {
    return (
      issueMap.has(menu.id) ||
      paidMenuIds.has(menu.id)
    );
  };

  const isMenuReceived = (menu) => {
    const issue = issueMap.get(menu.id);
    return issue?.status === "confirmed";
  };

  const unpaidMenus = useMemo(
    () => sortedMenus.filter((menu) => !isMenuPaid(menu)),
    [sortedMenus, issueMap, paidMenuIds]
  );

  const issuedMenus = useMemo(
    () =>
      sortedMenus.filter((menu) => isMenuPaid(menu) && !isMenuReceived(menu)),
    [sortedMenus, issueMap, paidMenuIds]
  );

  const confirmedMenus = useMemo(
    () => sortedMenus.filter((menu) => isMenuReceived(menu)),
    [sortedMenus, issueMap]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setLoadError("");
      const tasks = [
        { key: "menus", promise: apiRequest("/menus/", { token }) },
        { key: "payments", promise: apiRequest("/payments/me", { token }) },
        { key: "issues", promise: apiRequest("/meal-issues/me", { token }) },
      ];
      if (user?.role === "student") {
        tasks.push({
          key: "preferences",
          promise: apiRequest("/preferences/me", { token }),
        });
      }
      if (user?.id) {
        tasks.push({
          key: "reviews",
          promise: apiRequest(`/reviews/?user_id=${user.id}`, { token }),
        });
      }

      const results = await Promise.allSettled(tasks.map((task) => task.promise));
      const resultByKey = new Map(
        tasks.map((task, index) => [task.key, results[index]])
      );

      const menusResult = resultByKey.get("menus");
      const paymentsResult = resultByKey.get("payments");
      const issuesResult = resultByKey.get("issues");
      const preferencesResult = resultByKey.get("preferences");
      const reviewsResult = resultByKey.get("reviews");
      const errors = [];

      if (menusResult?.status === "fulfilled") {
        setMenus(menusResult.value.items || []);
      } else if (menusResult) {
        errors.push(menusResult.reason?.message || "Не удалось загрузить меню.");
      }

      if (paymentsResult?.status === "fulfilled") {
        setPayments(paymentsResult.value.items || []);
      } else if (paymentsResult) {
        errors.push(paymentsResult.reason?.message || "Не удалось загрузить оплаты.");
      }

      if (issuesResult?.status === "fulfilled") {
        const list = issuesResult.value.items || [];
        setIssues(list);
        const latest = getLatestIssueTimestamp(list);
        if (latest) {
          lastIssueCheckRef.current = latest;
        }
      } else if (issuesResult) {
        errors.push(
          issuesResult.reason?.message || "Не удалось загрузить данные по выдачам."
        );
      }

      if (preferencesResult?.status === "fulfilled") {
        setPreferences(preferencesResult.value);
      } else if (preferencesResult) {
        errors.push(
          preferencesResult.reason?.message ||
            "Не удалось загрузить предпочтения питания."
        );
      }

      if (reviewsResult?.status === "fulfilled") {
        setMyReviews(reviewsResult.value.items || []);
      } else if (reviewsResult) {
        errors.push(reviewsResult.reason?.message || "Не удалось загрузить отзывы.");
      }

      setLoadError(errors.join(" "));
      setLoading(false);
    };

    loadData();
  }, [token, user?.id, user?.role]);

  useEffect(() => {
    if (!token || user?.role !== "student") {
      return undefined;
    }
    let isActive = true;
    const poll = async () => {
      while (isActive) {
        const since = lastIssueCheckRef.current || new Date().toISOString();
        try {
          const data = await apiRequest(
            `/meal-issues/me/long-poll?since=${encodeURIComponent(since)}`,
            { token }
          );
          if (!isActive) {
            return;
          }
          const incoming = Array.isArray(data.items) ? data.items : [];
          if (incoming.length) {
            setIssues((prev) => mergeIssues(prev, incoming));
            const latest = getLatestIssueTimestamp(incoming);
            lastIssueCheckRef.current = latest || new Date().toISOString();
            playNotificationSound();
            toast.info("Питание выдано. Подтвердите получение.");
          } else {
            lastIssueCheckRef.current = new Date().toISOString();
          }
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    };
    poll();
    return () => {
      isActive = false;
    };
  }, [token, user?.role, toast]);

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
    if (mealConfirmError) {
      toast.error(mealConfirmError);
      setMealConfirmError("");
    }
    if (mealConfirmSuccess) {
      toast.success(mealConfirmSuccess);
      setMealConfirmSuccess("");
    }
    if (reviewsError) {
      toast.error(reviewsError);
      setReviewsError("");
    }
    if (reviewFormError) {
      toast.error(reviewFormError);
      setReviewFormError("");
    }
    if (reviewNotice) {
      toast.success(reviewNotice.message || reviewNotice);
      setReviewNotice(null);
    }
  }, [
    loadError,
    mealConfirmError,
    mealConfirmSuccess,
    menuPaymentError,
    menuPaymentSuccess,
    reviewFormError,
    reviewNotice,
    reviewsError,
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

  const issueMenuFromSubscription = async (menu) => {
    if (!menu) {
      return;
    }
    setMenuPaying(true);
    setMenuPaymentError("");
    setMenuPaymentSuccess("");
    try {
      await apiRequest("/meal-issues/me/issue", {
        method: "POST",
        token,
        body: {
          menu_id: menu.id,
        },
      });
      const label = MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type;
      setMenuPaymentSuccess(
        `Меню ${label} от ${formatDate(menu.menu_date)} добавлено в ожидание выдачи по абонементу.`
      );
      await refreshPaymentsAndIssues();
    } catch (err) {
      setMenuPaymentError(err.message);
    } finally {
      setMenuPaying(false);
    }
  };

  const handleMenuPayClick = async (menu) => {
    if (menuPaying) {
      return;
    }
    if (isMenuCoveredBySubscription(menu)) {
      await issueMenuFromSubscription(menu);
      return;
    }
    openMenuPayment(menu);
  };

  const openSubscriptionModal = () => {
    const today = toLocalDateValue();
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

  const handleMealReceive = async (menu) => {
    if (!menu) {
      return;
    }
    const issue = issueMap.get(menu.id);
    if (!issue || issue.status !== "served") {
      setMealConfirmError(
        "Подтверждение возможно после отметки повара о выдаче."
      );
      return;
    }

    setConfirmingMenuId(menu.id);
    setMealConfirmError("");
    setMealConfirmSuccess("");
    try {
      await apiRequest("/meal-issues/me", {
        method: "POST",
        token,
        body: {
          menu_id: menu.id,
        },
      });
      const label = MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type;
      setMealConfirmSuccess(
        `Получение ${label} от ${formatDate(menu.menu_date)} подтверждено.`
      );
      await refreshPaymentsAndIssues();
    } catch (err) {
      setMealConfirmError(err.message);
    } finally {
      setConfirmingMenuId(null);
    }
  };

  const openReviewsModal = async (menu) => {
    if (!menu) {
      return;
    }
    setReviewsModalMenu(menu);
    setReviewsByDish(new Map());
    setReviewsError("");

    const dishIds = Array.from(
      new Set(
        (menu.menu_items || [])
          .map((item) => item.dish?.id)
          .filter((dishId) => Number.isFinite(dishId))
      )
    );
    if (!dishIds.length) {
      setReviewsLoading(false);
      return;
    }
    setReviewsLoading(true);
    try {
      const results = await Promise.allSettled(
        dishIds.map((dishId) => apiRequest(`/reviews/?dish_id=${dishId}`, { token }))
      );
      const nextMap = new Map();
      results.forEach((result, index) => {
        const dishId = dishIds[index];
        if (result.status === "fulfilled") {
          nextMap.set(dishId, result.value.items || []);
        } else {
          nextMap.set(dishId, []);
        }
      });
      setReviewsByDish(nextMap);
      if (results.some((result) => result.status === "rejected")) {
        setReviewsError("Не удалось загрузить часть отзывов.");
      }
    } catch (err) {
      setReviewsError(err.message);
    } finally {
      setReviewsLoading(false);
    }
  };

  const closeReviewsModal = () => {
    setReviewsModalMenu(null);
    setReviewsByDish(new Map());
    setReviewsError("");
    setReviewsLoading(false);
  };

  const openReviewForm = (menuId, dishId) => {
    if (!menuId || !dishId) {
      return;
    }
    setActiveReviewForm({ menuId, dishId });
    setReviewForm({ rating: 5, comment: "" });
    setReviewFormError("");
    setReviewNotice(null);
  };

  const handleReviewFormChange = (event) => {
    const { name, value } = event.target;
    setReviewForm((prev) => ({
      ...prev,
      [name]: name === "rating" ? Number(value) : value,
    }));
    if (reviewFormError) {
      setReviewFormError("");
    }
  };

  const submitReview = async (event, menuId, dishId) => {
    event.preventDefault();
    if (!menuId || !dishId) {
      setReviewFormError("Не удалось определить блюдо для отзыва.");
      return;
    }
    if (reviewSubmitting) {
      return;
    }
    if (!reviewForm.rating || reviewForm.rating < 1) {
      setReviewFormError("Укажите оценку от 1 до 5.");
      return;
    }
    setReviewSubmitting(true);
    setReviewFormError("");
    try {
      const response = await apiRequest("/reviews/", {
        method: "POST",
        token,
        body: {
          dish_id: dishId,
          menu_id: menuId,
          rating: reviewForm.rating,
          comment: reviewForm.comment.trim() || null,
        },
      });
      setMyReviews((prev) => [response, ...prev]);
      setReviewNotice({
        menuId,
        dishId,
        message: "Спасибо! Отзыв отправлен.",
      });
      setActiveReviewForm(null);
    } catch (err) {
      setReviewFormError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const renderMenuCard = (menu, { showPay, allowReview = false }) => {
    const issue = issueMap.get(menu.id);
    const coveredBySubscription = isMenuCoveredBySubscription(menu);
    const canConfirm = issue?.status === "served";
    const payLabel = coveredBySubscription ? "Оформить выдачу" : "Оплатить";
    const reviewsDisabled = reviewsLoading && reviewsModalMenu?.id === menu.id;
    const actionLabel = confirmingMenuId === menu.id
      ? "Подтверждаем..."
      : canConfirm
      ? "Подтвердить получение"
      : "Ожидает выдачи";
    const actionHint =
      !showPay && !canConfirm
        ? !issue
          ? "Подтверждение станет доступно после отметки повара."
          : issue.status === "issued"
          ? "Повар еще не отметил выдачу."
          : ""
        : "";
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
          {(menu.menu_items || []).map((item) => {
            const dishId = item.dish?.id;
            const dishAllergies = item.dish?.allergies || [];
            const conflictNames = dishAllergies
              .filter((allergy) => allergyIdSet.has(allergy.id))
              .map((allergy) => allergy.name)
              .filter(Boolean);
            const hasConflict = conflictNames.length > 0;
            const reviewKey = dishId ? `${menu.id}-${dishId}` : null;
            const myReview = reviewKey ? myReviewMap.get(reviewKey) : null;
            const isActiveReview =
              activeReviewForm?.menuId === menu.id && activeReviewForm?.dishId === dishId;
            return (
              <div
                key={item.id}
                className={`menu-item${hasConflict ? " menu-item-alert" : ""}`}
              >
                <div>
                  <strong>{item.dish?.name || "Блюдо"}</strong>
                  {item.dish?.description && (
                    <p className="form-hint">{item.dish.description}</p>
                  )}
                  {hasConflict && (
                    <div className="form-hint allergy-hint">
                      Содержит ваши аллергены: {conflictNames.join(", ")}.
                    </div>
                  )}
                </div>
                <div className="menu-meta">
                  {hasConflict && <span className="allergy-badge">Аллерген</span>}
                  {item.portion_size != null && <span>Порция: {item.portion_size}</span>}
                  {item.planned_qty != null && <span>План: {item.planned_qty}</span>}
                  {item.remaining_qty != null && (
                    <span>Осталось: {item.remaining_qty}</span>
                  )}
                </div>
                {allowReview && dishId && (
                  <div style={{ width: "100%" }}>
                    {myReview ? (
                      <div className="form-hint">
                        Ваш отзыв: {myReview.rating}/5
                        {myReview.comment ? ` · ${myReview.comment}` : ""} ·{" "}
                        {formatDateTime(myReview.created_at)}
                      </div>
                    ) : isActiveReview ? (
                      <form
                        className="auth-form"
                        onSubmit={(event) => submitReview(event, menu.id, dishId)}
                        style={{ marginTop: "0.75rem" }}
                      >
                        <div className="option-grid">
                          <label className="form-field">
                            Оценка
                            <select
                              name="rating"
                              value={reviewForm.rating}
                              onChange={handleReviewFormChange}
                              disabled={reviewSubmitting}
                            >
                              {[5, 4, 3, 2, 1].map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="form-field">
                            Комментарий
                            <textarea
                              name="comment"
                              rows="2"
                              value={reviewForm.comment}
                              onChange={handleReviewFormChange}
                              placeholder="Напишите впечатления"
                              disabled={reviewSubmitting}
                            />
                          </label>
                        </div>
                        <div className="button-row">
                          <button
                            type="submit"
                            className="primary-button"
                            disabled={reviewSubmitting}
                          >
                            {reviewSubmitting ? "Отправляем..." : "Отправить отзыв"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setActiveReviewForm(null)}
                            disabled={reviewSubmitting}
                          >
                            Отмена
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="button-row" style={{ marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => openReviewForm(menu.id, dishId)}
                        >
                          Оставить отзыв
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {(!menu.menu_items || menu.menu_items.length === 0) && (
            <div className="summary">Позиции меню не заполнены.</div>
          )}
        </div>
        {menu.price == null && (
          <div className="form-hint">Цена меню пока не указана.</div>
        )}
        <div className="button-row">
          {showPay && (menu.price != null || coveredBySubscription) && (
            <button
              type="button"
              className="primary-button"
              onClick={() => handleMenuPayClick(menu)}
              disabled={menuPaying}
            >
              {payLabel}
            </button>
          )}
          {showPay && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => openReviewsModal(menu)}
              disabled={reviewsDisabled}
            >
              {reviewsDisabled ? "Загружаем отзывы..." : "Отзывы"}
            </button>
          )}
          {!showPay && (
            <button
              type="button"
              className={canConfirm ? "primary-button" : "secondary-button"}
              onClick={() => handleMealReceive(menu)}
              disabled={!canConfirm || confirmingMenuId === menu.id}
            >
              {actionLabel}
            </button>
          )}
        </div>
        {!showPay && actionHint && <div className="form-hint">{actionHint}</div>}
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

      <div
        className={`subscription-banner subscription-${subscriptionStatus}`}
        style={{ marginTop: "0.75rem" }}
      >
        {subscriptionText}
      </div>

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <h3>Доступные меню</h3>
        <p className="form-hint">
          Выберите меню и оплатите его разово или оформите выдачу по абонементу.
        </p>
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
        <h3>Выдача и история</h3>
        <p className="form-hint">
          Переключайтесь между готовящимися меню и подтвержденной историей.
        </p>
        <div className="button-row" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className={historyTab === "pending" ? "primary-button" : "secondary-button"}
            onClick={() => setHistoryTab("pending")}
          >
            Готовящиеся меню
          </button>
          <button
            type="button"
            className={historyTab === "confirmed" ? "primary-button" : "secondary-button"}
            onClick={() => setHistoryTab("confirmed")}
          >
            Полученные меню
          </button>
        </div>
      </div>

      {historyTab === "pending" ? (
        <>
          <div className="form-hint" style={{ marginBottom: "1rem" }}>
            Здесь показываются меню, которые уже оплачены и ожидают выдачи.
          </div>
          <div className="menu-grid">
            {issuedMenus.length === 0 ? (
              <div className="summary">Пока нет оплаченных меню.</div>
            ) : (
              issuedMenus.map((menu) => renderMenuCard(menu, { showPay: false }))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="form-hint" style={{ marginBottom: "1rem" }}>
            Подтвержденные меню. Здесь можно оставить отзыв о блюдах.
          </div>
          <div className="menu-grid">
            {confirmedMenus.length === 0 ? (
              <div className="summary">Пока нет подтвержденных меню.</div>
            ) : (
              confirmedMenus.map((menu) =>
                renderMenuCard(menu, { showPay: false, allowReview: true })
              )
            )}
          </div>
        </>
      )}

      {reviewsModalMenu && (
        <div className="modal-backdrop" onClick={closeReviewsModal}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Отзывы о блюдах</h3>
                <p className="form-hint">
                  {MEAL_TYPE_LABELS[reviewsModalMenu.meal_type] ||
                    reviewsModalMenu.meal_type}{" "}
                  · {formatDate(reviewsModalMenu.menu_date)}
                </p>
              </div>
              <button
                type="button"
                className="secondary-button modal-close"
                onClick={closeReviewsModal}
              >
                Закрыть
              </button>
            </div>

            {reviewsLoading && (
              <div className="form-hint">Загружаем отзывы...</div>
            )}

            <div className="data-grid">
              {(reviewsModalMenu.menu_items || []).length === 0 && (
                <div className="summary">В этом меню пока нет блюд.</div>
              )}
              {(reviewsModalMenu.menu_items || []).map((item) => {
                const dishId = item.dish?.id;
                const reviews = dishId ? reviewsByDish.get(dishId) || [] : [];
                const average =
                  reviews.length > 0
                    ? (
                        reviews.reduce((sum, review) => sum + review.rating, 0) /
                        reviews.length
                      ).toFixed(1)
                    : null;
                return (
                  <article key={item.id} className="data-card">
                    <header>
                      <strong>{item.dish?.name || "Блюдо"}</strong>
                      <span className="status-pill status-neutral">
                        {reviews.length} отзыв(ов)
                      </span>
                    </header>
                    <div className="summary">
                      {average ? `Средняя оценка: ${average}/5` : "Пока нет оценок."}
                    </div>
                    {reviews.length === 0 ? (
                      <div className="form-hint">Будьте первым, кто оставит отзыв.</div>
                    ) : (
                      <div className="data-list">
                        {reviews.map((review) => (
                          <div key={review.id} className="data-list-row">
                            <span>
                              Оценка: {review.rating}/5
                              {review.comment ? ` · ${review.comment}` : ""}
                            </span>
                            <span>{formatDateTime(review.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
