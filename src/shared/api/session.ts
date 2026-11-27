let session = new AbortController();
let version = 0;

export const advanceSession = () => {
  const previous = session;
  session = new AbortController();
  version += 1;
  previous.abort();
};

export const getSessionSignal = () => session.signal;
export const getSessionVersion = () => version;
