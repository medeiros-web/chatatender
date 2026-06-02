import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, User, Mail, Phone, Briefcase, Globe } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, type ProfileData } from '@/hooks/useProfile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  timezone: z.string(),
})

type ProfileValues = z.infer<typeof profileSchema>

const passwordSchema = z.object({
  new_password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'As senhas não coincidem',
  path: ['confirm_password'],
})

type PasswordValues = z.infer<typeof passwordSchema>

export function ProfilePage() {
  const { user } = useAuth()
  const { data: profileRaw, updateMutation, uploadAvatar } = useProfile(user?.id)
  const profile = profileRaw as ProfileData | null | undefined
  const fileRef = useRef<HTMLInputElement>(null)

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      job_title: profile?.job_title ?? '',
      timezone: profile?.timezone ?? 'America/Sao_Paulo',
    },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  })

  const onProfileSubmit = async (values: ProfileValues) => {
    await updateMutation.mutateAsync(values)
  }

  const onPasswordSubmit = async (values: PasswordValues) => {
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.updateUser({ password: values.new_password })
    passwordForm.reset()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadAvatar.mutateAsync(file)
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
        </div>

        {/* Avatar + Email */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foto e identidade</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow hover:opacity-90 transition-opacity"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="font-medium text-foreground">{profile?.full_name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados pessoais</CardTitle>
            <CardDescription>Informações exibidas para sua equipe</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">
                    <User className="inline h-3.5 w-3.5 mr-1" />
                    Nome completo
                  </Label>
                  <Input id="full_name" {...profileForm.register('full_name')} />
                  {profileForm.formState.errors.full_name && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.full_name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">
                    <Phone className="inline h-3.5 w-3.5 mr-1" />
                    Telefone
                  </Label>
                  <Input id="phone" placeholder="(11) 99999-9999" {...profileForm.register('phone')} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="job_title">
                    <Briefcase className="inline h-3.5 w-3.5 mr-1" />
                    Cargo
                  </Label>
                  <Input id="job_title" placeholder="Ex: Gerente de Vendas" {...profileForm.register('job_title')} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="timezone">
                    <Globe className="inline h-3.5 w-3.5 mr-1" />
                    Fuso horário
                  </Label>
                  <Input id="timezone" {...profileForm.register('timezone')} />
                </div>
              </div>

              <Button
                type="submit"
                loading={updateMutation.isPending}
                className="w-full sm:w-auto"
              >
                Salvar alterações
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Alterar senha */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alterar senha</CardTitle>
            <CardDescription>Crie uma senha forte com pelo menos 8 caracteres</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new_password">Nova senha</Label>
                  <Input id="new_password" type="password" {...passwordForm.register('new_password')} />
                  {passwordForm.formState.errors.new_password && (
                    <p className="text-xs text-destructive">{passwordForm.formState.errors.new_password.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm_password">Confirmar</Label>
                  <Input id="confirm_password" type="password" {...passwordForm.register('confirm_password')} />
                  {passwordForm.formState.errors.confirm_password && (
                    <p className="text-xs text-destructive">{passwordForm.formState.errors.confirm_password.message}</p>
                  )}
                </div>
              </div>
              <Button type="submit" variant="outline" loading={passwordForm.formState.isSubmitting}>
                Alterar senha
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Zona de perigo */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Zona de perigo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Estas ações são irreversíveis. Prossiga com cuidado.
            </p>
            <Button variant="destructive" size="sm" disabled>
              Excluir minha conta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
