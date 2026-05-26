"use client";

import { cn } from "@/lib/utils";
import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import Link from "next/link";
import {
  AnimatePresence,
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: { title: string; icon: React.ReactNode; href: string; active?: boolean }[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};

const FloatingDockMobile = ({
  items,
  className,
}: {
  items: { title: string; icon: React.ReactNode; href: string; active?: boolean }[];
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            layoutId="nav"
            className="absolute bottom-full right-0 mb-2 flex flex-col gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: 10,
                  transition: {
                    delay: idx * 0.05,
                  },
                }}
                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border transition",
                    item.active
                      ? "border-white/10 bg-neutral-900 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                      : "border-transparent bg-transparent",
                  )}
                >
                  <div className="h-4 w-4">{item.icon}</div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-800"
      >
        <IconLayoutNavbarCollapse className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
      </button>
    </div>
  );
};

const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: { title: string; icon: React.ReactNode; href: string; active?: boolean }[];
  className?: string;
}) => {
  const mouseY = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseY.set(e.clientY)}
      onMouseLeave={() => mouseY.set(Infinity)}
      className={cn(
        "mx-auto hidden w-16 flex-col items-center gap-4 rounded-2xl bg-transparent px-3 py-4 md:flex dark:bg-neutral-900",
        className
      )}
    >
      {items.map((item) => (
        <IconContainer mouseY={mouseY} key={item.title} {...item} />
      ))}
    </motion.div>
  );
};

function IconContainer({
  mouseY,
  title,
  icon,
  href,
  active = false,
}: {
  mouseY: MotionValue<number>;
  title: string;
  icon: React.ReactNode;
  href: string;
  active?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const centerYRef = useRef(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const bounds = node.getBoundingClientRect();
      centerYRef.current = bounds.top + bounds.height / 2;
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);

    resizeObserver?.observe(node);
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const distance = useTransform(mouseY, (val) => val - centerYRef.current);

  const sizeTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const iconSizeTransform = useTransform(
    distance,
    [-150, 0, 150],
    [20, 40, 20]
  );

  const size = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const iconSize = useSpring(iconSizeTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <Link href={href}>
      <motion.div
        ref={ref}
        style={{ width: size, height: size }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-full border transition",
          active
            ? "border-white bg-white text-black shadow-[0_12px_28px_rgba(255,255,255,0.14)]"
            : "border-white/10 bg-neutral-900 text-white",
        )}
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, x: -10, y: "-50%" }}
              animate={{ opacity: 1, x: 0, y: "-50%" }}
              exit={{ opacity: 0, x: -2, y: "-50%" }}
              className="absolute left-full top-1/2 ml-3 w-max rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          style={{ width: iconSize, height: iconSize }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </Link>
  );
}
