import { RouterProvider } from "react-router";
import { router } from "./router/routes";
import { ToastProvider } from "./ui/toast";
import { AuthProvider } from "./lib/auth/auth";
import { AuthGateProvider } from "./screens/auth/components/AuthGateDialog";
import { SavedProvider } from "./lib/features/saved-context";
import { TrackerProvider } from "./lib/features/tracker-context";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGateProvider>
          <SavedProvider>
            <TrackerProvider>
              <RouterProvider router={router} />
            </TrackerProvider>
          </SavedProvider>
        </AuthGateProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
