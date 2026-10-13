"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import SaduBand from "@/components/landing/SaduBand";
import { useT } from "@/lib/i18n";
import { usePathname } from "next/navigation";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { lang } = useT();
  const pathname = usePathname();

  const backHref = pathname === "/forgot-password" ? "/login" : "/";
  return (
    


<main className="flex min-h-dvh items-center justify-center bg-navy-50">



      
      <div className="grid min-h-dvh w-full bg-white md:grid-cols-2">




        {/* Brand section */}
        <section className="relative flex flex-col items-center justify-center gap-5 overflow-hidden bg-navy-900 px-6 py-10 text-center md:px-10">
          <Link href="/" aria-label="معمار">
            <BrandLogo
              variant="full"
              tone="light"
              height={115}
              alt="معمار"
              priority
            />
          </Link>

          <p className="text-sm text-white/80">
           {lang === "ar"
            ? "نقرأ الأرض لنصنع القرار"
            : "We Read the Land to Shape the Decision"}
          </p>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 text-gold-500"
            aria-hidden="true"
          >
            <SaduBand opacity={0.35} />
          </div>
        </section>

        {/* Form section */}
        <section className="flex items-center justify-center px-5 py-8 sm:px-8 md:px-10">
          
       <div className="w-full max-w-md">
         <Link
           href={backHref}
           className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-navy-900/70 transition-colors hover:text-gold-700"
           >
            <svg
               aria-hidden="true"
               className={`h-4 w-4 ${lang === "ar" ? "rotate-180" : ""}`}
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               strokeWidth="2"
               strokeLinecap="round"
               strokeLinejoin="round"
             >
              <path d="M19 12H5m7-7-7 7 7 7" />
           </svg>
           {lang === "ar" ? "العودة" : "Back"}
          </Link> 

          {children}
       </div>

        </section>

      </div>
    </main>
  );
}
