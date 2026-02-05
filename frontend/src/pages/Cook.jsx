import { Link } from "react-router-dom";
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
          Авторизация: {isAuthenticated ? `вошли как ${user?.full_name}` : "нет"}
        </div>
      </header>

      <CookNav />

      <div className="cook-dashboard">
        <section className="cook-hero">
          <div>
            <h3>План на смену</h3>
            <p>
              Следите за выдачей, собирайте меню и держите под рукой информацию об
              аллергиях и предпочтениях учеников.
            </p>
          </div>
          <div className="cook-hero-actions">
            <Link className="primary-button" to="/cook/menus">
              Создать меню
            </Link>
            <Link className="secondary-button" to="/cook/meals">
              Выдача питания
            </Link>
          </div>
        </section>

        <section className="dashboard-grid">
          <Link className="dashboard-card" to="/cook/menus">
            <span className="dashboard-eyebrow">Меню</span>
            <strong>Управляйте меню</strong>
            <p>Создавайте позиции, редактируйте блюда и следите за остатками.</p>
          </Link>
          <Link className="dashboard-card" to="/cook/meals">
            <span className="dashboard-eyebrow">Выдача</span>
            <strong>Отмечайте выдачу</strong>
            <p>Проверяйте статусы и сразу видите аллергенные предупреждения.</p>
          </Link>
          <Link className="dashboard-card" to="/cook/allergies">
            <span className="dashboard-eyebrow">Аллергены</span>
            <strong>Справочник аллергенов</strong>
            <p>Поддерживайте список актуальным для блюд и учеников.</p>
          </Link>
          <Link className="dashboard-card" to="/cook/stock">
            <span className="dashboard-eyebrow">Остатки</span>
            <strong>Контроль продуктов</strong>
            <p>Фиксируйте поступления и списания, обновляйте запасы.</p>
          </Link>
          <Link className="dashboard-card" to="/cook/purchases">
            <span className="dashboard-eyebrow">Закупки</span>
            <strong>Заявки на закупку</strong>
            <p>Следите за запросами и планируйте пополнение.</p>
          </Link>
        </section>
      </div>
    </section>
  );
}
