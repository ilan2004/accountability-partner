import { QueryDatabaseResponse, PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// Notion property types based on the expected database schema
export interface NotionTaskProperties {
  Title: {
    type: 'title';
    title: Array<{
      type: 'text';
      text: { content: string };
    }>;
  };
  Status: {
    type: 'status';
    status: {
      name: 'Todo' | 'In Progress' | 'Done';
    } | null;
  };
  Due: {
    type: 'date';
    date: {
      start: string;
      end: string | null;
    } | null;
  };
  Owner: {
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
}

// Type guard to check if a page has our expected properties
export function isTaskPage(page: PageObjectResponse): page is PageObjectResponse & {
  properties: NotionTaskProperties;
} {
  const props = page.properties as any;
  return (
    props.Title?.type === 'title' &&
    props.Status?.type === 'status' &&
    props.Due?.type === 'date' &&
    props.Owner?.type === 'people'
  );
}

// Parsed task from Notion
export interface NotionTask {
  id: string;
  title: string;
  status: 'Todo' | 'In Progress' | 'Done';
  dueDate: Date | null;
  ownerNotionId: string | null;
  ownerName: string | null;
  lastEditedTime: Date;
  url: string;
}

// Configuration for Notion client
export interface NotionClientConfig {
  integrationToken: string;
  databaseId: string;
  rateLimitRetries?: number;
  rateLimitDelay?: number;
}
