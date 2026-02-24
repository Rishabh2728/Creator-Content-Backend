import chatService from "../services/chatService.js";
import { getIO } from "../socket/io.js";
import HttpError from "../utils/httpError.js";

export const listChatUsersController = async (req, res, next) => {
  try {
    const { search, limit } = req.query;
    const data = await chatService.listUsersForChat({
      currentUserId: req.user._id,
      search,
      limit,
    });

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getInboxController = async (req, res, next) => {
  try {
    const data = await chatService.getInbox(req.user._id);

    res.status(200).json({
      success: true,
      message: "Inbox fetched successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessagesController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page, limit } = req.query;

    let data;
    try {
      data = await chatService.getMessagesWithUser({
        currentUserId: req.user._id,
        otherUserId: userId,
        page,
        limit,
      });
    } catch (error) {
      // Frontend often sends conversationId in this route.
      // Fallback keeps older clients working without UI changes.
      if (error?.statusCode === 404) {
        data = await chatService.getMessagesByConversation({
          currentUserId: req.user._id,
          conversationId: userId,
          page,
          limit,
        });
      } else {
        throw error;
      }
    }

    res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      data,
      messages: data.messages,
      conversationId: data.conversationId,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessagesByIdController = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page, limit } = req.query;

    const data = await chatService.getMessagesByConversation({
      currentUserId: req.user._id,
      conversationId,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      data,
      messages: data.messages,
      conversationId: data.conversationId,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessageController = async (req, res, next) => {
  try {
    let payload = req.body;

    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }

    if (!payload || typeof payload !== "object") {
      payload = {};
    }

    const receiverId = payload.receiverId || req.query.receiverId;
    const body = payload.body || payload.message || req.query.body || req.query.message;

    if (!receiverId || !body) {
      throw new HttpError(400, "receiverId and body are required");
    }

    const result = await chatService.sendMessage({
      senderId: req.user._id,
      receiverId,
      body,
    });

    const io = getIO();
    const receiverRoom = `user:${result.message.receiver.id.toString()}`;

    io.to(receiverRoom).emit("chat:message", result.message);

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
