const {
  Client,
  GatewayIntentBits,
  PermissionsBitField
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = ".";
const TOKEN = process.env.DISCORD_TOKEN;
const DB_FILE = path.join(__dirname, "proleague.json");
const REG_CHANNEL = "1573274494179475587";

let db = {
  players: {},
  teams: {},
  fixtures: [],
  match: null,
  autoRole: null
};

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
    }
  } catch (err) {
    console.error("Veri dosyası okunamadı:", err);
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function isAdmin(message) {
  return message.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );
}

function money(value) {
  return Number(String(value).replace(/[^\d.]/g, "")) || 0;
}

function getPlayer(userId) {
  return db.players[userId];
}

function getTeam(teamName) {
  return Object.keys(db.teams).find(
    name => name.toLowerCase() === teamName.toLowerCase()
  );
}

function getPlayerTeam(userId) {
  return Object.keys(db.teams).find(
    team => db.teams[team].players.includes(userId)
  );
}

function teamStats(teamName) {
  const team = db.teams[teamName];

  if (!team.stats) {
    team.stats = {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    };
  }

  return team.stats;
}

function formatPlayer(userId) {
  const player = getPlayer(userId);
  if (!player) return "Bilinmeyen oyuncu";

  return `<@${userId}> — ${player.name} | ${player.flag} | ${player.position} | ${player.value}M€`;
}

function addCareerStat(userId, key, amount = 1) {
  const player = getPlayer(userId);
  if (!player) return;

  if (!player.career) {
    player.career = {
      matches: 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: 0,
      saves: 0,
      penalties: 0
    };
  }

  player.career[key] = (player.career[key] || 0) + amount;
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTeamPlayers(teamName) {
  return (db.teams[teamName]?.players || [])
    .filter(id => db.players[id]);
}

function createTeam(teamName) {
  if (!db.teams[teamName]) {
    db.teams[teamName] = {
      players: [],
      stats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0
      }
    };
  }
}

function updateStandings(teamA, teamB, goalsA, goalsB) {
  const a = teamStats(teamA);
  const b = teamStats(teamB);

  a.played++;
  b.played++;

  a.goalsFor += goalsA;
  a.goalsAgainst += goalsB;

  b.goalsFor += goalsB;
  b.goalsAgainst += goalsA;

  if (goalsA > goalsB) {
    a.wins++;
    a.points += 3;
    b.losses++;
  } else if (goalsB > goalsA) {
    b.wins++;
    b.points += 3;
    a.losses++;
  } else {
    a.draws++;
    b.draws++;
    a.points++;
    b.points++;
  }
}

function createFixtureList() {
  const teams = Object.keys(db.teams);

  if (teams.length < 2) return false;

  db.fixtures = [];

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      db.fixtures.push({
        home: teams[i],
        away: teams[j],
        played: false,
        week: db.fixtures.length + 1
      });

      db.fixtures.push({
        home: teams[j],
        away: teams[i],
        played: false,
        week: db.fixtures.length + 1
      });
    }
  }

  saveDB();
  return true;
}

