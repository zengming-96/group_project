import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/layout/page-transition'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { registerAccount } from '../lib/api'
import { loadAccessToken } from '../lib/auth-token'
import { getHttpErrorMessage } from '../lib/http-error'
import { saveSessionUser, upsertRegisteredUser } from '../lib/user-session'

export function RegisterPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreePolicy, setAgreePolicy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    const token = loadAccessToken()
    if (token) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  const passwordScore = useMemo(() => {
    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    return score
  }, [password])

  const passwordStrength = ['很弱', '较弱', '一般', '较强', '很强'][passwordScore]

  const validate = () => {
    if (!fullName.trim()) return '请输入姓名。'
    if (!/\S+@\S+\.\S+/.test(email)) return '请输入有效的邮箱地址。'
    if (password.length < 8) return '密码长度至少为 8 位。'
    if (password !== confirmPassword) return '两次输入的密码不一致。'
    if (!agreePolicy) return '请先同意条款后继续。'
    return ''
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorText('')

    const validateResult = validate()
    if (validateResult) {
      setErrorText(validateResult)
      return
    }

    setIsSubmitting(true)
    try {
      await registerAccount({ fullName, email, role: 'student', password })
      const sessionUser = upsertRegisteredUser({ fullName, email, role: 'student', password })
      saveSessionUser(sessionUser)
      setIsSuccess(true)
    } catch (err) {
      setErrorText(getHttpErrorMessage(err, '注册失败，请稍后重试。'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <section className="flex min-h-[82vh] items-center justify-center">
        <Card className="w-full max-w-xl border-gray-300">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl">创建账号</CardTitle>
            <CardDescription>
              一分钟内完成 AI 批改账号创建。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSuccess ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-gray-700">姓名</span>
                  <Input
                    type="text"
                    value={fullName}
                    placeholder="请输入姓名"
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-gray-700">邮箱</span>
                  <Input
                    type="email"
                    value={email}
                    placeholder="you@school.edu"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-gray-700">密码</span>
                  <Input
                    type="password"
                    value={password}
                    placeholder="至少 8 位"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-gray-700">确认密码</span>
                  <Input
                    type="password"
                    value={confirmPassword}
                    placeholder="再次输入密码"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>

                <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-700">
                  <p>密码强度：<span className="font-semibold">{passwordStrength}</span></p>
                  <div className="mt-2 h-2 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-black transition-all"
                      style={{ width: `${(passwordScore / 4) * 100}%` }}
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={agreePolicy}
                    onChange={(event) => setAgreePolicy(event.target.checked)}
                    className="mt-1"
                  />
                  我已阅读并同意服务条款与隐私政策。
                </label>

                {errorText && <p className="text-sm text-gray-600">{errorText}</p>}

                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  创建账号
                </Button>
              </form>
            ) : (
              <div className="space-y-4 rounded-md border bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-sm font-semibold">账号创建成功</p>
                    <p className="mt-1 text-sm text-gray-600">
                      账号已创建，请前往登录页使用该账号登录。
                    </p>
                  </div>
                </div>
                <Button className="w-full" onClick={() => navigate('/login')}>
                  前往登录
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-gray-600">
              <Link to="/login" className="hover:text-black">
                返回登录
              </Link>
              <Link to="/forgot-password" className="hover:text-black">
                忘记密码
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageTransition>
  )
}
