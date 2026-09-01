import React from "react";
import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/metadata";

export const metadata: Metadata = {
  title: {
    default: `Admin | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nosnippet: true,
    },
  },
};

export default function Layout({children} : {children : React.ReactNode}) {
  return (
    <React.Fragment>
        {children}
    </React.Fragment>
  )
}
