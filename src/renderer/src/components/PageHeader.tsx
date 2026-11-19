import { createContext, useContext, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Hatch, ScrambleText } from './fx'

/** Which module is on screen — provided by App so headers can number themselves. */
export const PageMetaContext = createContext<{ index: number; group: string }>({ index: 0, group: '' })

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}): JSX.Element {
  const { index, group } = useContext(PageMetaContext)
  return (
    <div className="flex items-end justify-between gap-6 mb-8 pb-6 border-b border-[var(--hair)]">
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <Hatch className="h-3 w-7" />
          <span className="label text-ink-300">
            <ScrambleText text={`${String(index).padStart(2, '0')} / ${group}`} />
          </span>
        </div>
        <div className="overflow-hidden">
          <motion.h1
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-hero text-ink-50"
          >
            {title}
          </motion.h1>
        </div>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-[0.9375rem] text-ink-400 mt-3 max-w-xl leading-relaxed"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
