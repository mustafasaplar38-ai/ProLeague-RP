require('dotenv').config();

const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

const PREFIX = '.';

const CONFIG = {
  kayitKanal: '1573274494179475587',
  antKanal: '1573153141757841449',
  penKanal: '1573153187358052422',
  kapKanal: '1573865156570521740',
  kayitsizRol: '⏳ Kayıtsız',
  kayitliRol: '✅ Kayıtlı Üye',
  kayitYetkilisi: 'Kayıt Yetkilisi',
  degerYetkilisi: 'Değer Yetkilisi',
  teknikDirektor: 'Teknik Direktör'
};

const DB_FILE = './proleague-data.json';

let db = {
  players: {},
  wallets: {},
  training: {},
  messageStats: {},
  voiceStats: {},
  fixtures: [],
  matches: {},
  quiz: null,
  autoRole: null
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch (e) {
    console.log('Veri dosyası okunamadı, yeni veri dosyası oluşturulacak.');
  }
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function money(value) {
  return Number(value || 0).toLocaleString('tr-TR') + '€';
}

function parseMoney(value) {
  if (!value) return 0;
  const text = value.toUpperCase().replace(/€/g, '').replace(/\s/g, '');
  const number = parseFloat(text.replace(',', '.'));
  if (!Number.isFinite(number)) return 0;
  if (text.endsWith('M')) return number * 1000000;
  if (text.endsWith('K')) return number * 1000;
  return number;
}

function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function hasRole(member, roleName) {
  return member.roles.cache.some(r => r.name === roleName);
}

function getPlayer(id) {
  if (!db.players[id]) {
    db.players[id] = {
      name: 'Oyuncu',
      flag: '🇹🇷',
      position: 'STP',
      value: 1000000,
      goals: 0,
      assists: 0,
      matches: 0,
      yellow: 0,
      red: 0,
      training: 0,
      penaltyGoals: 0
    };
  }
  return db.players[id];
}

function getWallet(id) {
  if (db.wallets[id] === undefined) db.wallets[id] = 100000000;
  return db.wallets[id];
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function findTeam(guild, name) {
  return guild.roles.cache.find(
    r => r.name.toLowerCase().includes(name.toLowerCase())
  );
}

function getTeamPlayers(guild, role) {
  return guild.members.cache.filter(m => m.roles.cache.has(role.id));
}

function playerName(guild, id) {
  return guild.members.cache.get(id)?.displayName || 'Oyuncu';
}

function getStandings(guild) {
  const table = {};

  for (const role of guild.roles.cache.values()) {
    if (
      role.name.includes('Galatasaray') ||
      role.name.includes('Fenerbahçe') ||
      role.name.includes('Real Madrid') ||
      role.name.includes('Barcelona') ||
      role.name.includes('Arsenal') ||
      role.name.includes('Manchester')
    ) {
      table[role.name] = table[role.name] || {
        O: 0, G: 0, B: 0, M: 0, AG: 0, YG: 0, P: 0
      };
    }
  }

  for (const match of Object.values(db.matches)) {
    if (!match.finished) continue;

    const a = table[match.teamA];
    const b = table[match.teamB];
    if (!a || !b) continue;

    a.O++;
    b.O++;
    a.AG += match.scoreA;
    a.YG += match.scoreB;
    b.AG += match.scoreB;
    b.YG += match.scoreA;

    if (match.scoreA > match.scoreB) {
      a.G++;
      a.P += 3;
      b.M++;
    } else if (match.scoreB > match.scoreA) {
      b.G++;
      b.P += 3;
      a.M++;
    } else {
      a.B++;
      b.B++;
      a.P++;
      b.P++;
    }
  }

  return Object.entries(table).sort((a, b) => b[1].P - a[1].P);
}

client.once('ready', () => {
  console.log(`${client.user.tag} hazır.`);
  client.user.setActivity('ProLeague RP');
});

client.on('guildMemberAdd', async member => {
  const role = member.guild.roles.cache.find(
    r => r.name === CONFIG.kayitsizRol
  );

  if (role) {
    await member.roles.add(role).catch(() => {});
  }
});

client.on('guildMemberAdd', async member => {
  if (!db.autoRole) return;
  const role = member.guild.roles.cache.get(db.autoRole);
  if (role) await member.roles.add(role).catch(() => {});
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const id = message.author.id;
  const player = getPlayer(id);

  db.messageStats[id] = (db.messageStats[id] || 0) + 1;
  save();

  if (db.quiz && !db.quiz.ended) {
    if (
      message.content.trim().toLowerCase() ===
      db.quiz.answer.toLowerCase()
    ) {
      db.quiz.ended = true;
      clearTimeout(db.quiz.timer);

      const reward = db.quiz.reward;
      db.wallets[id] = getWallet(id) + reward;
      save();

      await message.channel.send(
        `🏆 ${message.author} doğru cevabı buldu!\n` +
        `💰 Ödül: ${money(reward)}`
      );
    }
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  const member = message.member;
  const admin = isAdmin(member);

  try {

    // YARDIM
    if (command === 'yardım' || command === 'help') {
      return message.reply(
        '**⚽ PROLEAGUE RP KOMUTLARI**\n\n' +
        '**Kayıt:** `.k @oyuncu İsim | 🇹🇷 | STP | 5M€`\n' +
        '**Değer:** `.değerver @oyuncu 5M`\n' +
        '**Oyuncu:** `.kariyer @oyuncu` `.ara isim`\n' +
        '**Takım:** `.takim Galatasaray`\n' +
        '**Ekonomi:** `.bal` `.deposit miktar` `.withdraw miktar`\n' +
        '**Antrenman:** `.ant` `.pen`\n' +
        '**Quiz:** `.quiz`\n' +
        '**Maç:** `.başlat Takım A | Takım B` `.durdur` `.maçı bitir`\n' +
        '**Lig:** `.fiksür` `.puandurum`\n' +
        '**Yönetim:** `.rolver` `.rolal` `.sil` `.lock` `.unlock`\n' +
        '**Diğer:** `.m` `.ses` `.kap`'
      );
    }

    // KAYIT
    if (command === 'k') {
      if (message.channel.id !== CONFIG.kayitKanal) {
        return message.reply('Bu komut sadece kayıt kanalında kullanılabilir.');
      }

      if (!admin && !hasRole(member, CONFIG.kayitYetkilisi)) {
        return message.reply('Bu komut için Kayıt Yetkilisi olmalısın.');
      }

      const target = message.mentions.members.first();
      const raw = args.slice(1).join(' ');
      const parts = raw.split('|').map(x => x.trim());

      if (!target || parts.length < 4) {
        return message.reply(
          'Kullanım: `.k @oyuncu İsim | 🇹🇷 | STP | 5M€`'
        );
      }

      const [name, flag, position, valueText] = parts;
      const value = parseMoney(valueText);

      if (!name || !position || value <= 0) {
        return message.reply('Bilgileri doğru girmelisin.');
      }

      const p = getPlayer(target.id);
      p.name = name;
      p.flag = flag;
      p.position = position.toUpperCase();
      p.value = value;

      const registered = message.guild.roles.cache.find(
        r => r.name === CONFIG.kayitliRol
      );
      const unregistered = message.guild.roles.cache.find(
        r => r.name === CONFIG.kayitsizRol
      );

      if (unregistered) await target.roles.remove(unregistered).catch(() => {});
      if (registered) await target.roles.add(registered).catch(() => {});

      await target.setNickname(
        `${name} | ${flag} | ${position} | ${money(value)}`
      ).catch(() => {});

      save();
      return message.reply(`✅ ${target} başarıyla kaydedildi.`);
    }

    // DEĞER VER
    if (command === 'değerver') {
      if (!admin && !hasRole(member, CONFIG.degerYetkilisi)) {
        return message.reply('Bu komut için Değer Yetkilisi olmalısın.');
      }

      const target = message.mentions.members.first();
      const amount = parseMoney(args[1]);

      if (!target || amount <= 0) {
        return message.reply('Kullanım: `.değerver @oyuncu 5M`');
      }

      const p = getPlayer(target.id);
      p.value += amount;

      await target.setNickname(
        `${p.name} | ${p.flag} | ${p.position} | ${money(p.value)}`
      ).catch(() => {});

      save();
      return message.reply(
        `✅ ${target} oyuncusuna ${money(amount)} eklendi.\n` +
        `Yeni değer: **${money(p.value)}**`
      );
    }

    // KARİYER
    if (command === 'kariyer') {
      const target = message.mentions.users.first() || message.author;
      const p = getPlayer(target.id);

      return message.reply(
        `**⚽ ${p.name} - Kariyer**\n` +
        `Mevki: ${p.position}\n` +
        `Değer: ${money(p.value)}\n` +
        `Maç: ${p.matches}\n` +
        `Gol: ${p.goals}\n` +
        `Asist: ${p.assists}\n` +
        `Sarı kart: ${p.yellow}\n` +
        `Kırmızı kart: ${p.red}\n` +
        `Antrenman: ${p.training}/10`
      );
    }

    // OYUNCU ARA
    if (command === 'ara') {
      const search = args.join(' ').toLowerCase();
      if (!search) return message.reply('Bir oyuncu adı yazmalısın.');

      const results = Object.entries(db.players)
        .filter(([id, p]) =>
          p.name.toLowerCase().includes(search) ||
          playerName(message.guild, id).toLowerCase().includes(search)
        )
        .slice(0, 10);

      if (!results.length) return message.reply('Sonuç bulunamadı.');

      return message.reply(
        results.map(([id, p]) =>
          `• ${playerName(message.guild, id)} — ${p.position} — ${money(p.value)}`
        ).join('\n')
      );
    }

    // TAKIM LİSTESİ
    if (command === 'takim') {
      const teamName = args.join(' ');
      if (!teamName) return message.reply('Örnek: `.takim Galatasaray`');

      const role = findTeam(message.guild, teamName);
      if (!role) return message.reply('Bu takımın rolü bulunamadı.');

      const players = getTeamPlayers(message.guild, role);

      return message.reply(
        `**${role.name} Kadrosu**\n` +
        (players.size
          ? players.map(m => `• ${m.displayName}`).join('\n')
          : 'Henüz kadroda oyuncu yok.')
      );
    }

    // BAKİYE
    if (command === 'bal') {
      return message.reply(`💰 Bakiyen: **${money(getWallet(id))}**`);
    }

    if (command === 'deposit' || command === 'yatır') {
      const amount = parseMoney(args[0]);
      if (amount <= 0) return message.reply('Geçerli bir miktar yaz.');

      const balance = getWallet(id);
      if (amount > balance) return message.reply('Yeterli bakiyen yok.');

      db.wallets[id] = balance - amount;
      save();
      return message.reply(`${money(amount)} yatırıldı.`);
    }

    if (command === 'withdraw' || command === 'çek') {
      const amount = parseMoney(args[0]);
      if (amount <= 0) return message.reply('Geçerli bir miktar yaz.');

      db.wallets[id] = getWallet(id) + amount;
      save();
      return message.reply(`${money(amount)} çekildi.`);
    }

    // ANTRENMAN
    if (command === 'ant') {
      if (message.channel.id !== CONFIG.antKanal) {
        return message.reply('Antrenman kanalında kullanabilirsin.');
      }

      const p = getPlayer(id);
      p.training++;

      if (p.training >= 10) {
        p.training = 0;
        p.value += 2000000;

        save();
        return message.reply(
          `🏋️ Antrenman tamamlandı!\n` +
          `Oyuncu değerine **2M€** eklendi.\n` +
          `Yeni değer: ${money(p.value)}`
        );
      }

      save();
      return message.reply(`🏋️ Antrenman ilerlemesi: **${p.training}/10**`);
    }

    // PENALTI
    if (command === 'pen') {
      if (message.channel.id !== CONFIG.penKanal) {
        return message.reply('Penaltı kanalında kullanabilirsin.');
      }

      const result = randomItem(['GOOOL!', 'Kaleci kurtardı!', 'Dışarı gitti!', 'Direkten döndü!']);

      if (result === 'GOOOL!') {
        const p = getPlayer(id);
        p.value += 3000000;
        p.penaltyGoals++;
        save();
        return message.reply(`⚽ ${result} +3M€ oyuncu değeri kazandın!`);
      }

      return message.reply(`🥅 ${result}`);
    }

    // QUIZ
    if (command === 'quiz') {
      if (db.quiz && !db.quiz.ended) {
        return message.reply('Zaten devam eden bir quiz var.');
      }

      const questions = [
        { q: 'Dünya Kupası tarihinde en çok şampiyon olan ülke hangisidir?', a: 'Brezilya', reward: 5000000 },
        { q: 'Cristiano Ronaldo hangi ülkedendir?', a: 'Portekiz', reward: 3000000 },
        { q: 'Lionel Messi hangi ülkedendir?', a: 'Arjantin', reward: 3000000 },
        { q: 'UEFA Şampiyonlar Ligi kupasını en çok kazanan takım hangisidir?', a: 'Real Madrid', reward: 5000000 },
        { q: '2022 Dünya Kupasını hangi ülke kazandı?', a: 'Arjantin', reward: 3000000 }
      ];

      const q = randomItem(questions);
      db.quiz = {
        answer: q.a,
        reward: q.reward,
        ended: false
      };

      db.quiz.timer = setTimeout(() => {
        if (db.quiz && !db.quiz.ended) {
          db.quiz.ended = true;
          message.channel.send(`⏰ Quiz süresi bitti! Cevap: **${q.a}**`);
        }
      }, 300000);

      return message.channel.send(
        `🧠 **PROLEAGUE QUIZ**\n\n` +
        `${q.q}\n\n` +
        `💰 Ödül: **${money(q.reward)}**\n` +
        `⏱️ Süre: 5 dakika\n` +
        `İlk doğru cevap kazanır!`
      );
    }

    // ROL VER
    if (command === 'rolver') {
      if (!admin) return message.reply('Bu komut sadece yöneticilere açık.');

      const target = message.mentions.members.first();
      const role = message.mentions.roles.first();

      if (!target || !role) {
        return message.reply('Kullanım: `.rolver @oyuncu @rol`');
      }

      await target.roles.add(role);
      return message.reply('✅ Rol verildi.');
    }

    // ROL AL
    if (command === 'rolal') {
      if (!admin) return message.reply('Bu komut sadece yöneticilere açık.');

      const target = message.mentions.members.first();
      const role = message.mentions.roles.first();

      if (!target || !role) {
        return message.reply('Kullanım: `.rolal @oyuncu @rol`');
      }

      await target.roles.remove(role);
      return message.reply('✅ Rol alındı.');
    }

    // OTOMATİK ROL
    if (command === 'oto-rol') {
      if (!admin) return message.reply('Yönetici olmalısın.');

      const role = message.mentions.roles.first();
      if (!role) return message.reply('Bir rol etiketlemelisin.');

      db.autoRole = role.id;
      save();
      return message.reply(`✅ Otomatik rol ayarlandı: ${role.name}`);
    }

    if (command === 'oto-rol-kapat') {
      if (!admin) return message.reply('Yönetici olmalısın.');

      db.autoRole = null;
      save();
      return message.reply('Otomatik rol kapatıldı.');
    }

    // MESAJ SİL
    if (command === 'sil') {
      if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return message.reply('Mesajları yönetme yetkin yok.');
      }

      const amount = Math.min(parseInt(args[0]) || 0, 100);
      if (amount < 1) return message.reply('Örnek: `.sil 10`');

      await message.channel.bulkDelete(amount + 1, true);
      return;
    }

    // KANAL KİLİT
    if (command === 'lock' || command === 'unlock') {
      if (!admin) return message.reply('Yönetici olmalısın.');

      const locked = command === 'lock';

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        { SendMessages: !locked }
      );

      return message.reply(locked ? '🔒 Kanal kilitlendi.' : '🔓 Kanal açıldı.');
    }

    // MESAJ İSTATİSTİĞİ
    if (command === 'm') {
      return message.reply(
        `📊 Mesaj istatistiğin: **${db.messageStats[id] || 0}** mesaj`
      );
    }

    // SES İSTATİSTİĞİ
    if (command === 'ses') {
      return message.reply(
        `🔊 Ses istatistiğin: **${db.voiceStats[id] || 0}** dakika`
      );
    }

    // KAP
    if (command === 'kap') {
      if (!admin && !hasRole(member, CONFIG.teknikDirektor)) {
        return message.reply('Bu komut Teknik Direktörlere açıktır.');
      }

      if (message.channel.id !== CONFIG.kapKanal) {
        return message.reply('KAP kanalında kullanabilirsin.');
      }

      return message.reply(
        '📝 **PROLEAGUE KAP**\n' +
        'Transfer işlemleri için yönetim ekibine başvur.\n' +
        'İşlem türünü ve oyuncu bilgilerini belirt.'
      );
    }

    // MAÇ BAŞLAT
    if (command === 'başlat' || command === 'baslat') {
      if (!admin) return message.reply('Maç başlatmak için yönetici olmalısın.');

      const text = args.join(' ');
      const teams = text.split('|').map(x => x.trim());

      if (teams.length !== 2) {
        return message.reply('Kullanım: `.başlat Galatasaray | Fenerbahçe`');
      }

      const roleA = findTeam(message.guild, teams[0]);
      const roleB = findTeam(message.guild, teams[1]);

      if (!roleA || !roleB || roleA.id === roleB.id) {
        return message.reply('İki takımın da ayrı Discord rolü bulunmalı.');
      }

      const matchId = Date.now().toString();

      const match = {
        id: matchId,
        channel: message.channel.id,
        teamA: roleA.name,
        teamB: roleB.name,
        scoreA: 0,
        scoreB: 0,
        minute: 0,
        paused: false,
        finished: false,
        events: []
      };

      db.matches[matchId] = match;
      save();

      await message.channel.send(
        `⚽ **MAÇ BAŞLADI!**\n` +
        `${roleA.name} 🆚 ${roleB.name}\n` +
        `⏱️ 0' — 0-0`
      );

      match.timer = setInterval(async () => {
        if (match.paused || match.finished) return;

        match.minute++;

        const eventChance = Math.random();

        if (eventChance < 0.20) {
          const goalTeam = Math.random() < 0.5 ? 'A' : 'B';

          if (goalTeam === 'A') match.scoreA++;
          else match.scoreB++;

          const goalMessage =
            `⚽ **GOOOL!** ${goalTeam === 'A' ? match.teamA : match.teamB}!\n`;

          match.events.push(`${match.minute}' Gol`);
          await message.channel.send(
            `${match.minute}' ${goalMessage}` +
            `📊 ${match.teamA} ${match.scoreA} - ${match.scoreB} ${match.teamB}`
          );
        } else if (eventChance < 0.32) {
          await message.channel.send(
            `${match.minute}' 🟨 Sarı kart!`
          );
        } else if (eventChance < 0.42) {
          await message.channel.send(
            `${match.minute}' 🥅 Tehlikeli atak!`
          );
        } else if (eventChance < 0.50) {
          await message.channel.send(
            `${match.minute}' 🚩 Ofsayt!`
          );
        }

        if (match.minute === 45) {
          await message.channel.send(
            `⏸️ **İLK YARI BİTTİ!**\n` +
            `${match.teamA} ${match.scoreA} - ${match.scoreB} ${match.teamB}`
          );
        }

        if (match.minute >= 90) {
          match.finished = true;
          clearInterval(match.timer);

          save();

          await message.channel.send(
            `🏁 **MAÇ SONA ERDİ!**\n` +
            `${match.teamA} ${match.scoreA} - ${match.scoreB} ${match.teamB}\n` +
            `⚽ Toplam gol: ${match.scoreA + match.scoreB}`
          );
        }

        save();
      }, 10000);

      return;
    }

    // MAÇ DURDUR / DEVAM
    if (command === 'durdur') {
      if (!admin) return message.reply('Yönetici olmalısın.');

      const match = Object.values(db.matches).find(
        m => !m.finished && m.channel === message.channel.id
      );

      if (!match) return message.reply('Bu kanalda devam eden maç yok.');

      match.paused = !match.paused;
      save();

      return message.reply(
        match.paused ? '⏸️ Maç duraklatıldı.' : '▶️ Maç devam ediyor.'
      );
    }

    // MAÇI BİTİR
    if (command === 'maçı' && args[0]?.toLowerCase() === 'bitir') {
      if (!admin) return message.reply('Yönetici olmalısın.');

      const match = Object.values(db.matches).find(
        m => !m.finished && m.channel === message.channel.id
      );

      if (!match) return message.reply('Devam eden maç bulunamadı.');

      match.finished = true;
      if (match.timer) clearInterval(match.timer);
      save();

      return message.reply(
        `🏁 Maç bitirildi!\n` +
        `${match.teamA} ${match.scoreA} - ${match.scoreB} ${match.teamB}`
      );
    }

    // PUAN DURUMU
    if (command === 'puandurum') {
      const standings = getStandings(message.guild);

      if (!standings.length) {
        return message.reply('Henüz lig takımı veya tamamlanmış maç yok.');
      }

      return message.reply(
        '**🏆 PROLEAGUE PUAN DURUMU**\n\n' +
        standings.map(([name, s], i) =>
          `**${i + 1}. ${name}** — ${s.P} P | O:${s.O} G:${s.G} B:${s.B} M:${s.M} AG:${s.AG} YG:${s.YG}`
        ).join('\n')
      );
    }

    // FİKSTÜR
    if (command === 'fiksür' || command === 'fikstur') {
      const matches = Object.values(db.matches);

      if (!matches.length) {
        return message.reply('Henüz maç oynanmadı.');
      }

      return message.reply(
        '**📅 PROLEAGUE MAÇ KAYITLARI**\n\n' +
        matches.slice(-10).map(m =>
          `${m.teamA} ${m.scoreA} - ${m.scoreB} ${m.teamB} ${m.finished ? '🏁' : '⏳'}`
        ).join('\n')
      );
    }

  } catch (error) {
    console.error('Komut hatası:', error);
    message.reply('Komut çalışırken bir hata oluştu. Bot konsolunu kontrol et.');
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    newState.member.voiceStart = Date.now();
  }

  if (oldState.channelId && !newState.channelId) {
    const member = oldState.member;
    if (member.voiceStart) {
      const minutes = Math.floor((Date.now() - member.voiceStart) / 60000);
      db.voiceStats[member.id] = (db.voiceStats[member.id] || 0) + minutes;
      delete member.voiceStart;
      save();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
