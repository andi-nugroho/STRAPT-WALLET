import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import LoadingScreen from './LoadingScreen';

const WalletCheck = () => {
  const { isConnected } = useXellarWallet();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  // Just check connection status without trying to connect
  useEffect(() => {
    // Short timeout to ensure wallet state is properly loaded
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // If loading, show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  // If not connected, prevent access to the app
  if (!isConnected) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If connected, render the children
  return <Outlet />;
};

export default WalletCheck;