function matchEvent(match) {
  const teamAPlayers = getTeamPlayers(match.teamA);
  const teamBPlayers = getTeamPlayers(match.teamB);

  const events = [
    "goal",
    "goal",
    "assist",
    "yellow",
    "foul",
    "corner",
    "shot",
    "save",
    "offside",
    "injury",
    "penalty",
    "red"
  ];

  const event = randomItem(events);
  const side = Math.random() < 0.5 ? "A" : "B";

  const teamName = side === "A" ? match.teamA : match.teamB;
  const players = side === "A" ? teamAPlayers : teamBPlayers;
  const opponent = side === "A" ? match.teamB : match.teamA;

  if (!players.length) return null;

  const player = randomItem(players);
  const playerData = getPlayer(player);

  if (event === "goal") {
    match[side === "A" ? "scoreA" : "scoreB"]++;

    addCareerStat(player, "goals");

    const scorers = match.scorers;
    scorers.push({
      player,
      team: teamName,
      minute: match.minute
    });

    return `⚽ **GOOOL!** ${teamName} golü buldu!\n🥅 ${playerData.name} — ${match.minute}'`;
  }

  if (event === "assist") {
    addCareerStat(player, "assists");
    return `🎯 ${playerData.name} güzel bir asist yaptı!`;
  }

  if (event === "yellow") {
    addCareerStat(player, "yellow");
    return `🟨 ${playerData.name} sarı kart gördü!`;
  }

  if (event === "red") {
    addCareerStat(player, "red");
    return `🟥 ${playerData.name} kırmızı kart gördü!`;
  }

  if (event === "foul") {
    return `⚠️ ${playerData.name} faul yaptı!`;
  }

  if (event === "corner") {
    return `🚩 ${teamName} korner kazandı!`;
  }

  if (event === "shot") {
    return `🥅 ${playerData.name} şut çekti!`;
  }

  if (event === "save") {
    const keepers = players.filter(id =>
      ["KL", "GK", "KAL"].includes(
        getPlayer(id).position.toUpperCase()
      )
    );

    if (keepers.length) {
      const keeper = randomItem(keepers);
      addCareerStat(keeper, "saves");
      return `🧤 ${getPlayer(keeper).name} harika bir kurtarış yaptı!`;
    }

    return `🧤 ${opponent} kalecisi topu kontrol etti!`;
  }

  if (event === "offside") {
    return `🚩 ${teamName} ofsayta yakalandı!`;
  }

  if (event === "injury") {
    return `🚑 ${playerData.name} kısa süreli sakatlık yaşadı!`;
  }

  if (event === "penalty") {
    addCareerStat(player, "penalties");
    return `⚽ ${teamName} penaltı kazandı!`;
  }

  return null;
}

async function finishMatch(channel) {
  const match = db.match;
  if (!match) return;

  match.running = false;

  updateStandings(
    match.teamA,
    match.teamB,
    match.scoreA,
    match.scoreB
  );

  for (const id of getTeamPlayers(match.teamA)) {
    addCareerStat(id, "matches");
  }

  for (const id of getTeamPlayers(match.teamB)) {
    addCareerStat(id, "matches");
  }

  saveDB();

  await channel.send(
    `🏁 **MAÇ BİTTİ!**\n\n` +
    `🏟️ ${match.teamA} **${match.scoreA} - ${match.scoreB}** ${match.teamB}\n\n` +
    `📊 Maç istatistikleri kaydedildi.`
  );

  db.match = null;
  saveDB();
}

async function matchTick() {
  const match = db.match;

  if (!match || !match.running) return;

  match.minute++;

  if (match.minute === 45) {
    await match.channel.send("⏸️ **İLK YARI BİTTİ!**");
  }

  if (match.minute === 46) {
    await match.channel.send("▶️ **İKİNCİ YARI BAŞLADI!**");
  }

  const event = matchEvent(match);

  if (event) {
    const channel = await client.channels.fetch(match.channelId).catch(() => null);

    if (channel) {
      await channel.send(
        `⏱️ **${match.minute}. dakika**\n${event}\n\n` +
        `⚽ ${match.teamA} ${match.scoreA} - ${match.scoreB} ${match.teamB}`
      );
    }
  }

  saveDB();

  if (match.minute >= 90) {
    const channel = await client.channels.fetch(match.channelId).catch(() => null);
    if (channel) await finishMatch(channel);
  }
}

setInterval(() => {
  if (db.match && db.match.running) {
    matchTick().catch(console.error);
  }
}, 10000);

