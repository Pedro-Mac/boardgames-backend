export interface AddressOutput {
  id: string;
  fullName: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface ListAddressesQuery {
  page?: number;
}

export interface ListAddressesOutput {
  addresses: AddressOutput[];
  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateAddressInput {
  fullName: string;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault?: boolean;
}
