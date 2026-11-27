export const parseHttpsAddress = (input: string): URL | undefined => {
  const value = input.trim();
  if (
    value.length > 2048 ||
    !/^https:\/\//i.test(value) ||
    /\\|\p{Cc}/u.test(value)
  )
    return;

  try {
    const address = new URL(value);
    if (
      address.hostname &&
      !address.username &&
      !address.password &&
      address.href.length <= 2048
    )
      return address;
  } catch {
    return;
  }
};
