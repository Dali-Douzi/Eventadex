import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EventSetup from './pages/EventSetup';
import Registrants from './pages/Registrants';
import PageBuilder from './pages/PageBuilder';
import EmailTemplate from './pages/EmailTemplate';
import ReminderConfig from './pages/ReminderConfig';
import BadgeSetup from './pages/BadgeSetup';
import BadgePreview from './pages/BadgePreview';
import CheckIn from './pages/CheckIn';
import PrintCards from './pages/PrintCards';
import RegistrationLinks from './pages/RegistrationLinks';
import VipPageBuilder from './pages/VipPageBuilder';
import VipRegistrants from './pages/VipRegistrants';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Badge preview runs outside the dashboard layout (no sidebar/navbar) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin/badge-preview" element={<BadgePreview />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard"            element={<Dashboard />} />
              <Route path="/admin/registration-links"   element={<RegistrationLinks />} />
              <Route path="/admin/event"                element={<EventSetup />} />
              <Route path="/admin/registrants"          element={<Registrants />} />
              <Route path="/admin/vip-registrants"      element={<VipRegistrants />} />
              <Route path="/admin/page-builder"         element={<PageBuilder />} />
              <Route path="/admin/vip-page-builder"     element={<VipPageBuilder />} />
              <Route path="/admin/email-template"       element={<EmailTemplate />} />
              <Route path="/admin/reminder-config"      element={<ReminderConfig />} />
              <Route path="/admin/badge-setup"          element={<BadgeSetup />} />
              <Route path="/admin/checkin"              element={<CheckIn />} />
              <Route path="/admin/print-cards"          element={<PrintCards />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
