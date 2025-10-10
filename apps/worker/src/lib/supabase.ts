/**
 * Supabase client for worker services
 * Uses service role key to bypass RLS for worker operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      User: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          notionId: string | null;
          emailVerified: string | null;
          image: string | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          notionId?: string | null;
          emailVerified?: string | null;
          image?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          notionId?: string | null;
          emailVerified?: string | null;
          image?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      Pair: {
        Row: {
          id: string;
          user1Id: string;
          user2Id: string;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          user1Id: string;
          user2Id: string;
          isActive?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          user1Id?: string;
          user2Id?: string;
          isActive?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      NotionConfig: {
        Row: {
          id: string;
          pairId: string;
          databaseId: string;
          integrationToken: string;
          lastSyncAt: string | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          pairId: string;
          databaseId: string;
          integrationToken: string;
          lastSyncAt?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          pairId?: string;
          databaseId?: string;
          integrationToken?: string;
          lastSyncAt?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      Settings: {
        Row: {
          id: string;
          pairId: string | null;
          userId: string | null;
          timezone: string;
          warningTime: string;
          summaryTime: string;
          whatsappGroupJid: string | null;
          notificationTemplates: string;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          pairId?: string | null;
          userId?: string | null;
          timezone?: string;
          warningTime?: string;
          summaryTime?: string;
          whatsappGroupJid?: string | null;
          notificationTemplates?: string;
          isActive?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          pairId?: string | null;
          userId?: string | null;
          timezone?: string;
          warningTime?: string;
          summaryTime?: string;
          whatsappGroupJid?: string | null;
          notificationTemplates?: string;
          isActive?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      TaskMirror: {
        Row: {
          id: string;
          notionId: string;
          title: string;
          status: string;
          dueDate: string | null;
          ownerId: string;
          lastEditedTime: string;
          notionUrl: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          notionId: string;
          title: string;
          status: string;
          dueDate?: string | null;
          ownerId: string;
          lastEditedTime: string;
          notionUrl: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          notionId?: string;
          title?: string;
          status?: string;
          dueDate?: string | null;
          ownerId?: string;
          lastEditedTime?: string;
          notionUrl?: string;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      TaskEvent: {
        Row: {
          id: string;
          taskMirrorId: string;
          eventType: string;
          previousStatus: string | null;
          newStatus: string;
          idempotencyKey: string;
          processedAt: string | null;
          createdAt: string;
        };
        Insert: {
          id?: string;
          taskMirrorId: string;
          eventType: string;
          previousStatus?: string | null;
          newStatus: string;
          idempotencyKey: string;
          processedAt?: string | null;
          createdAt?: string;
        };
        Update: {
          id?: string;
          taskMirrorId?: string;
          eventType?: string;
          previousStatus?: string | null;
          newStatus?: string;
          idempotencyKey?: string;
          processedAt?: string | null;
          createdAt?: string;
        };
      };
      Notification: {
        Row: {
          id: string;
          taskEventId: string;
          channel: string;
          status: string;
          sentAt: string | null;
          retryCount: number;
          lastError: string | null;
          messageId: string | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          taskEventId: string;
          channel: string;
          status: string;
          sentAt?: string | null;
          retryCount?: number;
          lastError?: string | null;
          messageId?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          taskEventId?: string;
          channel?: string;
          status?: string;
          sentAt?: string | null;
          retryCount?: number;
          lastError?: string | null;
          messageId?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
      };
    };
  };
}

// Singleton pattern for worker Supabase client
let supabaseClient: SupabaseClient<Database> | null = null;

export function createServiceClient(): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }

  supabaseClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

// Export a default instance for convenience
export const supabase = createServiceClient();

// Helper types for easier usage
export type UserRow = Database['public']['Tables']['User']['Row'];
export type UserInsert = Database['public']['Tables']['User']['Insert'];
export type UserUpdate = Database['public']['Tables']['User']['Update'];

export type PairRow = Database['public']['Tables']['Pair']['Row'];
export type PairInsert = Database['public']['Tables']['Pair']['Insert'];
export type PairUpdate = Database['public']['Tables']['Pair']['Update'];

export type NotionConfigRow = Database['public']['Tables']['NotionConfig']['Row'];
export type NotionConfigInsert = Database['public']['Tables']['NotionConfig']['Insert'];
export type NotionConfigUpdate = Database['public']['Tables']['NotionConfig']['Update'];

export type SettingsRow = Database['public']['Tables']['Settings']['Row'];
export type SettingsInsert = Database['public']['Tables']['Settings']['Insert'];
export type SettingsUpdate = Database['public']['Tables']['Settings']['Update'];

export type TaskMirrorRow = Database['public']['Tables']['TaskMirror']['Row'];
export type TaskMirrorInsert = Database['public']['Tables']['TaskMirror']['Insert'];
export type TaskMirrorUpdate = Database['public']['Tables']['TaskMirror']['Update'];

export type TaskEventRow = Database['public']['Tables']['TaskEvent']['Row'];
export type TaskEventInsert = Database['public']['Tables']['TaskEvent']['Insert'];
export type TaskEventUpdate = Database['public']['Tables']['TaskEvent']['Update'];

export type NotificationRow = Database['public']['Tables']['Notification']['Row'];
export type NotificationInsert = Database['public']['Tables']['Notification']['Insert'];
export type NotificationUpdate = Database['public']['Tables']['Notification']['Update'];

// Helper functions for common operations
export class SupabaseWorkerHelpers {
  static async findUserByNotionId(notionId: string): Promise<UserRow | null> {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('notionId', notionId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  static async findUserByName(name: string): Promise<UserRow | null> {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('name', name)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  static async findTaskMirrorByNotionId(notionId: string): Promise<TaskMirrorRow | null> {
    const { data, error } = await supabase
      .from('TaskMirror')
      .select('*')
      .eq('notionId', notionId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  static async findTaskEventByIdempotencyKey(key: string): Promise<TaskEventRow | null> {
    const { data, error } = await supabase
      .from('TaskEvent')
      .select('*')
      .eq('idempotencyKey', key)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  static async getNotionConfigByPairId(pairId: string): Promise<NotionConfigRow | null> {
    const { data, error } = await supabase
      .from('NotionConfig')
      .select('*')
      .eq('pairId', pairId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  static async getSettingsByPairId(pairId: string): Promise<SettingsRow | null> {
    const { data, error } = await supabase
      .from('Settings')
      .select('*')
      .eq('pairId', pairId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  static async getPairWithUsers(pairId: string) {
    const { data, error } = await supabase
      .from('Pair')
      .select(`
        *,
        user1:User!Pair_user1Id_fkey(*),
        user2:User!Pair_user2Id_fkey(*),
        settings:Settings(*)
      `)
      .eq('id', pairId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  static async getUnprocessedTaskEvents(limit = 10) {
    const { data, error } = await supabase
      .from('TaskEvent')
      .select(`
        *,
        taskMirror:TaskMirror(
          *,
          owner:User(*)
        )
      `)
      .is('processedAt', null)
      .order('createdAt', { ascending: true })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    return data || [];
  }

  static async getPendingNotificationByTaskEventId(taskEventId: string): Promise<NotificationRow | null> {
    const { data, error } = await supabase
      .from('Notification')
      .select('*')
      .eq('taskEventId', taskEventId)
      .eq('status', 'pending')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  static async getSentNotificationByTaskEventId(taskEventId: string): Promise<NotificationRow | null> {
    const { data, error } = await supabase
      .from('Notification')
      .select('*')
      .eq('taskEventId', taskEventId)
      .eq('status', 'sent')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }
}
