"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Create Twin" },
  { href: "/subscription", label: "Subscription" },
  { href: "/login", label: "Login" },
];

export function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith("/twin/")) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-white/10 bg-black/78 text-white/72 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8 lg:px-12 xl:px-14">
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              Quick links
            </p>
            <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm">
              {footerLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              Contact for Support
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <p>
                Email:{" "}
                <a
                  href="mailto:osiemomaina85@gmail.com"
                  className="transition hover:text-white"
                >
                  osiemomaina85@gmail.com
                </a>
              </p>
              <p>
                Phone:{" "}
                <a href="tel:+254799535642" className="transition hover:text-white">
                  +254799535642
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
