import { RouterProvider } from "react-router";
import { router } from "./app/routes";
import { ToastProvider } from "./components/ui/toast";
import { AuthProvider } from "./lib/auth";
import { AuthGateProvider } from "./components/auth/AuthGateDialog";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGateProvider>
          <RouterProvider router={router} />
        </AuthGateProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
