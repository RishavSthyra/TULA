"use client";

import React from "react";
import { motion } from "framer-motion";

type LeafConfig = {
  id: number;
  startLeft: string;
  size: number;
  duration: number;
  delay: number;
  xPath: number[];
  yPath: number[];
  rotatePath: number[];
  innerRotatePath: number[];
  scalePath?: number[];
};

const leaves: LeafConfig[] = [
  {
    id: 1,
    startLeft: "-6%",
    size: 22,
    duration: 10,
    delay: 0,
    xPath: [0, 80, 180, 260, 360, 470],
    yPath: [-8, 10, 26, 42, 60, 84],
    rotatePath: [-18, 12, -28, 22, -10, 14],
    innerRotatePath: [0, 14, -16, 10, -8, 0],
    scalePath: [1, 1.02, 0.98, 1.03, 0.99, 1],
  },
  {
    id: 2,
    startLeft: "8%",
    size: 18,
    duration: 12,
    delay: 1.2,
    xPath: [0, 60, 140, 220, 300, 390],
    yPath: [-10, 8, 22, 40, 58, 80],
    rotatePath: [10, -20, 24, -16, 18, -8],
    innerRotatePath: [0, -12, 9, -10, 6, 0],
    scalePath: [1, 1.03, 0.97, 1.02, 0.99, 1],
  },
  {
    id: 3,
    startLeft: "26%",
    size: 20,
    duration: 11.2,
    delay: 0.5,
    xPath: [0, -40, 30, 110, 180, 260],
    yPath: [-12, 5, 18, 35, 55, 77],
    rotatePath: [20, -12, 26, -20, 14, -6],
    innerRotatePath: [0, 10, -14, 8, -5, 0],
    scalePath: [1, 1.04, 0.98, 1.03, 0.98, 1],
  },
  {
    id: 4,
    startLeft: "42%",
    size: 16,
    duration: 13,
    delay: 2,
    xPath: [0, 90, 160, 250, 330, 420],
    yPath: [-10, 7, 20, 37, 54, 76],
    rotatePath: [-14, 16, -22, 18, -12, 8],
    innerRotatePath: [0, 11, -10, 8, -6, 0],
    scalePath: [1, 1.02, 0.99, 1.01, 1, 1],
  },
  {
    id: 5,
    startLeft: "60%",
    size: 21,
    duration: 10.8,
    delay: 0.8,
    xPath: [0, -70, -10, 70, 150, 240],
    yPath: [-8, 8, 24, 39, 57, 79],
    rotatePath: [16, -22, 18, -26, 14, -10],
    innerRotatePath: [0, -14, 10, -8, 5, 0],
    scalePath: [1, 1.03, 0.97, 1.02, 0.99, 1],
  },
  {
    id: 6,
    startLeft: "78%",
    size: 17,
    duration: 12.4,
    delay: 1.6,
    xPath: [0, 75, 150, 230, 320, 410],
    yPath: [-11, 6, 19, 34, 52, 74],
    rotatePath: [-12, 20, -24, 16, -10, 6],
    innerRotatePath: [0, 12, -11, 9, -6, 0],
    scalePath: [1, 1.01, 0.98, 1.03, 1, 1],
  },
  {
    id: 7,
    startLeft: "92%",
    size: 15,
    duration: 11.6,
    delay: 2.8,
    xPath: [0, -60, -130, -200, -280, -360],
    yPath: [-10, 8, 21, 38, 56, 78],
    rotatePath: [12, -18, 20, -14, 16, -8],
    innerRotatePath: [0, -10, 8, -9, 4, 0],
    scalePath: [1, 1.03, 0.98, 1.02, 0.99, 1],
  },
];

function MapleLeafSVG({
  size = 18,
  id,
}: {
  size?: number;
  id: number;
}) {
  const gradientId = `mapleLeafGrad-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.16)]"
    >
      <path
        d="M31.8 4
           L36 14
           L45 9
           L43 20
           L55 18
           L48 28
           L58 33
           L46 37
           L49 49
           L38 45
           L36 60
           L32 54
           L28 60
           L26 45
           L15 49
           L18 37
           L6 33
           L16 28
           L9 18
           L21 20
           L19 9
           L28 14
           Z"
        fill={`url(#${gradientId})`}
        stroke="rgba(92, 45, 8, 0.28)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      <path
        d="M32 14 L32 53"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      <defs>
        <linearGradient
          id={gradientId}
          x1="32"
          y1="4"
          x2="32"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFB35C" />
          <stop offset="0.45" stopColor="#E8722A" />
          <stop offset="1" stopColor="#9C3A1D" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function LeafOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-3 overflow-hidden">
      {leaves.map((leaf) => (
        <motion.div
          key={leaf.id}
          className="absolute -top-20"
          style={{
            left: leaf.startLeft,
            opacity: 1,
          }}
          initial={{
            x: `${leaf.xPath[0]}px`,
            y: `${leaf.yPath[0]}vh`,
            rotate: leaf.rotatePath[0],
          }}
          animate={{
            x: leaf.xPath.map((v) => `${v}px`),
            y: leaf.yPath.map((v) => `${v}vh`),
            rotate: leaf.rotatePath,
          }}
          transition={{
            duration: leaf.duration,
            delay: leaf.delay,
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
            times: [0, 0.18, 0.36, 0.58, 0.8, 1],
          }}
        >
          <motion.div
            animate={{
              rotateZ: leaf.innerRotatePath,
              scale: leaf.scalePath ?? [1, 1.02, 0.98, 1.03, 0.99, 1],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.2, 0.4, 0.65, 0.82, 1],
            }}
            style={{
              transformOrigin: "50% 50%",
            }}
          >
            <MapleLeafSVG size={leaf.size} id={leaf.id} />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}