import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { restoreSession, type BootstrapResult } from "./app/bootstrap";
import { SignInPage } from "./features/auth/SignInPage";
import { clearDraft } from "./features/onboarding/draft";
import { RegisterPage } from "./features/onboarding/RegisterPage";
import { clearSession, initLogoutSync } from "./session/session";

export function App() {
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState<BootstrapResult | { status: "loading" }>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    void restoreSession().then((result) => {
      if (active) {
        setBootstrap(result);
      }
    });

    const cleanupSync = initLogoutSync(() => {
      clearSession();
      clearDraft();
      setBootstrap({ status: "anonymous" });
      navigate("/login", { replace: true });
    });

    return () => {
      active = false;
      cleanupSync();
    };
  }, [navigate]);

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <Routes>
          <Route path="/login" element={<SignInPage bootstrap={bootstrap} />} />
          <Route path="/register" element={<RegisterPage bootstrap={bootstrap} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </MotionConfig>
  );
}
