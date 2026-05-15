export interface PatchMePasswordRoute {
  Body: {
    newPassword: string;
  };
  Reply: {
    message: string;
  };
}
