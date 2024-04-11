/**
 * Get environment variables. Given an environment variable name, will retrieve
 * the value. If the variable does not exist and it is required for the test,
 * this function will throw an Error
 * @param {string} name - Name of the environment variable
 * @param {bool} [required] - Optional boolean specifying if an error should be
 * thrown if the variable is not found. Defaults to `true`.
 * @returns {string} Value of the environment variable
 * @example
 * const password = getEnv('ACCOUNT_APP_PASSWORD')  // Required for test run
 * const profile = getEnv('PROFILE', false) ?? 'smoke'  // Optional variable defaults to 'smoke' if variable does not exist
 */
export function getEnv(name: string, required: boolean = true): string {
  const variable = __ENV[name];
  if (required && variable === undefined) {
    throw new Error(`Environment variable '${name}' does not exist.`);
  }
  return variable;
}
