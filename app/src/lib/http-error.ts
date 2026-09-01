import axios from 'axios'

export function getHttpErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (data && typeof data === 'object' && 'message' in data) {
      const msg = (data as { message: unknown }).message
      if (typeof msg === 'string' && msg.trim()) return msg
    }
    if (!err.response) {
      const base =
        '无法连接服务器：请确认后端已启动，并在 .env.development 或 .env.local 中设置 VITE_API_BASE_URL（完整地址，例如 http://192.168.1.13:8080/api），修改后需重启 Vite。'
      const network =
        err.code === 'ERR_NETWORK' || err.message === 'Network Error'
          ? ' 若地址无误仍失败，常见原因是跨域：请在后端为当前前端来源（如 http://localhost:5174）配置 CORS。'
          : ''
      return base + network
    }
    const status = err.response.status
    const text = err.response.statusText
    return text ? `${status} ${text}` : `${status} 请求失败`
  }
  return fallback
}
