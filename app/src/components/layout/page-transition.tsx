import { motion } from 'framer-motion'
import type { PropsWithChildren } from 'react'
import { cn } from '../../lib/utils'

interface PageTransitionProps extends PropsWithChildren {
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={cn('mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8', className)}
    >
      {children}
    </motion.main>
  )
}
