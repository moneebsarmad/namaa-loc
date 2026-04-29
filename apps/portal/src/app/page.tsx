"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useSchoolBranding } from "./branding-context";
import { useAuth } from "./providers";

const roles = [
  {
    id: "student",
    title: "Student",
    description: "Track points, celebrate progress, and climb the ranks."
  },
  {
    id: "parent",
    title: "Parent",
    description: "Follow your child's house progress and milestones."
  },
  {
    id: "staff",
    title: "Staff",
    description: "Award points quickly and recognize character daily."
  }
] as const;

export default function Home() {
  const router = useRouter();
  const branding = useSchoolBranding();
  const { loading, signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] =
    useState<(typeof roles)[number]["id"]>("student");

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? roles[0],
    [selectedRoleId]
  );

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage(null);
    const error = await signIn(email, password);
    if (error) {
      setAuthMessage(error);
      return;
    }
    setPassword("");
    router.push("/dashboard");
  };

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="auth-star auth-star-top">
          <svg viewBox="0 0 200 200">
            <path d="M100,10 L120,80 L190,80 L130,120 L150,190 L100,150 L50,190 L70,120 L10,80 L80,80 Z" />
          </svg>
        </div>
        <div className="auth-star auth-star-bottom">
          <svg viewBox="0 0 200 200">
            <path d="M100,10 L120,80 L190,80 L130,120 L150,190 L100,150 L50,190 L70,120 L10,80 L80,80 Z" />
          </svg>
        </div>
        <div className="auth-orb auth-orb-purple"></div>
        <div className="auth-orb auth-orb-gold"></div>
      </div>

      <div className="auth-shell">
        <div className="auth-line"></div>
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="auth-logo-inner">
                <img src={branding.logoUrl} alt={`${branding.programName} crest`} />
              </div>
              <span className="auth-logo-glow"></span>
            </div>
            <h1>{branding.programName}</h1>
            <p>{selectedRole.title} Portal</p>
          </div>

          <div className="auth-divider"></div>

          <div className="auth-roles">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`auth-role ${selectedRoleId === role.id ? "active" : ""}`}
                onClick={() => setSelectedRoleId(role.id)}
              >
                {role.title}
              </button>
            ))}
          </div>

          <form className="auth-form" onSubmit={handleSignIn}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {authMessage ? (
              <div className="auth-error">{authMessage}</div>
            ) : null}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading || !email || !password}
            >
              <span>{loading ? "Signing in..." : "Sign In"}</span>
            </button>
          </form>

          <div className="auth-footer">
            <span className="auth-dot"></span>
            {branding.schoolName}
          </div>
        </div>
        <div className="auth-line"></div>
      </div>
    </div>
  );
}
