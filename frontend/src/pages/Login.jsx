import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Login() {
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { loginWithCredentials } = useAuth();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) {
      setError("");
    }
    if (success) {
      setSuccess("");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = loginWithCredentials(form);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess("Вход выполнен успешно.");
  };

  return (
    <section className="page auth-page">
      <header className="auth-header">
        <h2>Вход</h2>
        <p>
          Войти могут ученики, повара и администраторы. Регистрация доступна
          только ученикам.
        </p>
      </header>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field">
          Логин
          <input
            type="text"
            name="login"
            value={form.login}
            onChange={handleChange}
            placeholder="Введите логин"
            autoComplete="username"
            required
          />
        </label>
        <label className="form-field">
          Пароль
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Введите пароль"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {success && <div className="form-success">{success}</div>}
        <button type="submit" className="primary-button">
          Войти
        </button>
        <div className="auth-footer">
          <span>Нет аккаунта ученика?</span>
          <Link to="/register">Зарегистрироваться</Link>
        </div>
      </form>
    </section>
  );
}
