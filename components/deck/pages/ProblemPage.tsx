"use client";

import React, { forwardRef } from "react";

type Props = {
  number?: number;
};

const ProblemPage = forwardRef<HTMLDivElement, Props>(({ number }, ref) => {
  return (
    <div
      ref={ref}
      className="h-full w-full overflow-hidden rounded-[24px] bg-white sm:rounded-2xl"
    >
      <div className="flex h-full w-full flex-col justify-center bg-[#f8f8f8] px-16 text-neutral-900">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-neutral-500">
          Page {number}
        </p>
        <h2 className="mb-6 text-4xl font-bold">Problem</h2>
        <p className="max-w-3xl text-lg leading-8 text-neutral-700">
          Add your problem statement here. This page is now a real flipbook page,
          not merged into the previous one.
        </p>
      </div>
    </div>
  );
});

ProblemPage.displayName = "ProblemPage";

export default ProblemPage;
