/**
 * NFT Gallery Component - Display owned NFTs in a grid
 * Feature: NFT tab in WalletDetail
 *
 * Includes ArcSign Pro membership NFT injection via BSC direct query
 * (Alchemy doesn't support BSC, so membership NFTs are fetched separately)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import tauriApi from "@/services/tauri-api";
import type { NFT } from "@/types/nft";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getChainIconUrl, getChainFallbackIcon } from "@/utils/chainIcons";
import { useMembership, type MembershipStatus } from "@/hooks/useMembership";
import { useHasProviderKey } from "@/hooks/useHasProviderKey";
import { ACTIVE_NETWORK } from "@/constants/contracts";

// Sentinel slug for identifying membership NFTs
const MEMBERSHIP_SLUG = "arcsign-pro";

function isMembershipNFT(nft: NFT): boolean {
  return nft.collectionSlug === MEMBERSHIP_SLUG;
}

/** Build synthetic NFT objects from membership status */
function buildMembershipNFTs(
  status: MembershipStatus | null,
  bscAddress: string,
  t: (key: string) => string
): NFT[] {
  if (!status?.isPro || status.nftCount === 0) return [];

  const count = status.nftCount;
  const hasTokenIds = status.tokenIds.length > 0;

  return Array.from({ length: count }, (_, i) => {
    const tokenId = hasTokenIds ? String(status.tokenIds[i]) : String(i + 1);
    return {
      address: bscAddress,
      network: "bnb-mainnet",
      networkLabel: "BNB Chain",
      contractAddress: ACTIVE_NETWORK.nftContract,
      tokenId,
      tokenType: "ERC721",
      name: `ArcSign Pro${hasTokenIds ? ` #${tokenId}` : ""}`,
      description: `${t("nftGallery.proDescription")} (${status.daysRemaining} ${t("nftGallery.daysRemaining")})`,
      imageUrl: "/arcsign-pro-nft.png",
      thumbnailUrl: "/arcsign-pro-nft.png",
      collectionName: "ArcSign Pro Membership",
      collectionSlug: MEMBERSHIP_SLUG,
      balance: "1",
    };
  });
}

interface NFTGalleryProps {
  walletId: string;
  password: string;
  usbPath: string;
  sessionToken?: string;
  bscAddress?: string;
}

export function NFTGallery({ walletId, password, usbPath, sessionToken, bscAddress }: NFTGalleryProps) {
  const { t } = useTranslation();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [filterNetwork, setFilterNetwork] = useState<string>("all");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  // Membership NFT via BSC direct query
  const { status: membershipStatus } = useMembership(bscAddress || null);

  // Detect provider key presence to show actionable empty state
  const { hasAlchemyKey } = useHasProviderKey(usbPath, sessionToken, password);

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

  // Merge membership NFTs (prepended) with Alchemy NFTs
  const membershipNfts = useMemo(
    () => (bscAddress && membershipStatus) ? buildMembershipNFTs(membershipStatus, bscAddress, t) : [],
    [membershipStatus, bscAddress, t]
  );
  const allNfts = useMemo(() => [...membershipNfts, ...nfts], [membershipNfts, nfts]);

  const networks = Array.from(new Set(allNfts.map((n) => n.network)));
  const filteredNfts = filterNetwork === "all"
    ? allNfts
    : allNfts.filter((n) => n.network === filterNetwork);

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

  // Only show error when we have zero NFTs (membership NFTs can still render)
  if (error && allNfts.length === 0) {
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

  if (allNfts.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem 1.5rem", color: "#64748b" }}>
        <div style={{ marginBottom: "1rem" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        {!hasAlchemyKey ? (
          <>
            <p style={{ fontWeight: "600", color: "#1e293b", marginBottom: "0.5rem" }}>
              {t("nftGallery.needKeyTitle")}
            </p>
            <p style={{ fontSize: "0.875rem", maxWidth: "32rem", margin: "0 auto" }}>
              {t("nftGallery.needKeyDescription")}
            </p>
          </>
        ) : (
          <>
            <p style={{ fontWeight: "600", color: "#1e293b", marginBottom: "0.5rem" }}>
              {t("nftGallery.empty")}
            </p>
            <p style={{ fontSize: "0.875rem" }}>
              {t("nftGallery.emptyDescription")}
            </p>
          </>
        )}
      </div>
    );
  }

  // NFT detail modal
  if (selectedNft) {
    const isPro = isMembershipNFT(selectedNft);
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
              {isPro && (
                <span style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "#fff", fontSize: "0.625rem", fontWeight: 700,
                  padding: "0.125rem 0.5rem", borderRadius: "0.25rem",
                  letterSpacing: "0.05em",
                }}>
                  PRO
                </span>
              )}
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
              {/* Membership-specific rows */}
              {isPro && membershipStatus && (
                <>
                  <DetailRow
                    label={t("nftGallery.daysRemaining")}
                    value={`${membershipStatus.daysRemaining} ${t("nftGallery.days")}`}
                  />
                  <DetailRow
                    label={t("nftGallery.walletQuota")}
                    value={membershipStatus.walletLimit ? String(membershipStatus.walletLimit) : t("nftGallery.unlimited")}
                  />
                </>
              )}
            </div>

            {/* BscScan link for membership NFT */}
            {isPro && (
              <a
                href={`${ACTIVE_NETWORK.explorer}/token/${ACTIVE_NETWORK.nftContract}?a=${selectedNft.address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.375rem",
                  marginTop: "1rem", fontSize: "0.8125rem", color: "#0d9488",
                  textDecoration: "none", fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                {t("nftGallery.viewOnExplorer")}
              </a>
            )}

            {selectedNft.description && !isPro && (
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
            count={allNfts.length}
          />
          {networks.map((net) => {
            const count = allNfts.filter((n) => n.network === net).length;
            const label = allNfts.find((n) => n.network === net)?.networkLabel || net;
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
          const isPro = isMembershipNFT(nft);
          return (
            <div
              key={key}
              onClick={() => setSelectedNft(nft)}
              style={{
                borderRadius: "0.75rem",
                overflow: "hidden",
                border: isPro ? "2px solid #f59e0b" : "1px solid #e2e8f0",
                cursor: "pointer",
                transition: "all 0.15s",
                background: "#fff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = isPro ? "#d97706" : "#0d9488";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = isPro
                  ? "0 4px 12px rgba(245,158,11,0.2)"
                  : "0 4px 12px rgba(13,148,136,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isPro ? "#f59e0b" : "#e2e8f0";
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
                {/* PRO badge (top-left) */}
                {isPro && (
                  <div style={{
                    position: "absolute", top: "0.25rem", left: "0.25rem",
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    borderRadius: "0.25rem",
                    padding: "0.125rem 0.5rem",
                    fontSize: "0.625rem", color: "#fff", fontWeight: 700,
                    letterSpacing: "0.05em",
                  }}>
                    PRO
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
                  fontSize: "0.625rem", color: isPro ? "#d97706" : "#94a3b8",
                  margin: "0.125rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontWeight: isPro ? 600 : 400,
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
