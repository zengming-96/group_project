import { ArrowRight, BookOpenCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTransition } from '../components/layout/page-transition'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'

export function SplashPage() {
  return (
    <PageTransition>
      <section className="flex min-h-[82vh] items-center justify-center">
        <Card className="w-full max-w-3xl border-gray-300 bg-white/95">
          <CardContent className="space-y-8 px-8 py-12 text-center sm:px-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black text-white">
              <BookOpenCheck className="h-7 w-7" />
            </div>
            <div className="space-y-4">
              <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
                行测智能AI批改助手
              </h1>
              <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">
                专业的 AI 试卷批改工作台，帮助你快速阅卷、精准定位错误并提供针对性提升建议。
              </p>
            </div>
            <Link to="/login" className="inline-block">
              <Button size="lg" className="gap-2">
                立即开始
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </PageTransition>
  )
}
