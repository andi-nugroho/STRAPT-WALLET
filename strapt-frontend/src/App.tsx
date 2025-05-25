
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Loading } from "@/components/ui/loading";

import { XellarProvider } from './providers/XellarProvider';
import { AppStateProvider } from './state/AppStateContext';
import { TransferStateProvider } from './state/TransferStateContext';
import { DataProvider } from './providers/DataProvider';
import TransactionDetector from './components/TransactionDetector';

// Import WalletCheck eagerly as it's needed for route protection
import WalletCheck from './components/WalletCheck';

// Eagerly load layouts as they're used on every page
import Layout from "./components/Layout";
import DesktopLayout from "./components/DesktopLayout";

// Lazy load all page components to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const Home = lazy(() => import("./pages/Home"));
const Transfer = lazy(() => import("./pages/Transfer"));
const Streams = lazy(() => import("./pages/OptimizedStreams"));
const AutoRefreshStreams = lazy(() => import("./pages/AutoRefreshStreams"));
const Pools = lazy(() => import("./pages/Pools"));
const StraptDrop = lazy(() => import("./pages/StraptDrop"));
const StraptDropClaim = lazy(() => import("./pages/StraptDropClaim"));
const MyDrops = lazy(() => import("./pages/OptimizedMyDrops"));
const Profile = lazy(() => import("./pages/OptimizedProfile"));
const Claims = lazy(() => import("./pages/Claims"));
const Savings = lazy(() => import("./pages/Savings"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const NotFound = lazy(() => import("./pages/NotFound"));

const App = () => {
  const isMobile = useIsMobile();

  // Loading fallback for lazy-loaded components
  const PageLoading = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loading size="lg" text="Loading page..." />
    </div>
  );

  return (
    <ThemeProvider defaultTheme="dark" storageKey="strapt-theme">
      <XellarProvider>
        <AppStateProvider>
          <TransferStateProvider>
            <TooltipProvider>
              <Sonner position="top-right" />
              <BrowserRouter>
                <DataProvider>
                <TransactionDetector>
                <Routes>
                  <Route path="/" element={
                    <Suspense fallback={<PageLoading />}>
                      <Index />
                    </Suspense>
                  } />
                  <Route path="claim/:id?" element={<Navigate to="/app/claims" replace />} />
                  {/* Protected routes require wallet connection */}
                  <Route element={<WalletCheck />}>
                    <Route path="app" element={isMobile ? <Layout /> : <DesktopLayout />}>
                      <Route index element={<Home />} />
                      <Route path="transfer" element={
                        <Suspense fallback={<PageLoading />}>
                          <Transfer />
                        </Suspense>
                      } />
                      <Route path="streams" element={
                        <Suspense fallback={<PageLoading />}>
                          <AutoRefreshStreams />
                        </Suspense>
                      } />
                      <Route path="streams-old" element={
                        <Suspense fallback={<PageLoading />}>
                          <Streams />
                        </Suspense>
                      } />
                      <Route path="savings" element={
                        <Suspense fallback={<PageLoading />}>
                          <Savings />
                        </Suspense>
                      } />
                      <Route path="pools" element={
                        <Suspense fallback={<PageLoading />}>
                          <Pools />
                        </Suspense>
                      } />
                      <Route path="strapt-drop" element={
                        <Suspense fallback={<PageLoading />}>
                          <StraptDrop />
                        </Suspense>
                      } />
                      <Route path="strapt-drop/claim" element={
                        <Suspense fallback={<PageLoading />}>
                          <StraptDropClaim />
                        </Suspense>
                      } />
                      <Route path="strapt-drop/my-drops" element={
                        <Suspense fallback={<PageLoading />}>
                          <MyDrops />
                        </Suspense>
                      } />
                      <Route path="profile" element={
                        <Suspense fallback={<PageLoading />}>
                          <Profile />
                        </Suspense>
                      } />
                      <Route path="claims" element={
                        <Suspense fallback={<PageLoading />}>
                          <Claims />
                        </Suspense>
                      } />
                      <Route path="coming-soon" element={
                        <Suspense fallback={<PageLoading />}>
                          <ComingSoon />
                        </Suspense>
                      } />
                    </Route>
                  </Route>
                  <Route path="*" element={
                    <Suspense fallback={<PageLoading />}>
                      <NotFound />
                    </Suspense>
                  } />
                </Routes>
                </TransactionDetector>
                </DataProvider>
              </BrowserRouter>
              </TooltipProvider>
          </TransferStateProvider>
        </AppStateProvider>
      </XellarProvider>
    </ThemeProvider>
  );
};

export default App;
