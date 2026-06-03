import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, LogOut, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export function PendingApprovalPage() {
  const { user, signOut, profileStatus, isLoading } = useAuth()
  const navigate = useNavigate()

  // Auto-refresh a cada 15 segundos para checar aprovação
  useEffect(() => {
    const interval = setInterval(() => {
      // Recarregar página para que useAuth re-busque o status
      window.location.reload()
    }, 15_000)
    return () => clearInterval(interval)
  }, [])

  // Se aprovado, redirecionar para admin
  useEffect(() => {
    if (!isLoading && profileStatus === 'active') {
      navigate('/admin', { replace: true })
    }
  }, [profileStatus, isLoading, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const email = user?.email ?? ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md text-center space-y-6 bg-card/80 border border-border/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
        {/* Ícone animado */}
        <div className="flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
            <Clock className="h-9 w-9 text-amber-500 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Cadastro em análise
          </h1>
          <p className="text-muted-foreground">
            Seu cadastro está aguardando aprovação do administrador.
            Você receberá um e-mail assim que seu acesso for liberado.
          </p>
        </div>

        {email && (
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{email}</span>
          </div>
        )}

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-600">
          Esta página verifica automaticamente a aprovação a cada 15 segundos.
        </div>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  )
}
