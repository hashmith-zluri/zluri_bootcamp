import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ROLE_ACCESS } from "../utils/constants";

export function useAuth() {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  const logout = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/login";
  }, []);

  const canAccess = useCallback((path) => {
    if (!user?.role) return false;
    const allowedPaths = ROLE_ACCESS[user.role] || [];
    return allowedPaths.some(p => path.startsWith(p));
  }, [user?.role]);

  return {
    user,
    token,
    isAuthenticated: !!user && !!token,
    role: user?.role,
    logout,
    canAccess,
  };
}
