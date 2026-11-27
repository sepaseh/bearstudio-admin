import { advanceSession, getSessionVersion } from "./session";

let accessToken: string | null = null;

export const clearAccessToken = () => {
  accessToken = null;
  advanceSession();
};

export const getAccessToken = () => accessToken;
export const getAccessTokenVersion = getSessionVersion;
export { getSessionSignal } from "./session";

export const setAccessToken = (token: string) => {
  clearAccessToken();
  accessToken = token;
};
