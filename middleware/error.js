const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.status || 500;
  let message = err.message || "Internal Server Error";

  // Mongoose ValidationError
  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(", ");
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 400;
    const keyPattern = err.keyPattern || {};
    const field = Object.keys(keyPattern)[0] || 'field';
    const keyValue = err.keyValue || {};
    const value = keyValue[field];
    message = `A record with this ${field} already exists. Please use a different value.`;
    console.error(`[DUPLICATE KEY] Collection: ${err.message?.match(/collection:\s*(\S+)/i)?.[1] || 'unknown'}, Index: ${JSON.stringify(keyPattern)}, Value: ${JSON.stringify(keyValue)}`);
  }

  // Mongoose CastError / Bad ObjectId
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 400;
    message = "Resource not found";
  }

  // JWT invalid signature / malformed token
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  // JWT expired
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Multer / file upload errors
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Please upload a smaller file.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Too many files uploaded. Please upload fewer files.";
    } else {
      message = `Upload failed: ${err.message || err.code}`;
    }
  }

  // Cloudinary / storage errors (e.g. invalid file format rejected by storage)
  if (err.message && /cloudinary|invalid file type|not supported|not allowed/i.test(err.message)) {
    statusCode = 400;
    message = err.message || "File type not supported";
  }

  const response = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = { notFound, errorHandler };
