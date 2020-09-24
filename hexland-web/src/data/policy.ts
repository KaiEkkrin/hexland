export interface IInviteExpiryPolicy {
  timeUnit: 'second' | 'day'; // a dayjs time unit, see https://day.js.org/docs/en/display/difference
  recreate: number;
  expiry: number;
  deletion: number; 
}

export const defaultInviteExpiryPolicy: IInviteExpiryPolicy = {
  timeUnit: 'day',
  recreate: 1,
  expiry: 3,
  deletion: 4
};

// This email address validation from https://ui.dev/validate-email-address-javascript/
export function emailIsValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function passwordIsValid(password: string) {
  return password.length >= 8 && /[a-z]/i.test(password) && /[0-9]/.test(password);
}