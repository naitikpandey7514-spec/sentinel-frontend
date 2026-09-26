import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadCurrentUser() {
    try {
      const response =
        await api.get("/api/auth/me");

      setUser(
        response.data?.user || null
      );
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrentUser();
  }, []);

  async function login(
    identifier,
    password
  ) {
    const response =
      await api.post(
        "/api/auth/login",
        {
          identifier,
          password,
        }
      );

    const authenticatedUser =
      response.data?.user || null;

    setUser(authenticatedUser);

    return authenticatedUser;
  }

  async function logout() {
    try {
      await api.post(
        "/api/auth/logout"
      );
    } finally {
      setUser(null);
    }
  }

  function hasPermission(
    permission
  ) {
    return Boolean(
      user?.permissions?.includes(
        permission
      )
    );
  }

  function hasAnyPermission(
    permissions
  ) {
    return permissions.some(
      (permission) =>
        user?.permissions?.includes(
          permission
        )
    );
  }

  function hasRole(role) {
    return (
      user?.role === role
    );
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser:
        loadCurrentUser,
      hasPermission,
      hasAnyPermission,
      hasRole,
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}