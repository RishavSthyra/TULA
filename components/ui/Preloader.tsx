"use client"

import React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Cormorant_Garamond } from "next/font/google"

const luxeItalic = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["italic"],
})

type TrifectaPreloaderProps = {
  progress?: number
}

export default function TrifectaPreloader({
  progress = 65,
}: TrifectaPreloaderProps) {
  const clamped = Math.max(0, Math.min(100, progress))
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[9999] overflow-hidden bg-[#050505]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,168,109,0.16),transparent_34%),radial-gradient(circle_at_50%_55%,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,#070707_0%,#050505_45%,#020202_100%)]" />
      <motion.div
        animate={
          reduceMotion
            ? { opacity: 0.34, scale: 1 }
            : {
                opacity: [0.28, 0.5, 0.28],
                scale: [0.96, 1.02, 0.96],
              }
        }
        transition={{
          duration: 4.6,
          repeat: reduceMotion ? 0 : Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(214,188,136,0.16),rgba(214,188,136,0.04)_38%,transparent_68%)] blur-3xl"
      />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-white">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full max-w-5xl flex-col items-center"
        >
          <div className="mb-6 text-center">
            <div className="text-[10px] uppercase tracking-[0.55em] text-white/38 sm:text-[11px]">
              Curating The Experience
            </div>
          </div>

          <div className="relative select-none">
            <motion.h1
              animate={
                reduceMotion
                  ? { opacity: 0.5 }
                  : { opacity: [0.42, 0.58, 0.42] }
              }
              transition={{
                duration: 3.2,
                repeat: reduceMotion ? 0 : Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className={`${luxeItalic.className} text-center text-[clamp(3rem,12vw,8.5rem)] font-semibold uppercase leading-none tracking-[0.28em] text-white/12`}
            >
              TRIFECTA
            </motion.h1>

            <motion.h1
              className={`${luxeItalic.className} pointer-events-none absolute inset-0 overflow-hidden whitespace-nowrap text-center text-[clamp(3rem,12vw,8.5rem)] font-semibold uppercase leading-none tracking-[0.28em] text-[#f7f1e5]`}
              style={{
                width: `${clamped}%`,
                textShadow:
                  "0 0 18px rgba(255,244,220,0.22), 0 0 40px rgba(214,188,136,0.12)",
              }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              TRIFECTA
            </motion.h1>

            <motion.div
              animate={reduceMotion ? { x: "114%" } : { x: ["-14%", "114%"] }}
              transition={{
                duration: 2.4,
                repeat: reduceMotion ? 0 : Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className="pointer-events-none absolute inset-y-0 w-[16%] skew-x-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] blur-md"
            />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-center text-[12px] italic tracking-[0.24em] text-[#d7c3a0]/82 sm:text-[13px]"
          >
            A more refined way to arrive
          </motion.p>

          <div className="mt-10 w-full max-w-md">
            <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.32em] text-white/40 sm:text-[11px]">
              <span>Loading</span>
              <span>{clamped}%</span>
            </div>

            <div className="relative h-[2px] overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#7a6647_0%,#d6bc88_45%,#fff4dc_100%)]"
                initial={{ width: 0 }}
                animate={{ width: `${clamped}%` }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
