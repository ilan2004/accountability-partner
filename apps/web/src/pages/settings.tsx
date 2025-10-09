import { GetServerSidePropsContext } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Layout from '@/components/Layout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface Settings {
  timezone: string;
  warningTime: string;
  summaryTime: string;
  whatsappGroupJid: string;
  notificationTemplates: string;
}

interface NotionConfig {
  databaseId: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    timezone: 'Asia/Kolkata',
    warningTime: '20:00',
    summaryTime: '23:55',
    whatsappGroupJid: '',
    notificationTemplates: '{}',
  });
  const [notionConfig, setNotionConfig] = useState<NotionConfig>({
    databaseId: '',
  });
  const [templates, setTemplates] = useState({
    completed: '✅ {owner} completed: {task}\\nDue: {due}\\n🔗 {link}',
    created: '📝 {owner} created: {task}\\nDue: {due}',
    status_changed: '📊 {owner} updated: {task}\\nStatus: {previousStatus} → {newStatus}',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(settings.notificationTemplates || '{}');
      setTemplates({
        completed: parsed.completed || templates.completed,
        created: parsed.created || templates.created,
        status_changed: parsed.status_changed || templates.status_changed,
      });
    } catch (e) {
      // Invalid JSON, use defaults
    }
  }, [settings.notificationTemplates]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setNotionConfig(data.notionConfig);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: {
            ...settings,
            notificationTemplates: JSON.stringify(templates),
          },
          notionConfig,
        }),
      });

      if (res.ok) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Configure your accountability partner system</p>
        </div>

        <div className="space-y-8">
          {/* Notion Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Notion Configuration</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="databaseId" className="block text-sm font-medium text-gray-700">
                  Database ID
                </label>
                <input
                  type="text"
                  id="databaseId"
                  value={notionConfig.databaseId}
                  onChange={(e) => setNotionConfig({ ...notionConfig, databaseId: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Your Notion database ID"
                />
                <p className="mt-1 text-sm text-gray-500">
                  The ID of your shared Notion tasks database
                </p>
              </div>
            </div>
          </div>

          {/* WhatsApp Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">WhatsApp Configuration</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="groupJid" className="block text-sm font-medium text-gray-700">
                  Group JID
                </label>
                <input
                  type="text"
                  id="groupJid"
                  value={settings.whatsappGroupJid}
                  onChange={(e) => setSettings({ ...settings, whatsappGroupJid: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="123456789012345@g.us"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Your WhatsApp group ID (ends with @g.us)
                </p>
              </div>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Schedule Configuration</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                  Timezone
                </label>
                <select
                  id="timezone"
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="warningTime" className="block text-sm font-medium text-gray-700">
                    Daily Warning Time
                  </label>
                  <input
                    type="time"
                    id="warningTime"
                    value={settings.warningTime}
                    onChange={(e) => setSettings({ ...settings, warningTime: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    When to send daily task warnings
                  </p>
                </div>

                <div>
                  <label htmlFor="summaryTime" className="block text-sm font-medium text-gray-700">
                    Daily Summary Time
                  </label>
                  <input
                    type="time"
                    id="summaryTime"
                    value={settings.summaryTime}
                    onChange={(e) => setSettings({ ...settings, summaryTime: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    When to send daily summary
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Message Templates */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Message Templates</h2>
            <p className="text-sm text-gray-500 mb-4">
              Customize notification messages. Available variables: {'{owner}'}, {'{task}'}, {'{due}'}, {'{link}'}, {'{previousStatus}'}, {'{newStatus}'}
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="completedTemplate" className="block text-sm font-medium text-gray-700">
                  Task Completed
                </label>
                <textarea
                  id="completedTemplate"
                  value={templates.completed}
                  onChange={(e) => setTemplates({ ...templates, completed: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="createdTemplate" className="block text-sm font-medium text-gray-700">
                  Task Created
                </label>
                <textarea
                  id="createdTemplate"
                  value={templates.created}
                  onChange={(e) => setTemplates({ ...templates, created: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="statusChangedTemplate" className="block text-sm font-medium text-gray-700">
                  Status Changed
                </label>
                <textarea
                  id="statusChangedTemplate"
                  value={templates.status_changed}
                  onChange={(e) => setTemplates({ ...templates, status_changed: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
}
