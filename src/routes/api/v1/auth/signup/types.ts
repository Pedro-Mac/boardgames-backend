export interface SignupRoute {
  Body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
}
