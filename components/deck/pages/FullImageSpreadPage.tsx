"use client";

import { forwardRef } from "react";
import SignedImage from "@/src/components/common/SignedImage";

type Props = {
  side: "left" | "right";
  number?: number;
};

const OVERVIEW_FRAME_SRC = "images/first_frame_overview.jpg";
const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const FullImageSpreadPage = forwardRef<HTMLDivElement, Props>(
  ({ side, number: _number }, ref) => {
    void _number;

    return (
      <div
        ref={ref}
        className={`relative h-full w-full overflow-hidden bg-black ${
          side === "left"
            ? "rounded-l-[24px] sm:rounded-l-2xl"
            : "rounded-r-[24px] sm:rounded-r-2xl"
        }`}
      >
        <div
          className={`absolute inset-y-0 w-[200%] ${
            side === "left" ? "left-0" : "-left-full"
          }`}
        >
          <SignedImage
            src={OVERVIEW_FRAME_SRC}
            placeholderSrc={EMPTY_IMAGE_DATA_URL}
            alt="Trifecta Veranza project overview"
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </div>
    );
  },
);

FullImageSpreadPage.displayName = "FullImageSpreadPage";

export default FullImageSpreadPage;
