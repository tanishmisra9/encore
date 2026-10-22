import process from 'node:process';
const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID || '1562884435278565416';
if (!token) throw new Error('DISCORD_BOT_TOKEN is required.');
const command = {
  name: 'encore',
  description: 'Turn group chat taste into a local plan.',
  options: [
    { type: 3, name: 'ask', description: 'What should your group do nearby?', required: true },
    { type: 5, name: 'use_recent_chat', description: 'Read the latest 25 channel messages once for stated preferences', required: false },
  ],
};
const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, { method: 'PUT', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify([command]) });
if (!response.ok) throw new Error(`Discord command registration failed (${response.status}): ${await response.text()}`);
console.log('Registered Encore command.');
