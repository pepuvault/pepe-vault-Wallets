"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  getWallets,
  updateActivity,
  lockWallet,
  getPrivateKey,
  getMnemonic,
  encryptData,
  decryptData,
  getAutoLockSeconds,
  setAutoLockSeconds,
  getCurrentWallet,
  deleteWallet,
  clearAllWallets,
} from "@/lib/wallet"
import { deleteAllCookies } from "@/lib/cookies"
import { CURRENCIES, getSavedCurrency, saveCurrency, getDefaultCurrency, type Currency } from "@/lib/currencies"
import {
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  ChevronRight,
  Shield,
  Globe,
  Clock,
  Key,
  AlertTriangle,
  X,
  RefreshCw,
  Wallet,
} from "lucide-react"
import BottomNav from "@/components/BottomNav"
import Link from "next/link"

/* ─────────── tiny reusable components ─────────── */

function SettingSection({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: "#1a1d2e",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function SettingRow({
  icon,
  iconColor = "#00ff88",
  iconBg = "rgba(0,255,136,0.12)",
  label,
  sublabel,
  right,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  iconColor?: string
  iconBg?: string
  label: string
  sublabel?: string
  right?: React.ReactNode
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 transition-colors text-left"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: onClick ? "pointer" : "default",
      }}
      disabled={!onClick}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: danger ? "rgba(239,68,68,0.12)" : iconBg }}
      >
        <span style={{ color: danger ? "#ef4444" : iconColor }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold"
          style={{ color: danger ? "#ef4444" : "#fff" }}
        >
          {label}
        </p>
        {sublabel && (
          <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
            {sublabel}
          </p>
        )}
      </div>
      {right ?? (onClick && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#4b5563" }} />)}
    </button>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-widest px-5 pt-6 pb-2"
      style={{ color: "#4b5563" }}
    >
      {label}
    </p>
  )
}

/* ─────────── Modal shell ─────────── */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-6 space-y-5 max-h-[88vh] overflow-y-auto animate-modal-center"
        style={{ background: "#181b29", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ─────────── Main page ─────────── */
export default function SettingsPage() {
  const router = useRouter()
  const [wallets, setWallets] = useState<any[]>([])
  const [copied, setCopied] = useState("")
  const [error, setError] = useState("")
  const [autoLockSeconds, setAutoLockSecondsState] = useState<number>(60)
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(getDefaultCurrency())

  /* modal states */
  const [modal, setModal] = useState<
    null | "passcode" | "privateKey" | "seedPhrase" | "autoLock" | "currency" | "deleteWallet"
  >(null)

  /* passcode change */
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changePasscodeLoading, setChangePasscodeLoading] = useState(false)
  const [changePasscodeSuccess, setChangePasscodeSuccess] = useState("")

  /* secret reveal */
  const [revealPassword, setRevealPassword] = useState("")
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [loadingSecret, setLoadingSecret] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    const w = getWallets()
    if (w.length === 0) { router.push("/setup"); return }
    updateActivity()
    setWallets(w)
    if (typeof window !== "undefined") {
      setAutoLockSecondsState(getAutoLockSeconds())
      setSelectedCurrency(getSavedCurrency())
    }
  }, [router])

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(""), 2000)
  }

  const closeModal = () => {
    setModal(null)
    setError("")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setRevealPassword("")
    setPrivateKey(null)
    setMnemonic(null)
    setShowSecret(false)
    setChangePasscodeSuccess("")
  }

  const handleChangePasscode = async () => {
    setError("")
    if (!currentPassword || !newPassword || !confirmPassword) { setError("Please fill all fields"); return }
    if (newPassword !== confirmPassword) { setError("New passwords don't match"); return }
    if (newPassword.length !== 4) { setError("Password must be exactly 4 digits"); return }
    setChangePasscodeLoading(true)
    try {
      const currentWallets = getWallets()
      if (!currentWallets.length) throw new Error("No wallet found")
      const active = getCurrentWallet() || currentWallets[0]
      try { decryptData(active.encryptedPrivateKey, currentPassword) } catch { throw new Error("Current password is incorrect") }
      const updated = currentWallets.map((w) => ({
        ...w,
        encryptedPrivateKey: encryptData(decryptData(w.encryptedPrivateKey, currentPassword), newPassword),
        encryptedMnemonic: w.encryptedMnemonic
          ? encryptData(decryptData(w.encryptedMnemonic, currentPassword), newPassword)
          : undefined,
      }))
      localStorage.setItem("unchained_wallets", JSON.stringify(updated))
      setChangePasscodeSuccess("Passcode updated successfully!")
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
      setTimeout(() => { setChangePasscodeSuccess(""); closeModal() }, 2000)
    } catch (err: any) {
      setError(err.message || "Failed to change passcode")
    } finally {
      setChangePasscodeLoading(false)
    }
  }

  const revealSecret = async (type: "privateKey" | "seedPhrase") => {
    if (!revealPassword) { setError("Enter your PIN first"); return }
    setLoadingSecret(true)
    setError("")
    try {
      const active = getCurrentWallet() || wallets[0]
      if (type === "privateKey") {
        const key = getPrivateKey(active, revealPassword)
        setPrivateKey(key)
      } else {
        const m = getMnemonic(active, revealPassword)
        setMnemonic(m || "No seed phrase available")
      }
      setShowSecret(true)
    } catch (err: any) {
      setError(err.message || "Invalid PIN")
    } finally {
      setLoadingSecret(false)
    }
  }

  const activeWallet = getCurrentWallet() || wallets[0]
  const autoLockLabel =
    autoLockSeconds === 0 ? "Never" : autoLockSeconds < 60 ? `${autoLockSeconds}s` : `${autoLockSeconds / 60}m`

  return (
    <div className="min-h-screen pb-28 text-white" style={{ background: "#13141a" }}>

      {/* ── Top bar ── */}
      <div
        className="sticky top-0 z-40 px-5 py-4 flex items-center gap-3"
        style={{ background: "rgba(19,20,26,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,255,136,0.12)" }}
        >
          <Shield className="w-5 h-5" style={{ color: "#00ff88" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold">Settings</h1>
          <p className="text-xs" style={{ color: "#6b7280" }}>Manage wallet & security</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">

        {/* ── Wallet card ── */}
        {activeWallet && (
          <div
            className="mt-5 rounded-2xl p-5"
            style={{ background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base"
                style={{ background: "linear-gradient(135deg,#00ff88,#00cc6a)", color: "#13141a" }}
              >
                {(activeWallet.name || "W")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{activeWallet.name || "My Wallet"}</p>
                <p className="text-xs font-mono" style={{ color: "#6b7280" }}>
                  {activeWallet.address.slice(0, 10)}...{activeWallet.address.slice(-8)}
                </p>
              </div>
              <button
                onClick={() => handleCopy(activeWallet.address, "address")}
                className="ml-auto p-2 rounded-lg transition-colors"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {copied === "address" ? (
                  <Check className="w-4 h-4" style={{ color: "#00ff88" }} />
                ) : (
                  <Copy className="w-4 h-4" style={{ color: "#9ca3af" }} />
                )}
              </button>
            </div>
            {/* Full address */}
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs font-mono break-all" style={{ color: "#00ff88" }}>
                {activeWallet.address}
              </p>
            </div>
          </div>
        )}

        {/* ── Security ── */}
        <SectionHeader label="Security" />
        <SettingSection>
          <SettingRow
            icon={<Key className="w-4 h-4" />}
            label="Change PIN"
            sublabel="Update your 4-digit unlock PIN"
            onClick={() => setModal("passcode")}
          />
          <SettingRow
            icon={<Clock className="w-4 h-4" />}
            label="Auto-Lock"
            sublabel="Lock after inactivity"
            right={<span className="text-sm font-semibold" style={{ color: "#00ff88" }}>{autoLockLabel}</span>}
            onClick={() => setModal("autoLock")}
          />
          <SettingRow
            icon={<Lock className="w-4 h-4" />}
            label="Lock Wallet"
            sublabel="Lock immediately"
            onClick={() => { lockWallet(); router.push("/unlock") }}
          />
        </SettingSection>

        {/* ── Recovery ── */}
        <SectionHeader label="Recovery Keys" />
        <SettingSection>
          <SettingRow
            icon={<Eye className="w-4 h-4" />}
            iconBg="rgba(245,158,11,0.12)"
            iconColor="#f59e0b"
            label="Show Private Key"
            sublabel="Requires your PIN"
            onClick={() => setModal("privateKey")}
          />
          <SettingRow
            icon={<Key className="w-4 h-4" />}
            iconBg="rgba(245,158,11,0.12)"
            iconColor="#f59e0b"
            label="Show Seed Phrase"
            sublabel="Requires your PIN"
            onClick={() => setModal("seedPhrase")}
          />
        </SettingSection>

        {/* ── Preferences ── */}
        <SectionHeader label="Preferences" />
        <SettingSection>
          <SettingRow
            icon={<Globe className="w-4 h-4" />}
            label="Display Currency"
            sublabel={`${selectedCurrency.name} (${selectedCurrency.code.toUpperCase()})`}
            right={
              <span className="text-sm font-bold" style={{ color: "#00ff88" }}>
                {selectedCurrency.symbol}
              </span>
            }
            onClick={() => setModal("currency")}
          />
        </SettingSection>

        {/* ── Wallet management ── */}
        <SectionHeader label="Wallet Management" />
        <SettingSection>
          {wallets.length > 1 && (
            <SettingRow
              icon={<Trash2 className="w-4 h-4" />}
              label="Remove Active Wallet"
              sublabel="Keep your primary wallet"
              danger
              onClick={() => setModal("deleteWallet")}
            />
          )}
          <SettingRow
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Reset All Wallets"
            sublabel="Wipe all data permanently"
            danger
            onClick={() => {
              if (confirm("⚠️ This deletes ALL wallets permanently. Make sure you have your seed phrases saved!")) {
                clearAllWallets()
                deleteAllCookies()
                router.push("/setup")
              }
            }}
          />
        </SettingSection>

        {/* ── Info card ── */}
        <div
          className="mt-2 mb-8 rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
          <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>
            Never share your private key or seed phrase. This is a non-custodial wallet — only you control your keys.
          </p>
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* Change PIN */}
      {modal === "passcode" && (
        <Modal title="Change PIN" onClose={closeModal}>
          {changePasscodeSuccess ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(0,255,136,0.12)" }}>
                <Check className="w-7 h-7" style={{ color: "#00ff88" }} />
              </div>
              <p className="font-semibold text-center" style={{ color: "#00ff88" }}>{changePasscodeSuccess}</p>
            </div>
          ) : (
            <>
              {[
                { label: "Current PIN", val: currentPassword, set: setCurrentPassword },
                { label: "New PIN (4 digits)", val: newPassword, set: setNewPassword },
                { label: "Confirm New PIN", val: confirmPassword, set: setConfirmPassword },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold mb-2" style={{ color: "#9ca3af" }}>{label}</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={val}
                    onChange={(e) => { set(e.target.value); setError("") }}
                    placeholder="••••"
                    className="input-field"
                  />
                </div>
              ))}
              {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
              <button
                onClick={handleChangePasscode}
                disabled={changePasscodeLoading}
                className="btn-primary w-full"
              >
                {changePasscodeLoading ? "Updating…" : "Update PIN"}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Private Key */}
      {modal === "privateKey" && (
        <Modal title="Show Private Key" onClose={closeModal}>
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
            <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>
              Never share your private key. Anyone with it can drain your wallet.
            </p>
          </div>
          {!showSecret ? (
            <>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: "#9ca3af" }}>Enter PIN to reveal</label>
                <input
                  type="password"
                  maxLength={4}
                  value={revealPassword}
                  onChange={(e) => { setRevealPassword(e.target.value); setError("") }}
                  placeholder="••••"
                  className="input-field"
                />
              </div>
              {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
              <button onClick={() => revealSecret("privateKey")} disabled={loadingSecret} className="btn-primary w-full">
                {loadingSecret ? "Decrypting…" : "Reveal Key"}
              </button>
            </>
          ) : privateKey ? (
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "#9ca3af" }}>Your Private Key</label>
              <div className="relative">
                <div className="p-4 rounded-xl font-mono text-xs break-all" style={{ background: "#0e0f17", border: "1px solid rgba(255,255,255,0.08)", color: "#f59e0b" }}>
                  {privateKey}
                </div>
                <button
                  onClick={() => handleCopy(privateKey, "pk")}
                  className="absolute top-3 right-3 p-1.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  {copied === "pk" ? <Check className="w-3.5 h-3.5" style={{ color: "#00ff88" }} /> : <Copy className="w-3.5 h-3.5" style={{ color: "#9ca3af" }} />}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-center" style={{ color: "#ef4444" }}>Failed to decrypt. Wrong PIN?</p>
          )}
        </Modal>
      )}

      {/* Seed Phrase */}
      {modal === "seedPhrase" && (
        <Modal title="Show Seed Phrase" onClose={closeModal}>
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
            <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>
              Your seed phrase is the master key to all your wallets. Never share it.
            </p>
          </div>
          {!showSecret ? (
            <>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: "#9ca3af" }}>Enter PIN to reveal</label>
                <input
                  type="password"
                  maxLength={4}
                  value={revealPassword}
                  onChange={(e) => { setRevealPassword(e.target.value); setError("") }}
                  placeholder="••••"
                  className="input-field"
                />
              </div>
              {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
              <button onClick={() => revealSecret("seedPhrase")} disabled={loadingSecret} className="btn-primary w-full">
                {loadingSecret ? "Decrypting…" : "Reveal Seed Phrase"}
              </button>
            </>
          ) : mnemonic ? (
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "#9ca3af" }}>Your Seed Phrase</label>
              <div
                className="p-4 rounded-xl font-mono text-sm leading-relaxed"
                style={{ background: "#0e0f17", border: "1px solid rgba(255,255,255,0.08)", color: "#f59e0b" }}
              >
                {mnemonic.split(" ").map((word, i) => (
                  <span key={i} className="inline-flex items-center gap-1 mr-2 mb-1">
                    <span className="text-[10px]" style={{ color: "#4b5563" }}>{i + 1}.</span>
                    <span>{word}</span>
                  </span>
                ))}
              </div>
              <button
                onClick={() => handleCopy(mnemonic, "seed")}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
              >
                {copied === "seed" ? <Check className="w-4 h-4" style={{ color: "#00ff88" }} /> : <Copy className="w-4 h-4" />}
                {copied === "seed" ? "Copied!" : "Copy Phrase"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-center" style={{ color: "#ef4444" }}>Failed to decrypt. Wrong PIN?</p>
          )}
        </Modal>
      )}

      {/* Auto-Lock */}
      {modal === "autoLock" && (
        <Modal title="Auto-Lock Timer" onClose={closeModal}>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            Lock the wallet after this many seconds of inactivity. Set to 0 to disable.
          </p>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#9ca3af" }}>Seconds (0 = never)</label>
            <input
              type="number"
              min={0}
              value={autoLockSeconds}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) { setAutoLockSecondsState(v); setAutoLockSeconds(v) }
              }}
              className="input-field"
            />
          </div>
          <div className="flex gap-2">
            {[0, 60, 300, 900].map((v) => (
              <button
                key={v}
                onClick={() => { setAutoLockSecondsState(v); setAutoLockSeconds(v) }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={
                  autoLockSeconds === v
                    ? { background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.25)", color: "#00ff88" }
                    : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }
                }
              >
                {v === 0 ? "Never" : v === 60 ? "1m" : v === 300 ? "5m" : "15m"}
              </button>
            ))}
          </div>
          <button onClick={closeModal} className="btn-primary w-full">Save</button>
        </Modal>
      )}

      {/* Currency */}
      {modal === "currency" && (
        <Modal title="Display Currency" onClose={closeModal}>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  setSelectedCurrency(c)
                  saveCurrency(c)
                  closeModal()
                  window.location.reload()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={
                  selectedCurrency.code === c.code
                    ? { background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.25)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid transparent" }
                }
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.08)", color: selectedCurrency.code === c.code ? "#00ff88" : "#9ca3af" }}
                >
                  {c.symbol}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs" style={{ color: "#6b7280" }}>{c.code.toUpperCase()}</p>
                </div>
                {selectedCurrency.code === c.code && <Check className="w-4 h-4" style={{ color: "#00ff88" }} />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Delete active wallet */}
      {modal === "deleteWallet" && (
        <Modal title="Remove Wallet" onClose={closeModal}>
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
            <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>
              This will remove the active wallet from this device. You can re-import it later with your seed phrase.
            </p>
          </div>
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <div className="flex gap-3">
            <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => {
                if (wallets.length <= 1) { setError("Cannot delete primary wallet"); return }
                const active = getCurrentWallet() || wallets[0]
                if (wallets[0].id === active.id) { setError("Cannot delete primary wallet"); return }
                try { deleteWallet(active.id); setWallets(getWallets()); closeModal() }
                catch (err: any) { setError(err.message || "Failed to delete wallet") }
              }}
              className="btn-danger flex-1"
            >
              Remove
            </button>
          </div>
        </Modal>
      )}

      <BottomNav active="settings" />
    </div>
  )
}
