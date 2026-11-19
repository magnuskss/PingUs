/// <reference types="vite/client" />
import type { PingusApi } from '../../preload/index'

declare global {
  interface Window {
    pingus: PingusApi
  }
}

export {}
