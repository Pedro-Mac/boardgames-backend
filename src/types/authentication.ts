import { Session } from "./session";
import { User } from "./user";

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginOutput {
  user: User;
  session: Session;
}
