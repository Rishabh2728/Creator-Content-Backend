import jwt from "jsonwebtoken";
import User from "../models/user.js";
import chatService from "../services/chatService.js";

const extractToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    return authToken.startsWith("Bearer ") ? authToken.split(" ")[1] : authToken;
  }

  const headerToken = socket.handshake.headers?.authorization;
  if (headerToken?.startsWith("Bearer ")) {
    return headerToken.split(" ")[1];
  }

  return null;
};

export const setupChatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        return next(new Error("Unauthorized: token required"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "dev_jwt_secret_change_me"
      );

      const user = await User.findById(decoded.id).select("_id name email role");
      if (!user) {
        return next(new Error("Unauthorized: user not found"));
      }

      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized: invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);

    socket.emit("chat:connected", {
      userId,
      message: "Socket connected",
    });

    socket.on("chat:send", async (payload = {}, ack) => {
      try {
        const message = await chatService.sendMessage({
          senderId: userId,
          receiverId: payload.receiverId,
          body: payload.body,
        });

        const senderRoom = `user:${message.sender.id.toString()}`;
        const receiverRoom = `user:${message.receiver.id.toString()}`;

        io.to(senderRoom).emit("chat:message", message);
        io.to(receiverRoom).emit("chat:message", message);

        if (typeof ack === "function") {
          ack({ ok: true, message });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ ok: false, message: error.message || "Unable to send message" });
        }
      }
    });
  });
};

export default setupChatSocket;
