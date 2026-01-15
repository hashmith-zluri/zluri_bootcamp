import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const isAuthenticated = !!user && !!token;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
