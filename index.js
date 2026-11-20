const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const FILE = './players.json';
const KAYIT_KANALI = '1573274494179475587';

let players = {};

if (fs.existsSync(FILE)) {
  players = JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

client.once('ready', () => {
  console.log(`${client.user.tag} ProLeague RP aktif!`);
});

client.on('guildMemberAdd', async (member) => {
  const role = member.guild.roles.cache.find(
    r => r.name === '⏳ Kayıtsız'
  );

  if (role) {
    await member.roles.add(role).catch(console.error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === '!ping') {
    return message.reply('⚽ ProLeague RP çalışıyor!');
  }

  if (!message.content.startsWith('.k ')) return;

  if (message.channel.id !== KAYIT_KANALI) {
    return message.reply('❌ Bu komut sadece kayıt kanalında kullanılabilir.');
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Sadece yöneticiler kayıt yapabilir.');
  }

  const args = message.content.trim().split(/\s+/);
  const member = message.mentions.members.first();

  if (!member) {
    return message.reply('❌ Kullanım: `.k @oyuncu 1m`');
  }

  const match = (args[2] || '1m').match(/^(\d+(?:[.,]\d+)?)\s*(m|k)?$/i);

  if (!match) {
    return message.reply('❌ Değer hatalı! Örnek: `.k @oyuncu 1m`');
  }

  const value = `${match[1].replace(',', '.')}${(match[2] || 'm').toUpperCase()}€`;

  const registeredRole = message.guild.roles.cache.find(
    r => r.name === '✅ Kayıtlı Üye'
  );

  const unregisteredRole = message.guild.roles.cache.find(
    r => r.name === '⏳ Kayıtsız'
  );

  if (!registeredRole || !unregisteredRole) {
    return message.reply('❌ Kayıt rolleri bulunamadı!');
  }

  if (member.roles.cache.has(registeredRole.id)) {
    return message.reply('⚠️ Bu oyuncu zaten kayıtlı!');
  }

  try {
    await member.roles.add(registeredRole);
    await member.roles.remove(unregisteredRole);

    players[member.id] = {
      name: member.user.username,
      value: value,
      team: null
    };

    fs.writeFileSync(FILE, JSON.stringify(players, null, 2));

    message.reply(`✅ ${member} kaydedildi!\n💰 Değer: **${value}**`);
  } catch (error) {
    console.error(error);
    message.reply('❌ Kayıt başarısız! Botun rol izinlerini kontrol edin.');
  }
});

client.login(process.env.DISCORD_TOKEN);
