"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wallet, Send, Globe, Settings, Hash, LayoutGrid } from "lucide-react"
import { useState, useEffect } from "react"

interface BottomNavProps {
  active?: string
}

export default function BottomNav({ active }: BottomNavProps) {
  const pathname = usePathname()
  const [chainId, setChainId] = useState(97741)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("selected_chain")
      if (stored) setChainId(Number(stored))
    }
  }, [])

  const currentPage = active || pathname?.split("/")[1] || "dashboard"

  const tabs = [
    { id: "dashboard", label: "Wallet",   href: "/dashboard", icon: Wallet },
    ...(chainId === 97741
      ? [{ id: "domains", label: "Domains",  href: "/domains",   icon: Hash }]
      : []),
    ...(chainId === 97741
      ? [{ id: "browser", label: "Browser",  href: "/browser",   icon: Globe }]
      : []),
    { id: "send",      label: "Send",     href: "/send",      icon: Send },
    { id: "settings",  label: "Settings", href: "/settings",  icon: Settings },
  ]

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(19, 20, 26, 0.95)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {tabs.map(({ id, label, href, icon: Icon }) => {
          const isActive = currentPage === id
          return (
            <Link
              key={id}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all relative min-w-[52px]"
              style={{
                color: isActive ? "#00ff88" : "#6b7280",
              }}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: "#00ff88" }}
                />
              )}
              <Icon
                className="transition-all"
                style={{
                  width: 22,
                  height: 22,
                  strokeWidth: isActive ? 2.5 : 1.75,
                  filter: isActive ? "drop-shadow(0 0 6px rgba(0,255,136,0.5))" : "none",
                }}
              />
              <span
                className="text-[10px] font-semibold tracking-wide"
                style={{ color: isActive ? "#00ff88" : "#6b7280" }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
