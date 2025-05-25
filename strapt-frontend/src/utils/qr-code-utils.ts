/**
 * Utility functions for QR code generation and processing
 */

/**
 * Generate a consistent STRAPT Drop claim link
 * @param dropId The STRAPT Drop ID
 * @returns A properly formatted URL for claiming the drop
 */
export const generateDropClaimLink = (dropId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/app/strapt-drop/claim?id=${dropId}`;
};

/**
 * Generate a consistent transfer claim link
 * @param transferId The transfer ID
 * @param claimCode Optional claim code
 * @returns A properly formatted URL for claiming the transfer
 */
export const generateTransferClaimLink = (transferId: string, claimCode?: string): string => {
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/app/claims?id=${transferId}`;

  // Add claim code if provided
  if (claimCode) {
    return `${url}&code=${claimCode}`;
  }

  return url;
};

/**
 * Generate a consistent wallet address link for transfers
 * @param address The wallet address
 * @returns A properly formatted URL for sending to the address
 */
export const generateWalletAddressLink = (address: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/app/transfer?to=${address}`;
};

/**
 * Process QR code data and navigate to the appropriate page
 * @param decodedText The decoded text from the QR code
 * @param navigate Function to navigate to a new page
 * @param toast Toast notification function
 * @returns True if the QR code was successfully processed, false otherwise
 */
export const processQRCodeData = (
  decodedText: string,
  navigate: (to: string) => void,
  toast: any
): boolean => {
  console.log("Processing QR code:", decodedText);

  try {
    // Trim whitespace from the decoded text
    const trimmedText = decodedText.trim();

    // Check if it's a URL
    if (trimmedText.startsWith('http')) {
      try {
        const url = new URL(trimmedText);

        // Extract path segments for better analysis
        const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);

        // Check for STRAPT Drop claim URLs - multiple possible formats
        if (
          (pathSegments.includes('strapt-drop') && pathSegments.includes('claim')) ||
          (pathSegments.includes('app') && pathSegments.includes('strapt-drop') && pathSegments.includes('claim'))
        ) {
          // Extract drop ID from URL parameters
          const params = new URLSearchParams(url.search);
          const dropId = params.get('id') || params.get('dropId');

          // Also check if the ID is in the path (e.g., /strapt-drop/claim/0x123...)
          const pathDropId = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : null;
          const finalDropId = dropId || (pathDropId?.startsWith('0x') ? pathDropId : null);

          if (finalDropId?.startsWith('0x')) {
            navigate(`/app/strapt-drop/claim?id=${finalDropId}`);
            toast({
              title: "STRAPT Drop Detected",
              description: "Opening the STRAPT Drop claim page",
            });
            return true;
          }
        }

        // Check for transfer claim URLs - multiple possible formats
        if (
          pathSegments.includes('claim') ||
          pathSegments.includes('claims') ||
          url.pathname.includes('/claim/')
        ) {
          // Try to extract transfer ID from URL parameters
          const params = new URLSearchParams(url.search);
          const transferId = params.get('id') || params.get('transferId');
          const claimCode = params.get('code') || params.get('claimCode') || params.get('password');

          // Also check if the ID is in the path (e.g., /claim/0x123...)
          let pathTransferId = null;

          // Check various path formats
          if (url.pathname.includes('/claim/')) {
            pathTransferId = url.pathname.split('/claim/')[1];
          } else if (pathSegments.length > 1 && pathSegments[pathSegments.length - 2] === 'claim') {
            pathTransferId = pathSegments[pathSegments.length - 1];
          }

          const finalTransferId = transferId || (pathTransferId?.startsWith('0x') ? pathTransferId : null);

          if (finalTransferId?.startsWith('0x')) {
            // If we have a code parameter, include it in the URL
            if (claimCode) {
              navigate(`/app/claims?id=${finalTransferId}&code=${claimCode}`);
            } else {
              navigate(`/app/claims?id=${finalTransferId}`);
            }

            toast({
              title: "Transfer Claim Detected",
              description: "Opening the claim page",
            });
            return true;
          }
        }

        // Check if URL contains transfer ID or drop ID in query params
        const params = new URLSearchParams(url.search);
        const genericId = params.get('id') || params.get('transferId') || params.get('dropId');
        const claimCode = params.get('code') || params.get('claimCode') || params.get('password');

        if (genericId?.startsWith('0x')) {
          // Determine if this is a STRAPT Drop ID or a transfer ID based on length
          // STRAPT Drop IDs and Transfer IDs are both 66 characters (0x + 64 hex chars)
          // We'll use the current path to help determine the type
          const currentPath = window.location.pathname;

          if (currentPath.includes('strapt-drop') || currentPath.includes('drop')) {
            navigate(`/app/strapt-drop/claim?id=${genericId}`);
            toast({
              title: "STRAPT Drop Detected",
              description: "Opening the STRAPT Drop claim page",
            });
          } else {
            // Otherwise, treat as a regular transfer
            if (claimCode) {
              navigate(`/app/claims?id=${genericId}&code=${claimCode}`);
            } else {
              navigate(`/app/claims?id=${genericId}`);
            }

            toast({
              title: "Transfer ID Detected",
              description: "Opening the claim page",
            });
          }
          return true;
        }

        // Check if URL contains a wallet address
        for (const [key, value] of params.entries()) {
          if (value?.startsWith('0x') && value.length === 42) {
            navigate(`/app/transfer?to=${value}`);
            toast({
              title: "Wallet Address Detected",
              description: "Opening the transfer page",
            });
            return true;
          }
        }

        // If it's just a website URL without transfer info
        toast({
          title: "Not a Payment Code",
          description: "This QR code doesn't contain payment information",
          variant: "destructive",
        });
        return false;
      } catch (urlError) {
        console.error("Error parsing URL from QR code:", urlError);
        // Continue to other checks since this might not be a valid URL
      }
    }

    // Check if it's a JSON string containing transfer data
    if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
      try {
        const jsonData = JSON.parse(trimmedText);

        // Check if JSON contains drop ID
        if (jsonData.dropId) {
          navigate(`/app/strapt-drop/claim?id=${jsonData.dropId}`);
          toast({
            title: "STRAPT Drop Data Detected",
            description: "Opening the STRAPT Drop claim page",
          });
          return true;
        }

        // Check if JSON contains transfer ID
        if (jsonData.id || jsonData.transferId) {
          const transferId = jsonData.id || jsonData.transferId;
          const claimCode = jsonData.code || jsonData.claimCode || jsonData.password;

          if (transferId?.startsWith('0x')) {
            if (claimCode) {
              navigate(`/app/claims?id=${transferId}&code=${claimCode}`);
            } else {
              navigate(`/app/claims?id=${transferId}`);
            }

            toast({
              title: "Transfer Data Detected",
              description: "Opening the claim page",
            });
            return true;
          }
        }

        // Check if JSON contains wallet address
        if (jsonData.address?.startsWith('0x') && jsonData.address.length === 42) {
          navigate(`/app/transfer?to=${jsonData.address}`);
          toast({
            title: "Wallet Address Detected",
            description: "Opening the transfer page",
          });
          return true;
        }

        // Check all properties for potential IDs or addresses
        for (const key in jsonData) {
          const value = jsonData[key];
          if (typeof value === 'string' && value.startsWith('0x')) {
            if (value.length === 42) {
              // It's likely an Ethereum address
              navigate(`/app/transfer?to=${value}`);
              toast({
                title: "Wallet Address Found in JSON",
                description: "Opening the transfer page",
              });
              return true;
            }

            if (value.length === 66) {
              // It's likely a transfer ID or drop ID
              // Use the key name to help determine the type
              if (key.toLowerCase().includes('drop')) {
                navigate(`/app/strapt-drop/claim?id=${value}`);
                toast({
                  title: "STRAPT Drop ID Found in JSON",
                  description: "Opening the STRAPT Drop claim page",
                });
              } else {
                navigate(`/app/claims?id=${value}`);
                toast({
                  title: "Transfer ID Found in JSON",
                  description: "Opening the claim page",
                });
              }
              return true;
            }
          }
        }
      } catch (jsonError) {
        console.error("Error parsing JSON from QR code:", jsonError);
        // Continue to other checks since this might not be valid JSON
      }
    }

    // Check if it's an Ethereum address
    if (trimmedText.startsWith('0x') && trimmedText.length === 42) {
      // It's an Ethereum address, navigate to transfer page with pre-filled recipient
      navigate(`/app/transfer?to=${trimmedText}`);
      toast({
        title: "Wallet Address Detected",
        description: "Opening the transfer page",
      });
      return true;
    }

    // Check if it's a transfer ID or STRAPT Drop ID (32 bytes hex)
    if (trimmedText.startsWith('0x') && trimmedText.length === 66) {
      // Try to determine if it's a STRAPT Drop ID or a transfer ID
      // For now, we'll just check the URL path to determine where to navigate
      const currentPath = window.location.pathname;

      if (currentPath.includes('strapt-drop') || currentPath.includes('drop')) {
        // If we're in the STRAPT Drop section, assume it's a drop ID
        navigate(`/app/strapt-drop/claim?id=${trimmedText}`);
        toast({
          title: "STRAPT Drop ID Detected",
          description: "Opening the STRAPT Drop claim page",
        });
      } else {
        // Otherwise, assume it's a transfer ID
        navigate(`/app/claims?id=${trimmedText}`);
        toast({
          title: "Transfer ID Detected",
          description: "Opening the claim page",
        });
      }
      return true;
    }

    // Check if it contains a transfer ID or drop ID anywhere in the text
    const hexRegex = /0x[a-fA-F0-9]{64}/g;
    const matches = trimmedText.match(hexRegex);

    if (matches && matches.length > 0) {
      // If we found multiple IDs, use the first one
      const id = matches[0];

      // Try to determine if it's a STRAPT Drop ID or a transfer ID
      const currentPath = window.location.pathname;

      if (currentPath.includes('strapt-drop') || currentPath.includes('drop')) {
        navigate(`/app/strapt-drop/claim?id=${id}`);
        toast({
          title: "STRAPT Drop ID Found",
          description: "Opening the STRAPT Drop claim page",
        });
      } else {
        navigate(`/app/claims?id=${id}`);
        toast({
          title: "Transfer ID Found",
          description: "Opening the claim page",
        });
      }
      return true;
    }

    // Check if it contains an Ethereum address anywhere in the text
    const addressRegex = /0x[a-fA-F0-9]{40}/g;
    const addressMatches = trimmedText.match(addressRegex);

    if (addressMatches && addressMatches.length > 0) {
      const address = addressMatches[0];
      navigate(`/app/transfer?to=${address}`);
      toast({
        title: "Wallet Address Found",
        description: "Opening the transfer page",
      });
      return true;
    }

    // If we get here, the format wasn't recognized
    toast({
      title: "Unknown QR Code Format",
      description: "This QR code format isn't recognized",
      variant: "destructive",
    });
    return false;
  } catch (e) {
    console.error("Error processing QR code:", e);
    toast({
      title: "Invalid QR Code",
      description: "This QR code format isn't recognized",
      variant: "destructive",
    });
    return false;
  }
};
