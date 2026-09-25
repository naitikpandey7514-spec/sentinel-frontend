function CameraStatus({ status }) {
  const online = status === "Online";

  return (
    <span className={online ? "status online" : "status offline"}>
      <span className="status-dot"></span>
      {status}
    </span>
  );
}

export default CameraStatus;