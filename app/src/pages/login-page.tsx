import { Loader2, LogIn } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/layout/page-transition'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { login } from '../lib/api'
import { loadAccessToken, persistAuthFromLoginResponse } from '../lib/auth-token'
import { getHttpErrorMessage } from '../lib/http-error'
import { clearAllClientAuthAndCaches } from '../lib/session-reset'
import { ensureSessionUserByEmail } from '../lib/user-session'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    const state = location.state as { switchAccount?: boolean } | null
    if (state?.switchAccount) {
      clearAllClientAuthAndCaches()
      navigate('/login', { replace: true, state: {} })
      return
    }
    const token = loadAccessToken()
    if (token) {
      navigate('/dashboard', { replace: true })
    }
  }, [location.state, navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email || !password) {
      setErrorText('请填写邮箱和密码。')
      return
    }

    setIsLoading(true)
    setErrorText('')

    try {
      const result = await login({ email, password })
      const token = result.accessToken || result.token || ''

      if (!token) {
        setErrorText('登录成功但未返回访问凭证，请联系后端确认登录接口返回。')
        return
      }

      clearAllClientAuthAndCaches()
      persistAuthFromLoginResponse(result)
      ensureSessionUserByEmail(email)
      navigate('/dashboard')
    } catch (err) {
      setErrorText(getHttpErrorMessage(err, '登录失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageTransition>
      <section className="flex min-h-[82vh] items-center justify-center">
        <Card className="w-full max-w-md border-gray-300">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl">登录</CardTitle>
            <CardDescription>进入你的批改工作台</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {errorText && <p className="text-sm text-gray-600">{errorText}</p>}
              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                登录
              </Button>
            </form>
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <Link to="/forgot-password" className="hover:text-black">
                忘记密码
              </Link>
              <Link to="/register" className="hover:text-black">
                注册账号
              </Link>
            </div>
            <div className="mt-6 text-center text-sm text-gray-600">
              <Link to="/" className="hover:text-black">
                返回首页
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageTransition>
  )
}
