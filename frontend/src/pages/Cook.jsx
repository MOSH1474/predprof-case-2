import { useAuth } from "../contexts/AuthContext.jsx";
import CookNav from "../components/CookNav.jsx";

export default function Cook() {
  const { user, isAuthenticated } = useAuth();

  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Рабочее место повара</h2>
          <p>
            Выберите нужный раздел, чтобы вести учет питания, остатков и
            закупок.
          </p>
        </div>
        <div className="summary auth-status">
          Авторизация: {isAuthenticated ? `вошли как ${user?.name}` : "нет"}
        </div>
      </header>

      <CookNav />
    </section>
  );
}
