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

// Sunucuya yeni giren üyeye otomatik Kayıtsız rolü ver
client.on('guildMemberAdd', async (member) => {
  const role = member.guild.roles.cache.find(
    r => r.name === '⏳ Kayıtsız'
  );

  if (!role) {
    console.log('Kayıtsız rolü bulunamadı!');
    return;
  }

  try {
    await member.roles.add(role);
    console.log(`${member.user.username} kayıtsız olarak eklendi.`);
  } catch (error) {
    console.error('Rol verilemedi:', error);
  }
});

// Oyuncu kayıt sistemi
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  if (!message.content.startsWith('.k ')) return;

  if (!message.channel.name.includes('kayıt-ol')) {
    return message.reply('❌ Bu komut sadece kayıt kanalında kullanılabilir.');
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');
  }

  const member = message.mentions.members.first();

  if (!member) {
    return message.reply('❌ Kullanım: `.k @oyuncu 1m`');
  }

  const registeredRole = message.guild.roles.cache.find(
    r => r.name === '✅ Kayıtlı Üye'
  );

  const unregisteredRole = message.guild.roles.cache.find(
    r => r.name === '⏳ Kayıtsız'
  );

  if (!registeredRole || !unregisteredRole) {
    return message.reply('❌ Kayıt veya Kayıtsız rolü bulunamadı!');
  }

  if (member.roles.cache.has(registeredRole.id)) {
    return message.reply('⚠️ Bu oyuncu zaten kayıtlı!');
  }

  try {
    await member.roles.add(registeredRole);
    await member.roles.remove(unregisteredRole);

    players[member.id] = {
      name: member.user.username,
      value: '1M€',
      team: null
    };

    fs.writeFileSync(FILE, JSON.stringify(players, null, 2));

    message.reply(
      `✅ ${member} başarıyla kaydedildi!\n💰 Başlangıç değeri: **1M€**`
    );
  } catch (error) {
    console.error(error);
    message.reply('❌ Kayıt başarısız! Botun rol izinlerini kontrol edin.');
  }
});

client.login(process.env.DISCORD_TOKEN);
