import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MessageSquare, Loader2 } from 'lucide-react'

const schema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'As senhas não coincidem',
  path: ['confirm_password'],
})

type Values = z.infer<typeof schema>

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Token inválido.'); return }
    // Supabase auth usa fragment hash para invite tokens
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus('ready')
      else setStatus('ready') // token será processado no submit
    })
  }, [token])

  const onSubmit = async (values: Values) => {
    const { error } = await supabase.auth.updateUser({
      password: values.password,
      data: { full_name: values.full_name },
    })
    if (error) { setErrorMsg(error.message); return }
    navigate('/admin', { replace: true })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm text-center p-8">
          <p className="text-destructive">{errorMsg}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Aceitar convite</CardTitle>
            <CardDescription className="mt-1">Configure sua conta para acessar a plataforma</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Seu nome</Label>
              <Input id="full_name" placeholder="João Silva" {...register('full_name')} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Criar senha</Label>
              <Input id="password" type="password" placeholder="Mínimo 8 caracteres" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirmar senha</Label>
              <Input id="confirm_password" type="password" {...register('confirm_password')} />
              {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
            </div>
            {errorMsg && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-xs text-destructive">{errorMsg}</p>
              </div>
            )}
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Ativar conta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
