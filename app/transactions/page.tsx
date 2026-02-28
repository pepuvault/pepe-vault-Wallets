"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getWallets, updateActivity } from "@/lib/wallet"
import { ExternalLink, ArrowLeft, Clock, Send, TrendingUp, Zap, ArrowRightLeft } from "lucide-react"
import Link from "next/link"
import BottomNav from "@/components/BottomNav"

interface Transaction {
  hash: string
  type: string
  fromToken?: string
  toToken?: string
  amountIn?: string
  amountOut?: string
  chainId: number
  timestamp: number
  explorerUrl?: string
}

/* ── tx type icon ── */
const TxIcon = ({ type }: { type: string }) => {
  const configs: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
    swap:   { icon: <ArrowRightLeft className="w-4 h-4" />, bg: "rgba(0,255,136,0.12)", color: "#00ff88" },
    send:   { icon: <Send className="w-4 h-4" />,           bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
    bridge: { icon: <Zap className="w-4 h-4" />,            bg: "rgba(139,92,246,0.12)", color: "#8b5cf6" },
  }
  const cfg = configs[type] || { icon: <Clock className="w-4 h-4" />, bg: "rgba(107,114,128,0.12)", color: "#6b7280" }
  return (
    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon}
    </div>
  )
}

/* ── network badge ── */
const NetBadge = ({ chainId }: { chainId: number }) => {
  const label = chainId === 1 ? "ETH" : chainId === 97741 ? "PEPU" : "?"
  const color = chainId === 1 ? "#627eea" : "#00ff88"
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {label}
    </span>
  )
}

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [chainId, setChainId] = useState(97741)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const wallets = getWallets()
    if (wallets.length === 0) { router.push("/setup"); return }
    updateActivity()
    loadTransactions()
  }, [router, chainId])

  const loadTransactions = () => {
    setLoading(true)
    try {
      const stored = localStorage.getItem("transaction_history")
      if (stored) {
        const allTxs: Transaction[] = JSON.parse(stored)
        const filtered = chainId ? allTxs.filter(tx => tx.chainId === chainId) : allTxs
        setTransactions(filtered.sort((a, b) => b.timestamp - a.timestamp))
      } else {
        setTransactions([])
      }
    } catch (error) {
      console.error("Error loading transactions:", error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (m < 1) return "Just now"
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    if (d < 7) return `${d}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  const getExplorerUrl = (tx: Transaction) => {
    if (tx.explorerUrl) return tx.explorerUrl
    if (tx.chainId === 1) return `https://etherscan.io/tx/${tx.hash}`
    if (tx.chainId === 97741) return `https://pepuscan.com/tx/${tx.hash}`
    return "#"
  }

  const shortHash = (hash: string) =>
    hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : "—"

  const networkTabs = [
    { id: 97741, label: "PEPU", color: "#00ff88" },
    { id: 1,     label: "Ethereum", color: "#627eea" },
    { id: 0,     label: "All", color: "#9ca3af" },
  ]

  return (
    <div className="min-h-screen pb-28 text-white" style={{ background: "#13141a" }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-5 py-4"
        style={{ background: "rgba(19,20,26,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold">Activity</h1>
          <p className="text-xs" style={{ color: "#6b7280" }}>Your transaction history</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-4">

        {/* ── Network filter tabs ── */}
        <div
          className="flex rounded-2xl p-1 gap-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {networkTabs.map((n) => (
            <button
              key={n.id}
              onClick={() => setChainId(n.id)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={
                chainId === n.id
                  ? { background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.1)", color: n.color }
                  : { color: "#6b7280" }
              }
            >
              {n.label}
            </button>
          ))}
        </div>

        {/* ── Tx list ── */}
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center animate-pulse" style={{ background: "rgba(0,255,136,0.1)" }}>
              <Clock className="w-5 h-5" style={{ color: "#00ff88" }} />
            </div>
            <p className="text-sm" style={{ color: "#6b7280" }}>Loading transactions…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div
            className="flex flex-col items-center py-16 gap-3"
            style={{ background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 24 }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
              <Clock className="w-7 h-7" style={{ color: "#374151" }} />
            </div>
            <p className="font-semibold" style={{ color: "#9ca3af" }}>No transactions yet</p>
            <p className="text-sm text-center px-6" style={{ color: "#4b5563" }}>
              Your on-chain activity will appear here
            </p>
          </div>
        ) : (
          <div
            className="rounded-3xl overflow-hidden"
            style={{ background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {transactions.map((tx, idx) => (
              <div
                key={tx.hash}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: idx < transactions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              >
                <TxIcon type={tx.type} />

                <div className="flex-1 min-w-0">
                  {/* top row */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold capitalize">{tx.type}</span>
                    {chainId === 0 && <NetBadge chainId={tx.chainId} />}
                  </div>

                  {/* token pair (swap) */}
                  {tx.type === "swap" && tx.fromToken && tx.toToken && (
                    <p className="text-xs font-medium mb-0.5" style={{ color: "#9ca3af" }}>
                      {tx.fromToken} → {tx.toToken}
                    </p>
                  )}

                  {/* amounts */}
                  {tx.amountIn && tx.amountOut && (
                    <p className="text-xs" style={{ color: "#6b7280" }}>
                      {Number.parseFloat(tx.amountIn).toFixed(4)} → {Number.parseFloat(tx.amountOut).toFixed(4)}
                    </p>
                  )}

                  {/* hash + time */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-mono" style={{ color: "#4b5563" }}>{shortHash(tx.hash)}</span>
                    <span style={{ color: "#374151" }}>·</span>
                    <span className="text-xs" style={{ color: "#4b5563" }}>{formatDate(tx.timestamp)}</span>
                  </div>
                </div>

                {/* explorer link */}
                <a
                  href={getExplorerUrl(tx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" }}
                  title="View on explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" style={{ color: "#00ff88" }} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="dashboard" />
    </div>
  )
}
