process.env.UNICO_AUTOSTART = "0";

const { default: server } = await import("../server/index.js");

export default server;
