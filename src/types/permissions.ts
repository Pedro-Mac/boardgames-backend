export interface Permission {
  id: string;
  name: string;
}

export interface CreatePermissionInput {
  name: string;
}

export interface CreatePermissionOutput {
  permission: Permission;
}

export interface DeletePermissionParams {
  id: string;
}

export interface AssignPermissionToUserBody {
  permission_id: string;
}

export interface AssignPermissionToUserParams {
  userId: string;
}
