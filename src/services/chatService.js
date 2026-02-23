import mongoose from "mongoose";
import User from "../models/user.js";
import Conversation from "../models/conversation.js";
import Message from "../models/message.js";
import HttpError from "../utils/httpError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, `Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(id);
};

const buildParticipantsHash = (firstUserId, secondUserId) => {
  return [firstUserId.toString(), secondUserId.toString()].sort().join(":");
};

const ensureReceiverExists = async (receiverId) => {
  const receiver = await User.findById(receiverId).select("_id name email");
  if (!receiver) {
    throw new HttpError(404, "Receiver user not found");
  }
  return receiver;
};

const getOrCreateConversation = async (senderId, receiverId) => {
  const participantsHash = buildParticipantsHash(senderId, receiverId);

  let conversation = await Conversation.findOne({ participantsHash });
  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, receiverId],
      participantsHash,
    });
  }

  return conversation;
};

export const listUsersForChat = async ({ currentUserId, search = "", limit = 50 }) => {
  const safeLimit = Math.min(Number(limit) || 50, 100);

  const query = {
    _id: { $ne: currentUserId },
  };

  if (search?.trim()) {
    query.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { email: { $regex: search.trim(), $options: "i" } },
    ];
  }

  const users = await User.find(query)
    .select("_id name email")
    .sort({ name: 1 })
    .limit(safeLimit);

  return users.map((user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
  }));
};

export const getInbox = async (currentUserId) => {
  const conversations = await Conversation.find({
    participants: currentUserId,
  })
    .populate("participants", "_id name email")
    .sort({ lastMessageAt: -1, updatedAt: -1 });

  const inbox = await Promise.all(
    conversations.map(async (conversation) => {
      const otherUser = conversation.participants.find(
        (participant) => participant._id.toString() !== currentUserId.toString()
      );

      const unreadCount = await Message.countDocuments({
        conversationId: conversation._id,
        receiver: currentUserId,
        readBy: { $ne: currentUserId },
      });

      return {
        conversationId: conversation._id,
        otherUser: otherUser
          ? { id: otherUser._id, name: otherUser.name, email: otherUser.email }
          : null,
        lastMessage: conversation.lastMessage || "",
        lastMessageAt: conversation.lastMessageAt,
        unreadCount,
      };
    })
  );

  return inbox.filter((item) => item.otherUser);
};

export const getMessagesWithUser = async ({
  currentUserId,
  otherUserId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
}) => {
  const currentObjectId = toObjectId(currentUserId, "current user id");
  const otherObjectId = toObjectId(otherUserId, "user id");

  if (currentObjectId.toString() === otherObjectId.toString()) {
    throw new HttpError(400, "Cannot open chat with yourself");
  }

  await ensureReceiverExists(otherObjectId);

  const safePage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const skip = (safePage - 1) * safeLimit;

  const participantsHash = buildParticipantsHash(currentObjectId, otherObjectId);

  const conversation = await Conversation.findOne({ participantsHash });
  if (!conversation) {
    return {
      conversationId: null,
      messages: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        hasMore: false,
      },
    };
  }

  const messages = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .populate("sender", "_id name email")
    .populate("receiver", "_id name email");

  await Message.updateMany(
    {
      conversationId: conversation._id,
      receiver: currentObjectId,
      readBy: { $ne: currentObjectId },
    },
    {
      $addToSet: { readBy: currentObjectId },
    }
  );

  const normalizedMessages = messages
    .reverse()
    .map((message) => ({
      id: message._id,
      conversationId: message.conversationId,
      body: message.body,
      sender: {
        id: message.sender._id,
        name: message.sender.name,
        email: message.sender.email,
      },
      receiver: {
        id: message.receiver._id,
        name: message.receiver.name,
        email: message.receiver.email,
      },
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      isReadByCurrentUser: message.readBy.some(
        (readerId) => readerId.toString() === currentObjectId.toString()
      ),
    }));

  return {
    conversationId: conversation._id,
    messages: normalizedMessages,
    pagination: {
      page: safePage,
      limit: safeLimit,
      hasMore: messages.length === safeLimit,
    },
  };
};

