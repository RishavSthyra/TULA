"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import SignedImage from "@/src/components/common/SignedImage";

type Props = {
  number?: number;
};

const imageReveal = {
  hidden: { opacity: 0, scale: 1.08, x: 30 },
  show: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};
const OVERVIEW_LEFT_IMAGE_URL = "images/bros_1.webp";
const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const OverviewLeftPage = forwardRef<HTMLDivElement, Props>(({ number: _number }, ref) => {
  void _number;
  return (
    <div
      ref={ref}
      className="h-full w-full overflow-hidden relative rounded-[24px] bg-white sm:rounded-2xl"
    >
      <motion.div
        variants={imageReveal}
        initial="hidden"
        animate="show"
        className="relative h-full w-full"
      >
        <SignedImage
          src={OVERVIEW_LEFT_IMAGE_URL}
          placeholderSrc={EMPTY_IMAGE_DATA_URL}
          alt="Project overview tower"
          fill
          className="absolute h-full w-full object-cover object-[45%_40%]"
          priority
        />
      </motion.div>
    </div>
  );
});

OverviewLeftPage.displayName = "OverviewLeftPage";

export default OverviewLeftPage;
