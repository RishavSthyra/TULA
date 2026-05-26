"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import UpperLayoutCTA from "./UpperLayoutCTA";
import {
  clearTrifectaPresenterApi,
  setTrifectaPresenterApi,
  TRIFECTA_LEAD_OPEN_EVENT,
} from "@/lib/trifecta-remote-control";

const QuoteRequestModal = dynamic(() => import("./QuoteRequestModal"), {
  ssr: false,
});

export default function QuoteRequestController({
  mergeRouteLinks = false,
  showCta = true,
}: {
  mergeRouteLinks?: boolean;
  showCta?: boolean;
}) {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  useEffect(() => {
    const openLead = () => {
      setIsQuoteModalOpen(true);
    };

    window.addEventListener(TRIFECTA_LEAD_OPEN_EVENT, openLead as EventListener);
    setTrifectaPresenterApi({ openLead });

    return () => {
      window.removeEventListener(
        TRIFECTA_LEAD_OPEN_EVENT,
        openLead as EventListener,
      );

      if (window.TrifectaPresenter?.openLead === openLead) {
        clearTrifectaPresenterApi(["openLead"]);
      }
    };
  }, []);

  return (
    <>
      {showCta ? (
        <UpperLayoutCTA
          mergeRouteLinks={mergeRouteLinks}
          onQuoteClick={() => setIsQuoteModalOpen(true)}
        />
      ) : null}
      <QuoteRequestModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
      />
    </>
  );
}
