import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import FloatingChatButton from './FloatingChatButton';
import { OfflineBanner } from '../ui/OfflineBanner';
import ConsentBanner from '../ui/ConsentBanner';
import LegalFooter from '../ui/LegalFooter';

export default function AppShell() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-navy focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      <div className="flex flex-col min-h-screen">
        <Header />
        <OfflineBanner />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-4"
          style={{
            paddingTop: 80,
            paddingBottom: 80,
            backgroundColor: '#F1F5F9',
          }}
        >
          <Outlet />
          <LegalFooter />
        </main>
        <BottomNav />
      </div>
      <FloatingChatButton />
      <ConsentBanner />
    </>
  );
}