export const getMessagesByConversation = async ({
  currentUserId,
  conversationId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
}) => {
  const currentObjectId = toObjectId(currentUserId, "current user id");
  const conversationObjectId = toObjectId(conversationId, "conversation id");

  const safePage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const skip = (safePage - 1) * safeLimit;

  const conversation = await Conversation.findById(conversationObjectId).populate(
    "participants",
    "_id name email"
  );

  if (!conversation) {
    throw new HttpError(404, "Conversation not found");
  }

  const isParticipant = conversation.participants.some(
    (participant) => participant._id.toString() === currentObjectId.toString()
  );

  if (!isParticipant) {
    throw new HttpError(403, "You are not allowed to view this conversation");
  }

  const messages = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .populate("sender", "_id name email")
    .populate("receiver", "_id name email");

  await Message.updateMany(
    {
      conversationId: conversation._id,
      receiver: currentObjectId,
      readBy: { $ne: currentObjectId },
    },
    {
      $addToSet: { readBy: currentObjectId },
    }
  );

  const normalizedMessages = messages
    .reverse()
    .map((message) => ({
      id: message._id,
      conversationId: message.conversationId,
      body: message.body,
      sender: {
        id: message.sender._id,
        name: message.sender.name,
        email: message.sender.email,
      },
      receiver: {
        id: message.receiver._id,
        name: message.receiver.name,
        email: message.receiver.email,
      },
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      isReadByCurrentUser: message.readBy.some(
        (readerId) => readerId.toString() === currentObjectId.toString()
      ),
    }));

  return {
    conversationId: conversation._id,
    messages: normalizedMessages,
    pagination: {
      page: safePage,
      limit: safeLimit,
      hasMore: messages.length === safeLimit,
    },
  };
};

export const sendMessage = async ({ senderId, receiverId, body }) => {
  const senderObjectId = toObjectId(senderId, "sender id");
  const receiverObjectId = toObjectId(receiverId, "receiver id");

  if (senderObjectId.toString() === receiverObjectId.toString()) {
    throw new HttpError(400, "Cannot send message to yourself");
  }

  const trimmedBody = body?.trim();
  if (!trimmedBody) {
    throw new HttpError(400, "Message body is required");
  }

  const [sender, receiver] = await Promise.all([
    User.findById(senderObjectId).select("_id name email"),
    ensureReceiverExists(receiverObjectId),
  ]);

  if (!sender) {
    throw new HttpError(401, "Sender user not found");
  }

  const conversation = await getOrCreateConversation(senderObjectId, receiverObjectId);

  // Guard against accidental duplicate sends (double click / dual submit paths)
  const duplicateWindowStart = new Date(Date.now() - 3000);
  const recentDuplicate = await Message.findOne({
    conversationId: conversation._id,
    sender: senderObjectId,
    receiver: receiverObjectId,
    body: trimmedBody,
    createdAt: { $gte: duplicateWindowStart },
  })
    .sort({ createdAt: -1 })
    .populate("sender", "_id name email")
    .populate("receiver", "_id name email");

  if (recentDuplicate) {
    return {
      id: recentDuplicate._id,
      conversationId: recentDuplicate.conversationId,
      body: recentDuplicate.body,
      sender: {
        id: recentDuplicate.sender._id,
        name: recentDuplicate.sender.name,
        email: recentDuplicate.sender.email,
      },
      receiver: {
        id: recentDuplicate.receiver._id,
        name: recentDuplicate.receiver.name,
        email: recentDuplicate.receiver.email,
      },
      createdAt: recentDuplicate.createdAt,
      updatedAt: recentDuplicate.updatedAt,
    };
  }

  const message = await Message.create({
    conversationId: conversation._id,
    sender: senderObjectId,
    receiver: receiverObjectId,
    body: trimmedBody,
    readBy: [senderObjectId],
  });

  conversation.lastMessage = trimmedBody;
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageSender = senderObjectId;
  await conversation.save();

  return {
    id: message._id,
    conversationId: conversation._id,
    body: message.body,
    sender: {
      id: sender._id,
      name: sender.name,
      email: sender.email,
    },
    receiver: {
      id: receiver._id,
      name: receiver.name,
      email: receiver.email,
    },
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

export default {
  listUsersForChat,
  getInbox,
  getMessagesWithUser,
  getMessagesByConversation,
  sendMessage,
};
