import authService from "../services/authService.js";

export const sendOtpController = async (req, res, next) => {
  try {
    const { email } = req.body;
    const data = await authService.sendOtp(email);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtpController = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const data = await authService.verifyOtp(email, otp);

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const registerController = async (req, res, next) => {
  try {
    const { name, email, password, otp } = req.body;
    const data = await authService.registerUser({ name, email, password, otp });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await authService.loginUser({ email, password });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data,
    });
  } catch (error) {
    next(error);
  }
};

