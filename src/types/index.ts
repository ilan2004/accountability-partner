// Database Types
export type TaskStatus = 'not_started' | 'in_progress' | 'done';
export type PriorityLevel = 'low' | 'medium' | 'high';
export type EffortLevel = 'low' | 'medium' | 'high';

// User Types
export interface User {
  id: string;
  name: string;
  notion_id: string;
  whatsapp_number: string | null;
  created_at: string;
}

// Task Types
export interface Task {
  id: string;
  user_id: string;
  task_name: string;
  description: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  effort_level: EffortLevel;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  task_name: string;
  description?: string;
  priority?: PriorityLevel;
  effort_level?: EffortLevel;
  due_date?: string;
}

export interface UpdateTaskRequest {
  task_name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: PriorityLevel;
  effort_level?: EffortLevel;
  due_date?: string;
}

// Settings Types
export interface UserSettings {
  id: string;
  user_id: string;
  reminder_time: string;
  summary_time: string;
  timezone: string;
}

export interface UpdateSettingsRequest {
  reminder_time?: string;
  summary_time?: string;
  timezone?: string;
}

// AI Types
export interface GeminiTaskParseResult {
  action: 'add_task' | 'complete_task' | 'update_task' | 'query_tasks' | 'ambiguous';
  task_name?: string;
  description?: string;
  due_date?: string;
  time?: string;
  priority?: PriorityLevel;
  effort_level?: EffortLevel;
  response_message: string;
  clarification_needed?: boolean;
  task_id?: string;
}

export interface DailyTaskSummary {
  user: User;
  tasks: Task[];
  completed_count: number;
  total_count: number;
  completion_rate: number;
}

export interface MorningMessageData {
  date: string;
  users_summaries: DailyTaskSummary[];
  missing_task_users: string[];
  formatted_message: string;
}

export interface EveningMessageData {
  date: string;
  users_summaries: DailyTaskSummary[];
  overall_completion_rate: number;
  motivational_message: string;
  formatted_message: string;
}

// WhatsApp Types
export interface WhatsAppMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  author?: string; // For group messages
}

export interface WhatsAppContact {
  id: string;
  name?: string;
  number: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Authentication Types
export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    notion_id?: string;
  };
}

// Cron Job Types
export interface CronJobStatus {
  id: string;
  name: string;
  schedule: string;
  last_run?: string;
  next_run?: string;
  status: 'active' | 'inactive' | 'error';
  error_message?: string;
}

// Environment Types
export interface EnvironmentConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  notion: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  gemini: {
    apiKey: string;
  };
  app: {
    url: string;
    jwtSecret: string;
    nodeEnv: string;
  };
  whatsapp: {
    sessionPath: string;
  };
}
