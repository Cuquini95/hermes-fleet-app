import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import FloatingChatButton from './FloatingChatButton';
import { OfflineBanner } from '../ui/OfflineBanner';
import ConsentBanner from '../ui/ConsentBanner';
import LegalFooter from '../ui/LegalFooter';
import { useAuthStore } from '../../stores/auth-store';

const editable = 'textarea, [contenteditable="true"], input:is(:not([type]), [type="text"], [type="search"], [type="tel"], [type="email"], [type="url"], [type="number"], [type="password"])';

export default function AppShell() {
  const shell = useRef<HTMLDivElement>(null);
  const project = useAuthStore(state => state.project);

  useEffect(() => {
    const viewport = window.visualViewport;
    const currentHeight = () => viewport?.height ?? window.innerHeight;
    let fullHeight = currentHeight();
    let width = window.innerWidth;
    let keyboardOpen = false;

    const update = () => {
      const height = currentHeight();
      const editing = document.activeElement?.matches(editable);
      if (width !== window.innerWidth || (!editing && !keyboardOpen)) {
        width = window.innerWidth;
        fullHeight = height;
        keyboardOpen = false;
      }
      if (height > fullHeight) fullHeight = height;
      // Keep the toolbar hidden through a tap that blurs the field, while the keyboard is still open.
      keyboardOpen = Boolean((editing || keyboardOpen) && (viewport?.scale ?? 1) === 1 && fullHeight - height >= 120);
      shell.current?.toggleAttribute('data-keyboard-open', keyboardOpen);
      shell.current?.style.setProperty('--app-viewport-height', `${height}px`);
    };

    update();
    document.addEventListener('focusin', update);
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    return () => {
      document.removeEventListener('focusin', update);
      window.removeEventListener('resize', update);
      viewport?.removeEventListener('resize', update);
    };
  }, []);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-navy focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      <div ref={shell} data-project={project} className="app-shell flex min-h-dvh min-w-0 w-full flex-col">
        <Header />
        <OfflineBanner />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 w-full flex-1 overflow-y-auto px-3 sm:px-4"
          style={{
            paddingTop: 80,
            paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            backgroundColor: '#F1F5F9',
          }}
        >
          <Outlet />
          <LegalFooter />
        </main>
        <BottomNav />
        <FloatingChatButton />
        <ConsentBanner />
      </div>
    </>
  );
}
