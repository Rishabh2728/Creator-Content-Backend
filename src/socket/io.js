let ioInstance = null;

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io instance is not initialized");
  }

  return ioInstance;
};

export default {
  setIO,
  getIO,
};
