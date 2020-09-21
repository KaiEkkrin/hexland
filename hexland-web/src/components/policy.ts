// This email address validation from https://ui.dev/validate-email-address-javascript/
export function emailIsValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function passwordIsValid(password: string) {
  return password.length >= 8 && /[a-z]/i.test(password) && /[0-9]/.test(password);
}