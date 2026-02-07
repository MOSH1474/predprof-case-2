import { Link } from "react-router-dom";

export default function CookNav() {
  return (
    <nav className="cook-nav" aria-label="Разделы повара">
      <Link to="/cook">Обзор</Link>
      <Link to="/cook/menus">Меню</Link>
      <Link to="/cook/allergies">Аллергены</Link>
      <Link to="/cook/meals">Выдача питания</Link>
      <Link to="/cook/stock">Остатки</Link>
      <Link to="/cook/purchases">Закупки</Link>
    </nav>
  );
}
