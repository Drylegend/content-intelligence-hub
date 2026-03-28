window.CIH = window.CIH || {};

function setFieldError(field, message) {
  if (!field) {
    return;
  }

  const errorNode = document.querySelector(`[data-error-for="${field.id}"]`);
  if (errorNode) {
    errorNode.textContent = message || "";
  }

  field.setAttribute("aria-invalid", message ? "true" : "false");
}

window.CIH.validateURL = function validateURL(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "URL is required.";
  }

  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/.test(parsed.protocol)) {
      return "URL must start with http:// or https://";
    }
    return "";
  } catch (error) {
    return "Enter a valid URL.";
  }
};

window.CIH.validateFile = function validateFile(file) {
  if (!file) {
    return "Choose a PDF, DOCX, or TXT file.";
  }

  const lowerName = file.name.toLowerCase();
  const accepted = [".pdf", ".docx", ".txt"].some((extension) => lowerName.endsWith(extension));
  if (!accepted) {
    return "Only PDF, DOCX, and TXT files are allowed.";
  }

  if (file.size > 50 * 1024 * 1024) {
    return "File size must be 50MB or smaller.";
  }

  return "";
};

window.CIH.validateRegister = function validateRegister(values) {
  const errors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (values.password !== values.confirm) {
    errors.confirm = "Passwords do not match.";
  }

  if (!values.terms) {
    errors.terms = "You must agree to the terms.";
  }

  return errors;
};

window.CIH.validateLogin = function validateLogin(values) {
  const errors = {};

  if (!/^\S+@\S+\.\S+$/.test(String(values.email || "").trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!String(values.password || "").trim()) {
    errors.password = "Password is required.";
  }

  return errors;
};

window.CIH.validateContact = function validateContact(values) {
  const errors = {};

  if (!values.contactName.trim()) {
    errors.contactName = "Name is required.";
  }

  if (!/^\S+@\S+\.\S+$/.test(values.contactEmail.trim())) {
    errors.contactEmail = "Enter a valid email address.";
  }

  if (!values.subject.trim()) {
    errors.subject = "Choose a subject.";
  }

  if (!values.message.trim()) {
    errors.message = "Message is required.";
  }

  return errors;
};

window.CIH.showErrors = function showErrors(form, errors) {
  form.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
  });

  Object.entries(errors).forEach(([fieldId, message]) => {
    const field = form.querySelector(`#${fieldId}`);
    setFieldError(field, message);
  });
};

window.CIH.clearFieldError = function clearFieldError(field) {
  setFieldError(field, "");
};
