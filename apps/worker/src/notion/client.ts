import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import pino from 'pino';
import { NotionClientConfig, NotionTask, isTaskPage, NotionTaskProperties } from './types';

const logger = pino({ name: 'notion-client' });

export class NotionClient {
  private client: Client;
  private databaseId: string;
  private rateLimitRetries: number;
  private rateLimitDelay: number;

  constructor(config: NotionClientConfig) {
    this.client = new Client({
      auth: config.integrationToken,
    });
    this.databaseId = config.databaseId;
    this.rateLimitRetries = config.rateLimitRetries || 3;
    this.rateLimitDelay = config.rateLimitDelay || 1000;
  }

  /**
   * Fetch all tasks from the Notion database
   */
  async fetchAllTasks(): Promise<NotionTask[]> {
    logger.info('Fetching all tasks from Notion');
    const tasks: NotionTask[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const response = await this.queryDatabaseWithRetry({
        start_cursor: startCursor,
      });

      const pageTasks = response.results
        .filter((page): page is PageObjectResponse => 'properties' in page)
        .filter(isTaskPage)
        .map(page => this.parseTask(page));

      tasks.push(...pageTasks);

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    logger.info(`Fetched ${tasks.length} tasks from Notion`);
    return tasks;
  }

  /**
   * Fetch tasks modified since a specific time
   */
  async fetchTasksSince(since: Date): Promise<NotionTask[]> {
    logger.info(`Fetching tasks modified since ${since.toISOString()}`);
    const tasks: NotionTask[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const response = await this.queryDatabaseWithRetry({
        start_cursor: startCursor,
        filter: {
          timestamp: 'last_edited_time',
          last_edited_time: {
            after: since.toISOString(),
          },
        },
        sorts: [
          {
            timestamp: 'last_edited_time',
            direction: 'ascending',
          },
        ],
      });

      const pageTasks = response.results
        .filter((page): page is PageObjectResponse => 'properties' in page)
        .filter(isTaskPage)
        .map(page => this.parseTask(page));

      tasks.push(...pageTasks);

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    logger.info(`Fetched ${tasks.length} tasks modified since ${since.toISOString()}`);
    return tasks;
  }

  /**
   * Parse a Notion page into our TaskMirror format
   */
  private parseTask(page: PageObjectResponse & { properties: NotionTaskProperties }): NotionTask {
    const props = page.properties as Partial<NotionTaskProperties> as any;

    // Extract title from 'Task name' property
    const title = props['Task name']?.title
      ?.map((text: any) => text.text.content)
      .join('') || 'Untitled';

    // Extract status (map to our expected values)
    const status = (props.Status as any)?.status?.name || 'Not started';

    // Extract due date from 'Due date' property (optional)
    const dueDate = (props['Due date'] as any)?.date ? new Date((props['Due date'] as any).date.start) : null;

    // Extract owner from 'Assignee' property (optional)
    const owner = (props.Assignee as any)?.people?.[0];
    const ownerNotionId = owner?.id || null;
    const ownerName = owner?.name || null;

    // Extract additional fields (optional)
    const priority = (props.Priority as any)?.select?.name || undefined;
    const description = (props.Description as any)?.rich_text
      ?.map((text: any) => text.text.content)
      .join('') || undefined;
    const effortLevel = (props['Effort level'] as any)?.select?.name || undefined;
    const taskTypes = (props['Task type'] as any)?.multi_select?.map((item: any) => item.name) || undefined;

    // Last edited time
    const lastEditedTime = new Date(page.last_edited_time);

    // Construct URL
    const url = `https://notion.so/${page.id.replace(/-/g, '')}`;

    return {
      id: page.id,
      title,
      status,
      dueDate,
      ownerNotionId,
      ownerName,
      lastEditedTime,
      url,
      priority,
      description,
      effortLevel,
      taskTypes,
    };
  }

  /**
   * Query database with exponential backoff for rate limiting
   */
  private async queryDatabaseWithRetry(params: any, attempt = 0): Promise<any> {
    try {
      return await this.client.databases.query({
        database_id: this.databaseId,
        ...params,
      });
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error.code === 'rate_limited' && attempt < this.rateLimitRetries) {
        const delay = this.rateLimitDelay * Math.pow(2, attempt);
        logger.warn(
          `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${this.rateLimitRetries})`
        );
        await this.sleep(delay);
        return this.queryDatabaseWithRetry(params, attempt + 1);
      }

      // Log and re-throw other errors
      logger.error({ error }, 'Failed to query Notion database');
      throw error;
    }
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get users (people) from the database
   */
  async fetchUsers(): Promise<Array<{ id: string; name: string; email?: string }>> {
    logger.info('Fetching users from Notion database');
    
    try {
      // First, we need to get the database to find the Owner property
      const database = await this.client.databases.retrieve({
        database_id: this.databaseId,
      });

      // Extract people from the Owner property
      const ownerProperty = (database as any).properties?.Owner;
      if (!ownerProperty || ownerProperty.type !== 'people') {
        logger.warn('No Owner property found in database');
        return [];
      }

      // Note: The Notion API doesn't provide a direct way to list all people
      // We'll need to extract them from tasks or use a different approach
      logger.info('User fetching from property configuration is limited in Notion API');
      return [];
    } catch (error) {
      logger.error({ error }, 'Failed to fetch users from Notion');
      throw error;
    }
  }

  /**
   * Fetch a single task by Notion page ID
   */
  async fetchTaskById(pageId: string): Promise<NotionTask | null> {
    try {
      const page = await (this.client as any).pages.retrieve({ page_id: pageId });
      if (!('properties' in page)) return null;
      if (!isTaskPage(page as any)) return null;
      return this.parseTask(page as any);
    } catch (error) {
      logger.error({ error, pageId }, 'Failed to fetch Notion task by ID');
      return null;
    }
  }
}
