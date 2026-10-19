// Shared form rules. Change them here and every screen follows.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_RESULT_NAME_LENGTH = 60;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getPasswordRequirements(password: string) {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasNumber: /[0-9]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
  };
}

export function isValidPassword(password: string): boolean {
  const requirements = getPasswordRequirements(password);

  return (
    requirements.minLength &&
    requirements.hasNumber &&
    requirements.hasUppercase
  );
}
