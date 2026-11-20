const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const KAYIT_KANALI = '1573274494179475587';

client.once('ready', () => {
  console.log(`${client.user.tag} ProLeague RP aktif!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.channel.id !== KAYIT_KANALI) {
    if (message.content.startsWith('.k ')) {
      return message.reply('❌ Bu komut sadece kayıt kanalında kullanılabilir.');
    }
    return;
  }

  if (message.content === '!ping') {
    message.reply('⚽ ProLeague RP çalışıyor!');
  }
});

client.login(process.env.DISCORD_TOKEN);
