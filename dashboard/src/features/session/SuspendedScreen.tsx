import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { logout } from './session';
import { Button } from '../../components/ui/button';

export const SuspendedScreen: React.FC = () => {
  return (
    <div
      role="alert"
      className="min-h-screen bg-bg text-text flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-md bg-surface border border-danger/40 rounded-lg p-8 shadow-2xl flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-full bg-danger/15 text-danger flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">Account Suspended</h1>
          <p className="text-sm text-text-muted mt-2">
            Your CodeBridge account has been suspended due to an administrative or policy action. You can no longer access dashboard services.
          </p>
        </div>
        <div className="pt-2 w-full">
          <Button
            variant="danger"
            size="md"
            onClick={logout}
            className="w-full justify-center"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};

