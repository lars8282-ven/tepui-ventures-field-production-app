"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/instant";
import { useState } from "react";
import { Logo } from "@/components/Logo";

const navigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Field Entry", href: "/field-entry" },
  { name: "Summary", href: "/summary" },
  { name: "Baseline", href: "/baseline" },
  { name: "Wells", href: "/wells" },
  { name: "Import", href: "/import" },
];

export function Navigation() {
  const pathname = usePathname();
  const { user: authUser } = db.useAuth();
  const userId = authUser?.id;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper function to check if a path is active
  // Handles sub-routes (e.g., /wells/123 should highlight "Wells")
  const isActiveRoute = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (!userId) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Logo />
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-6">
              {navigation.map((item) => {
                const isActive = isActiveRoute(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold ${
                      isActive
                        ? "border-tepui-blue text-tepui-gray"
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-tepui-gray"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <button
              onClick={handleSignOut}
              className="text-gray-600 hover:text-tepui-gray px-3 py-2 text-sm font-medium"
            >
              Sign out
            </button>
          </div>
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-tepui-blue"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-semibold ${
                    isActive
                      ? "bg-blue-50 border-tepui-blue text-tepui-gray"
                      : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-tepui-gray"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
