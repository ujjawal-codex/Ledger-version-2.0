


import React, { useState } from "react";
import { supabase, setRememberMe } from "./supabase";
import "./Auth.css";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Supabase connection is not configured.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        setMessage(
          "Account created! Please check your email and click the verification link before signing in."
        );
      }

      else if (mode === "login") {
        setRememberMe(remember);

        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) throw error;

        setMessage("Login successful. Loading your workspace...");
      }

      else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: window.location.origin }
        );

        if (error) throw error;

        setMessage(
          "Password reset instructions have been sent if the account exists."
        );
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">L</div>
          <div>
            <h2>Ledger</h2>
            <span>Business made simpler</span>
          </div>
        </div>

        <div className="auth-welcome">
          <div className="auth-tag">YOUR BUSINESS, IN CONTROL</div>

          <h1>
            {mode === "login" && "Welcome back."}
            {mode === "signup" && "Create your account."}
            {mode === "forgot" && "Reset your password."}
          </h1>

          <p>
            {mode === "login" && "Sign in to manage your business records."}
            {mode === "signup" && "Start managing your business with Ledger."}
            {mode === "forgot" && "Enter your email to receive a secure reset link."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <label>
              Full name
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          {mode !== "forgot" && (
            <label>
              Password
              <div className="auth-password">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          )}

          {mode === "login" && (
            <div className="auth-options">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                Remember me
              </label>

              <button
                type="button"
                className="auth-link"
                onClick={() => changeMode("forgot")}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button className="auth-submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : "Send reset link"}
          </button>
        </form>

        {message && (
          <div className="auth-message">{message}</div>
        )}

        <div className="auth-switch">
          {mode === "login" && (
            <>
              New to Ledger?{" "}
              <button type="button" onClick={() => changeMode("signup")}>
                Create an account
              </button>
            </>
          )}

          {mode === "signup" && (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => changeMode("login")}>
                Sign in
              </button>
            </>
          )}

          {mode === "forgot" && (
            <button type="button" onClick={() => changeMode("login")}>
              Back to login
            </button>
          )}
        </div>

        <div className="auth-security">
          <span>● Secure access</span>
          <span>● Private business records</span>
        </div>
      </div>
    </div>
  );
}
