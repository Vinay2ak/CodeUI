import React, { useEffect, useRef } from 'react';
import { LogIn, Clock } from 'lucide-react';
import { env } from '../../lib/env';
import { Button } from '../../components/ui/button';

export const SessionExpiredModal: React.FC = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // Trap focus on button
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignInAgain = () => {
    window.location.assign(env.VITE_SIGNIN_URL);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-lg bg-surface border border-border p-6 shadow-2xl flex flex-col items-center text-center gap-4"
      >
        <div className="w-12 h-12 rounded-full bg-warning/15 text-warning flex items-center justify-center">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h2 id="session-expired-title" className="text-lg font-bold text-text">
            Your session has expired
          </h2>
          <p className="text-sm text-text-muted mt-2">
            For your security, please sign in again to continue accessing your dashboard.
          </p>
        </div>
        <Button
          ref={buttonRef}
          variant="primary"
          size="md"
          onClick={handleSignInAgain}
          className="w-full justify-center mt-2"
        >
          <LogIn className="w-4 h-4 mr-2" />
          Sign in again
        </Button>
      </div>
    </div>
  );
};

