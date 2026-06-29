export function createBufferedSender(getSocket) {
  const pending = [];
  let socketOverride = null;

  function flush() {
    const socket = socketOverride || getSocket();
    if (!socket || socket.readyState !== 1) return;
    while (pending.length) socket.send(JSON.stringify(pending.shift()));
  }

  return {
    send(obj) {
      const socket = getSocket();
      if (socket && socket.readyState === 1) {
        socket.send(JSON.stringify(obj));
        return;
      }
      pending.push(obj);
    },
    setSocket(socket) {
      socketOverride = socket || null;
      flush();
    },
    flush,
    pendingCount() {
      return pending.length;
    },
  };
}
