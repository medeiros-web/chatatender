import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PendingApprovalPage } from '@/pages/PendingApprovalPage'

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  )
}

function AccessDeniedPage({ status }: { status: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">🚫</div>
        <h1 className="text-xl font-bold text-foreground">Acesso negado</h1>
        <p className="text-muted-foreground text-sm">
          Seu acesso a esta plataforma foi {status === 'rejected' ? 'rejeitado' : 'suspenso'}.
          Entre em contato com o suporte se acredita que isso é um erro.
        </p>
        <a href="/login" className="text-sm text-primary underline">
          Voltar ao login
        </a>
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const { user, isLoading, profileStatus } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (profileStatus === 'pending') return <PendingApprovalPage />
  if (profileStatus === 'rejected' || profileStatus === 'suspended') return <AccessDeniedPage status={profileStatus} />

  return <Outlet />
}

export function SuperAdminRoute() {
  const { user, isSuperAdmin, isLoading, profileStatus } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (profileStatus === 'pending') return <PendingApprovalPage />
  if (!isSuperAdmin) return <Navigate to="/admin" replace />

  return <Outlet />
}

export function AdminRoute() {
  const { user, isAdmin, isLoading, profileStatus } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (profileStatus === 'pending') return <PendingApprovalPage />
  if (!isAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
