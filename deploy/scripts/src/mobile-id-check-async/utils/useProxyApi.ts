import { config } from './config'

export function useProxyApi() {
  return config.useProxyApi === 'true'
}
