import { resolveLocation, sanitizeSession, signalsFor, vote, winner, type Member, type Session } from './core';
import { recommend, type EnvKeys } from './providers';

type DiscordEnv = EnvKeys & { DISCORD_PUBLIC_KEY?: string; DISCORD_BOT_TOKEN?: string; DISCORD_APPLICATION_ID?: string };
type Store = { read(id: string): Promise<Session | null>; insert(plan: Session): Promise<void>; update(old: Session, next: Session): Promise<boolean> };
type Interaction = { type: number; id: string; token: string; application_id: string; channel_id?: string; member?: { user: DiscordUser }; user?: DiscordUser; message?: { id: string }; data?: { name?: string; custom_id?: string; options?: Array<{ name: string; value: string | boolean }>; components?: Array<{ components?: Array<{ custom_id: string; value: string }> }> } };
type DiscordUser = { id: string; username: string; global_name?: string };
const reply = (type: number, data?: object) => Response.json(data ? { type, data } : { type });
const clip = (value: unknown, length: number) => typeof value === 'string' ? value.trim().slice(0, length) : '';
const bytes = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map(pair => parseInt(pair, 16)) || []);

async function verified(request: Request, key: string): Promise<string | null> {
  const signature = request.headers.get('X-Signature-Ed25519'), timestamp = request.headers.get('X-Signature-Timestamp');
  if (!signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature) || !/^[0-9a-f]{64}$/i.test(key)) return null;
  const body = await request.text();
  const publicKey = await crypto.subtle.importKey('raw', bytes(key), 'Ed25519', false, ['verify']);
  return await crypto.subtle.verify('Ed25519', publicKey, bytes(signature), new TextEncoder().encode(timestamp + body)) ? body : null;
}
async function discordApi(path: string, token: string, method = 'GET', body?: object): Promise<unknown> {
  const response = await fetch(`https://discord.com/api/v10${path}`, { method, headers: { Authorization: `Bot ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Discord API ${method} ${path} failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
async function editOriginal(interaction: Interaction, content: object): Promise<void> {
  const response = await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
  if (!response.ok) throw new Error(`Discord followup failed (${response.status})`);
}
function display(plan: Session): object {
  const counts = new Map<string, number>();
  for (const id of Object.values(plan.votes)) counts.set(id, (counts.get(id) || 0) + 1);
  const chosen = Object.keys(plan.votes).length ? winner(plan)?.id : undefined;
  const options = plan.options.map((option, index) => `${index + 1}. **${option.name}**${chosen === option.id ? ' 🏆' : ''} · ${option.distanceKm.toFixed(1)} km · ${counts.get(option.id) || 0} vote(s)\nGroup fit: ${option.reason}\nPractical: ${option.hours || 'Hours unconfirmed'}${option.price === undefined ? ' · Price unconfirmed' : ` · ~$${option.price}`}`).join('\n\n');
  const source = plan.source === 'qloo' ? 'Qloo taste graph' : 'Local fixture';
  const intro = `**Encore · ${plan.location.label}**\n${plan.request}\nSource: ${source} · Read ${plan.discord?.contextRead || 0} recent messages on request; retained ${plan.discord?.statements || 0} explicit signals. Raw chat was discarded.\nGroup: ${plan.members.length} people · radius ${plan.radiusKm} km${plan.budget ? ` · budget $${plan.budget}` : ''}`;
  const buttons = [...plan.options.map((option, index) => ({ type: 2, style: 1, label: `Vote ${index + 1}`, custom_id: `vote:${plan.id}:${option.id}` })), { type: 2, style: 2, label: 'Add my taste', custom_id: `taste:${plan.id}` }, { type: 2, style: 2, label: 'Replan', custom_id: `replan:${plan.id}` }];
  return { content: `${intro}\n\n${options || 'Encore needs one or more explicit group tastes before it can recommend a place.'}\n\nHours and availability must be confirmed before going.`, allowed_mentions: { parse: [] }, components: [{ type: 1, components: buttons.slice(0, 5) }] };
}
function modal(kind: 'taste' | 'replan', id: string, messageId: string): object {
  const input = (field: string, label: string, placeholder: string, required: boolean) => ({ type: 1, components: [{ type: 4, custom_id: field, label, style: 1, min_length: 1, max_length: 200, required, placeholder }] });
  return { custom_id: `${kind}:${id}:${messageId}`, title: kind === 'taste' ? 'Tell Encore your taste' : 'Change the plan', components: kind === 'taste' ? [input('tastes', 'What would make this a good night?', 'quiet jazz, late-night food', true)] : [input('note', 'What changed?', 'Quieter, under $35', true), input('budget', 'Max spend in dollars (optional)', '35', false), input('radius', 'Walking radius in km (optional)', '2', false)] };
}
function fields(interaction: Interaction): Record<string, string> { return Object.fromEntries((interaction.data?.components || []).flatMap(row => row.components || []).map(field => [field.custom_id, field.value])); }
async function contextMembers(channelId: string, token: string, enabled: boolean): Promise<{ members: Member[]; read: number; statements: number; budget?: number; radiusKm?: number }> {
  if (!enabled) return { members: [], read: 0, statements: 0 };
  const messages = await discordApi(`/channels/${channelId}/messages?limit=25`, token) as Array<{ author: { id: string; username: string; global_name?: string; bot?: boolean }; content?: string }>;
  const byId = new Map<string, Member>(); let statements = 0, budget: number | undefined, radiusKm: number | undefined;
  for (const message of messages.slice(0, 25)) {
    if (message.author.bot) continue;
    const content = clip(message.content, 300), explicit = content.match(/\b(?:I|we)\s+(?:like|love|prefer|want|need)\s+([^.!?\n]{3,60})/i);
    if (explicit) { const id = `discord-${message.author.id}`, existing = byId.get(id) || { id, name: clip(message.author.global_name || message.author.username, 40), tastes: [] }; if (existing.tastes.length < 3) existing.tastes.push(explicit[1].trim()); byId.set(id, existing); statements++; }
    const amount = content.match(/\b(?:budget|max|under)\s*\$?(\d{1,3})\b/i), walk = content.match(/\b(?:within|under)\s*(\d(?:\.\d)?)\s*km\b/i);
    if (amount) budget = Math.min(budget ?? Infinity, Number(amount[1]));
    if (walk) radiusKm = Math.min(radiusKm ?? Infinity, Number(walk[1]));
  }
  return { members: [...byId.values()].slice(0, 8), read: Math.min(messages.length, 25), statements, budget, radiusKm };
}
async function processCommand(interaction: Interaction, env: DiscordEnv, store: Store): Promise<void> {
  const options = Object.fromEntries((interaction.data?.options || []).map(option => [option.name, option.value]));
  const request = clip(options.ask, 300), location = resolveLocation(request);
  if (!request || !interaction.channel_id || !env.DISCORD_BOT_TOKEN) throw new Error('A request, channel, and bot token are required.');
  if (!location) return editOriginal(interaction, { content: 'Encore needs a neighborhood before it can plan. Try `/encore ask:"what should we do in Williamsburg tonight?"`.' });
  const context = await contextMembers(interaction.channel_id, env.DISCORD_BOT_TOKEN, options.use_recent_chat === true);
  if (!context.members.length) return editOriginal(interaction, { content: 'Encore needs one stated group taste. Start with `use_recent_chat:true`, or tell the group what each person wants before trying again.' });
  const plan: Session = { id: crypto.randomUUID(), request, location, members: context.members, signals: signalsFor(context.members), note: '', budget: context.budget, radiusKm: context.radiusKm || 2, options: [], votes: {}, source: 'qloo', createdAt: Date.now(), version: 0, discord: { channelId: interaction.channel_id, contextRead: context.read, statements: context.statements } };
  Object.assign(plan, await recommend(plan, env));
  await store.insert(plan); await editOriginal(interaction, display(plan));
}
async function updateMessage(interaction: Interaction, env: DiscordEnv, messageId: string, plan: Session): Promise<void> {
  if (!env.DISCORD_BOT_TOKEN || !plan.discord) throw new Error('Discord bot is not configured');
  await discordApi(`/channels/${plan.discord.channelId}/messages/${messageId}`, env.DISCORD_BOT_TOKEN, 'PATCH', display(plan));
  if (interaction.type === 5) await editOriginal(interaction, { content: 'Encore updated the group plan.' });
}
async function processChange(interaction: Interaction, env: DiscordEnv, store: Store, kind: string, id: string, value: string, messageId: string): Promise<void> {
  const old = await store.read(id); if (!old?.discord || old.discord.channelId !== interaction.channel_id) throw new Error('Plan expired or belongs to another channel.');
  const user = interaction.member?.user || interaction.user; if (!user) throw new Error('Discord user missing'); const memberId = `discord-${user.id}`;
  let next: Session;
  if (kind === 'vote') { const members = old.members.some(member => member.id === memberId) ? old.members : [...old.members, { id: memberId, name: clip(user.global_name || user.username, 40), tastes: [] }]; next = vote({ ...old, members }, memberId, value); }
  else if (kind === 'taste') { const tastes = fields(interaction).tastes?.split(',').map(item => clip(item, 60)).filter(Boolean).slice(0, 3) || []; if (!tastes.length) throw new Error('Add at least one taste.'); const members = [...old.members.filter(member => member.id !== memberId), { id: memberId, name: clip(user.global_name || user.username, 40), tastes }].slice(0, 8); next = { ...old, members, signals: signalsFor(members, old.note), votes: {}, version: old.version + 1 }; next = sanitizeSession({ ...next, ...await recommend(next, env) }); }
  else if (kind === 'replan') { const form = fields(interaction), budget = form.budget ? Number(form.budget) : old.budget, radiusKm = form.radius ? Number(form.radius) : old.radiusKm; if ((budget !== undefined && (!Number.isFinite(budget) || budget < 1 || budget > 500)) || !Number.isFinite(radiusKm) || radiusKm < 0.1 || radiusKm > 10) throw new Error('Budget or radius is outside the supported range.'); next = { ...old, note: clip(form.note, 200), budget, radiusKm, signals: signalsFor(old.members, clip(form.note, 200)), votes: {}, version: old.version + 1 }; next = { ...next, ...await recommend(next, env) }; }
  else throw new Error('Unknown action');
  if (!await store.update(old, next)) throw new Error('Plan changed. Please try again.'); await updateMessage(interaction, env, messageId, next);
}
export async function handleDiscord(request: Request, env: DiscordEnv, ctx: ExecutionContext, store: Store): Promise<Response> {
  if (!env.DISCORD_PUBLIC_KEY) return new Response('Discord is not configured', { status: 503 });
  const raw = await verified(request, env.DISCORD_PUBLIC_KEY); if (raw === null) return new Response('Invalid signature', { status: 401 });
  const interaction = JSON.parse(raw) as Interaction; if (interaction.type === 1) return reply(1);
  if (interaction.type === 2 && interaction.data?.name === 'encore') { ctx.waitUntil(processCommand(interaction, env, store).catch(error => editOriginal(interaction, { content: `Encore could not start: ${error instanceof Error ? error.message : 'unknown error'}` }))); return reply(5); }
  const [kind, id, value] = (interaction.data?.custom_id || '').split(':');
  if (interaction.type === 3 && (kind === 'taste' || kind === 'replan') && interaction.message?.id) return reply(9, modal(kind, id, interaction.message.id));
  if (interaction.type === 3 && kind === 'vote' && interaction.message?.id) { ctx.waitUntil(processChange(interaction, env, store, kind, id, value, interaction.message.id).catch(console.error)); return reply(6); }
  if (interaction.type === 5 && (kind === 'taste' || kind === 'replan')) { ctx.waitUntil(processChange(interaction, env, store, kind, id, '', value).catch(error => editOriginal(interaction, { content: `Encore could not update: ${error instanceof Error ? error.message : 'unknown error'}` }))); return reply(5, { flags: 64 }); }
  return reply(4, { content: 'Unknown Encore action.', flags: 64 });
}
