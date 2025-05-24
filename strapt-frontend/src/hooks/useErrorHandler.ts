import { toast } from 'sonner';

/**
 * Hook for standardized error handling
 * Provides functions for handling different types of errors with appropriate toast messages
 */
export function useErrorHandler() {
  /**
   * Handle contract interaction errors with appropriate toast messages
   * @param error The error object
   * @param defaultMessage Default message to show if error type can't be determined
   */
  const handleError = (error: any, defaultMessage: string = "Transaction failed") => {
    console.error('Error:', error);

    // Extract error message
    const errorMessage = error?.message || String(error);

    // Check for common error patterns
    if (errorMessage.includes('rejected') || errorMessage.includes('denied') || errorMessage.includes('cancelled')) {
      toast.error("Transaction cancelled", {
        description: "You cancelled the transaction"
      });
    } else if (errorMessage.includes('insufficient funds')) {
      toast.error("Insufficient funds", {
        description: "You do not have enough funds to complete this transaction"
      });
    } else if (errorMessage.includes('gas required exceeds allowance')) {
      toast.error("Gas limit exceeded", {
        description: "The transaction requires more gas than your wallet allows"
      });
    } else if (errorMessage.includes('nonce too low')) {
      toast.error("Transaction nonce error", {
        description: "Please try again with a higher nonce value"
      });
    } else if (errorMessage.includes('already claimed') || errorMessage.includes('not claimable')) {
      toast.error("Already claimed", {
        description: "This transfer has already been claimed or is not available"
      });
    } else if (errorMessage.includes('Invalid claim code') || errorMessage.includes('invalid password')) {
      toast.error("Invalid claim code", {
        description: "The claim code you entered is incorrect"
      });
    } else if (errorMessage.includes('not refundable') || errorMessage.includes('cannot refund')) {
      toast.error("Not refundable", {
        description: "This transfer cannot be refunded or has already been claimed"
      });
    } else if (errorMessage.includes('expired')) {
      toast.error("Expired", {
        description: "This transfer has expired and is no longer valid"
      });
    } else if (errorMessage.includes('user rejected')) {
      toast.error("User rejected", {
        description: "You rejected the transaction request"
      });
    } else {
      // Default error message
      toast.error(defaultMessage, {
        description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage
      });
    }
  };

  /**
   * Handle form validation errors
   * @param error The error object or message
   * @param field The field name that has the error
   */
  const handleFormError = (error: any, field?: string) => {
    const errorMessage = error?.message || String(error);

    if (field) {
      toast.error(`Invalid ${field}`, {
        description: errorMessage
      });
    } else {
      toast.error("Form validation error", {
        description: errorMessage
      });
    }
  };

  /**
   * Handle API errors
   * @param error The error object
   * @param defaultMessage Default message to show if error type can't be determined
   */
  const handleApiError = (error: any, defaultMessage: string = "API request failed") => {
    console.error('API Error:', error);

    // Extract error message
    const errorMessage = error?.message || String(error);
    const statusCode = error?.status || error?.statusCode;

    if (statusCode === 401 || statusCode === 403) {
      toast.error("Authentication error", {
        description: "You are not authorized to perform this action"
      });
    } else if (statusCode === 404) {
      toast.error("Not found", {
        description: "The requested resource was not found"
      });
    } else if (statusCode === 429) {
      toast.error("Rate limit exceeded", {
        description: "Too many requests. Please try again later"
      });
    } else if (statusCode >= 500) {
      toast.error("Server error", {
        description: "The server encountered an error. Please try again later"
      });
    } else {
      toast.error(defaultMessage, {
        description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage
      });
    }
  };

  return {
    handleError,
    handleFormError,
    handleApiError,
  };
}
