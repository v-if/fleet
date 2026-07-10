import type { StaticImageData } from "next/image";

import fmsLogo from "@/img/bori-fleet-logo.png";

export const FMS_NAME = "보리차";
export const FMS_DESCRIPTION = "법인 차량 관리 및 실시간 관제 시스템";
export const FMS_TAGLINE = "테슬라 플릿 차량을 한곳에서 관리하는 차량 관제 시스템";
export const FMS_LOGO: StaticImageData = fmsLogo;
export const FMS_LOGO_PATH = "/images/logo/bori-fleet-logo.png";

export function fmsPageTitle(page: string) {
  return `${page} | ${FMS_NAME}`;
}
