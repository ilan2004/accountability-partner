export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          notion_id: string
          whatsapp_number: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          notion_id: string
          whatsapp_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          notion_id?: string
          whatsapp_number?: string | null
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          task_name: string
          description: string | null
          status: 'not_started' | 'in_progress' | 'done'
          priority: 'low' | 'medium' | 'high'
          effort_level: 'low' | 'medium' | 'high'
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_name: string
          description?: string | null
          status?: 'not_started' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          effort_level?: 'low' | 'medium' | 'high'
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_name?: string
          description?: string | null
          status?: 'not_started' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          effort_level?: 'low' | 'medium' | 'high'
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          user_id: string
          reminder_time: string
          summary_time: string
          timezone: string
        }
        Insert: {
          id?: string
          user_id: string
          reminder_time?: string
          summary_time?: string
          timezone?: string
        }
        Update: {
          id?: string
          user_id?: string
          reminder_time?: string
          summary_time?: string
          timezone?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      task_status: 'not_started' | 'in_progress' | 'done'
      priority_level: 'low' | 'medium' | 'high'
      effort_level: 'low' | 'medium' | 'high'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
