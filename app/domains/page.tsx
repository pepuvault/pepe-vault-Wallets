"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getWallets, getCurrentWallet, clearAllWallets, confirmWalletReset } from "@/lib/wallet"
import {
  checkDomainAvailability,
  getDomainRegistrationFee,
  getDomainRegistrationFeeByDays,
  getDomainInfo,
  getDomainStatus,
  validateDomainName,
  registerDomain,
  getDomainByWallet,
} from "@/lib/domains"
import { getTokenBalance } from "@/lib/rpc"
import { Search, Loader, CheckCircle, XCircle, Globe, RotateCcw } from "lucide-react"
import BottomNav from "@/components/BottomNav"

const USDC_ADDRESS = "0x20fB684Bfc1aBAaD3AceC5712f2Aa30bd494dF74"
const PEPU_CHAIN_ID = 97741

export default function DomainsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [domainStatus, setDomainStatus] = useState<any>(null)
  const [registrationFee, setRegistrationFee] = useState<string>("0")
  const [years, setYears] = useState(1)
  const [days, setDays] = useState(365)
  const [inputMode, setInputMode] = useState<"years" | "days">("days")
  const [loadingFee, setLoadingFee] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState("0")
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [registering, setRegistering] = useState(false)
  const [password, setPassword] = useState("")
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [userDomain, setUserDomain] = useState<string | null>(null)
  const [userDomainInfo, setUserDomainInfo] = useState<any>(null)
  const [loadingUserDomain, setLoadingUserDomain] = useState(false)

  useEffect(() => {
    const wallets = getWallets()
    if (wallets.length === 0) {
      router.push("/setup")
      return
    }

    loadUserDomain()
    loadUsdcBalance()
  }, [router])

  const loadUserDomain = async () => {
    try {
      setLoadingUserDomain(true)
      const wallets = getWallets()
      if (wallets.length === 0) return

      const wallet = getCurrentWallet() || wallets[0]
      const domain = await getDomainByWallet(wallet.address)
      
      if (domain) {
        setUserDomain(domain)
        const parsed = domain.replace(".pepu", "")
        const info = await getDomainInfo(parsed, ".pepu")
        setUserDomainInfo(info)
      }
    } catch (error) {
      console.error("Error loading user domain:", error)
    } finally {
      setLoadingUserDomain(false)
    }
  }

  const loadUsdcBalance = async () => {
    try {
      setLoadingBalance(true)
      const wallets = getWallets()
      if (wallets.length === 0) return

      const wallet = getCurrentWallet() || wallets[0]
      const balance = await getTokenBalance(USDC_ADDRESS, wallet.address, PEPU_CHAIN_ID)
      setUsdcBalance(balance)
    } catch (error) {
      console.error("Error loading USDC balance:", error)
    } finally {
      setLoadingBalance(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a domain name")
      return
    }

    // Remove .pepu if user included it
    const domainName = searchQuery.trim().toLowerCase().replace(".pepu", "")

    // Validate domain name format
    if (!/^[a-z0-9-]{1,63}$/.test(domainName)) {
      setError("Invalid domain name. Use only letters, numbers, and hyphens (1-63 characters)")
      setIsAvailable(null)
      setDomainStatus(null)
      setShowRegisterForm(false)
      return
    }

    setIsChecking(true)
    setError("")
    setSuccess("")
    setShowRegisterForm(false)

    try {
      const isValid = await validateDomainName(domainName)
      if (!isValid) {
        setError("Invalid domain name format")
        setIsAvailable(null)
        setDomainStatus(null)
        return
      }

      const available = await checkDomainAvailability(domainName, ".pepu")
      setIsAvailable(available)

      if (available) {
        const status = await getDomainStatus(domainName, ".pepu")
        setDomainStatus(status)
        setShowRegisterForm(true)
        await updateFee(domainName, years)
      } else {
        // Domain exists, get its info
        const info = await getDomainInfo(domainName, ".pepu")
        if (info) {
          setDomainStatus({
            exists: true,
            expired: Date.now() / 1000 >= info.expiryTimestamp,
            remainingDays: info.expiryTimestamp > Date.now() / 1000
              ? Math.floor((info.expiryTimestamp - Date.now() / 1000) / 86400)
              : 0,
          })
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to check domain availability")
      setIsAvailable(null)
      setDomainStatus(null)
    } finally {
      setIsChecking(false)
    }
  }

  const updateFee = async (domainName: string, yearsValue: number, daysValue?: number) => {
    if (!domainName) return

    setLoadingFee(true)
    try {
      let fee: string
      if (inputMode === "days" && daysValue !== undefined) {
        if (daysValue < 1 || daysValue > 21900) return // Max 60 years = 21,900 days
        fee = await getDomainRegistrationFeeByDays(domainName, daysValue, ".pepu")
      } else {
        if (yearsValue < 1 || yearsValue > 60) return
        fee = await getDomainRegistrationFee(domainName, yearsValue, ".pepu")
      }
      setRegistrationFee(fee)
    } catch (err: any) {
      console.error("Error calculating fee:", err)
    } finally {
      setLoadingFee(false)
    }
  }

  useEffect(() => {
    if (showRegisterForm && searchQuery.trim() && isAvailable) {
      const domainName = searchQuery.trim().toLowerCase().replace(".pepu", "")
      if (inputMode === "days") {
        updateFee(domainName, years, days)
      } else {
        updateFee(domainName, years)
      }
    }
  }, [years, days, inputMode, showRegisterForm, searchQuery, isAvailable])

  // Sync days and years when switching modes
  useEffect(() => {
    if (inputMode === "days") {
      setDays(Math.round(years * 365))
    } else {
      setYears(Math.max(1, Math.min(60, Math.ceil(days / 365))))
    }
  }, [inputMode])

  const handleRegister = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a domain name")
      return
    }

    if (!password) {
      setError("Please enter your password")
      return
    }

    const domainName = searchQuery.trim().toLowerCase().replace(".pepu", "")

    // Validate input based on mode
    if (inputMode === "days") {
      if (days < 1 || days > 21900) {
        setError("Please enter a valid number of days (1-21,900 days, max 60 years)")
        return
      }
    } else {
      if (years < 1 || years > 60) {
        setError("Please select a valid number of years (1-60)")
        return
      }
    }

    setRegistering(true)
    setError("")
    setSuccess("")

    try {
      const wallets = getWallets()
      if (wallets.length === 0) throw new Error("No wallet found")

      const wallet = getCurrentWallet() || wallets[0]

      // Convert days to years (round up to ensure user gets at least the days they paid for)
      const yearsToRegister = inputMode === "days" ? Math.ceil(days / 365) : years
      
      // Recalculate fee based on actual years that will be registered (important for days mode)
      const actualFee = await getDomainRegistrationFee(domainName, yearsToRegister, ".pepu")
      
      // Check USDC balance with actual fee
      const balance = await getTokenBalance(USDC_ADDRESS, wallet.address, PEPU_CHAIN_ID)
      if (Number.parseFloat(balance) < Number.parseFloat(actualFee)) {
        throw new Error(
          `Insufficient USDC balance. Required: ${Number.parseFloat(actualFee).toFixed(2)} USDC, Available: ${Number.parseFloat(balance).toFixed(2)} USDC`
        )
      }
      
      const txHash = await registerDomain(wallet, password, domainName, yearsToRegister, ".pepu")
      
      setSuccess(`Domain registered successfully! Transaction: https://pepuscan.com/tx/${txHash}`)
      setPassword("")
      setSearchQuery("")
      setShowRegisterForm(false)
      setIsAvailable(null)
      setDomainStatus(null)
      
      // Reload user domain and balance
      await loadUserDomain()
      await loadUsdcBalance()

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    } catch (err: any) {
      setError(err.message || "Failed to register domain")
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="min-h-screen pb-28 text-white" style={{ background: "#13141a" }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-5 py-4"
        style={{ background: "rgba(19,20,26,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,255,136,0.12)" }}>
          <Globe className="w-4 h-4" style={{ color: "#00ff88" }} />
        </div>
        <div>
          <h1 className="text-base font-bold">Register Domain</h1>
          <p className="text-xs" style={{ color: "#6b7280" }}>Get your unique .pepu name</p>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 pt-5 space-y-4">
          {/* ── User's existing domain ── */}
          {loadingUserDomain ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader className="w-5 h-5 animate-spin" style={{ color: "#00ff88" }} />
              <span className="text-sm" style={{ color: "#6b7280" }}>Loading your domain…</span>
            </div>
          ) : userDomain && userDomainInfo ? (
            <div className="rounded-3xl p-5 space-y-4" style={{ background: "#1a1d2e", border: "1px solid rgba(0,255,136,0.2)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(0,255,136,0.12)" }}>
                  <CheckCircle className="w-5 h-5" style={{ color: "#00ff88" }} />
                </div>
                <div>
                  <p className="font-bold" style={{ color: "#00ff88" }}>{userDomain}</p>
                  <p className="text-xs" style={{ color: "#6b7280" }}>Your registered domain</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: "Registered", value: new Date(userDomainInfo.registrationTimestamp * 1000).toLocaleDateString() },
                  { label: "Expires", value: new Date(userDomainInfo.expiryTimestamp * 1000).toLocaleDateString() },
                  { label: "Time left", value: userDomainInfo.expiryTimestamp > Date.now() / 1000 ? `${Math.floor((userDomainInfo.expiryTimestamp - Date.now() / 1000) / 86400)} days` : "Expired" },
                ].map(row => (
                  <div key={row.label} className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p style={{ color: "#6b7280" }}>{row.label}</p>
                    <p className="font-semibold mt-0.5">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Search bar ── */}
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs font-semibold" style={{ color: "#6b7280" }}>Search Domain</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setIsAvailable(null); setDomainStatus(null); setShowRegisterForm(false); setError("") }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
                  placeholder="yourname"
                  className="input-field text-sm pl-4 pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: "#6b7280" }}>.pepu</span>
              </div>
              <button
                onClick={handleSearch}
                disabled={isChecking || !searchQuery.trim()}
                className="px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-1.5 flex-shrink-0 transition-all active:scale-95"
                style={isChecking || !searchQuery.trim()
                  ? { background: "rgba(255,255,255,0.06)", color: "#4b5563", cursor: "not-allowed" }
                  : { background: "#00ff88", color: "#13141a" }}
              >
                {isChecking ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isChecking ? "" : "Search"}
              </button>
            </div>
          </div>

          {/* ── Availability status ── */}
          {isAvailable !== null && (
            <div
              className="flex items-center gap-4 p-4 rounded-2xl"
              style={isAvailable
                ? { background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)" }
                : { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              {isAvailable
                ? <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#00ff88" }} />
                : <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />}
              <div>
                <p className="text-sm font-semibold" style={{ color: isAvailable ? "#00ff88" : "#ef4444" }}>
                  {searchQuery.replace(".pepu", "")}.pepu is {isAvailable ? "available!" : "taken"}
                </p>
                {domainStatus && isAvailable && (
                  <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                    Base fee: {Number.parseFloat(domainStatus.fee).toFixed(2)} USDC/year
                  </p>
                )}
                {domainStatus && !isAvailable && domainStatus.exists && (
                  <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                    {domainStatus.expired ? "This domain has expired" : `Registered for ${domainStatus.remainingDays} more days`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Registration form ── */}
          {showRegisterForm && isAvailable && (
            <div className="rounded-3xl p-5 space-y-4" style={{ background: "#1a1d2e", border: "1px solid rgba(0,255,136,0.15)" }}>
              <p className="text-sm font-bold" style={{ color: "#00ff88" }}>
                Register {searchQuery.replace(".pepu", "")}.pepu
              </p>

              {/* Period mode toggle */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "#6b7280" }}>Registration Period</p>
                <div
                  className="flex rounded-2xl p-1 gap-1 mb-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {(["days", "years"] as const).map(mode => (
                    <button key={mode} onClick={() => setInputMode(mode)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all"
                      style={inputMode === mode
                        ? { background: "#13141a", border: "1px solid rgba(255,255,255,0.1)", color: "#00ff88" }
                        : { color: "#6b7280" }}>
                      {mode}
                    </button>
                  ))}
                </div>

                {inputMode === "days" ? (
                  <div className="space-y-2">
                    <input type="number" min="1" max="21900" value={days}
                      onChange={e => { const v = Math.max(1, Math.min(21900, Number.parseInt(e.target.value) || 1)); setDays(v); setYears(Math.ceil(v / 365)) }}
                      placeholder="Days (1–21,900)" className="input-field text-sm" />
                    <p className="text-xs" style={{ color: "#4b5563" }}>{days}d = {Math.ceil(days / 365)}yr</p>
                    <div className="flex gap-1 flex-wrap">
                      {[30, 90, 180, 365, 730, 1095, 1825].map(d => (
                        <button key={d} onClick={() => { setDays(d); setYears(Math.ceil(d / 365)) }}
                          className="px-3 py-1 rounded-xl text-xs font-semibold transition-all"
                          style={days === d
                            ? { background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.3)", color: "#00ff88" }
                            : { background: "rgba(255,255,255,0.06)", color: "#6b7280" }}>
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input type="number" min="1" max="60" value={years}
                      onChange={e => { const v = Math.max(1, Math.min(60, Number.parseInt(e.target.value) || 1)); setYears(v); setDays(v * 365) }}
                      className="input-field text-sm" />
                    <p className="text-xs" style={{ color: "#4b5563" }}>{years}yr = {years * 365}d</p>
                    <div className="flex gap-1">
                      {[1, 5, 10, 20, 60].map(y => (
                        <button key={y} onClick={() => { setYears(y); setDays(y * 365) }}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                          style={years === y
                            ? { background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.3)", color: "#00ff88" }
                            : { background: "rgba(255,255,255,0.06)", color: "#6b7280" }}>
                          {y}y
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fee display */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: "#6b7280" }}>Registration fee</span>
                  {loadingFee
                    ? <Loader className="w-4 h-4 animate-spin" style={{ color: "#00ff88" }} />
                    : <span className="font-bold" style={{ color: "#00ff88" }}>{Number.parseFloat(registrationFee).toFixed(2)} USDC</span>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: "#6b7280" }}>Your USDC balance</span>
                  {loadingBalance
                    ? <Loader className="w-4 h-4 animate-spin" style={{ color: "#9ca3af" }} />
                    : <span className="font-semibold">{Number.parseFloat(usdcBalance).toFixed(2)} USDC</span>}
                </div>
                {Number.parseFloat(usdcBalance) < Number.parseFloat(registrationFee) && (
                  <p className="text-xs pt-2" style={{ color: "#ef4444" }}>
                    Need {(Number.parseFloat(registrationFee) - Number.parseFloat(usdcBalance)).toFixed(2)} more USDC
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: "#6b7280" }}>Wallet Password</p>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your wallet password" className="input-field text-sm" />
                <button type="button" onClick={() => { if (confirmWalletReset()) { clearAllWallets(); router.push("/setup") } }}
                  className="flex items-center gap-1 text-xs" style={{ color: "#ef4444" }}>
                  <RotateCcw className="w-3 h-3" />
                  Forgot password? Reset wallet
                </button>
              </div>

              {/* Register button */}
              <button
                onClick={handleRegister}
                disabled={registering || !password || Number.parseFloat(usdcBalance) < Number.parseFloat(registrationFee)}
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={registering || !password || Number.parseFloat(usdcBalance) < Number.parseFloat(registrationFee)
                  ? { background: "rgba(255,255,255,0.06)", color: "#4b5563", cursor: "not-allowed" }
                  : { background: "#00ff88", color: "#13141a" }}
              >
                {registering ? <><Loader className="w-4 h-4 animate-spin" /> Registering…</> : <><Globe className="w-4 h-4" /> Register {searchQuery.replace(".pepu", "")}.pepu</>}
              </button>
            </div>
          )}

          {/* ── Error / success ── */}
          {error && (
            <div className="p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <p className="text-sm" style={{ color: "#fca5a5" }}>{error}</p>
            </div>
          )}
          {success && (
            <div className="p-4 rounded-2xl" style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)" }}>
              <p className="text-sm" style={{ color: "#6ee7b7" }}>{success}</p>
            </div>
          )}
        </div>

      <BottomNav active="domains" />
    </div>
  )
}

