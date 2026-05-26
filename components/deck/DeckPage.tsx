"use client";

import React, { forwardRef } from "react";

type DeckPageProps = {
  children: React.ReactNode;
  className?: string;
};

const DeckPage = forwardRef<HTMLDivElement, DeckPageProps>(
  ({ children, className = "" }, ref) => {
    return (
      <div
        ref={ref}
        className={`h-full w-full overflow-hidden bg-white text-slate-900 ${className}`}
      >
        <div className="flex h-full w-full flex-col p-8 md:p-10">
          {children}
        </div>
      </div>
    );
  }
);

DeckPage.displayName = "DeckPage";

export default DeckPage;