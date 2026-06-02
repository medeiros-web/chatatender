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
              <Route index element={<AdminDashboardPlaceholder />} />
              <Route path="sectors"      element={<SectorsPage />} />
              <Route path="products"     element={<ProductsPage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route path="leads"        element={<LeadsPage />} />
              <Route path="inbox"        element={<InboxPage />} />
              <Route path="whatsapp"     element={<WhatsAppPage />} />
              <Route path="agents"       element={<AgentsPage />} />
            </Route>

            <Route element={<SuperAdminRoute />}>
              <Route path="/super-admin" element={
                <div className="p-8 text-foreground font-medium">Super Admin — Módulo 13</div>
              } />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
