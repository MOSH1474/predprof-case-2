import { Link } from "react-router-dom";

export default function StudentPay() {
  return (
    <section className="page">
      <header className="auth-header page-header-row">
        <div>
          <h2>Оплата питания</h2>
          <p>Разовая оплата и абонементы будут доступны позже.</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" to="/student/menu">
            Назад к меню
          </Link>
        </div>
      </header>

      <div className="summary">
        Сейчас этот раздел в разработке. Вы можете вернуться к меню или
        заполнить аллергии и предпочтения.
      </div>
      <div className="button-row" style={{ marginTop: "1rem" }}>
        <Link className="secondary-button" to="/student/allergies">
          Аллергии
        </Link>
        <Link className="primary-button" to="/student/menu">
          Меню
        </Link>
      </div>
    </section>
  );
}
