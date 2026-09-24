const WS_URL = import.meta.env.VITE_WS_URL || "";

let socket = null;
let reconnectTimer = null;
let reconnectDelay = 2000;
let manuallyClosed = false;

export function connectWebSocket(
  onMessage,
  onStatusChange
) {
  manuallyClosed = false;

  if (!WS_URL) {
    onStatusChange?.("unconfigured");
    return () => {};
  }

  function connect() {
    if (manuallyClosed) return;

    onStatusChange?.("connecting");

    try {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        reconnectDelay = 2000;
        onStatusChange?.("connected");
      };

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          onMessage?.(data);
        } catch {
          onMessage?.({
            type: "message",
            message: message.data,
          });
        }
      };

      socket.onerror = () => {
        onStatusChange?.("error");
      };

      socket.onclose = () => {
        socket = null;

        if (manuallyClosed) return;

        onStatusChange?.("disconnected");

        reconnectTimer = setTimeout(
          connect,
          reconnectDelay
        );

        reconnectDelay = Math.min(
          reconnectDelay * 2,
          30000
        );
      };
    } catch (error) {
      console.error("WebSocket error:", error);
      onStatusChange?.("error");

      reconnectTimer = setTimeout(
        connect,
        reconnectDelay
      );

      reconnectDelay = Math.min(
        reconnectDelay * 2,
        30000
      );
    }
  }

  connect();

  return () => {
    manuallyClosed = true;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket) {
      socket.close();
      socket = null;
    }
  };
}