"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/instant";

export default function Home() {
  const router = useRouter();
  const { user: authUser } = db.useAuth();
  const userId = authUser?.id;

  useEffect(() => {
    if (userId) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [userId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
