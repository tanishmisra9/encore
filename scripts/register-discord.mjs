const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID || '1562884435278565416';
if (!token) throw new Error('Add DISCORD_BOT_TOKEN to .env before registering the command.');

const command = {
  name: 'encore',
  description: 'Plan where your group should go after a concert',
  type: 1,
  options: [
    { type: 3, name: 'artist', description: 'Who are you seeing?', required: true },
    { type: 3, name: 'venue', description: 'Where is the show?', required: true, choices: [
      { name: 'Brooklyn Steel', value: 'Brooklyn Steel' },
      { name: 'The Fillmore Philadelphia', value: 'The Fillmore Philadelphia' },
      { name: 'The Salt Shed', value: 'The Salt Shed' },
    ] },
    { type: 5, name: 'use_recent_chat', description: 'Read the latest 25 channel messages once to find stated preferences', required: false },
  ],
};
const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: 'PUT', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify([command]),
});
if (!response.ok) throw new Error(`Discord command registration failed (${response.status}): ${await response.text()}`);
console.log('Registered /encore');
