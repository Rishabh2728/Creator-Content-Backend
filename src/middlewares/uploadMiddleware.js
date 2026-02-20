import multer from "multer";
import HttpError from "../utils/httpError.js";
const allowedMimeTypes = new Set([
  "image/png",
  "image/jpg",
  "image/jpeg",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(
        new HttpError(
          400,
          "Unsupported file type. Allowed: PNG, JPG, JPEG, MP4, WEBM, OGG, MOV"
        )
      );
    }
    return cb(null, true);
  },
});

export const uploadAssetSingle = upload.single("file");

export const uploadErrorHandler = (error, _req, _res, next) => {
  if (error && error.code === "LIMIT_FILE_SIZE") {
    return next(new HttpError(400, "File size cannot exceed 15MB"));
  }

  if (error instanceof multer.MulterError) {
    return next(new HttpError(400, error.message));
  }

  return next(error);
};
