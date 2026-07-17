/**
 * Tesla Virtual Key 페어링 안내·QR 페이지 (`/_ak/{domain}`).
 * FMS는 QR을 생성하지 않고 이 URL을 새 창으로 연다 (VS C-1).
 */
export const TESLA_VIRTUAL_KEY_PAIRING_URL =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_TESLA_VIRTUAL_KEY_PAIRING_URL?.trim()) ||
  "https://www.tesla.com/_ak/bori-fleet.shop";

/** 팝업 차단 시에도 사용자가 열 수 있도록 새 탭 시도 */
export function openTeslaVirtualKeyPairingPage(): Window | null {
  const opened = window.open(
    TESLA_VIRTUAL_KEY_PAIRING_URL,
    "_blank",
    "noopener,noreferrer",
  );
  return opened;
}
