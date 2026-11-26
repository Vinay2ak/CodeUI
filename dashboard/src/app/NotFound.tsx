import React from 'react';
import { HelpCircle, ArrowLeft } from 'lucide-react';
import { useSession } from '../features/session/session';
import { Button } from '../components/ui/button';

export const NotFound: React.FC = () => {
  const { user } = useSession();
  const targetRoute = user ? `/${user.role}` : '/';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 gap-4">
      <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center text-text-muted">
        <HelpCircle className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-text">Page Not Found</h2>
        <p className="text-sm text-text-muted mt-1 max-w-sm">
          The dashboard screen you requested does not exist or has been moved.
        </p>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          window.location.assign(targetRoute);
        }}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Return to Dashboard
      </Button>
    </div>
  );
};

