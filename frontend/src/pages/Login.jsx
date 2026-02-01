import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Login() {
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginWithCredentials } = useAuth();
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await loginWithCredentials(form);
    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }
    navigate("/student/allergies", { replace: true });
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
          Логин (email)
          <input
            type="text"
            name="login"
            value={form.login}
            onChange={handleChange}
            placeholder="student@example.com"
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
            minLength={8}
            required
          />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? "Входим..." : "Войти"}
        </button>
        <div className="auth-footer">
          <span>Нет аккаунта ученика?</span>
          <Link to="/register">Зарегистрироваться</Link>
        </div>
      </form>
    </section>
  );
}
