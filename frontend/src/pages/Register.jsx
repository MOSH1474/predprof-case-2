import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Register() {
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { registerStudent } = useAuth();
  const navigate = useNavigate();

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
    const result = registerStudent(form);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess("Регистрация успешна.");
    navigate("/student/allergies", { replace: true });
  };

  return (
    <section className="page auth-page">
      <header className="auth-header">
        <h2>Регистрация ученика</h2>
        <p>Регистрация доступна только для учеников.</p>
      </header>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field">
          Фамилия
          <input
            type="text"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            placeholder="Иванов"
            autoComplete="family-name"
            required
          />
        </label>
        <label className="form-field">
          Имя
          <input
            type="text"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            placeholder="Иван"
            autoComplete="given-name"
            required
          />
        </label>
        <label className="form-field">
          Отчество
          <input
            type="text"
            name="middleName"
            value={form.middleName}
            onChange={handleChange}
            placeholder="Иванович"
            autoComplete="additional-name"
          />
        </label>
        <label className="form-field">
          Email (логин для дальнейшего входа)
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="student@example.com"
            autoComplete="email"
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
            autoComplete="new-password"
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
          Зарегистрироваться
        </button>
        <div className="auth-footer">
          <span>Уже есть аккаунт?</span>
          <Link to="/login">Войти</Link>
        </div>
      </form>
    </section>
  );
}
