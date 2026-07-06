"use client";

import { VehicleTable } from "@/components/fleet/vehicle-table";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicles } from "@/hooks/use-vehicles";

export function VehiclesListView() {
  const { data, isLoading, isError, error } = useVehicles();

  if (isLoading) {
    return (
      <>
        <AppHeader title="차량 목록" description="데이터를 불러오는 중입니다." />
        <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <AppHeader title="차량 목록" />
        <div className="p-6 text-sm text-destructive">
          {error?.message ?? "차량 목록을 불러오지 못했습니다."}
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="차량 목록"
        description="차량번호·상태·미운행 여부로 검색하고 필터링합니다."
        provider={data.provider}
        lastUpdatedAt={data.lastUpdatedAt}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>전체 차량 ({data.count}대)</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleTable vehicles={data.vehicles} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
