import Asset from "../models/asset.js";
import HttpError from "../utils/httpError.js";
import cloudinary from "../config/cloudinary.js";

const toAssetResponse = (asset, req) => {
  const fileUrl = asset.fileUrl.startsWith("http")
    ? asset.fileUrl
    : `${req.protocol}://${req.get("host")}${asset.fileUrl}`;

  return {
    id: asset._id,
    title: asset.title,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    ownerName: asset.ownerId?.name || null,
    createdAt: asset.createdAt,
    fileUrl,
  };
};

export const createAssetController = async (req, res, next) => {
  try {
    const { title, visibility } = req.body;
    const file = req.file;

    if (!title?.trim()) {
      throw new HttpError(400, "Title is required");
    }

    if (!visibility) {
      throw new HttpError(400, "Visibility is required");
    }

    if (!["public", "private"].includes(visibility)) {
      throw new HttpError(400, "Visibility must be public or private");
    }

    if (!file) {
      throw new HttpError(400, "File is required");
    }

    const resourceType = file.mimetype.startsWith("video/") ? "video" : "image";

    const cloudinaryUpload = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "creator-connect/assets",
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        }
      );

      uploadStream.end(file.buffer);
    });

    const asset = await Asset.create({
      title: title.trim(),
      fileName: file.originalname,
      fileUrl: cloudinaryUpload.secure_url,
      cloudinaryPublicId: cloudinaryUpload.public_id,
      mimeType: file.mimetype,
      visibility,
      ownerId: req.user._id,
    });

    const populatedAsset = await Asset.findById(asset._id).populate(
      "ownerId",
      "name"
    );

    res.status(201).json({
      success: true,
      message: "Asset uploaded successfully",
      data: toAssetResponse(populatedAsset, req),
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicAssetsController = async (req, res, next) => {
  try {
    const assets = await Asset.find({ visibility: "public" })
      .sort({ createdAt: -1 })
      .populate("ownerId", "name");

    res.status(200).json({
      success: true,
      message: "Public assets fetched successfully",
      data: assets.map((asset) => toAssetResponse(asset, req)),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyAssetsController = async (req, res, next) => {
  try {
    const assets = await Asset.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("ownerId", "name");

    res.status(200).json({
      success: true,
      message: "Your assets fetched successfully",
      data: assets.map((asset) => toAssetResponse(asset, req)),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAssetController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findById(id);

    if (!asset) {
      throw new HttpError(404, "Asset not found");
    }

    if (asset.ownerId.toString() !== req.user._id.toString()) {
      throw new HttpError(403, "You are not allowed to delete this asset");
    }

    if (asset.cloudinaryPublicId) {
      const resourceType = asset.mimeType?.startsWith("video/") ? "video" : "image";
      await cloudinary.uploader.destroy(asset.cloudinaryPublicId, {
        resource_type: resourceType,
      });
    }

    await Asset.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Asset deleted successfully",
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};
