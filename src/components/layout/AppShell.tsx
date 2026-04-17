import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import FloatingChatButton from './FloatingChatButton';
import { OfflineBanner } from '../ui/OfflineBanner';

export default function AppShell() {
  return (
    <>
      <div className="flex flex-col min-h-screen">
        <Header />
        <OfflineBanner />
        <main
          className="flex-1 overflow-y-auto px-4"
          style={{
            paddingTop: 80,
            paddingBottom: 80,
            backgroundColor: '#F1F5F9',
          }}
        >
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <FloatingChatButton />
    </>
  );
}
