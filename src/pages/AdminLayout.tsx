import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePlatformName } from '@/hooks/usePlatformBranding'
import { useProfile, type ProfileData } from '@/hooks/useProfile'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { MessageSquare, LogOut, User, Settings, ShieldCheck, Bell } from 'lucide-react'

export function AdminLayout() {
  const { user, isSuperAdmin, signOut } = useAuth()
  const { data: profileRaw } = useProfile(user?.id)
  const profile = profileRaw as ProfileData | null | undefined
  const platformName = usePlatformName()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 flex-shrink-0">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <MessageSquare className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-foreground">{platformName}</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Notificações (Módulo 15) */}
            <Button variant="ghost" size="icon-sm" className="relative text-muted-foreground">
              <Bell className="h-4 w-4" />
            </Button>

            {/* Avatar menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="rounded-full">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="h-4 w-4" />
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
                  <Settings className="h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                {isSuperAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/super-admin')}>
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-primary font-medium">Super Admin</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function AdminDashboardPlaceholder() {
  return null
}
