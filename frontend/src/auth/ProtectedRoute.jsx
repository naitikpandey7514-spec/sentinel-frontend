import {
  Navigate,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./AuthContext";

function ProtectedRoute({
  children,
  permission = null,
}) {
  const {
    user,
    loading,
    hasPermission,
  } = useAuth();

  const location =
    useLocation();

  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen">
          <p>
            Checking secure access...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  if (
    permission &&
    !hasPermission(permission)
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;