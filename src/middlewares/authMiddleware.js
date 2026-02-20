import jwt from "jsonwebtoken";
import User from "../models/user.js";
import HttpError from "../utils/httpError.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new HttpError(401, "Authorization token is required");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev_jwt_secret_change_me"
    );

    const user = await User.findById(decoded.id).select("_id name email role");
    if (!user) {
      throw new HttpError(401, "Invalid token user");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return next(new HttpError(401, "Invalid or expired token"));
    }
    return next(error);
  }
};

export default authMiddleware;
