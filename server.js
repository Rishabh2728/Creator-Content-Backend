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

  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  setIO(io);
  setupChatSocket(io);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO ready on port ${PORT}`);
  });
};

startServer();
