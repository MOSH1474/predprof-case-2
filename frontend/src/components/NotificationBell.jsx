import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { playNotificationSound } from "../utils/notificationSound.js";

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

const mergeNotifications = (prev, incoming) => {
  const map = new Map(prev.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    map.set(item.id, { ...map.get(item.id), ...item });
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

const getLatestCreatedAt = (items) => {
  if (!items.length) {
    return null;
  }
  let latest = items[0].created_at;
  items.forEach((item) => {
    if (item.created_at && new Date(item.created_at) > new Date(latest)) {
      latest = item.created_at;
    }
  });
  return latest;
};

export default function NotificationBell() {
  const { token } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const lastSeenRef = useRef(null);
  const initializedRef = useRef(false);

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!token) {
        return;
      }
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const data = await apiRequest("/notifications", { token });
        const list = Array.isArray(data.items) ? data.items : [];
        setItems(list);
        setUnreadCount(Number.isFinite(data.unread_count) ? data.unread_count : 0);
        setErrorMessage("");
        const latest = getLatestCreatedAt(list);
        lastSeenRef.current = latest || new Date().toISOString();
      } catch (error) {
        const message = error.message || "Не удалось загрузить уведомления.";
        setErrorMessage(message);
        if (!silent) {
          toast.error(message);
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [token, toast]
  );

  const markAsRead = useCallback(
    async (id) => {
      if (!token) {
        return;
      }
      try {
        await apiRequest(`/notifications/${id}/read`, { method: "POST", token });
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        toast.error(error.message || "Не удалось обновить уведомление.");
      }
    },
    [token, toast]
  );

  const markAllAsRead = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      await apiRequest("/notifications/read-all", { method: "POST", token });
      setItems((prev) =>
        prev.map((item) =>
          item.read_at ? item : { ...item, read_at: new Date().toISOString() }
        )
      );
      setUnreadCount(0);
    } catch (error) {
      toast.error(error.message || "Не удалось отметить уведомления.");
    }
  }, [token, toast]);

  useEffect(() => {
    loadNotifications({ silent: true });
  }, [loadNotifications]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }
    let isActive = true;
    const poll = async () => {
      while (isActive) {
        const since = lastSeenRef.current || new Date().toISOString();
        try {
          const data = await apiRequest(
            `/notifications/long-poll?since=${encodeURIComponent(since)}`,
            { token }
          );
          if (!isActive) {
            return;
          }
          const incoming = Array.isArray(data.items) ? data.items : [];
          if (incoming.length) {
            setItems((prev) => mergeNotifications(prev, incoming));
            setUnreadCount((prev) =>
              Number.isFinite(data.unread_count) ? data.unread_count : prev
            );
            const latest = getLatestCreatedAt(incoming);
            lastSeenRef.current = latest || new Date().toISOString();
            if (initializedRef.current) {
              playNotificationSound();
              toast.info(incoming[0]?.title || "Новое уведомление");
            }
          } else {
            if (Number.isFinite(data.unread_count)) {
              setUnreadCount(data.unread_count);
            }
            lastSeenRef.current = new Date().toISOString();
          }
          initializedRef.current = true;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    };
    poll();
    return () => {
      isActive = false;
    };
  }, [token, toast]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    loadNotifications({ silent: true });
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleClickOutside = (event) => {
      const target = event.target;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="notification-wrap">
      <button
        type="button"
        className={`notification-button${isOpen ? " is-active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Уведомления"
        aria-expanded={isOpen}
        ref={buttonRef}
      >
        <svg className="notification-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3a6 6 0 0 0-6 6v2.3c0 1.2-.5 2.3-1.4 3.1l-.7.6c-.5.4-.2 1.2.5 1.2h15.2c.7 0 1-.8.5-1.2l-.7-.6a4.3 4.3 0 0 1-1.4-3.1V9a6 6 0 0 0-6-6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.6 19a2.4 2.4 0 0 0 4.8 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-panel" role="dialog" aria-label="Уведомления" ref={panelRef}>
          <div className="notification-header">
            <div>
              <strong>Уведомления</strong>
              <span className="notification-count">
                {unreadCount > 0 ? `Новых: ${unreadCount}` : "Новых нет"}
              </span>
            </div>
            <button
              type="button"
              className="notification-action"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              Прочитать все
            </button>
          </div>

          <div className="notification-list">
            {isLoading && <div className="notification-empty">Загрузка уведомлений...</div>}
            {!isLoading && items.length === 0 && (
              <div className="notification-empty">
                {errorMessage || "Пока нет уведомлений."}
              </div>
            )}
            {!isLoading &&
              items.map((item) => (
                <div
                  key={item.id}
                  className={`notification-item${item.read_at ? "" : " is-unread"}`}
                >
                  <div>
                    <p className="notification-title">{item.title}</p>
                    {item.body && <p className="notification-body">{item.body}</p>}
                    <div className="notification-meta">
                      <span>{formatDateTime(item.created_at)}</span>
                      {!item.read_at && <span className="notification-pill">Новое</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="notification-action"
                    onClick={() => markAsRead(item.id)}
                    disabled={Boolean(item.read_at)}
                  >
                    {item.read_at ? "Прочитано" : "Прочитать"}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
