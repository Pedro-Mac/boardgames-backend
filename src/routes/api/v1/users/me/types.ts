export interface GetMeRoute {
  Reply: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
  };
}

export interface PatchMeRoute {
  Body: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  Reply: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
  };
}
