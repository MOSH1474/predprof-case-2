import { Navigate, Route, Routes } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout.jsx";
import Cook from "../pages/Cook.jsx";
import CookLeftovers from "../pages/CookLeftovers.jsx";
import CookMealLog from "../pages/CookMealLog.jsx";
import CookMeals from "../pages/CookMeals.jsx";
import CookPurchases from "../pages/CookPurchases.jsx";
import CookStock from "../pages/CookStock.jsx";
import CookStockNew from "../pages/CookStockNew.jsx";
import AdminPurchaseRequests from "../pages/AdminPurchaseRequests.jsx";
import AdminReports from "../pages/AdminReports.jsx";
import AdminStats from "../pages/AdminStats.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import StudentAllergies from "../pages/StudentAllergies.jsx";
import StudentMenu from "../pages/StudentMenu.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route path="/student/menu" element={<StudentMenu />} />
      <Route path="/student/allergies" element={<StudentAllergies />} />
      <Route path="/student/pay" element={<Navigate to="/student/menu" replace />} />
      <Route path="/cook" element={<Cook />} />
      <Route path="/cook/meals" element={<CookMeals />} />
      <Route path="/cook/meals/log" element={<CookMealLog />} />
      <Route path="/cook/stock" element={<CookStock />} />
      <Route path="/cook/stock/new" element={<CookStockNew />} />
      <Route path="/cook/leftovers" element={<CookLeftovers />} />
      <Route path="/cook/purchases" element={<CookPurchases />} />
      <Route path="/admin/stats" element={<AdminStats />} />
      <Route path="/admin/purchase-requests" element={<AdminPurchaseRequests />} />
      <Route path="/admin/reports" element={<AdminReports />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
