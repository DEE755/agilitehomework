import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { LanguageProvider } from './i18n/LanguageContext';

// Customer layout + pages
import Layout from './components/Layout';
import CreateTicketPage from './pages/CreateTicketPage';
import ProductsPage from './pages/ProductsPage';
import SupportSuccessPage from './pages/SupportSuccessPage';
import TicketLookupPage from './pages/TicketLookupPage';

// Admin layout + pages
import AdminLayout from './components/admin/AdminLayout';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminTicketDetailPage from './pages/admin/AdminTicketDetailPage';
import AdminAgentsPage from './pages/admin/AdminAgentsPage';

function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export default function App() {
  return (
    <LanguageProvider>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Customer portal ── */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/products" replace />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="support/new" element={<CreateTicketPage />} />
            <Route path="support/lookup" element={<TicketLookupPage />} />
            <Route path="support/success/:ticketId" element={<SupportSuccessPage />} />

            {/* Legacy customer ticket routes */}
            <Route path="tickets" element={<Navigate to="/support/new" replace />} />
            <Route path="tickets/new" element={<RedirectWithSearch to="/support/new" />} />
            <Route path="tickets/:id" element={<Navigate to="/support/new" replace />} />
          </Route>

          {/* ── Admin portal ── */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/tickets" replace />} />
            <Route path="tickets" element={<AdminDashboardPage />} />
            <Route path="tickets/:id" element={<AdminTicketDetailPage />} />
            <Route path="agents" element={<AdminAgentsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/products" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
    </LanguageProvider>
  );
}
