import { Client } from 'ssh2'
import net from 'node:net'

/**
 * 创建 SSH 隧道，将本地端口转发到远程服务器上的目标地址。
 *
 * 使用方式（参考 ssh_kingbase_connect.py）：
 *   SSH 连接到 8.145.44.8:22
 *   本地监听 127.0.0.1:15432
 *   通过 SSH 转发到远程服务器上的 127.0.0.1:54321（金仓数据库）
 *
 * @param {{ sshHost, sshPort, sshUser, sshPassword, remoteHost, remotePort, localPort }} opts
 * @returns {Promise<{ localPort: number, close: () => Promise<void> }>}
 */
export function createSshTunnel({
  sshHost,
  sshPort = 22,
  sshUser,
  sshPassword,
  remoteHost,
  remotePort,
  localPort
}) {
  return new Promise((resolve, reject) => {
    const sshClient = new Client()
    let server = null
    let settled = false

    function fail(err) {
      if (settled) return
      settled = true
      try { sshClient.end() } catch (_) { /* ignore */ }
      try { if (server) server.close() } catch (_) { /* ignore */ }
      reject(err)
    }

    sshClient.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      finish(prompts.map(() => sshPassword))
    })

    sshClient.on('ready', () => {
      server = net.createServer((localSocket) => {
        sshClient.forwardOut(
          '127.0.0.1', 0,
          remoteHost, remotePort,
          (err, stream) => {
            if (err) {
              localSocket.destroy()
              return
            }
            localSocket.pipe(stream).pipe(localSocket)
          }
        )
      })

      server.on('error', fail)

      server.listen(localPort, '127.0.0.1', () => {
        if (settled) return
        settled = true
        resolve({
          localPort,
          async close() {
            return new Promise((res) => {
              try { sshClient.end() } catch (_) { /* ignore */ }
              if (server) {
                server.close(() => res())
              } else {
                res()
              }
            })
          }
        })
      })
    })

    sshClient.on('error', fail)

    sshClient.connect({
      host: sshHost,
      port: sshPort,
      username: sshUser,
      password: sshPassword,
      tryKeyboard: true,
      readyTimeout: 10000,
      keepaliveInterval: 30000
    })
  })
}
