import { CheckCircle2, Loader2, Mail, RefreshCcw } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/layout/page-transition'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { requestPasswordReset } from '../lib/api'
import { loadAccessToken } from '../lib/auth-token'

const initialCountdown = 30

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [countdown, setCountdown] = useState(initialCountdown)

  useEffect(() => {
    const token = loadAccessToken()
    if (token) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (!isSuccess || countdown <= 0) return

    const timer = window.setInterval(() => {
      setCountdown((value) => (value > 0 ? value - 1 : 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isSuccess, countdown])

  const validateEmail = (value: string) => /\S+@\S+\.\S+/.test(value)

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorText('')

    if (!validateEmail(email)) {
      setErrorText('请输入有效的邮箱地址。')
      return
    }

    setIsSubmitting(true)
    try {
      await requestPasswordReset({ email })
    } catch {
      // Keep the page functional even without backend service.
    } finally {
      setIsSubmitting(false)
      setIsSuccess(true)
      setCountdown(initialCountdown)
    }
  }

  const resendRequest = async () => {
    if (countdown > 0) return

    setIsSubmitting(true)
    try {
      await requestPasswordReset({ email })
    } catch {
      // Keep the page functional even without backend service.
    } finally {
      setIsSubmitting(false)
      setCountdown(initialCountdown)
    }
  }

  return (
    <PageTransition>
      <section className="flex min-h-[82vh] items-center justify-center">
        <Card className="w-full max-w-lg border-gray-300">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl">找回密码</CardTitle>
            <CardDescription>
              发送重置链接以安全地更新你的密码。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSuccess ? (
              <form onSubmit={submitRequest} className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-gray-700">账号邮箱</span>
                  <Input
                    type="email"
                    value={email}
                    placeholder="you@school.edu"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                {errorText && <p className="text-sm text-gray-600">{errorText}</p>}
                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  发送重置链接
                </Button>
              </form>
            ) : (
              <div className="space-y-4 rounded-md border bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-sm font-semibold">邮件发送成功</p>
                    <p className="mt-1 text-sm text-gray-600">
                      如果邮箱 <span className="font-medium">{email}</span> 对应账号存在，系统已发送密码重置链接。
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={resendRequest}
                  disabled={countdown > 0 || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  {countdown > 0 ? `${countdown}s 后可重发` : '重新发送重置链接'}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-gray-600">
              <Link to="/login" className="hover:text-black">
                返回登录
              </Link>
              <Link to="/register" className="hover:text-black">
                注册账号
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageTransition>
  )
}
