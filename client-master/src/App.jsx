import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import Lookups from './pages/Lookups';
import Visitors from './pages/Visitors';
import NotFound from './pages/NotFound';

// Wrapper forces full remount of Lookups when the type param changes,
// resetting all local state cleanly without manual cleanup in the page.
function LookupRoute() {
  const { type } = useParams();
  return <Lookups key={type} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/organizations" element={<Organizations />} />
              <Route path="/visitors" element={<Visitors />} />
              <Route path="/lookups/:type" element={<LookupRoute />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
