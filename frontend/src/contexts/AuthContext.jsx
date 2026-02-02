import React, { createContext, useContext, useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";

const AuthContext = createContext(null);

const TOKEN_KEY = "canteen_token";
const USER_KEY = "canteen_user";

const loadStoredUser = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const loadStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
};

const persistSession = (user, token) => {
  if (typeof window === "undefined") {
    return;
  }
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
};

const clearSession = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);
  const [token, setToken] = useState(loadStoredToken);

  const loginWithCredentials = async ({ login, password }) => {
    const normalizedLogin = (login || "").trim().toLowerCase();

    if (!normalizedLogin || !password) {
      return { ok: false, message: "Заполните логин и пароль." };
    }

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        isForm: true,
        body: { username: normalizedLogin, password },
      });

      setUser(data.user);
      setToken(data.access_token);
      persistSession(data.user, data.access_token);
      return { ok: true, user: data.user };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const registerStudent = async (payload) => {
    const email = (payload.email || "").trim().toLowerCase();
    const fullName = (payload.fullName || "").trim();
    const password = payload.password || "";

    if (!email || !fullName || !password) {
      return { ok: false, message: "Заполните обязательные поля." };
    }

    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: {
          email,
          password,
          full_name: fullName,
        },
      });
    } catch (error) {
      return { ok: false, message: error.message };
    }

    return loginWithCredentials({ login: email, password });
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearSession();
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      loginWithCredentials,
      registerStudent,
      logout,
    }),
    [user, token]
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
