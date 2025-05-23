
import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart2, Users, User, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNav = () => {
  const location = useLocation();
  const path = location.pathname.split('/')[2] || '';

  const navItems = [
    { name: 'Home', shortName: 'Home', path: '', icon: Home },
    { name: 'Pay Streams', shortName: 'Streams', path: 'streams', icon: BarChart2 },
    { name: 'STRAPT Drop', shortName: 'Drop', path: 'strapt-drop', icon: Users },
    { name: 'Savings', shortName: 'Savings', path: 'savings', icon: Wallet },
    { name: 'Profile', shortName: 'Profile', path: 'profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-card/80 backdrop-blur-lg border-t border-border/50 mx-auto max-w-md">
      <div className="flex h-full items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = path === item.path;
          return (
            <Link
              key={item.name}
              to={`/app/${item.path}`}
              className={cn(
                'flex flex-col items-center justify-center px-3 py-2 transition-all',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5 mb-1', isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]')} />
              <span className={cn('text-xs', isActive ? 'font-medium' : 'font-normal')}>
                <span className="hidden sm:inline">{item.name}</span>
                <span className="sm:hidden">{item.shortName}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
