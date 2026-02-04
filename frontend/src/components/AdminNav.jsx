import { NavLink } from "react-router-dom";

const navClass = ({ isActive }) => `admin-tab${isActive ? " active" : ""}`;

export default function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Разделы администратора">
      <NavLink to="/admin/stats" className={navClass}>
        Статистика
      </NavLink>
      <span className="admin-tab is-disabled" aria-disabled="true">
        Заявки
      </span>
      <span className="admin-tab is-disabled" aria-disabled="true">
        Отчеты
      </span>
    </nav>
  );
}
