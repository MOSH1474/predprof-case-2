import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const MEAL_TYPE_LABELS = {
  breakfast: "Завтрак",
  lunch: "Обед",
};

const SUBSCRIPTION_KEY = "canteen_subscription";

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

const loadSubscription = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SUBSCRIPTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveSubscription = (data) => {
  if (typeof window === "undefined") {
    return;
  }
  if (!data) {
    window.localStorage.removeItem(SUBSCRIPTION_KEY);
    return;
  }
  window.localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(data));
};

export default function StudentMenu() {
  const { token, user } = useAuth();
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [subscription, setSubscription] = useState(loadSubscription);

  const sortedMenus = useMemo(() => {
    return [...menus].sort((a, b) => {
      const left = new Date(a.menu_date).getTime();
      const right = new Date(b.menu_date).getTime();
      return right - left;
    });
  }, [menus]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadMenus = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await apiRequest("/menus/", { token });
        setMenus(response.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadMenus();
  }, [token]);

  useEffect(() => {
    saveSubscription(subscription);
  }, [subscription]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === "cook") {
    return <Navigate to="/cook" replace />;
  }

  const handleBuySubscription = () => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 30);
    setSubscription({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setNotice("Абонемент оформлен (заглушка).");
  };

  const handleMealReceive = (menu) => {
    const label = MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type;
    setNotice(`Отметка получения (${label}) пока в разработке.`);
  };

  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Меню</h2>
          <p>Просматривайте завтраки и обеды на ближайшие дни.</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" to="/student/allergies">
            Аллергии
          </Link>
          {subscription?.start && subscription?.end ? (
            <div className="summary">
              Абонемент: {formatDate(subscription.start)} —
              {" "}
              {formatDate(subscription.end)}
            </div>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={handleBuySubscription}
            >
              Купить абонемент
            </button>
          )}
        </div>
      </header>

      {notice && <div className="form-hint">{notice}</div>}

      {loading ? (
        <div className="form-hint">Загрузка меню...</div>
      ) : (
        <div className="menu-grid">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {!error && sortedMenus.length === 0 && (
            <div className="summary">Меню пока не опубликовано.</div>
          )}
          {sortedMenus.map((menu) => (
            <article key={menu.id} className="menu-card">
              <div className="menu-card-header">
                <div>
                  <h3>
                    {MEAL_TYPE_LABELS[menu.meal_type] || menu.meal_type} · {" "}
                    {formatDate(menu.menu_date)}
                  </h3>
                  {menu.title && <p>{menu.title}</p>}
                </div>
                {menu.price != null && (
                  <div className="menu-price">{menu.price} ₽</div>
                )}
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
                      {item.portion_size != null && (
                        <span>Порция: {item.portion_size}</span>
                      )}
                      {item.planned_qty != null && (
                        <span>План: {item.planned_qty}</span>
                      )}
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
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleMealReceive(menu)}
                >
                  Получить прием пищи
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