client.once("ready", () => {
  console.log(`${client.user.tag} aktif! ProLeague RP hazır.`);
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  try {

    // YARDIM
    if (command === "yardım" || command === "yardim") {
      return message.reply(
        "**⚽ PROLEAGUE RP KOMUTLARI**\n\n" +
        "`.k @oyuncu İsim | 🇹🇷 | STP | 5M€` — Oyuncu kaydı\n" +
        "`.değerver @oyuncu 5M€` — Oyuncu değeri\n" +
        "`.takimata @oyuncu Takım` — Takıma oyuncu ekle\n" +
        "`.takim Takım` — Takım kadrosu\n" +
        "`.kariyer @oyuncu` — Kariyer bilgisi\n" +
        "`.rolver @oyuncu @rol` — Rol ver\n" +
        "`.rolal @oyuncu @rol` — Rol al\n" +
        "`.oto-rol @rol` — Otomatik rol ayarla\n" +
        "`.oto-rol-kapat` — Otomatik rolü kapat\n" +
        "`.sil 10` — Mesaj sil\n" +
        "`.lock` — Kanalı kilitle\n" +
        "`.unlock` — Kanalı aç\n\n" +
        "**🏆 MAÇ SİSTEMİ**\n" +
        "`.başlat Takım A | Takım B` — Maçı başlat\n" +
        "`.durdur` — Maçı durdur/devam ettir\n" +
        "`.maçı bitir` — Maçı bitir\n" +
        "`.fiksür` — Fikstürü oluştur/göster\n" +
        "`.puandurum` — Puan durumu"
      );
    }

    // OYUNCU KAYDI
    if (command === "k") {
      if (!isAdmin(message)) return message.reply("❌ Bu komut yöneticilere özeldir.");
      if (message.channel.id !== REG_CHANNEL) {
        return message.reply("❌ Kayıt işlemini kayıt kanalında yapmalısın.");
      }

      const user = message.mentions.users.first();
      if (!user) {
        return message.reply("Kullanım: `.k @oyuncu İsim | 🇹🇷 | STP | 5M€`");
      }

      if (db.players[user.id]) {
        return message.reply("❌ Bu oyuncu zaten kayıtlı.");
      }

      const raw = message.content.split(user.id + ">")[1] || "";
      const parts = raw.replace(/[<>@!]/g, "").trim().split("|").map(x => x.trim());

      if (parts.length < 4 || !parts[0]) {
        return message.reply("Kullanım: `.k @oyuncu İsim | 🇹🇷 | STP | 5M€`");
      }

      const value = money(parts[3]);

      db.players[user.id] = {
        name: parts[0],
        flag: parts[1],
        position: parts[2],
        value,
        career: {
          matches: 0,
          goals: 0,
          assists: 0,
          yellow: 0,
          red: 0,
          saves: 0,
          penalties: 0
        }
      };

      saveDB();

      const role = message.guild.roles.cache.find(
        r => r.name === "✅ Kayıtlı Üye"
      );

      const unregistered = message.guild.roles.cache.find(
        r => r.name === "⏳ Kayıtsız"
      );

      if (role) await message.guild.members.fetch(user.id)
        .then(member => member.roles.add(role))
        .catch(() => {});

      if (unregistered) await message.guild.members.fetch(user.id)
        .then(member => member.roles.remove(unregistered))
        .catch(() => {});

      return message.reply(
        `✅ ${user} başarıyla kaydedildi!\n` +
        `👤 ${parts[0]} | ${parts[1]} | ${parts[2]} | ${value}M€`
      );
    }

    // OYUNCU DEĞERİ
    if (command === "değerver" || command === "degerv er") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      const user = message.mentions.users.first();
      const valueText = args[args.length - 1];

      if (!user || !db.players[user.id] || !valueText) {
        return message.reply("Kullanım: `.değerver @oyuncu 5M€`");
      }

      const value = money(valueText);
      db.players[user.id].value = value;
      saveDB();

      return message.reply(`✅ ${user} oyuncusunun yeni değeri: **${value}M€**`);
    }

    // TAKIMA OYUNCU EKLE
    if (command === "takimata") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      const user = message.mentions.users.first();
      if (!user || !db.players[user.id]) {
        return message.reply("❌ Önce oyuncuyu kaydetmelisin.");
      }

      const teamName = message.content
        .replace(/^\.takimata\s*/i, "")
        .replace(/<@!?\d+>/, "")
        .trim();

      if (!teamName) {
        return message.reply("Kullanım: `.takimata @oyuncu Takım Adı`");
      }

      const oldTeam = getPlayerTeam(user.id);

      if (oldTeam) {
        db.teams[oldTeam].players =
          db.teams[oldTeam].players.filter(id => id !== user.id);
      }

      createTeam(teamName);

      if (!db.teams[teamName].players.includes(user.id)) {
        db.teams[teamName].players.push(user.id);
      }

      saveDB();

      return message.reply(`✅ ${user}, **${teamName}** takımına eklendi.`);
    }

    // TAKIM KADROSU
    if (command === "takim") {
      const teamName = args.join(" ");
      const actualName = getTeam(teamName);

      if (!actualName) return message.reply("❌ Takım bulunamadı.");

      const players = getTeamPlayers(actualName);

      return message.reply(
        `🏟️ **${actualName} KADROSU**\n\n` +
        (players.length
          ? players.map((id, i) => `${i + 1}. ${formatPlayer(id)}`).join("\n")
          : "Henüz oyuncu yok.")
      );
    }

    // KARİYER
    if (command === "kariyer") {
      const user = message.mentions.users.first() || message.author;
      const player = getPlayer(user.id);

      if (!player) return message.reply("❌ Oyuncu kayıtlı değil.");

      const c = player.career || {};

      return message.reply(
        `📊 **${player.name} — KARİYER**\n\n` +
        `⚽ Maç: ${c.matches || 0}\n` +
        `🥅 Gol: ${c.goals || 0}\n` +
        `🎯 Asist: ${c.assists || 0}\n` +
        `🟨 Sarı kart: ${c.yellow || 0}\n` +
        `🟥 Kırmızı kart: ${c.red || 0}\n` +
        `🧤 Kurtarış: ${c.saves || 0}\n` +
        `⚽ Penaltı: ${c.penalties || 0}`
      );
    }

    // ROL VER
    if (command === "rolver") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      const user = message.mentions.members.first();
      const role = message.mentions.roles.first();

      if (!user || !role) {
        return message.reply("Kullanım: `.rolver @oyuncu @rol`");
      }

      await user.roles.add(role);
      return message.reply("✅ Rol verildi.");
    }

    // ROL AL
    if (command === "rolal") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      const user = message.mentions.members.first();
      const role = message.mentions.roles.first();

      if (!user || !role) {
        return message.reply("Kullanım: `.rolal @oyuncu @rol`");
      }

      await user.roles.remove(role);
      return message.reply("✅ Rol alındı.");
    }

    // OTOMATİK ROL AYARLA
    if (command === "oto-rol") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      const role = message.mentions.roles.first();
      if (!role) return message.reply("Kullanım: `.oto-rol @rol`");

      db.autoRole = role.id;
      saveDB();

      return message.reply(`✅ Otomatik rol **${role.name}** olarak ayarlandı.`);
    }

    // OTOMATİK ROL KAPAT
    if (command === "oto-rol-kapat") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      db.autoRole = null;
      saveDB();

      return message.reply("✅ Otomatik rol kapatıldı.");
    }

    // MESAJ SİL
    if (command === "sil") {
      if (!message.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages
      )) {
        return message.reply("❌ Mesajları yönetme iznin yok.");
      }

      const amount = parseInt(args[0]);

      if (!amount || amount < 1 || amount > 100) {
        return message.reply("Kullanım: `.sil 10` (1-100 arası)");
      }

      await message.delete().catch(() => {});

      const deleted = await message.channel.bulkDelete(amount, true);

      const info = await message.channel.send(
        `🗑️ **${deleted.size}** mesaj silindi.`
      );

      setTimeout(() => info.delete().catch(() => {}), 4000);
      return;
    }

    // KANAL KİLİTLE
    if (command === "lock") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        { SendMessages: false }
      );

      return message.reply("🔒 Kanal kilitlendi.");
    }

    // KANAL AÇ
    if (command === "unlock") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        { SendMessages: null }
      );

      return message.reply("🔓 Kanal açıldı.");
    }

    // MAÇ BAŞLAT
    if (command === "başlat" || command === "baslat") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      if (db.match) {
        return message.reply("❌ Zaten devam eden bir maç var.");
      }

      const input = message.content.replace(/^\.başlat\s*/i, "")
        .replace(/^\.baslat\s*/i, "");

      const teams = input.split("|").map(x => x.trim());

      if (teams.length !== 2) {
        return message.reply("Kullanım: `.başlat Takım A | Takım B`");
      }

      const teamA = getTeam(teams[0]);
      const teamB = getTeam(teams[1]);

      if (!teamA || !teamB || teamA === teamB) {
        return message.reply("❌ İki geçerli ve farklı takım yazmalısın.");
      }

      if (!getTeamPlayers(teamA).length || !getTeamPlayers(teamB).length) {
        return message.reply("❌ İki takımın da kadrosunda oyuncu olmalı.");
      }

      db.match = {
        teamA,
        teamB,
        scoreA: 0,
        scoreB: 0,
        minute: 0,
        running: true,
        channelId: message.channel.id,
        scorers: []
      };

      saveDB();

      return message.channel.send(
        `🏟️ **MAÇ BAŞLIYOR!**\n\n` +
        `🔵 ${teamA} - ${teamB} 🔴\n\n` +
        `⏱️ Maç süresi: 90 dakika\n` +
        `⚡ Her oyun dakikası 10 saniyede ilerler.`
      );
    }

    // MAÇ DURDUR / DEVAM
    if (command === "durdur") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      if (!db.match) return message.reply("❌ Devam eden maç yok.");

      db.match.running = !db.match.running;
      saveDB();

      return message.reply(
        db.match.running
          ? "▶️ Maç devam ediyor."
          : "⏸️ Maç durduruldu."
      );
    }

    // MAÇI BİTİR
    if (command === "maçı") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      if (args[0]?.toLowerCase() !== "bitir") return;

      if (!db.match) return message.reply("❌ Devam eden maç yok.");

      db.match.minute = 90;
      db.match.running = false;

      return finishMatch(message.channel);
    }

    // FİKSÜR
    if (command === "fiksür" || command === "fikstur") {
      if (!isAdmin(message)) return message.reply("❌ Yönetici komutu.");

      if (!db.fixtures.length) {
        if (!createFixtureList()) {
          return message.reply("❌ Fikstür için en az 2 takım gerekli.");
        }
      }

      const week = parseInt(args[0]);

      if (week) {
        const games = db.fixtures.filter(f => f.week === week);

        if (!games.length) return message.reply("❌ Bu hafta için maç yok.");

        return message.reply(
          `📅 **${week}. HAFTA**\n\n` +
          games.map(f =>
            `${f.played ? "✅" : "⚽"} ${f.home} - ${f.away}`
          ).join("\n")
        );
      }

      return message.reply(
        `📅 **FİKSTÜR**\n\n` +
        db.fixtures.map((f, i) =>
          `${f.played ? "✅" : "⚽"} ${f.week}. Hafta: ${f.home} - ${f.away}`
        ).join("\n")
      );
    }

    // PUAN DURUMU
    if (command === "puandurum") {
      const teams = Object.keys(db.teams);

      if (!teams.length) return message.reply("Henüz takım yok.");

      const sorted = teams.sort((a, b) => {
        const sa = teamStats(a);
        const sb = teamStats(b);

        return sb.points - sa.points ||
          (sb.goalsFor - sb.goalsAgainst) -
          (sa.goalsFor - sa.goalsAgainst);
      });

      const table = sorted.map((name, i) => {
        const s = teamStats(name);
        const average = s.goalsFor - s.goalsAgainst;

        return `**${i + 1}. ${name}** — ${s.played}M | ${s.wins}G | ${s.draws}B | ${s.losses}M | ${average}AV | **${s.points}P**`;
      });

      return message.reply("🏆 **PUAN DURUMU**\n\n" + table.join("\n"));
    }

  } catch (error) {
    console.error(error);
    message.reply("❌ Komut çalışırken bir hata oluştu. Konsolu kontrol et.");
  }
});

// SUNUCUYA YENİ KATILANLARA OTOMATİK ROL
client.on("guildMemberAdd", async member => {
  if (!db.autoRole) return;

  const role = member.guild.roles.cache.get(db.autoRole);
  if (role) {
    await member.roles.add(role).catch(console.error);
  }
});

loadDB();

if (!TOKEN) {
  console.error("DISCORD_TOKEN bulunamadı! Hosting panelinden token değişkenini ayarla.");
  process.exit(1);
}

client.login(TOKEN);
