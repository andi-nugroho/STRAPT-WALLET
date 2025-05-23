
import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Scan } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { processQRCodeData } from '@/utils/qr-code-utils';

interface QRCodeScannerProps {
  onScan?: (decodedText: string) => void;
  onScanSuccess?: (decodedText: string) => void;
  triggerType?: 'button' | 'popover' | 'dialog';
  buttonText?: string;
  buttonVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  buttonClassName?: string;
  iconOnly?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const QRCodeScanner = ({
  onScan,
  onScanSuccess,
  triggerType = 'button',
  buttonText = 'Scan QR Code',
  buttonVariant = 'default',
  buttonSize = 'default',
  buttonClassName = '',
  iconOnly = false,
  open,
  onOpenChange,
}: QRCodeScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(open || false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'html5-qrcode-scanner';

  // Define stopScanner with useCallback to avoid recreation on each render
  const stopScanner = useCallback(() => {
    if (html5QrCode.current?.isScanning) {
      html5QrCode.current.stop()
        .catch(err => console.error("Error stopping scanner:", err))
        .finally(() => setIsScanning(false));
    }
  }, []);

  // Define startScanner with useCallback to avoid recreation on each render
  const startScanner = useCallback(async () => {
    if (!html5QrCode.current) {
      html5QrCode.current = new Html5Qrcode(scannerContainerId);
    }

    setIsScanning(true);

    try {
      const qrCodeSuccessCallback = (decodedText: string) => {
        stopScanner();

        // Call onScan handler if provided (doesn't close scanner)
        if (onScan) {
          onScan(decodedText);
        }

        // Call onScanSuccess handler if provided
        if (onScanSuccess) {
          // Call the custom handler first
          onScanSuccess(decodedText);

          // Also process with our standard handler to ensure consistent behavior
          // across all QR code scanners in the app
          processQRCodeData(decodedText, navigate, toast);
        } else {
          // Use the standard processing function
          processQRCodeData(decodedText, navigate, toast);
        }

        setScannerOpen(false);
        if (onOpenChange) {
          onOpenChange(false);
        }
      };

      // Enhanced configuration for better QR code scanning
      const config = {
        fps: 15,                                // Higher FPS for faster scanning
        qrbox: isMobile ? { width: 250, height: 250 } : { width: 300, height: 300 },
        aspectRatio: 1.0,                       // Square aspect ratio for better scanning
        disableFlip: false                      // Allow flipping for better detection
      };

      await html5QrCode.current.start(
        { facingMode: "environment" },          // Use back camera by default
        config,
        qrCodeSuccessCallback,
        () => {} // Ignore failures to avoid console noise
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setIsScanning(false);
      toast({
        title: "Camera Access Needed",
        description: "Please allow camera access to scan QR codes",
        variant: "destructive",
      });
    }
  }, [isMobile, navigate, onOpenChange, onScan, onScanSuccess, stopScanner, toast]);

  // Sync with external open state if provided
  useEffect(() => {
    if (open !== undefined) {
      setScannerOpen(open);
      if (open && !isScanning) {
        setTimeout(() => startScanner(), 500);
      } else if (!open && isScanning) {
        stopScanner();
      }
    }
  }, [open, isScanning, startScanner, stopScanner]);

  const handleOpenChange = useCallback((newOpenState: boolean) => {
    setScannerOpen(newOpenState);
    if (!newOpenState && isScanning) {
      stopScanner();
    }
    if (newOpenState) {
      setTimeout(() => startScanner(), 500);
    }

    // Call external handler if provided
    if (onOpenChange) {
      onOpenChange(newOpenState);
    }
  }, [isScanning, onOpenChange, startScanner, stopScanner]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCode.current?.isScanning) {
        html5QrCode.current.stop()
          .catch(err => console.error("Error stopping scanner:", err))
          .finally(() => setIsScanning(false));
      }
    };
  }, []);

  const scannerContent = (
    <div className="flex flex-col items-center">
      <div id={scannerContainerId} className="w-full max-w-[300px] h-[300px] relative">
        <div className="absolute inset-0 flex items-center justify-center">
          {!isScanning && <Scan className="h-10 w-10 text-muted-foreground animate-pulse" />}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-4 mb-2">
        Point your camera at a QR code to scan it
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(false)}
        className="mt-2"
      >
        Cancel
      </Button>
    </div>
  );

  const triggerButton = (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      className={buttonClassName}
      onClick={triggerType === 'button' ? () => handleOpenChange(true) : undefined}
    >
      <Scan className={`h-4 w-4 ${!iconOnly ? 'mr-2' : ''}`} />
      {!iconOnly && buttonText}
    </Button>
  );

  // Render different trigger types
  if (triggerType === 'dialog') {
    return (
      <>
        {triggerButton}
        <Dialog open={scannerOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-xs mx-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Scan a QR code to claim a transfer or add a contact
              </DialogDescription>
            </DialogHeader>
            {scannerContent}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (triggerType === 'popover') {
    return (
      <Popover open={scannerOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {triggerButton}
        </PopoverTrigger>
        <PopoverContent className="w-80" align="center">
          {scannerContent}
        </PopoverContent>
      </Popover>
    );
  }

  // Default case - button with dialog
  return (
    <>
      {triggerButton}
      <Dialog open={scannerOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xs mx-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Scan a QR code to claim a transfer or add a contact
            </DialogDescription>
          </DialogHeader>
          {scannerContent}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QRCodeScanner;
