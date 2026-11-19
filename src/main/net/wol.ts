import dgram from 'node:dgram'

/** Parse a MAC string into its 6 bytes, or null if malformed. */
function macBytes(mac: string): Buffer | null {
  const hex = mac.toLowerCase().replace(/[^0-9a-f]/g, '')
  if (hex.length !== 12) return null
  const buf = Buffer.alloc(6)
  for (let i = 0; i < 6; i++) buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return buf
}

/**
 * Build a Wake-on-LAN magic packet: 6 bytes of 0xFF followed by the target
 * MAC repeated 16 times.
 */
function magicPacket(mac: Buffer): Buffer {
  const packet = Buffer.alloc(102)
  packet.fill(0xff, 0, 6)
  for (let i = 0; i < 16; i++) mac.copy(packet, 6 + i * 6)
  return packet
}

/**
 * Send a Wake-on-LAN magic packet for the given MAC. Broadcasts to the local
 * network on UDP ports 9 and 7 (the conventional WoL ports). Waking a device
 * requires that device to have WoL enabled in its firmware/OS. Only wakes
 * devices on the user's own network.
 */
export function wakeOnLan(
  mac: string,
  broadcastAddress = '255.255.255.255'
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const bytes = macBytes(mac)
    if (!bytes) {
      resolve({ ok: false, error: 'Invalid MAC address' })
      return
    }
    if (!/^[0-9.]+$/.test(broadcastAddress)) {
      resolve({ ok: false, error: 'Invalid broadcast address' })
      return
    }

    const packet = magicPacket(bytes)
    const socket = dgram.createSocket('udp4')
    let settled = false
    const finish = (res: { ok: boolean; error?: string }): void => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch {
        /* already closed */
      }
      resolve(res)
    }

    socket.on('error', (err) => finish({ ok: false, error: err.message }))
    socket.bind(() => {
      try {
        socket.setBroadcast(true)
      } catch {
        /* ignore */
      }
      let remaining = 2
      const sent = (err: Error | null): void => {
        if (err) {
          finish({ ok: false, error: err.message })
          return
        }
        remaining -= 1
        if (remaining === 0) finish({ ok: true })
      }
      socket.send(packet, 0, packet.length, 9, broadcastAddress, sent)
      socket.send(packet, 0, packet.length, 7, broadcastAddress, sent)
    })
  })
}
