import { useCallback } from 'react';
import { keccak256, toBytes } from 'viem';

/**
 * Hook for claim code utilities
 * Provides functions for generating and hashing claim codes
 */
export function useClaimCodeUtils() {
  /**
   * Generate a random claim code
   * @param length Length of the claim code (default: 6)
   * @returns Random claim code string
   */
  const generateClaimCode = useCallback((length: number = 6) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }, []);

  /**
   * Hash a claim code for on-chain storage
   * @param claimCode The claim code to hash
   * @returns Hashed claim code as bytes32
   */
  const hashClaimCode = useCallback((claimCode: string): `0x${string}` => {
    // Convert to uppercase and trim whitespace
    const normalizedCode = claimCode.toUpperCase().trim();

    // Hash the claim code using keccak256
    return keccak256(toBytes(normalizedCode));
  }, []);

  /**
   * Generate a transfer link with the given parameters
   * @param transferId The transfer ID
   * @param claimCode Optional claim code
   * @param baseUrl Base URL (defaults to current origin)
   * @returns Full transfer link URL
   */
  const generateTransferLink = useCallback((
    transferId: string,
    claimCode?: string,
    baseUrl?: string
  ): string => {
    const url = baseUrl || window.location.origin;

    if (claimCode) {
      return `${url}/app/claims?id=${transferId}&code=${claimCode}`;
    }

    return `${url}/app/claims?id=${transferId}`;
  }, []);

  /**
   * Generate a QR code data URL for a transfer
   * @param transferId The transfer ID
   * @param claimCode Optional claim code
   * @returns Data for QR code generation
   */
  const generateQRCodeData = useCallback((
    transferId: string,
    claimCode?: string
  ): string => {
    const link = generateTransferLink(transferId, claimCode);
    return link;
  }, [generateTransferLink]);

  /**
   * Validate a claim code format
   * @param claimCode The claim code to validate
   * @returns True if valid, false otherwise
   */
  const validateClaimCode = useCallback((claimCode: string): boolean => {
    // Claim code should be 6 characters, alphanumeric
    const regex = /^[A-Z0-9]{6}$/;
    return regex.test(claimCode.toUpperCase().trim());
  }, []);

  return {
    generateClaimCode,
    hashClaimCode,
    generateTransferLink,
    generateQRCodeData,
    validateClaimCode,
  };
}
