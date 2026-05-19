import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import type { Instance, FileListResponse, SystemStats } from '../types'

class ApiClient {
  private client: AxiosInstance
  private token: string | null = null

  constructor() {
    this.client = axios.create({ baseURL: '/api', timeout: 30000 })
    this.token = localStorage.getItem('mc_easypanel_token')
    this.client.interceptors.request.use((config) => {
      if (this.token) config.headers.Authorization = `Bearer ${this.token}`
      return config
    })
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('mc_easypanel_token')
          this.token = null
          if (window.location.pathname !== '/login') window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  setToken(token: string | null) {
    this.token = token
    if (token) localStorage.setItem('mc_easypanel_token', token)
    else localStorage.removeItem('mc_easypanel_token')
  }

  getToken() { return this.token }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<{ success: boolean; data?: T; message?: string }> {
    try { const res = await this.client.get(url, config); return res.data } catch (e: any) { return e.response?.data || { success: false, message: '网络错误' } }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<{ success: boolean; data?: T; message?: string }> {
    try { const res = await this.client.post(url, data, config); return res.data } catch (e: any) { return e.response?.data || { success: false, message: '网络错误' } }
  }

  async put<T>(url: string, data?: any): Promise<{ success: boolean; data?: T; message?: string }> {
    try { const res = await this.client.put(url, data); return res.data } catch (e: any) { return e.response?.data || { success: false, message: '网络错误' } }
  }

  async delete<T>(url: string): Promise<{ success: boolean; data?: T; message?: string }> {
    try { const res = await this.client.delete(url); return res.data } catch (e: any) { return e.response?.data || { success: false, message: '网络错误' } }
  }

  // Auth
  async login(username: string, password: string) { return this.post('/auth/login', { username, password }) }
  async register(username: string, password: string) { return this.post('/auth/register', { username, password }) }
  async verifyToken() { return this.get('/auth/verify') }
  async changePassword(oldPassword: string, newPassword: string) { return this.post('/auth/change-password', { oldPassword, newPassword }) }
  async hasUsers() { return this.get('/auth/has-users') }

  // Instances
  async getInstances() { return this.get<Instance[]>('/instances') }
  async getInstance(id: string) { return this.get<Instance>(`/instances/${id}`) }
  async createInstance(data: Partial<Instance>) { return this.post<Instance>('/instances', data) }
  async updateInstance(id: string, data: Partial<Instance>) { return this.put<Instance>(`/instances/${id}`, data) }
  async deleteInstance(id: string) { return this.delete(`/instances/${id}`) }
  async startInstance(id: string) { return this.post<{ terminalSessionId?: string }>(`/instances/${id}/start`) }
  async stopInstance(id: string) { return this.post(`/instances/${id}/stop`) }
  async restartInstance(id: string) { return this.post(`/instances/${id}/restart`) }

  // Files
  async listFiles(path: string, page = 1, pageSize = 50) { return this.get<FileListResponse>('/files/list', { params: { path, page, pageSize } }) }
  async readFile(path: string) { return this.get<{ content: string; encoding?: string }>('/files/read', { params: { path } }) }
  async saveFile(path: string, content: string, encoding?: string) { return this.post('/files/save', { path, content, encoding }) }
  async deleteFile(path: string) { return this.post('/files/delete', { path }) }
  async createDirectory(path: string) { return this.post('/files/mkdir', { path }) }
  async renameFile(path: string, newPath: string) { return this.post('/files/rename', { path, newPath }) }
  async copyFile(path: string, destPath: string) { return this.post('/files/copy', { path, destPath }) }
  async moveFile(path: string, destPath: string) { return this.post('/files/move', { path, destPath }) }

  // System
  async getSystemStats() { return this.get<SystemStats>('/system/stats') }
  async getSystemInfo() { return this.get('/system/info') }

  // Archive
  async compressFile(path: string) { return this.post('/files/compress', { path }) }
  async extractFile(path: string, destPath?: string) { return this.post('/files/extract', { path, destPath }) }
}

export default new ApiClient()
