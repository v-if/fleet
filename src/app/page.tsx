import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getVehicleProviderName } from "@/lib/vehicle-providers";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  ONLINE: "정상",
  OFFLINE: "오프라인",
  WARNING: "주의",
  ALERT: "이상",
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ONLINE: "default",
  OFFLINE: "secondary",
  WARNING: "outline",
  ALERT: "destructive",
};

async function getDashboardData() {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { plateNumber: "asc" },
  });

  const snapshots = vehicles
    .map((vehicle) => vehicle.snapshots[0])
    .filter((snapshot) => snapshot !== undefined);

  return {
    vehicles,
    total: vehicles.length,
    online: snapshots.filter((snapshot) => snapshot.status === "ONLINE").length,
    warning: snapshots.filter((snapshot) => snapshot.status === "WARNING").length,
    alert: snapshots.filter((snapshot) => snapshot.status === "ALERT").length,
    offline: snapshots.filter((snapshot) => snapshot.status === "OFFLINE").length,
  };
}

export default async function Home() {
  const data = await getDashboardData();
  const provider = getVehicleProviderName();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Phase 1 · Fleet FMS MVP</p>
        <h1 className="text-3xl font-semibold tracking-tight">차량 관제 대시보드</h1>
        <p className="text-sm text-muted-foreground">
          데이터 소스: <Badge variant="outline">{provider}</Badge> · API:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">/api/vehicles</code>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>전체</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>정상</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.online}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>주의</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.warning}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>이상</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.alert}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>오프라인</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.offline}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>차량 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>차량번호</TableHead>
                <TableHead>모델</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>배터리</TableHead>
                <TableHead>주행가능</TableHead>
                <TableHead>최종 업데이트</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.vehicles.map((vehicle) => {
                const snapshot = vehicle.snapshots[0];
                return (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.plateNumber}</TableCell>
                    <TableCell>
                      {vehicle.model} ({vehicle.year})
                    </TableCell>
                    <TableCell>
                      {snapshot ? (
                        <Badge variant={statusVariant[snapshot.status]}>
                          {statusLabel[snapshot.status]}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {snapshot?.batteryPercent != null
                        ? `${Math.round(snapshot.batteryPercent)}%`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {snapshot?.rangeKm != null
                        ? `${Math.round(snapshot.rangeKm)} km`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {snapshot
                        ? snapshot.lastUpdatedAt.toLocaleString("ko-KR")
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
