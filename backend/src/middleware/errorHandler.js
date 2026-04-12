function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500

  if (req.file && !res.headersSent) {
    console.error(error)
  }

  res.status(statusCode).json({
    ok: false,
    error: error.message || 'Unexpected server error'
  })
}

module.exports = {
  errorHandler
}
