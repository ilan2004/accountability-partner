'use client'

import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  User,
  UserSettings,
  UpdateSettingsRequest,
  ApiResponse,
  PaginatedResponse
} from '@/types'

class ApiService {
  private baseUrl = '/api'

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }
      
      return data
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error)
      throw error
    }
  }

  // Task API methods
  async getTasks(params?: {
    status?: string
    limit?: number
    offset?: number
  }): Promise<PaginatedResponse<Task>> {
    const searchParams = new URLSearchParams()
    
    if (params?.status) searchParams.append('status', params.status)
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.offset) searchParams.append('offset', params.offset.toString())
    
    const query = searchParams.toString()
    const endpoint = `/tasks${query ? `?${query}` : ''}`
    
    return this.request<Task[]>(endpoint)
  }

  async getTask(id: string): Promise<ApiResponse<Task>> {
    return this.request<Task>(`/tasks/${id}`)
  }

  async createTask(task: CreateTaskRequest): Promise<ApiResponse<Task>> {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  async updateTask(id: string, updates: UpdateTaskRequest): Promise<ApiResponse<Task>> {
    return this.request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteTask(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/tasks/${id}`, {
      method: 'DELETE',
    })
  }

  // Quick task status updates
  async markTaskAsCompleted(id: string): Promise<ApiResponse<Task>> {
    return this.updateTask(id, { status: 'done' })
  }

  async markTaskAsInProgress(id: string): Promise<ApiResponse<Task>> {
    return this.updateTask(id, { status: 'in_progress' })
  }

  async markTaskAsNotStarted(id: string): Promise<ApiResponse<Task>> {
    return this.updateTask(id, { status: 'not_started' })
  }

  // User API methods
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/users/me')
  }

  async updateCurrentUser(updates: { name?: string; whatsapp_number?: string }): Promise<ApiResponse<User>> {
    return this.request<User>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  // Settings API methods
  async getSettings(): Promise<ApiResponse<UserSettings>> {
    return this.request<UserSettings>('/settings')
  }

  async updateSettings(settings: UpdateSettingsRequest): Promise<ApiResponse<UserSettings>> {
    return this.request<UserSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }

  // Helper methods for common operations
  async getTodayTasks(): Promise<PaginatedResponse<Task>> {
    return this.getTasks({
      // This will get all tasks, we'll filter client-side or add a server endpoint for today's tasks
      limit: 100
    })
  }

  async getCompletedTasks(): Promise<PaginatedResponse<Task>> {
    return this.getTasks({ status: 'done' })
  }

  async getPendingTasks(): Promise<PaginatedResponse<Task>> {
    return this.getTasks({ status: 'not_started' })
  }

  async getInProgressTasks(): Promise<PaginatedResponse<Task>> {
    return this.getTasks({ status: 'in_progress' })
  }
}

// Create and export a singleton instance
export const apiService = new ApiService()

// Export the class for testing or custom instances
export { ApiService }
