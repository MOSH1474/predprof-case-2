import React, { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const STUDENT_STORAGE_KEY = "canteen_students";

const normalize = (value) => value.trim().toLowerCase();

const getStudents = () => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STUDENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStudents = (students) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(students));
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const loginWithCredentials = ({ login, password }) => {
    const normalizedLogin = normalize(login || "");

    if (!normalizedLogin || !password) {
      return { ok: false, message: "Заполните логин и пароль." };
    }

    const students = getStudents();
    const student = students.find((entry) => entry.email === normalizedLogin);

    if (!student) {
      return {
        ok: false,
        message: "Ученик не найден. Зарегистрируйтесь, если это ваш первый вход.",
      };
    }

    if (student.password !== password) {
      return { ok: false, message: "Неверный пароль." };
    }

    const nextUser = {
      role: "student",
      email: student.email,
      name: `${student.firstName} ${student.lastName}`.trim(),
    };
    setUser(nextUser);
    return { ok: true, user: nextUser };
  };

  const registerStudent = (payload) => {
    const email = normalize(payload.email || "");

    if (!payload.lastName || !payload.firstName || !email || !payload.password) {
      return { ok: false, message: "Заполните обязательные поля." };
    }

    const students = getStudents();
    if (students.some((entry) => entry.email === email)) {
      return { ok: false, message: "Ученик с таким email уже зарегистрирован." };
    }

    const newStudent = {
      lastName: payload.lastName.trim(),
      firstName: payload.firstName.trim(),
      middleName: payload.middleName?.trim() || "",
      email,
      password: payload.password,
    };

    students.push(newStudent);
    saveStudents(students);

    const nextUser = {
      role: "student",
      email,
      name: `${newStudent.firstName} ${newStudent.lastName}`.trim(),
    };
    setUser(nextUser);
    return { ok: true, user: nextUser };
  };

  const logout = () => setUser(null);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loginWithCredentials,
      registerStudent,
      logout,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
