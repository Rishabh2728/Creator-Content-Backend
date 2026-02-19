import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Otp from "../models/otp.js";
import HttpError from "../utils/httpError.js";
import sendEmail from "../utils/sendEmail.js";

const OTP_EXPIRY_MINUTES = 10;

const normalizeEmail = (email) => email.trim().toLowerCase();

const createToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || "dev_jwt_secret_change_me",
    { expiresIn: "7d" }
  );

const generateOtpCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const buildOtpHtml = (otpCode) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:16px;">
    <h2 style="margin:0 0 12px;">Creator Connect OTP</h2>
    <p style="margin:0 0 8px;">Your verification code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:8px 0 12px;">${otpCode}</p>
    <p style="margin:0;color:#555;">This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
  </div>
`;

export const sendOtp = async (email) => {
  if (!email) {
    throw new HttpError(400, "Email is required");
  }

  const normalizedEmail = normalizeEmail(email);
  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.findOneAndUpdate(
    { email: normalizedEmail, isUsed: false },
    { email: normalizedEmail, otp: otpCode, expiresAt, isUsed: false },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  await sendEmail({
    to: normalizedEmail,
    subject: "Your OTP for Creator Connect",
    html: buildOtpHtml(otpCode),
  });

  return {
    email: normalizedEmail,
    expiresAt,
    ...(process.env.NODE_ENV !== "production" ? { otp: otpCode } : {}),
  };
};

export const verifyOtp = async (email, otp) => {
  if (!email || !otp) {
    throw new HttpError(400, "Email and OTP are required");
  }

  const normalizedEmail = normalizeEmail(email);

  const otpDoc = await Otp.findOne({
    email: normalizedEmail,
    otp,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  });

  if (!otpDoc) {
    throw new HttpError(400, "Invalid or expired OTP");
  }

  otpDoc.isUsed = true;
  await otpDoc.save();

  await User.findOneAndUpdate(
    { email: normalizedEmail },
    { $set: { isVerified: true } },
    { returnDocument: "after" }
  );

  return { success: true };
};

export const registerUser = async ({ name, email, password, otp }) => {
  if (!name || !email || !password || !otp) {
    throw new HttpError(400, "Name, email, password and OTP are required");
  }

  if (password.length < 6) {
    throw new HttpError(400, "Password must be at least 6 characters");
  }

  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new HttpError(409, "User already exists");
  }

  await verifyOtp(normalizedEmail, otp);

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    isVerified: true,
  });

  const token = createToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
    token,
  };
};

export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw new HttpError(400, "Email and password are required");
  }

  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new HttpError(401, "Invalid credentials");
  }

  const token = createToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
    token,
  };
};

export default {
  sendOtp,
  verifyOtp,
  registerUser,
  loginUser,
};

