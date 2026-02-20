import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import { uploadAssetSingle, uploadErrorHandler } from "../middlewares/uploadMiddleware.js";
import {
  createAssetController,
  deleteAssetController,
  getMyAssetsController,
  getPublicAssetsController,
} from "../controllers/assetController.js";

const router = Router();

router.get("/public", getPublicAssetsController);
router.get("/me", authMiddleware, getMyAssetsController);
router.post(
  "/",
  authMiddleware,
  uploadAssetSingle,
  uploadErrorHandler,
  createAssetController
);
router.delete("/:id", authMiddleware, deleteAssetController);

export default router;
