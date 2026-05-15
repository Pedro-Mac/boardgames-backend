export interface GetMeRoute {
  Reply: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
  };
}
