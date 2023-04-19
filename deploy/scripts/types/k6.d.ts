// typescript limitation, see: https://github.com/grafana/k6-template-typescript/issues/16
declare module 'https://jslib.k6.io/url/1.0.0/index.js' {
  export const URL: typeof globalThis.URL
}
