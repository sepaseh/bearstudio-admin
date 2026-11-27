import type { AdministratorSession } from "@/features/auth";

export type DefaultLayoutContext<User = AdministratorSession> = {
  clearSession: () => void;
  currentUser: User;
  fetchCurrentUser: () => Promise<void>;
  handleAccessError?: (error: unknown) => boolean;
};
