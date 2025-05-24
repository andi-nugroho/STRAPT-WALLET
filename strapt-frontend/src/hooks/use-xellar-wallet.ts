import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useConnectModal } from '@xellar/kit';

export function useXellarWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const navigate = useNavigate();

  // Auto-navigate to app after successful connection
  useEffect(() => {
    if (isConnected) {
      // Check if we're on the landing page and navigate if needed
      if (window.location.pathname === '/') {
        navigate('/app');
      }
    }
  }, [isConnected, navigate]);

  // Function to handle wallet connection
  const connectXellarWallet = async () => {
    try {
      // If the connect modal is available, use it
      if (openConnectModal) {
        openConnectModal();
        return true;
      }

      // Fallback: try to connect using wagmi directly
      const xellarConnector = connectors.find(c => c.id === 'xellar');

      if (xellarConnector) {
        await connect({ connector: xellarConnector });
        return true;
      }

      return false;
    } catch (error) {
      console.error("Xellar wallet connection error:", error);
      return false;
    }
  };

  // Function to disconnect wallet
  const disconnectXellarWallet = async () => {
    try {
      await disconnect();
      navigate('/');
      return true;
    } catch (error) {
      console.error("Xellar wallet disconnection error:", error);
      return false;
    }
  };

  // Return the necessary wallet functions and state
  return {
    isConnected,
    address,
    connectWallet: connectXellarWallet,
    disconnectWallet: disconnectXellarWallet,
  };
}
