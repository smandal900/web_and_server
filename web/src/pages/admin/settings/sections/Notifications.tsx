import { Button } from '../../../../components/ui/Button';
import { sendTestEmail } from '../../../../api/admin';
import { useRun } from '../../../../hooks/useRun';
import { t } from '../../../../i18n';
import { SchemaFields, type Field } from '../SchemaFields';
import { useSettings } from '../SettingsContext';

const on = (c: Record<string, any>) => !!c.notifications?.smtp?.enabled;

const fields: Field[] = [
  { path: 'notifications.smtp.enabled', type: 'switch', label: 'Send emails', help: 'Needed for album invitations and updates.' },
  { path: 'notifications.smtp.from', type: 'text', label: 'From address', when: on },
  { path: 'notifications.smtp.replyTo', type: 'text', label: 'Reply-to address', when: on },
  { path: 'notifications.smtp.transport.host', type: 'text', label: 'SMTP host', when: on },
  { path: 'notifications.smtp.transport.port', type: 'number', label: 'SMTP port', min: 1, max: 65535, when: on },
  { path: 'notifications.smtp.transport.username', type: 'text', label: 'Username', when: on },
  { path: 'notifications.smtp.transport.password', type: 'password', label: 'Password', when: on },
  { path: 'notifications.smtp.transport.secure', type: 'switch', label: 'Use TLS (secure)', when: on },
  { path: 'notifications.smtp.transport.ignoreCert', type: 'switch', label: 'Ignore certificate errors', when: on },
];

export default function Notifications() {
  const { config } = useSettings();
  const run = useRun();
  return (
    <div className="flex flex-col gap-4">
      <SchemaFields fields={fields} />
      {on(config) && (
        <div>
          <Button variant="outline" size="sm" onClick={() => run(() => sendTestEmail(config), { success: t('Test email sent') })}>
            {t('Send a test email')}
          </Button>
        </div>
      )}
    </div>
  );
}
