import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import RegistrationForm from './pages/RegistrationForm';
import Confirmation from './pages/Confirmation';
import NotFound from './pages/NotFound';

// Fires a GA4 page_view event on every route change
function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path:  location.pathname,
      page_title: document.title,
    });
  }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <PageViewTracker />
      <Routes>
        {/* More-specific routes first to prevent /:orgSlug catching them */}
        <Route path="/:orgSlug/vip/confirmation/:registrantId" element={<Confirmation vip />} />
        <Route path="/:orgSlug/vip"                            element={<RegistrationForm vip />} />
        <Route path="/:orgSlug/confirmation/:registrantId"     element={<Confirmation />} />
        <Route path="/:orgSlug"                                element={<RegistrationForm />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
