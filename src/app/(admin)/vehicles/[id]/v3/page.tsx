import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** VD3 컷오버: 구 `/v3` URL → 기본 상세로 리다이렉트 */
export default async function VehicleDetailV3RedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/vehicles/${id}`);
}
