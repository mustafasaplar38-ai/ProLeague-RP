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

  if (!role) return;

  try {
    await member.roles.add(role);
  } catch (error) {
    console.error(error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith('.k ')) return;

  if (message.channel.name !== 'kayıt-ol') {
    return message.reply('❌ Bu komut sadece kayıt kanalında kullanılabilir.');
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');
  }

  const member = message.mentions.members.first();

  if (!member) {
    return message.reply('❌ Kullanım: `.k @oyuncu Messi | 🇦🇷 | SĞK | 1M€`');
  }

  const details = message.content
    .replace(/^\.k\s+<@!?\d+>\s*/, '')
    .trim();

  if (!details || details.length > 32) {
    return message.reply('❌ Oyuncu bilgisi boş olamaz ve 32 karakteri geçemez.');
  }

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
    await member.setNickname(details);

    players[member.id] = {
      name: details,
      value: details.split('|').pop().trim(),
      team: null
    };

    fs.writeFileSync(FILE, JSON.stringify(players, null, 2));

    message.reply(
      `✅ ${member} başarıyla kaydedildi!\n⚽ Oyuncu: **${details}**`
    );

  } catch (error) {
    console.error(error);
    message.reply('❌ Kayıt başarısız! Botun rol ve takma ad izinlerini kontrol edin.');
  }
});

client.login(process.env.DISCORD_TOKEN);
