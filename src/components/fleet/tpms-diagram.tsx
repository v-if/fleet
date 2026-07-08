import { Badge } from "@/components/shadcn/ui/badge";
import { isLowTpms } from "@/lib/vehicle-status";
import { cn } from "@/lib/utils";

type TpmsDiagramProps = {
  frontLeft: number | null;
  frontRight: number | null;
  rearLeft: number | null;
  rearRight: number | null;
};

type TireProps = {
  label: string;
  value: number | null;
  className?: string;
};

function Tire({ label, value, className }: TireProps) {
  const low = isLowTpms(value);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full border-4 bg-muted/30",
          low ? "border-red-500" : "border-emerald-500",
        )}
      >
        <span className={cn("text-sm font-semibold", low && "text-red-600")}>
          {value != null ? Math.round(value) : "-"}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
      {low ? (
        <Badge variant="destructive" className="text-[10px]">
          이상
        </Badge>
      ) : (
        <span className="text-[10px] text-emerald-600">정상</span>
      )}
    </div>
  );
}

export function TpmsDiagram({
  frontLeft,
  frontRight,
  rearLeft,
  rearRight,
}: TpmsDiagramProps) {
  return (
    <div className="relative mx-auto w-full max-w-xs py-4">
      <p className="mb-3 text-center text-xs text-muted-foreground">단위: PSI</p>
      <div className="mx-auto h-40 w-28 rounded-3xl border-2 border-dashed border-muted-foreground/30 bg-muted/20" />
      <Tire label="전좌" value={frontLeft} className="absolute top-2 left-0" />
      <Tire label="전우" value={frontRight} className="absolute top-2 right-0" />
      <Tire label="후좌" value={rearLeft} className="absolute bottom-2 left-0" />
      <Tire label="후우" value={rearRight} className="absolute right-0 bottom-2" />
    </div>
  );
}
