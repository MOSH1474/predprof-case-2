import { useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

const ROLE_LABELS = {
  admin: "Администратор",
  cook: "Повар",
  student: "Ученик",
};

function AppShell() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const roleLabel = ROLE_LABELS[user?.role] || "Пользователь";
  const userLabel = user?.full_name || user?.email;

  if (!isAuthenticated) {
    return <AppRoutes />;
  }

  return (
    <>
      <header className="app-topbar">
        <div className="topbar-user">
          <span className="topbar-role">{roleLabel}</span>
          {userLabel && <span className="topbar-name">{userLabel}</span>}
        </div>
        <div className="topbar-actions">
          <NotificationBell />
          <button type="button" className="secondary-button" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>
      <main className="app-body">
        <AppRoutes />
      </main>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ToastProvider>
  );
}
