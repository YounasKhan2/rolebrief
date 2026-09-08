import { RouterProvider } from "react-router";
import { router } from "./app/routes";
import { ToastProvider } from "./components/ui/toast";
import { AuthProvider } from "./lib/auth";
import { AuthGateProvider } from "./components/auth/AuthGateDialog";
import { SavedProvider } from "./lib/saved-context";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGateProvider>
          <SavedProvider>
            <RouterProvider router={router} />
          </SavedProvider>
        </AuthGateProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
