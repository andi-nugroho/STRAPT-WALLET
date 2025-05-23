
import { useEffect, useRef, useMemo, memo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import QRCodeLib from 'qrcode';
import { cn } from '@/lib/utils';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
  bgColor?: string;
  fgColor?: string;
  renderAsImage?: boolean;
}

/**
 * Optimized QR Code component with memoization and image rendering option
 */
const QRCode = memo(({
  value,
  size = 200,
  className = "",
  bgColor = "#FFF",
  fgColor = "#000",
  renderAsImage = false
}: QRCodeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const isMobile = useIsMobile();

  // Memoize the QR size calculation to prevent unnecessary recalculations
  const qrSize = useMemo(() =>
    isMobile ? Math.min(size, window.innerWidth - 100) : size,
    [isMobile, size]
  );

  // Generate QR code
  useEffect(() => {
    if (renderAsImage) {
      // For image rendering, generate a data URL
      QRCodeLib.toDataURL(
        value,
        {
          width: qrSize,
          margin: 2,
          color: {
            dark: fgColor,
            light: bgColor,
          },
        },
        (error, url) => {
          if (error) {
            console.error(error);
            return;
          }

          if (imgRef.current && url) {
            imgRef.current.src = url;
          }
        }
      );
    } else if (canvasRef.current) {
      // For canvas rendering
      QRCodeLib.toCanvas(
        canvasRef.current,
        value,
        {
          width: qrSize,
          margin: 2,
          color: {
            dark: fgColor,
            light: bgColor,
          },
        },
        (error) => {
          if (error) console.error(error);
        }
      );
    }
  }, [value, qrSize, bgColor, fgColor, renderAsImage]);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      {renderAsImage ? (
        <img
          ref={imgRef}
          alt="QR Code"
          width={qrSize}
          height={qrSize}
          loading="lazy"
        />
      ) : (
        <canvas ref={canvasRef} />
      )}
    </div>
  );
});

QRCode.displayName = 'QRCode';

export default QRCode;
