import { User } from "@supabase/supabase-js";
import { Session } from "./session";

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginOutput {
  user: User;
  session: Session;
}
