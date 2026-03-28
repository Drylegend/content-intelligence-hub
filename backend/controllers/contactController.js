export async function submitContactMessage(req, res, next) {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      res.status(400);
      throw new Error("Name, email, subject, and message are required.");
    }

    res.status(201).json({
      message: "Contact message received.",
      submittedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
}
