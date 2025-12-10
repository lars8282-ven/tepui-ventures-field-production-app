import { Navigation } from "@/components/layout/Navigation";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

export default function BaselineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="pt-16">{children}</main>
      </div>
    </ProtectedRoute>
  );
}

