import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import SubmitRequest from "../pages/SubmitRequest";
import ApprovalDashboard from "../pages/ApprovalDashboard";
import MySubmissions from "../pages/MySubmissions";
import NotAuthorized from "../pages/NotAuthorized";
import DashboardLayout from "../components/layout/dashboardlayout";
import ProtectedRoute from "../components/common/protectedroute";
import { ROLE_ACCESS } from "../utils/constants";

function RoleProtectedRoute({ children, allowedRoles }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role;
  
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/not-authorized" replace />;
  }
  
  return children;
}

function DefaultRedirect() {
  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role;
  
  if (role === "MANAGER" || role === "ADMIN") {
    return <Navigate to="/approvals" replace />;
  }
  return <Navigate to="/submit" replace />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DefaultRedirect />} />
          
          <Route 
            path="/submit" 
            element={
              <RoleProtectedRoute allowedRoles={["DEVELOPER", "MANAGER", "ADMIN"]}>
                <SubmitRequest />
              </RoleProtectedRoute>
            } 
          />
          
          <Route 
            path="/my-submissions" 
            element={
              <RoleProtectedRoute allowedRoles={["DEVELOPER", "MANAGER", "ADMIN"]}>
                <MySubmissions />
              </RoleProtectedRoute>
            } 
          />
          
          <Route 
            path="/approvals" 
            element={
              <RoleProtectedRoute allowedRoles={["MANAGER", "ADMIN"]}>
                <ApprovalDashboard />
              </RoleProtectedRoute>
            } 
          />
        </Route>

        <Route path="/not-authorized" element={<NotAuthorized />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
