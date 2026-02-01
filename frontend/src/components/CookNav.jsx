import { Link } from "react-router-dom";

export default function CookNav() {
  return (
    <nav className="cook-nav" aria-label="Разделы повара">
      <Link to="/cook">Обзор</Link>
      <Link to="/cook/meals">Учет питания</Link>
      <Link to="/cook/meals/log">Журнал питания</Link>
      <Link to="/cook/stock">Остатки</Link>
      <Link to="/cook/stock/new">Добавить продукт</Link>
      <Link to="/cook/leftovers">Остатки блюд</Link>
      <Link to="/cook/purchases">Закупки</Link>
    </nav>
  );
}
