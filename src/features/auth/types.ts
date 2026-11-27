export type LoginParams = {
  mobile: string;
  password: string;
};

export type AdministratorSession = {
  id: string;
  mobile: string;
  name: string;
  roles: { id: string; name: string }[];
  permissions: string[];
};
