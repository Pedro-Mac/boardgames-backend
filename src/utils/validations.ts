export const VALIDATE = {
  EMAIL: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email.length <= 254 && emailRegex.test(email.trim().toLowerCase());
  },
};
