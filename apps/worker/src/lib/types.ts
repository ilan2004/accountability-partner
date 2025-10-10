// Shared types for the Accountability Partner system

export interface Task {
  id: string;
  title: string;
  status: 'Todo' | 'In Progress' | 'Done';
  due: Date | null;
  owner: string;
  notionId: string;
  lastEditedTime: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Config {
  notion: {
    token: string;
    databaseId: string;
  };
  whatsapp: {
    groupJid: string;
  };
  timezone: string;
  schedule: {
    warningTime: string; // e.g., "20:00"
    summaryTime: string; // e.g., "23:55"
  };
}

export const DEFAULT_CONFIG = {
  timezone: 'Asia/Kolkata',
  schedule: {
    warningTime: '20:00',
    summaryTime: '23:55',
  },
} as const;
