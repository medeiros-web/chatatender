import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute, SuperAdminRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { AcceptInvitePage } from '@/pages/AcceptInvitePage'
import { ProfilePage } from '@/pages/ProfilePage'
import { AdminLayout, AdminDashboardPlaceholder } from '@/pages/AdminLayout'
import { SectorsPage } from '@/pages/admin/SectorsPage'
import { ProductsPage } from '@/pages/admin/ProductsPage'
import { ProductDetailPage } from '@/pages/admin/ProductDetailPage'
import { LeadsPage } from '@/pages/admin/LeadsPage'
import { InboxPage } from '@/pages/admin/InboxPage'
import { WhatsAppPage } from '@/pages/admin/WhatsAppPage'
import { AgentsPage } from '@/pages/admin/AgentsPage'
import { FunnelsPage } from '@/pages/admin/FunnelsPage'
import { FormsPage } from '@/pages/admin/FormsPage'
import { CalendarPage } from '@/pages/admin/CalendarPage'
import { PaymentsPage } from '@/pages/admin/PaymentsPage'
import { CommissionsPage } from '@/pages/admin/CommissionsPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { SuperAdminLayout } from '@/pages/super-admin/SuperAdminLayout'
import {
  SADashboard, SAOrganizations, SAUsers,
  SAPlans, SASubscriptions, SABilling,
  SAReleases, SAHelpArticles, SASupport,
  SABranding, SAEmailSettings, SAPlatformSettings,
  SAAIQuality, SAToolExecutions, SAAuditLogs, SASystemHealth,
} from '@/pages/super-admin/SuperAdminPage'
import { PublicFunnelPage } from '@/pages/public/PublicFunnelPage'
import { PublicFormPage } from '@/pages/public/PublicFormPage'
import { PublicBookingPage } from '@/pages/public/PublicBookingPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfilePage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="sectors"      element={<SectorsPage />} />
              <Route path="products"     element={<ProductsPage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route path="leads"        element={<LeadsPage />} />
              <Route path="inbox"        element={<InboxPage />} />
              <Route path="whatsapp"     element={<WhatsAppPage />} />
              <Route path="agents"       element={<AgentsPage />} />
              <Route path="calendar"     element={<CalendarPage />} />
              <Route path="payments"     element={<PaymentsPage />} />
              <Route path="commissions"  element={<CommissionsPage />} />
              <Route path="funnels"      element={<FunnelsPage />} />
              <Route path="forms"        element={<FormsPage />} />
            </Route>

            <Route element={<SuperAdminRoute />}>
              <Route path="/super-admin" element={<SuperAdminLayout />}>
                <Route index                  element={<SADashboard />} />
                <Route path="organizations"   element={<SAOrganizations />} />
                <Route path="users"           element={<SAUsers />} />
                <Route path="plans"           element={<SAPlans />} />
                <Route path="subscriptions"   element={<SASubscriptions />} />
                <Route path="billing"         element={<SABilling />} />
                <Route path="releases"        element={<SAReleases />} />
                <Route path="help"            element={<SAHelpArticles />} />
                <Route path="support"         element={<SASupport />} />
                <Route path="branding"        element={<SABranding />} />
                <Route path="email"           element={<SAEmailSettings />} />
                <Route path="settings"        element={<SAPlatformSettings />} />
                <Route path="ai-quality"      element={<SAAIQuality />} />
                <Route path="executions"      element={<SAToolExecutions />} />
                <Route path="audit"           element={<SAAuditLogs />} />
                <Route path="health"          element={<SASystemHealth />} />
              </Route>
            </Route>
          </Route>

          {/* Páginas públicas — sem autenticação */}
          <Route path="/funnel/:slug"   element={<PublicFunnelPage />} />
          <Route path="/f/:slug"        element={<PublicFormPage />} />
          <Route path="/booking/:slug"  element={<PublicBookingPage />} />

          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
