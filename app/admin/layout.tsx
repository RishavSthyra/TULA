import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | Admin",
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
