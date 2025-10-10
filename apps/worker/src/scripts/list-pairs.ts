import { prisma } from '@accountability/db';

(async () => {
  const pairs = await prisma.pair.findMany({
    include: {
      user1: true,
      user2: true,
      notionConfig: true,
      settings: true,
    },
  });

  if (pairs.length === 0) {
    console.log('No pairs found.');
    process.exit(0);
  }

  for (const p of pairs) {
    console.log('Pair:', p.id);
    console.log('  user1:', p.user1?.name, p.user1?.email, `(id: ${p.user1?.id})`);
    console.log('  user2:', p.user2?.name, p.user2?.email, `(id: ${p.user2?.id})`);
    console.log('  notionConfig:', p.notionConfig ? 'yes' : 'no');
    console.log('  settings:', p.settings ? `jid=${p.settings.whatsappGroupJid ?? ''}` : 'no');
    console.log('---');
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
