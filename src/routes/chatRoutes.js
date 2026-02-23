import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  getConversationMessagesController,
  getConversationMessagesByIdController,
  getInboxController,
  listChatUsersController,
  sendMessageController,
} from "../controllers/chatController.js";

const router = Router();

router.use(authMiddleware);

router.get("/users", listChatUsersController);
router.get("/inbox", getInboxController);
router.get("/messages/conversation/:conversationId", getConversationMessagesByIdController);
router.get("/messages/:userId", getConversationMessagesController);
router.post("/messages", sendMessageController);

export default router;
