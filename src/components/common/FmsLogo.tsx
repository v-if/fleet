import Image from "next/image";
import { cn } from "@/lib/utils";
import { FMS_LOGO, FMS_NAME } from "@/lib/branding";

type FmsLogoProps = {
  width?: number;
  height?: number;
  className?: string;
  imageClassName?: string;
  showName?: boolean;
  nameClassName?: string;
  /** 어두운 배경 위에서 로고 대비를 높입니다. */
  onDark?: boolean;
};

export function FmsLogo({
  width = 32,
  height = 32,
  className,
  imageClassName,
  showName = false,
  nameClassName,
  onDark = false,
}: FmsLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
          onDark ? "bg-white/95 p-1" : "bg-white p-0.5 dark:bg-white/95 dark:p-1",
        )}
      >
        <Image
          src={FMS_LOGO}
          alt={FMS_NAME}
          width={width}
          height={height}
          className={cn("object-contain", imageClassName)}
        />
      </span>
      {showName ? (
        <span
          className={cn(
            "font-semibold text-gray-800 dark:text-white/90",
            nameClassName,
          )}
        >
          {FMS_NAME}
        </span>
      ) : null}
    </span>
  );
}
