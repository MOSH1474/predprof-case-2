import { NavLink } from "react-router-dom";

const navClass = ({ isActive }) => `admin-tab${isActive ? " active" : ""}`;

export default function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Разделы администратора">
      <NavLink to="/admin/stats" className={navClass}>
        Статистика
      </NavLink>
      <NavLink to="/admin/purchase-requests" className={navClass}>
        Заявки
      </NavLink>
      <NavLink to="/admin/reports" className={navClass}>
        Отчеты
      </NavLink>
    </nav>
  );
}
