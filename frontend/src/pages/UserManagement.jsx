import { useEffect, useState } from "react";
import {
  Shield,
  UserPlus,
  RefreshCw,
  UserCheck,
  UserX,
  KeyRound,
} from "lucide-react";

import api from "../services/api";

const ROLES = [
  "SUPER_ADMIN",
  "SECURITY_ADMIN",
  "OPERATOR",
  "VIEWER",
];

function formatApiError(err, fallback) {
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        const location = Array.isArray(item?.loc)
          ? item.loc.join(" → ")
          : "";

        const message =
          item?.msg ||
          item?.message ||
          "Validation error";

        return location
          ? `${location}: ${message}`
          : message;
      })
      .join(" • ");
  }

  if (
    detail &&
    typeof detail === "object"
  ) {
    return (
      detail.msg ||
      detail.message ||
      JSON.stringify(detail)
    );
  }

  if (
    typeof err?.message === "string" &&
    err.message
  ) {
    return err.message;
  }

  return fallback;
}

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    role: "VIEWER",
  });

  async function loadUsers() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.get("/api/auth/users");

      const data = response.data;

      if (Array.isArray(data)) {
        setUsers(data);
      } else if (Array.isArray(data?.users)) {
        setUsers(data.users);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("User management load error:", err);

      setUsers([]);

      setError(
        formatApiError(
          err,
          "Unable to load users from the Sentinel-X backend."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function createUser(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const username = form.username.trim();
    const email = form.email.trim();
    const name = form.name.trim();
    const password = form.password;
    const role = form.role;

    if (!username) {
      setError("Username is required.");
      setSaving(false);
      return;
    }

    if (!email) {
      setError("Email is required.");
      setSaving(false);
      return;
    }

    if (!name) {
      setError("Full name is required.");
      setSaving(false);
      return;
    }

    if (!password || password.length < 10) {
      setError(
        "Password must contain at least 10 characters."
      );
      setSaving(false);
      return;
    }

    try {
      await api.post("/api/auth/users", {
        username,
        email,
        name,
        password,
        role,
      });

      setForm({
        username: "",
        email: "",
        name: "",
        password: "",
        role: "VIEWER",
      });

      setMessage("User created successfully.");

      await loadUsers();
    } catch (err) {
      console.error("Create user error:", err);

      setError(
        formatApiError(
          err,
          "Unable to create the user."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId, role) {
    setError("");
    setMessage("");

    try {
      await api.patch(
        `/api/auth/users/${userId}/role`,
        {
          role,
        }
      );

      setMessage("User role updated.");

      await loadUsers();
    } catch (err) {
      console.error("Role update error:", err);

      setError(
        formatApiError(
          err,
          "Unable to update the user's role."
        )
      );
    }
  }

  async function changeStatus(user) {
    setError("");
    setMessage("");

    const currentEnabled =
      user.is_active ??
      user.enabled ??
      user.active ??
      true;

    try {
      await api.patch(
        `/api/auth/users/${user.id}/status`,
        {
          enabled: !currentEnabled,
        }
      );

      setMessage(
        !currentEnabled
          ? "User enabled."
          : "User disabled."
      );

      await loadUsers();
    } catch (err) {
      console.error("Status update error:", err);

      setError(
        formatApiError(
          err,
          "Unable to update the user's status."
        )
      );
    }
  }

  async function resetPassword(user) {
    const newPassword = window.prompt(
      `Enter a new password for ${user.username}:`
    );

    if (!newPassword) {
      return;
    }

    if (newPassword.length < 10) {
      setError(
        "Password must contain at least 10 characters."
      );
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.patch(
        `/api/auth/users/${user.id}/password`,
        {
          password: newPassword,
        }
      );

      setMessage(
        `Password updated for ${user.username}.`
      );
    } catch (err) {
      console.error("Password update error:", err);

      setError(
        formatApiError(
          err,
          "Unable to reset the user's password."
        )
      );
    }
  }

  function isEnabled(user) {
    return Boolean(
      user.is_active ??
        user.enabled ??
        user.active ??
        true
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title-row">
            <Shield size={24} />
            <h2>Access Control</h2>
          </div>

          <p>
            Manage Sentinel-X users, roles, account access,
            and authentication settings.
          </p>
        </div>

        <button
          className="refresh-button"
          type="button"
          onClick={loadUsers}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="connection-error">
          <UserX size={22} />

          <div>
            <strong>Action failed</strong>
            <p>{String(error)}</p>
          </div>
        </div>
      )}

      {message && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 14px",
            borderRadius: "10px",
            background: "rgba(22, 163, 74, 0.10)",
            border: "1px solid rgba(22, 163, 74, 0.25)",
            color: "#166534",
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(300px, 360px) minmax(0, 1fr)",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <section className="panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <UserPlus size={20} />

            <div>
              <h3 style={{ margin: 0 }}>
                Create User
              </h3>

              <p
                style={{
                  margin: "4px 0 0",
                  opacity: 0.7,
                  fontSize: "13px",
                }}
              >
                Add an authenticated Sentinel-X account.
              </p>
            </div>
          </div>

          <form onSubmit={createUser}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
              }}
            >
              Username
            </label>

            <input
              className="form-input"
              type="text"
              name="username"
              value={form.username}
              onChange={updateField}
              required
              autoComplete="off"
              placeholder="operator01"
            />

            <label
              style={{
                display: "block",
                marginTop: "14px",
                marginBottom: "6px",
              }}
            >
              Email
            </label>

            <input
              className="form-input"
              type="email"
              name="email"
              value={form.email}
              onChange={updateField}
              required
              placeholder="operator@example.com"
            />

            <label
              style={{
                display: "block",
                marginTop: "14px",
                marginBottom: "6px",
              }}
            >
              Full name
            </label>

            <input
              className="form-input"
              type="text"
              name="name"
              value={form.name}
              onChange={updateField}
              required
              placeholder="Security Operator"
            />

            <label
              style={{
                display: "block",
                marginTop: "14px",
                marginBottom: "6px",
              }}
            >
              Temporary password
            </label>

            <input
              className="form-input"
              type="password"
              name="password"
              value={form.password}
              onChange={updateField}
              required
              minLength={10}
              placeholder="Minimum 10 characters"
              autoComplete="new-password"
            />

            <label
              style={{
                display: "block",
                marginTop: "14px",
                marginBottom: "6px",
              }}
            >
              Role
            </label>

            <select
              className="form-input"
              name="role"
              value={form.role}
              onChange={updateField}
            >
              {ROLES.map((role) => (
                <option
                  key={role}
                  value={role}
                >
                  {role}
                </option>
              ))}
            </select>

            <button
              className="refresh-button"
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                justifyContent: "center",
                marginTop: "18px",
              }}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={17}
                    className="spin"
                  />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus size={17} />
                  Create User
                </>
              )}
            </button>
          </form>
        </section>

        <section className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                Sentinel-X Users
              </h3>

              <p
                style={{
                  margin: "4px 0 0",
                  opacity: 0.7,
                  fontSize: "13px",
                }}
              >
                {users.length} account
                {users.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="loading-screen">
              <RefreshCw
                className="spin"
                size={28}
              />
              <p>Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                padding: "36px 20px",
                textAlign: "center",
                opacity: 0.7,
              }}
            >
              No users were returned by the backend.
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "760px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        borderBottom:
                          "1px solid rgba(128,128,128,.2)",
                      }}
                    >
                      User
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        borderBottom:
                          "1px solid rgba(128,128,128,.2)",
                      }}
                    >
                      Email
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        borderBottom:
                          "1px solid rgba(128,128,128,.2)",
                      }}
                    >
                      Role
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        borderBottom:
                          "1px solid rgba(128,128,128,.2)",
                      }}
                    >
                      Status
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        borderBottom:
                          "1px solid rgba(128,128,128,.2)",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => {
                    const enabled = isEnabled(user);

                    const roleValue =
                      typeof user.role === "string"
                        ? user.role
                        : user.role_name ||
                          user.role?.name ||
                          "VIEWER";

                    return (
                      <tr key={user.id}>
                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom:
                              "1px solid rgba(128,128,128,.12)",
                          }}
                        >
                          <div>
                            <strong>
                              {user.name ||
                                user.username}
                            </strong>

                            <div
                              style={{
                                fontSize: "12px",
                                opacity: 0.65,
                                marginTop: "3px",
                              }}
                            >
                              @{user.username}
                            </div>
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom:
                              "1px solid rgba(128,128,128,.12)",
                          }}
                        >
                          {user.email || "—"}
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom:
                              "1px solid rgba(128,128,128,.12)",
                          }}
                        >
                          <select
                            value={roleValue}
                            onChange={(event) =>
                              changeRole(
                                user.id,
                                event.target.value
                              )
                            }
                            className="form-input"
                            style={{
                              minWidth: "170px",
                            }}
                          >
                            {ROLES.map((role) => (
                              <option
                                key={role}
                                value={role}
                              >
                                {role}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom:
                              "1px solid rgba(128,128,128,.12)",
                          }}
                        >
                          <span>
                            {enabled
                              ? "Active"
                              : "Disabled"}
                          </span>
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom:
                              "1px solid rgba(128,128,128,.12)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="refresh-button"
                              onClick={() =>
                                changeStatus(user)
                              }
                            >
                              {enabled ? (
                                <>
                                  <UserX size={15} />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <UserCheck size={15} />
                                  Enable
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              className="refresh-button"
                              onClick={() =>
                                resetPassword(user)
                              }
                            >
                              <KeyRound size={15} />
                              Reset Password
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default UserManagement;