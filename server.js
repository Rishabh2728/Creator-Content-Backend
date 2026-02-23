import "dotenv/config";

import http from "http";
import { Server } from "socket.io";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { setIO } from "./src/socket/io.js";
import { setupChatSocket } from "./src/socket/chatSocket.js";

const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT || 5000;
  const server = http.createServer(app);

  const allowedOrigins = (
    process.env.CORS_ORIGIN || "https://creator-connect-frontend.vercel.app"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.engine.on("connection_error", (err) => {
    console.log("[socket][engine][connection_error]", {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  setIO(io);
  setupChatSocket(io);

  const HOST = process.env.HOST || "0.0.0.0";

  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Socket.IO ready on http://${HOST}:${PORT}`);
  });
};

startServer();
