"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendMagicCode, signInWithMagicCode } from "@/lib/auth";
import { db } from "@/lib/instant";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { user: authUser, isLoading } = db.useAuth();
  const userId = authUser?.id;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && userId) {
      router.push("/dashboard");
    }
  }, [userId, isLoading, router]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSendingCode(true);

    try {
      await sendMagicCode(email);
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send magic code");
    } finally {
      setSendingCode(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithMagicCode(email, code);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (userId) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div className="flex justify-center mb-4">
          <Logo />
        </div>
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-tepui-gray">
            {codeSent ? "Enter your code" : "Sign in to your account"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Use your @tepuiv.com email address
          </p>
        </div>

        {!codeSent ? (
          <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div className="rounded-md shadow-sm">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-tepui-blue focus:border-tepui-blue focus:z-10 sm:text-sm"
                  placeholder="Email address (@tepuiv.com)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={sendingCode}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-semibold rounded-md text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingCode ? "Sending..." : "Send Magic Code"}
              </button>
            </div>

            <div className="text-center text-sm text-gray-600">
              <p>We'll send a magic code to your email to sign in.</p>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="email-display" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email-display"
                  type="email"
                  disabled
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 bg-gray-50 text-gray-500 rounded-md sm:text-sm cursor-not-allowed"
                  value={email}
                />
              </div>
              <div>
                <label htmlFor="code" className="sr-only">
                  Magic Code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  autoComplete="one-time-code"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-tepui-blue focus:border-tepui-blue focus:z-10 sm:text-sm"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setError("");
                }}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="flex-1 py-2 px-4 border border-transparent rounded-md text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
