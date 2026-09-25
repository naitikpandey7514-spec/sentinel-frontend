function ConnectionStatus({ status }) {
  const connected = status === "Connected";

  return (
    <span className={connected ? "status online" : "status offline"}>
      <span className="status-dot"></span>
      {status}
    </span>
  );
}

export default ConnectionStatus;