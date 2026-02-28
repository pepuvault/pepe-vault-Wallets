"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getWallets, getWalletState, updateActivity } from "@/lib/wallet"
import { ImageIcon, Loader, ArrowLeft } from "lucide-react"
import Link from "next/link"
import BottomNav from "@/components/BottomNav"
import { ethers } from "ethers"

const ERC721_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function ownerOf(uint256) view returns (address)",
]

const ERC1155_ABI = [
  "function balanceOf(address, uint256) view returns (uint256)",
  "function uri(uint256) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
]

interface NFT {
  contractAddress: string
  tokenId: string
  name: string
  image?: string
  collectionName: string
  collectionSymbol: string
}

export default function NFTsPage() {
  const router = useRouter()
  const [nfts, setNfts] = useState<NFT[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // No password required for viewing NFTs
    updateActivity()
    fetchPEPUNFTs()
  }, [router])

  const fetchPEPUNFTs = async () => {
    setLoading(true)
    try {
      const wallets = getWallets()
      if (wallets.length === 0) {
        setLoading(false)
        return
      }

      const wallet = wallets[0]
      const provider = new ethers.JsonRpcProvider("https://rpc-pepu-v2-mainnet-0.t.conduit.xyz")
      const allNFTs: NFT[] = []

      // Scan for Transfer events to find NFT collections (ERC721 and ERC1155)
      const erc721TransferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      const erc1155TransferTopic = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62"
      const currentBlock = await provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 20000) // Scan last 20000 blocks for better coverage

      const [erc721Logs, erc1155Logs] = await Promise.all([
        provider.getLogs({
          fromBlock,
          toBlock: "latest",
          topics: [erc721TransferTopic, null, ethers.getAddress(wallet.address)],
        }).catch(() => []),
        provider.getLogs({
        fromBlock,
        toBlock: "latest",
          topics: [erc1155TransferTopic, null, ethers.getAddress(wallet.address)],
        }).catch(() => []),
      ])

      const logs = [...erc721Logs, ...erc1155Logs]

      // Extract unique contract addresses (potential NFTs)
      const contractAddresses = [...new Set(logs.map((log) => log.address))]

      for (const contractAddress of contractAddresses) {
        try {
          const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider)

          // Try to get collection info
          let collectionName = "Unknown Collection"
          let collectionSymbol = "NFT"

          try {
            collectionName = await contract.name()
            collectionSymbol = await contract.symbol()
          } catch {
            // Not an ERC721, skip
            continue
          }

          // Get balance
          const balance = await contract.balanceOf(wallet.address)
          const balanceNum = Number(balance)

          // Fetch up to 10 NFTs from this collection
          for (let i = 0; i < Math.min(balanceNum, 10); i++) {
            try {
              const tokenId = await contract.tokenOfOwnerByIndex(wallet.address, i)
              const tokenURI = await contract.tokenURI(tokenId)

              // Parse metadata from tokenURI
              let nftName = `${collectionSymbol} #${tokenId}`
              let image = "/placeholder.svg"

              // Enhanced metadata fetching with multiple IPFS gateways
              if (tokenURI.startsWith("ipfs://")) {
                const ipfsHash = tokenURI.replace("ipfs://", "").replace("ipfs/", "")
                const gateways = [
                  `https://ipfs.io/ipfs/${ipfsHash}`,
                  `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
                  `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
                ]
                
                for (const gatewayUrl of gateways) {
                  try {
                    const response = await fetch(gatewayUrl, { signal: AbortSignal.timeout(5000) })
                    if (response.ok) {
                      const metadata = await response.json()
                  nftName = metadata.name || nftName
                  if (metadata.image) {
                    image = metadata.image.startsWith("ipfs://")
                          ? `https://ipfs.io/ipfs/${metadata.image.replace("ipfs://", "").replace("ipfs/", "")}`
                      : metadata.image
                      }
                      break
                    }
                  } catch (e) {
                    continue
                  }
                }
              } else if (tokenURI.startsWith("http")) {
                try {
                  const response = await fetch(tokenURI, { signal: AbortSignal.timeout(5000) })
                  if (response.ok) {
                    const metadata = await response.json()
                  nftName = metadata.name || nftName
                    if (metadata.image) {
                      image = metadata.image.startsWith("ipfs://")
                        ? `https://ipfs.io/ipfs/${metadata.image.replace("ipfs://", "").replace("ipfs/", "")}`
                        : metadata.image
                    }
                  }
                } catch (e) {
                  console.error("Error fetching metadata:", e)
                }
              } else if (tokenURI.startsWith("data:application/json")) {
                // Handle base64 encoded metadata
                try {
                  const base64Data = tokenURI.split(",")[1]
                  const decoded = JSON.parse(atob(base64Data))
                  nftName = decoded.name || nftName
                  image = decoded.image || image
                } catch (e) {
                  console.error("Error parsing base64 metadata:", e)
                }
              }

              allNFTs.push({
                contractAddress,
                tokenId: tokenId.toString(),
                name: nftName,
                image,
                collectionName,
                collectionSymbol,
              })
            } catch (error) {
              console.error("Error fetching NFT:", error)
            }
          }
        } catch (error) {
          console.error("Error processing contract:", error)
        }
      }

      setNfts(allNFTs)
    } catch (error) {
      console.error("Error fetching NFTs:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-28 text-white" style={{ background: "#13141a" }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-5 py-4"
        style={{ background: "rgba(19,20,26,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold">NFT Gallery</h1>
          <p className="text-xs" style={{ color: "#6b7280" }}>Your PEPU Collections</p>
        </div>
        {/* PEPU-only badge */}
        <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.2)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          PEPU
        </span>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5">
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Loader className="w-8 h-8 animate-spin" style={{ color: "#00ff88" }} />
            <p className="text-sm" style={{ color: "#6b7280" }}>Scanning blockchain for NFTs…</p>
          </div>
        ) : nfts.length === 0 ? (
          <div
            className="flex flex-col items-center py-16 gap-3"
            style={{ background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 24 }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
              <ImageIcon className="w-7 h-7" style={{ color: "#374151" }} />
            </div>
            <p className="font-semibold" style={{ color: "#9ca3af" }}>No NFTs found</p>
            <p className="text-sm text-center px-6" style={{ color: "#4b5563" }}>
              No ERC721 NFTs detected on the PEPU network
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {nfts.map((nft, idx) => (
              <div
                key={`${nft.contractAddress}-${nft.tokenId}-${idx}`}
                className="overflow-hidden rounded-2xl transition-all"
                style={{ background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="relative aspect-square overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <img
                    src={nft.image || "/placeholder.svg"}
                    alt={nft.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = "/placeholder.svg" }}
                  />
                </div>
                <div className="p-3">
                  <p className="text-xs truncate mb-0.5" style={{ color: "#6b7280" }}>{nft.collectionName}</p>
                  <h3 className="text-sm font-semibold truncate mb-1">{nft.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,255,136,0.1)", color: "#00ff88" }}>
                    #{nft.tokenId}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="nfts" />
    </div>
  )
}
