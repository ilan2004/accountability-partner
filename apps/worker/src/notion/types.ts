import { QueryDatabaseResponse, PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// Notion property types based on the user's existing database schema
export interface NotionTaskProperties {
  'Task name': {
    type: 'title';
    title: Array<{
      type: 'text';
      text: { content: string };
    }>;
  };
  Status: {
    type: 'status';
    status: {
      name: 'Not started' | 'In progress' | 'Done';
    } | null;
  };
  'Due date'?: {
    type: 'date';
    date: {
      start: string;
      end: string | null;
    } | null;
  };
  Assignee?: {
    type: 'people';
    people: Array<{
      id: string;
      name?: string;
      avatar_url?: string | null;
      type?: 'person';
      person?: {
        email?: string;
      };
    }>;
  };
  Priority?: {
    type: 'select';
    select: {
      name: 'High' | 'Medium' | 'Low';
    } | null;
  };
  Description?: {
    type: 'rich_text';
    rich_text: Array<{
      type: 'text';
      text: { content: string };
    }>;
  };
  'Effort level'?: {
    type: 'select';
    select: {
      name: 'Small' | 'Medium' | 'Large';
    } | null;
  };
  'Task type'?: {
    type: 'multi_select';
    multi_select: Array<{
      name: '🐞 Bug' | '💬 Feature request' | '💅 Polish';
    }>;
  };
}

// Type guard to check if a page has our expected properties (more permissive)
export function isTaskPage(page: PageObjectResponse): page is PageObjectResponse & {
  properties: NotionTaskProperties;
} {
  const props = page.properties as any;
  return (
    props['Task name']?.type === 'title' &&
    props.Status?.type === 'status'
  );
}

// Parsed task from Notion
export interface NotionTask {
  id: string;
  title: string;
  status: 'Not started' | 'In progress' | 'Done';
  dueDate: Date | null;
  ownerNotionId: string | null;
  ownerName: string | null;
  lastEditedTime: Date;
  url: string;
  // Additional fields from user's database
  priority?: 'High' | 'Medium' | 'Low';
  description?: string;
  effortLevel?: 'Small' | 'Medium' | 'Large';
  taskTypes?: string[];
}

// Configuration for Notion client
export interface NotionClientConfig {
  integrationToken: string;
  databaseId: string;
  rateLimitRetries?: number;
  rateLimitDelay?: number;
}
