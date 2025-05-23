import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import XellarWalletProfile from './XellarWalletProfile';
import { ThemeToggleSimple } from '@/components/ui/theme-toggle';

const Header = () => {
  const location = useLocation();
  const path = location.pathname.split('/')[2] || 'home';

  const getTitle = () => {
    // Always return STRAPT as the title
    return 'STRAPT';
  };

  return (
    <header className="sticky top-2 z-10 mx-2">
      <div className="bg-card/90 backdrop-blur-sm rounded-xl shadow-sm border border-border py-2.5 px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold gradient-text">{getTitle()}</h1>
          <div className="flex items-center gap-2">
            <ThemeToggleSimple />
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <Bell className="h-4 w-4" />
            </Button>
            <XellarWalletProfile />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
