// ============================================================
// Validadores robustos para formularios y APIs
// ============================================================

export function isValidEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isValidPhone(phone: unknown): boolean {
  if (!phone) return true; // Opcional
  if (typeof phone !== "string") return false;
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  return cleaned.length >= 7 && cleaned.length <= 15 && /^\d+$/.test(cleaned);
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateCreateUser(body: any): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Cuerpo de solicitud inválido." };
  }

  const { email, password, first_name, last_name, role } = body;

  if (!first_name || typeof first_name !== "string" || first_name.trim().length < 2) {
    return { valid: false, error: "El nombre es obligatorio y debe tener al menos 2 caracteres." };
  }

  if (!last_name || typeof last_name !== "string" || last_name.trim().length < 2) {
    return { valid: false, error: "El apellido es obligatorio y debe tener al menos 2 caracteres." };
  }

  if (!email || !isValidEmail(email)) {
    return { valid: false, error: "El correo electrónico no tiene un formato válido." };
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return { valid: false, error: "La contraseña debe tener un mínimo de 6 caracteres." };
  }

  const validRoles = ["super_admin", "director", "admin", "coordinador", "terapeuta", "fisioterapeuta", "padre", "paciente"];
  if (role && !validRoles.includes(role)) {
    return { valid: false, error: `El rol '${role}' no es válido.` };
  }

  if (body.phone && !isValidPhone(body.phone)) {
    return { valid: false, error: "El formato del número de teléfono es inválido." };
  }

  return { valid: true };
}

export function validateUpdateUser(body: any): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Cuerpo de solicitud inválido." };
  }

  if (!body.id || typeof body.id !== "string") {
    return { valid: false, error: "Falta el ID del usuario a modificar." };
  }

  if (body.first_name !== undefined && (typeof body.first_name !== "string" || body.first_name.trim().length < 2)) {
    return { valid: false, error: "El nombre debe tener al menos 2 caracteres." };
  }

  if (body.last_name !== undefined && (typeof body.last_name !== "string" || body.last_name.trim().length < 2)) {
    return { valid: false, error: "El apellido debe tener al menos 2 caracteres." };
  }

  if (body.phone !== undefined && body.phone !== null && !isValidPhone(body.phone)) {
    return { valid: false, error: "El formato de teléfono es inválido." };
  }

  if (body.password !== undefined && body.password !== "" && (typeof body.password !== "string" || body.password.length < 6)) {
    return { valid: false, error: "La nueva contraseña debe tener al menos 6 caracteres." };
  }

  return { valid: true };
}

export function validateCreatePatient(body: any): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Cuerpo de solicitud inválido." };
  }

  if (!body.first_name || typeof body.first_name !== "string" || body.first_name.trim().length < 2) {
    return { valid: false, error: "El nombre del paciente es obligatorio." };
  }

  if (!body.last_name || typeof body.last_name !== "string" || body.last_name.trim().length < 2) {
    return { valid: false, error: "El apellido del paciente es obligatorio." };
  }

  if (body.email && !isValidEmail(body.email)) {
    return { valid: false, error: "El correo electrónico del paciente/representante es inválido." };
  }

  if (body.phone && !isValidPhone(body.phone)) {
    return { valid: false, error: "El teléfono proporcionado no tiene un formato válido." };
  }

  return { valid: true };
}
