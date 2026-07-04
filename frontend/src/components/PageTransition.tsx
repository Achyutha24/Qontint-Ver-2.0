import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

const variants: any = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1, 
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  exit: { opacity: 0, transition: { duration: 0.1 } }
}

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  
  return (
    <AnimatePresence>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
