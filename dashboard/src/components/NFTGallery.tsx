/**
 * NFT Gallery Component - Display owned NFTs in a grid
 * Feature: NFT tab in WalletDetail
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import tauriApi from "@/services/tauri-api";
import type { NFT } from "@/types/nft";
import type { ProviderUnavailable } from "@/types/tokens";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getChainIconUrl, getChainFallbackIcon } from "@/utils/chainIcons";

interface NFTGalleryProps {
  walletId: string;
  password: string;
  usbPath: string;
  sessionToken?: string;
}

export function NFTGallery({ walletId, password, usbPath, sessionToken }: NFTGalleryProps) {
  const { t } = useTranslation();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [filterNetwork, setFilterNetwork] = useState<string>("all");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [unavailableProviders, setUnavailableProviders] = useState<ProviderUnavailable[]>([]);

  const loadNFTs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tauriApi.getNFTs({
        walletId,
        password,
        usbPath,
        sessionToken,
      });
      setNfts(response.nfts || []);
      setUnavailableProviders(response.unavailableProviders || []);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || t("nftGallery.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [walletId, password, usbPath, sessionToken, t]);

  useEffect(() => {
    if (walletId && password && usbPath) {
      loadNFTs();
    }
  }, [walletId, password, usbPath, loadNFTs]);

  const networks = Array.from(new Set(nfts.map((n) => n.network)));
  const filteredNfts = filterNetwork === "all"
    ? nfts
    : nfts.filter((n) => n.network === filterNetwork);

  const handleImgError = (key: string) => {
    setImgErrors((prev) => new Set(prev).add(key));
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "3rem" }}>
        <LoadingSpinner />
        <p style={{ marginTop: "1rem", color: "#64748b" }}>{t("nftGallery.loading")}</p>
      </div>
    );
  }

  if (error && nfts.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem 1.5rem", color: "#64748b" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>&#9888;</div>
        <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>
        <button
          onClick={loadNFTs}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          {t("nftGallery.retry")}
        </button>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem 1.5rem", color: "#64748b" }}>
        <div style={{ marginBottom: "1rem" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        {(() => {
          const alchemyMissing = unavailableProviders.some(
            (p) => p.provider === "alchemy" && (p.reason === "missing_key" || p.reason === "query_failed")
          );
          const noderealMissing = unavailableProviders.some(
            (p) => p.provider === "nodereal" && (p.reason === "missing_key" || p.reason === "query_failed")
          );
          if (alchemyMissing || noderealMissing) {
            return (
              <>
                <p style={{ fontWeight: "600", color: "#1e293b", marginBottom: "0.5rem" }}>
                  {t("nftGallery.needKeyTitle")}
                </p>
                {alchemyMissing && (
                  <p style={{ fontSize: "0.875rem", maxWidth: "32rem", margin: "0 auto 0.25rem" }}>
                    {t("nftGallery.needAlchemyKey")}
                  </p>
                )}
                {noderealMissing && (
                  <p style={{ fontSize: "0.875rem", maxWidth: "32rem", margin: "0 auto" }}>
                    {t("nftGallery.needNodeRealKey")}
                  </p>
                )}
              </>
            );
          }
          return (
            <>
              <p style={{ fontWeight: "600", color: "#1e293b", marginBottom: "0.5rem" }}>
                {t("nftGallery.empty")}
              </p>
              <p style={{ fontSize: "0.875rem" }}>
                {t("nftGallery.emptyDescription")}
              </p>
            </>
          );
        })()}
      </div>
    );
  }

  // NFT detail modal
  if (selectedNft) {
    return (
      <div style={{ padding: "1rem" }}>
        <button
          onClick={() => setSelectedNft(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#0d9488",
            fontWeight: 500,
            marginBottom: "1rem",
            padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("nftGallery.backToGallery")}
        </button>

        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {/* Image */}
          <div style={{
            width: "min(100%, 320px)",
            aspectRatio: "1",
            borderRadius: "0.75rem",
            overflow: "hidden",
            background: "#f1f5f9",
            flexShrink: 0,
          }}>
            {selectedNft.imageUrl && !imgErrors.has(`detail-${selectedNft.contractAddress}-${selectedNft.tokenId}`) ? (
              <img
                src={selectedNft.imageUrl}
                alt={selectedNft.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => handleImgError(`detail-${selectedNft.contractAddress}-${selectedNft.tokenId}`)}
              />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94a3b8", fontSize: "3rem",
              }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                {selectedNft.name || `#${selectedNft.tokenId}`}
              </h3>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0 0 1rem" }}>
              {selectedNft.collectionName}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <DetailRow label={t("nftGallery.network")} value={selectedNft.networkLabel} />
              <DetailRow label={t("nftGallery.tokenType")} value={selectedNft.tokenType} />
              <DetailRow label={t("nftGallery.tokenId")} value={`#${selectedNft.tokenId}`} />
              <DetailRow
                label={t("nftGallery.contract")}
                value={`${selectedNft.contractAddress.slice(0, 8)}...${selectedNft.contractAddress.slice(-6)}`}
              />
              {selectedNft.tokenType === "ERC1155" && (
                <DetailRow label={t("nftGallery.balance")} value={selectedNft.balance} />
              )}
            </div>

            {selectedNft.description && (
              <div style={{ marginTop: "1rem" }}>
                <p style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600, margin: "0 0 0.25rem" }}>
                  {t("nftGallery.description")}
                </p>
                <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.5, margin: 0 }}>
                  {selectedNft.description.length > 200
                    ? selectedNft.description.slice(0, 200) + "..."
                    : selectedNft.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Gallery grid view
  return (
    <div style={{ padding: "1rem" }}>
      {/* Filter bar */}
      {networks.length > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <FilterChip
            label={t("nftGallery.allNetworks")}
            active={filterNetwork === "all"}
            onClick={() => setFilterNetwork("all")}
            count={nfts.length}
          />
          {networks.map((net) => {
            const count = nfts.filter((n) => n.network === net).length;
            const label = nfts.find((n) => n.network === net)?.networkLabel || net;
            return (
              <FilterChip
                key={net}
                label={label}
                active={filterNetwork === net}
                onClick={() => setFilterNetwork(net)}
                count={count}
                icon={getChainIconUrl(net) || getChainFallbackIcon(net)}
              />
            );
          })}
        </div>
      )}

      {/* Count */}
      <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.75rem" }}>
        {filteredNfts.length} NFT{filteredNfts.length !== 1 ? "s" : ""}
      </p>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: "0.75rem",
      }}>
        {filteredNfts.map((nft) => {
          const key = `${nft.contractAddress}-${nft.tokenId}-${nft.network}`;
          return (
            <div
              key={key}
              onClick={() => setSelectedNft(nft)}
              style={{
                borderRadius: "0.75rem",
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                cursor: "pointer",
                transition: "all 0.15s",
                background: "#fff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0d9488";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(13,148,136,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Image */}
              <div style={{ aspectRatio: "1", background: "#f1f5f9", position: "relative" }}>
                {nft.imageUrl && !imgErrors.has(key) ? (
                  <img
                    src={nft.thumbnailUrl || nft.imageUrl}
                    alt={nft.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                    onError={() => handleImgError(key)}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#cbd5e1",
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                )}
                {/* Network badge (top-right) */}
                <div style={{
                  position: "absolute", top: "0.25rem", right: "0.25rem",
                  background: "rgba(0,0,0,0.6)", borderRadius: "0.25rem",
                  padding: "0.125rem 0.375rem",
                  fontSize: "0.625rem", color: "#fff", fontWeight: 500,
                }}>
                  {nft.networkLabel}
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: "0.5rem" }}>
                <p style={{
                  fontSize: "0.75rem", fontWeight: 600, color: "#1e293b",
                  margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {nft.name || `#${nft.tokenId}`}
                </p>
                <p style={{
                  fontSize: "0.625rem", color: "#94a3b8",
                  margin: "0.125rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {nft.collectionName}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: "0.875rem", color: "#1e293b", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  count,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.25rem 0.75rem",
        borderRadius: "999px",
        border: `1px solid ${active ? "#0d9488" : "#e2e8f0"}`,
        background: active ? "#0d948810" : "#fff",
        color: active ? "#0d9488" : "#64748b",
        fontSize: "0.75rem",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {icon && <img src={icon} alt="" style={{ width: 14, height: 14, borderRadius: "50%" }} />}
      {label}
      <span style={{
        background: active ? "#0d9488" : "#e2e8f0",
        color: active ? "#fff" : "#64748b",
        borderRadius: "999px",
        padding: "0 0.375rem",
        fontSize: "0.625rem",
        fontWeight: 600,
      }}>
        {count}
      </span>
    </button>
  );
}
