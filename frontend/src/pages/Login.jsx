import {
  AlertCircle,
  LoaderCircle,
  LogIn,
  Shield,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    loading: authLoading,
    login,
  } = useAuth();

  const [identifier, setIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const destination =
      location.state?.from?.pathname || "/";

    navigate(destination, {
      replace: true,
    });
  }, [
    authLoading,
    user,
    location.state,
    navigate,
  ]);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (
      !identifier.trim() ||
      !password
    ) {
      setError(
        "Enter your username/email and password."
      );
      return;
    }

    setSubmitting(true);

    try {
      await login(
        identifier.trim(),
        password
      );

      const destination =
        location.state?.from?.pathname || "/";

      navigate(destination, {
        replace: true,
      });
    } catch (err) {
      console.error(
        "Sentinel-X login error:",
        err
      );

      const detail =
        err?.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Login failed. Check your credentials."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #07111f 0%, #0d1b2f 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "15px",
          }}
        >
          <LoaderCircle
            size={20}
            style={{
              animation:
                "sentinel-spin 1s linear infinite",
            }}
          />
          Checking secure session...
        </div>

        <style>
          {`
            @keyframes sentinel-spin {
              from {
                transform: rotate(0deg);
              }

              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "linear-gradient(135deg, #07111f 0%, #0d1b2f 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "20px",
          padding: "36px",
          boxShadow:
            "0 24px 70px rgba(0,0,0,.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              background: "#0f172a",
              color: "#fff",
            }}
          >
            <Shield size={27} />
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "25px",
                color: "#0f172a",
              }}
            >
              Sentinel-X
            </h1>

            <p
              style={{
                margin: "4px 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Secure Operations Access
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              padding: "12px 14px",
              marginBottom: "18px",
              borderRadius: "10px",
              background: "#fef2f2",
              color: "#991b1b",
              fontSize: "14px",
            }}
          >
            <AlertCircle
              size={18}
              style={{
                flexShrink: 0,
              }}
            />

            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            Username or email
          </label>

          <input
            type="text"
            value={identifier}
            onChange={(event) =>
              setIdentifier(
                event.target.value
              )
            }
            autoComplete="username"
            disabled={submitting}
            autoFocus
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              border:
                "1px solid #cbd5e1",
              borderRadius: "10px",
              marginBottom: "18px",
              fontSize: "16px",
              outline: "none",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            autoComplete="current-password"
            disabled={submitting}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              border:
                "1px solid #cbd5e1",
              borderRadius: "10px",
              marginBottom: "22px",
              fontSize: "16px",
              outline: "none",
            }}
          />

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              minHeight: "48px",
              border: 0,
              borderRadius: "10px",
              background: "#0f172a",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 700,
              cursor: submitting
                ? "wait"
                : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "9px",
            }}
          >
            {submitting ? (
              <LoaderCircle
                size={19}
                style={{
                  animation:
                    "sentinel-spin 1s linear infinite",
                }}
              />
            ) : (
              <LogIn size={19} />
            )}

            {submitting
              ? "Signing in..."
              : "Sign In"}
          </button>
        </form>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop:
              "1px solid #e2e8f0",
            display: "flex",
            justifyContent:
              "space-between",
            gap: "12px",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          <span>
            Sentinel-X Security
          </span>

          <span>
            Protected Access
          </span>
        </div>
      </div>

      <style>
        {`
          @keyframes sentinel-spin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}

export default Login;