import jwt from "jsonwebtoken";
import mongoose from "mongoose";
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
  console.log("[socket][setup] Registering namespaces", ["/", "/chat"]);

  const toOptionalString = (value) => {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
  };

  const extractPossibleId = (value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string" || typeof value === "number") {
      return toOptionalString(value);
    }

    if (mongoose.Types.ObjectId.isValid(value)) {
      return String(value);
    }

    if (typeof value === "object") {
      return (
        toOptionalString(value._id) ||
        toOptionalString(value.id) ||
        toOptionalString(value.userId) ||
        toOptionalString(value.receiverId) ||
        null
      );
    }

    return null;
  };

  const registerNamespace = (namespace, namespaceLabel) => {
    namespace.use(async (socket, next) => {
      try {
        const token = extractToken(socket);
        if (!token) {
          console.log("[socket][auth][rejected]", {
            namespace: namespaceLabel,
            reason: "token_missing",
          });
          return next(new Error("Unauthorized: token required"));
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "dev_jwt_secret_change_me"
        );

        const user = await User.findById(decoded.id).select("_id name email role");
        if (!user) {
          console.log("[socket][auth][rejected]", {
            namespace: namespaceLabel,
            reason: "user_not_found",
            userId: decoded.id,
          });
          return next(new Error("Unauthorized: user not found"));
        }

        socket.user = user;
        console.log("[socket][auth][ok]", {
          namespace: namespaceLabel,
          userId: user._id.toString(),
        });
        return next();
      } catch (error) {
        console.log("[socket][auth][rejected]", {
          namespace: namespaceLabel,
          reason: "invalid_token",
          message: error?.message,
        });
        return next(new Error("Unauthorized: invalid token"));
      }
    });

    namespace.on("connection", (socket) => {
      const userId = socket.user._id.toString();
      socket.join(`user:${userId}`);
      console.log("[socket][connected]", {
        namespace: namespaceLabel,
        socketId: socket.id,
        userId,
        room: `user:${userId}`,
      });

      socket.onAny((eventName, payload) => {
        console.log("[socket][event][incoming]", {
          namespace: namespaceLabel,
          socketId: socket.id,
          userId,
          eventName,
          payload,
        });
      });

      const emitTypingState = (payload = {}, isTyping, ack) => {
        const receiverId =
          extractPossibleId(payload.receiverId) ||
          extractPossibleId(payload.receiver) ||
          extractPossibleId(payload.userId) ||
          extractPossibleId(payload.targetUserId);

        if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
          console.log("[socket][typing][rejected]", {
            namespace: namespaceLabel,
            reason: "invalid_receiver_id",
            senderId: userId,
            payload,
          });
          if (typeof ack === "function") {
            ack({ ok: false, message: "Valid receiverId is required" });
          }
          return;
        }

        if (receiverId === userId) {
          if (typeof ack === "function") {
            ack({ ok: false, message: "receiverId cannot be current user" });
          }
          return;
        }

        const conversationId =
          extractPossibleId(payload.conversationId) ||
          extractPossibleId(payload.conversation?._id) ||
          extractPossibleId(payload.chatId) ||
          null;

        const typingPayload = {
          senderId: userId,
          receiverId,
          conversationId,
          isTyping,
          updatedAt: new Date().toISOString(),
        };

        console.log("[socket][typing][incoming]", {
          namespace: namespaceLabel,
          senderId: userId,
          receiverId,
          conversationId,
          isTyping,
        });

        const receiverRoom = `user:${receiverId}`;
        const senderRoom = `user:${userId}`;

        namespace.to(receiverRoom).emit("chat:typing", typingPayload);
        namespace.to(senderRoom).emit("chat:typing", typingPayload);

        console.log("[socket][typing][outgoing]", {
          namespace: namespaceLabel,
          targetRoom: receiverRoom,
          payload: typingPayload,
        });
        console.log("[socket][typing][outgoing]", {
          namespace: namespaceLabel,
          targetRoom: senderRoom,
          payload: typingPayload,
        });

        if (typeof ack === "function") {
          ack({ ok: true, data: typingPayload });
        }
      };

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

          namespace.to(senderRoom).emit("chat:message", message);
          namespace.to(receiverRoom).emit("chat:message", message);

          if (typeof ack === "function") {
            ack({ ok: true, message });
          }
        } catch (error) {
          if (typeof ack === "function") {
            ack({ ok: false, message: error.message || "Unable to send message" });
          }
        }
      });

      socket.on("chat:typing:start", (payload = {}, ack) => {
        emitTypingState(payload, true, ack);
      });

      socket.on("chat:typing:stop", (payload = {}, ack) => {
        emitTypingState(payload, false, ack);
      });

      socket.on("chat:typing", (payload = {}, ack) => {
        emitTypingState(payload, true, ack);
      });

      socket.on("chat:stop-typing", (payload = {}, ack) => {
        emitTypingState(payload, false, ack);
      });

      socket.on("disconnect", (reason) => {
        console.log("[socket][disconnected]", {
          namespace: namespaceLabel,
          socketId: socket.id,
          userId,
          reason,
        });
      });
    });
  };

  registerNamespace(io, "/");
  registerNamespace(io.of("/chat"), "/chat");
};

export default setupChatSocket;
