import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

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

      <div className="form-group">
        <h3>Разделы</h3>
        <p>Все функции вынесены в отдельные страницы.</p>
        <div className="button-row">
          <Link to="/cook/meals" className="primary-button">
            Учет питания
          </Link>
          <Link to="/cook/meals/log" className="secondary-button">
            Журнал питания
          </Link>
          <Link to="/cook/stock/new" className="secondary-button">
            Добавить продукт
          </Link>
          <Link to="/cook/stock" className="secondary-button">
            Текущие остатки
          </Link>
          <Link to="/cook/purchases" className="secondary-button">
            Закупки
          </Link>
          <Link to="/cook/leftovers" className="secondary-button">
            Остатки блюд
          </Link>
        </div>
      </div>
    </section>
  );
}