// ProLeague RP — Discord.js v14.16.3
// Gereksinim: npm install discord.js@14.16.3
// Hosting panelinde DISCORD_TOKEN ortam değişkenini tanımlayın. Tokeni bu dosyaya yazmayın.

const {
  Client, GatewayIntentBits, Partials, PermissionsBitField,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const PREFIX = ".";
const DATA_FILE = path.join(__dirname, "proleague-data.json");
const TOKEN = process.env.DISCORD_TOKEN;
const pendingTransferTypes = new Map();
const pendingTransferWizards = new Map();

if (!TOKEN) {
  console.error("DISCORD_TOKEN bulunamadı. Hosting panelinin Environment Variables bölümüne ekleyin.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

const emptyData = () => ({
  players: {}, teams: {}, wallets: {}, messages: {}, voice: {},
  training: {}, config: {}, pending: {}, activeMatches: {}
});
let db = emptyData();

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) db = { ...emptyData(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
    else saveData();
  } catch (e) {
    console.error("Veri dosyası okunamadı:", e);
    db = emptyData();
  }
}
function saveData() {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function money(n) { return `${Number(n || 0).toLocaleString("tr-TR")}€`; }
function parseMoney(s) {
  if (!s) return NaN;
  const v = String(s).replace(/[€$]/g, "").replace(/m/i, "000000").replace(/k/i, "000").replace(/\./g, "").replace(",", ".");
  return Number(v);
}
function isStaff(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.some(r => /kurucu|admin|moder(atör)?/i.test(r.name));
}
function isTD(member) {
  return isStaff(member) || member.roles.cache.some(r => /teknik direktör/i.test(r.name));
}
function getPlayerByUser(userId) { return db.players[userId]; }
function ensureWallet(id) {
  if (!db.wallets[id]) db.wallets[id] = { cash: 0, bank: 0, starterBonusGiven: false };
  if (db.wallets[id].starterBonusGiven === undefined) db.wallets[id].starterBonusGiven = false;
  return db.wallets[id];
}
function getTeam(guildId, name) {
  const teams = db.teams[guildId] || {};
  const key = Object.keys(teams).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? teams[key] : null;
}
function getTeamName(guildId, userId) {
  const member = db.players[userId];
  return member?.team || null;
}
function embed(title, description, color = 0x2b2d31) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}
function mention(id) { return id ? `<@${id}>` : "Yok"; }
function parseDuration(s) {
  const m = /^(\d+)(m|h|d)$/i.exec(s || "");
  if (!m) return null;
  const mult = { m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()];
  return Math.min(Number(m[1]) * mult, 28 * 86400000);
}
function teamRosterText(team) {
  const starters = team.starters || {};
  const subs = team.subs || [];
  const slots = ["KL", "STP1", "STP2", "STP3", "DOS1", "DOS2", "SLO", "OOS1", "OOS2", "SĞO", "SNT"];
  const allSlots = [...new Set([...slots, ...Object.keys(starters)])];
  const lines = allSlots.map(pos => `${pos}: ${starters[pos] ? `<@${starters[pos]}>` : "NPC (Boş)"}`);
  return `**Diziliş:** ${team.formation || "4-3-3"}\n**Taktik:** ${team.tactic || "Dengeli"}\n**Korner:** ${team.cornerType || "Belirlenmedi"} • **Frikik:** ${team.freeKickType || "Belirlenmedi"}\n\n**İlk 11**\n${lines.join("\n") || "Henüz kadro ayarlanmadı."}\n\n**Yedekler**\n${subs.length ? subs.map(id => `<@${id}>`).join(", ") : "Yok"}\n\n**Bağlantılar:** ${(team.connections || []).map(c => `<@${c[0]}> ↔ <@${c[1]}>`).join(", ") || "Yok"}`;
}
function rosterControls(teamKey) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roster_add:${teamKey}`).setLabel("Oyuncu Ekle").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`roster_remove:${teamKey}`).setLabel("Oyuncu Çıkar").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`roster_captain:${teamKey}`).setLabel("Kaptan Seç").setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roster_tactic:${teamKey}`).setLabel("Taktik").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roster_formation:${teamKey}`).setLabel("Diziliş").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roster_roles:${teamKey}`).setLabel("Duran Toplar").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roster_link:${teamKey}`).setLabel("Bağlantı Kur").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`roster_corner:${teamKey}`).setLabel("Korner Tipi").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roster_freekick:${teamKey}`).setLabel("Frikik Tipi").setStyle(ButtonStyle.Secondary)
    )
  ];
}
async function refreshRosterPanel(guild, team) {
  if (!team.panelMessageId || !team.channels?.roster) return;
  try {
    const channel = await guild.channels.fetch(team.channels.roster);
    if (!channel || !channel.isTextBased()) return;
    const panel = await channel.messages.fetch(team.panelMessageId);
    await panel.edit({ embeds: [embed(`📋 ${team.name} — Kadro Yönetimi`, teamRosterText(team))], components: rosterControls(team.name) });
  } catch (e) { console.error("Kadro paneli güncellenemedi:", e.message); }
}

function teamOptions(guildId, excludeName = null) {
  return Object.values(db.teams[guildId] || {}).filter(t => t.name !== excludeName).slice(0, 25)
    .map(t => ({ label: t.name.slice(0, 100), value: t.name }));
}

function registeredOptions(guildId) {
  return Object.values(db.players).filter(p => p.guildId === guildId).slice(0, 25).map(p => ({
    label: (p.name || "Oyuncu").slice(0, 100),
    description: `${p.position || "Mevki yok"} • ${p.value || "0€"}`.slice(0, 100),
    value: p.userId
  }));
}
function getUserFromMention(s) {
  const m = /<@!?(\d+)>/.exec(s || "");
  return m ? m[1] : null;
}
function formatPlayer(p) {
  return `${p.name} | ${p.flag || "🏳️"} | ${p.position || "?"} | ${p.value || "0€"}`;
}
function teamTotal(team) {
  return Object.values(team.starters || {}).concat(team.subs || [])
    .filter(Boolean).reduce((sum, id) => sum + (parseMoney(db.players[id]?.value) || 0), 0);
}
function getConfig(guildId) {
  if (!db.config[guildId]) db.config[guildId] = {};
  return db.config[guildId];
}
function currentWeekKey() {
  const d = new Date();
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((x - yearStart) / 86400000) + 1) / 7);
  return `${x.getUTCFullYear()}-${week}`;
}
function resetStatsPeriod(s) {
  const today = new Date().toDateString();
  const week = currentWeekKey();
  if (s.day !== today) { s.daily = 0; s.day = today; }
  if (s.week !== week) { s.weekly = 0; s.week = week; }
}


function matchRoster(team) {
  const ids = [...new Set(Object.values(team.starters || {}).filter(Boolean))];
  return ids.map(id => db.players[id]).filter(p => p && p.team === team.name);
}
function randomItem(list) { return list.length ? list[Math.floor(Math.random() * list.length)] : null; }
function matchStat(match, side, key, amount = 1) {
  match.stats[side][key] = (match.stats[side][key] || 0) + amount;
}
function matchPlayerStat(match, uid, key, amount = 1) {
  if (!uid) return;
  match.playerStats[uid] ||= { appearances: 0, goals: 0, assists: 0, yellow: 0, red: 0, injuries: 0, saves: 0 };
  match.playerStats[uid][key] = (match.playerStats[uid][key] || 0) + amount;
}
function activeMatchPlayers(match, side) {
  return match.lineups[side].filter(id => db.players[id]);
}
function chooseMatchPlayer(match, side, positions = null) {
  const ids = activeMatchPlayers(match, side);
  const candidates = positions ? ids.filter(id => positions.includes((db.players[id]?.position || '').toUpperCase())) : ids;
  return randomItem(candidates.length ? candidates : ids);
}
function matchName(uid) { return db.players[uid]?.name || 'Oyuncu'; }
function matchTeamRating(team) {
  const players = matchRoster(team);
  const values = players.map(p => Number(p.overall) || Math.min(99, Math.max(40, Math.round((parseMoney(p.value) || 0) / 1000000))));
  const avg = values.length ? values.reduce((a,b)=>a+b,0)/values.length : 55;
  const tacticBonus = /pres|hücum|kanat/i.test(team.tactic || '') ? 2 : /defans|kontra/i.test(team.tactic || '') ? 1 : 0;
  return Math.max(35, Math.min(99, avg + tacticBonus + Math.min(5, players.length)));
}
function matchComment(match, minute) {
  const sides = ['home', 'away'];
  const homeChance = match.teams.home.rating / (match.teams.home.rating + match.teams.away.rating);
  const side = Math.random() < homeChance ? 'home' : 'away', other = side === 'home' ? 'away' : 'home';
  const team = match.teams[side], opponent = match.teams[other];
  const playerId = chooseMatchPlayer(match, side);
  const defenderId = chooseMatchPlayer(match, other, ['STP','STP1','STP2','STP3','DOS','DOS1','DOS2']);
  const keeperId = match.lineups[other].find(id => (db.players[id]?.position || '').toUpperCase() === 'KL') || chooseMatchPlayer(match, other);
  const player = playerId ? matchName(playerId) : 'Hücum oyuncusu';
  const defender = defenderId ? matchName(defenderId) : 'Savunma oyuncusu';
  const keeper = keeperId ? matchName(keeperId) : 'Kaleci';
  const roll = Math.random();
  let event;
  if (roll < 0.025) {
    const scorer = chooseMatchPlayer(match, side, ['SNT','SĞO','SLO','OOS','OOS1','OOS2']);
    const assister = chooseMatchPlayer(match, side);
    match.score[side]++;
    matchStat(match, side, 'shots'); matchStat(match, side, 'shotsOnTarget');
    matchPlayerStat(match, scorer, 'goals');
    if (assister && assister !== scorer && Math.random() < 0.72) matchPlayerStat(match, assister, 'assists');
    match.goals.push({ minute, side, scorer, assister: assister && assister !== scorer ? assister : null });
    event = `⚽ **GOOOL!** ${scorer ? mention(scorer) : player} ağları buldu! ${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}`;
  } else if (roll < 0.095) {
    matchStat(match, side, 'shots');
    if (Math.random() < 0.68) {
      matchStat(match, side, 'shotsOnTarget'); matchStat(match, other, 'saves');
      matchPlayerStat(match, keeperId, 'saves');
      event = `🧤 **KALECİ KURTARDI!** ${player} şutunu çıkardı, ${keeper} gole izin vermedi.`;
    } else event = `🎯 ${player} ceza sahası dışından denedi, top az farkla auta gitti!`;
  } else if (roll < 0.14) {
    matchStat(match, side, 'corners');
    event = `🚩 **KORNER!** ${player} çizgiye indi, ${team.name} korner kullanacak.`;
  } else if (roll < 0.21) {
    matchStat(match, side, 'fouls');
    event = `⚠️ **FAUL!** ${defender}, ${player}'a müdahalede bulundu. Hakem oyunu durdurdu.`;
  } else if (roll < 0.235) {
    matchStat(match, side, 'offsides');
    event = `🚩 **OFSAYT!** ${player} savunma arkasına sarktı ancak bayrak havada. Gol geçerli değil.`;
  } else if (roll < 0.25) {
    const cardPlayer = defenderId || playerId;
    const red = Math.random() < 0.12;
    matchStat(match, side, red ? 'redCards' : 'yellowCards');
    matchPlayerStat(match, cardPlayer, red ? 'red' : 'yellow');
    event = red ? `🟥 **KIRMIZI KART!** ${cardPlayer ? mention(cardPlayer) : defender} oyun dışında kaldı.` : `🟨 **SARI KART!** ${cardPlayer ? mention(cardPlayer) : defender} hakem tarafından uyarıldı.`;
  } else if (roll < 0.27) {
    matchStat(match, side, 'injuries'); matchPlayerStat(match, playerId, 'injuries');
    event = `🚑 ${player} bir sakatlık yaşadı. Sağlık ekibi oyun alanında.`;
  } else if (roll < 0.31) {
    event = `💨 ${player} rakibini çalımlarla geçti ve takımını atağa kaldırdı!`;
  } else if (roll < 0.35) {
    event = `⚡ **HIZLI HÜCUM!** ${team.name} kontra atakla rakip kaleye yükleniyor!`;
  } else if (roll < 0.39) {
    event = `🧱 ${defender} kritik bir müdahaleyle ${team.name} atağını kesti.`;
  } else {
    const lines = [
      `${player} orta sahada topu kontrol ediyor, takım arkadaşlarına pas dağıtıyor.`,
      `${team.name} paslarla rakip yarı alana yerleşmeye çalışıyor.`,
      `${opponent.name} savunması alanı daraltıyor, oyun orta sahada sıkıştı.`,
      `${player} kanattan bindirme yaptı, savunma araya girdi.`,
      `${team.name} oyunun temposunu artırıyor ve boşluk arıyor.`
    ];
    event = randomItem(lines);
  }
  return `⏱️ **Dakika ${minute}'** | ${event}\n\n━━━━ **CANLI SKOR** ━━━━\n**${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}**`;
}
function finishMatchStats(match) {
  if (match.finished) return;
  match.finished = true;
  const guildTeams = db.teams[match.guildId] || {};
  const home = guildTeams[match.teams.home.name], away = guildTeams[match.teams.away.name];
  if (home && away) {
    for (const [team, side, goalsFor, goalsAgainst] of [[home,'home',match.score.home,match.score.away],[away,'away',match.score.away,match.score.home]]) {
      team.played = (team.played || 0) + 1;
      team.goalsFor = (team.goalsFor || 0) + goalsFor;
      team.goalsAgainst = (team.goalsAgainst || 0) + goalsAgainst;
      if (goalsFor > goalsAgainst) team.wins = (team.wins || 0) + 1;
      else if (goalsFor === goalsAgainst) team.draws = (team.draws || 0) + 1;
      else team.losses = (team.losses || 0) + 1;
    }
  }
  for (const uid of [...new Set([...match.lineups.home, ...match.lineups.away])]) {
    const p = db.players[uid]; if (!p) continue;
    p.career ||= { matches: 0, goals: 0, assists: 0, yellow: 0, red: 0, injuries: 0, trophies: 0, history: [] };
    p.career.matches++;
    const st = match.playerStats[uid] || {};
    for (const key of ['goals','assists','yellow','red','injuries']) p.career[key] = (p.career[key] || 0) + (st[key] || 0);
  }
  const goalText = match.goals.length ? match.goals.map(g => `• ${g.minute}' ${matchName(g.scorer)}${g.assister ? ` (Asist: ${matchName(g.assister)})` : ''}`).join('\n') : 'Gol olmadı.';
  const s = match.stats;
  const report = `**Sonuç:** ${match.teams.home.name} **${match.score.home} - ${match.score.away}** ${match.teams.away.name}\n\n**⚽ Goller**\n${goalText}\n\n**📊 Maç İstatistikleri**\n| İstatistik | ${match.teams.home.name} | ${match.teams.away.name} |\n|---|---:|---:|\n| Şut | ${s.home.shots} | ${s.away.shots} |\n| İsabetli şut | ${s.home.shotsOnTarget} | ${s.away.shotsOnTarget} |\n| Korner | ${s.home.corners} | ${s.away.corners} |\n| Faul | ${s.home.fouls} | ${s.away.fouls} |\n| Sarı kart | ${s.home.yellowCards} | ${s.away.yellowCards} |\n| Kırmızı kart | ${s.home.redCards} | ${s.away.redCards} |\n| Kaleci kurtarışı | ${s.home.saves} | ${s.away.saves} |`;
  return report;
}
async function stopMatchTimer(guildId) {
  const timer = matchTimers.get(guildId);
  if (timer) clearInterval(timer);
  matchTimers.delete(guildId);
}
function startMatchTimer(guildId) {
  if (matchTimers.has(guildId)) return;
  const timer = setInterval(async () => {
    const match = db.activeMatches[guildId];
    if (!match || match.paused || match.finished) { await stopMatchTimer(guildId); return; }
    match.minute++;
    const channel = await client.channels.fetch(match.channelId).catch(() => null);
    if (match.minute === 45) {
      if (channel?.isTextBased()) await channel.send(`⏸️ **DEVRE ARASI!**\n${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}\nİkinci yarı birazdan başlayacak.`).catch(() => {});
    } else if (match.minute <= 90) {
      if (channel?.isTextBased()) await channel.send(matchComment(match, match.minute)).catch(() => {});
    }
    if (match.minute >= 90) {
      await stopMatchTimer(guildId);
      const report = finishMatchStats(match);
      if (channel?.isTextBased()) await channel.send({ embeds: [embed('🏁 MAÇ SONA ERDİ', report, 0x2ecc71)] }).catch(() => {});
      delete db.activeMatches[guildId]; saveData();
    } else saveData();
  }, 10000);
  matchTimers.set(guildId, timer);
}

loadData();
db.activeMatches ||= {};
const matchTimers = new Map();

client.once("ready", () => {
  console.log(`${client.user.tag} aktif! ProLeague RP hazır.`);
  client.user.setActivity("ProLeague RP | .yardım");
  for (const [guildId, match] of Object.entries(db.activeMatches || {})) if (match && !match.paused && !match.finished) startMatchTimer(guildId);
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const stats = db.messages[message.author.id] ||= { daily: 0, weekly: 0, total: 0, day: "", week: "" };
  resetStatsPeriod(stats);
  stats.daily++; stats.weekly++; stats.total++;
  saveData();

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (args.shift() || "").toLowerCase();
  const member = message.member;
  const guildId = message.guild.id;

  try {
    if (cmd === "yardım" || cmd === "help") {
      return message.reply({ embeds: [embed("⚽ ProLeague RP Komutları",
        "**Oyuncu:** `.k @oyuncu İsim | 🇹🇷 | STP | 5M€` • `.ara isim` • `.değerver @oyuncu 10M€`\n" +
        "**Takım:** `.takimkur isim` • `.takim isim` • `.kadroyap isim` • `.takimrol isim @rol`\n" +
        "**Transfer:** `.kap` • `.transferkanal #kanal`\n" +
        "**Antrenman/Penaltı:** `.ant` • `.pen`\n" +
        "**Ekonomi:** `.bal` • `.deposit miktar` • `.withdraw miktar`\n" +
        "**Maç:** `.başlat Takım 1 | Takım 2` • `.durdur` • `.maçı bitir`\n" +
        "**İstatistik:** `.m` • `.ses`\n" +
        "**Yetkili:** `.rolver @üye rol` • `.mute @üye 1h` • `.ban @üye sebep` • `.lock` • `.locked`\n" +
        "**Kurulum:** `.antkanal #kanal` • `.penkanal #kanal` • `.kanalayarla Takım sohbet|kadro #kanal` • `.takimtd Takım @üye`\n" +
        "**Takım yönetimi:** `.takimkur isim` • `.takimata Takım @oyuncu` • `.maas @oyuncu 1M` • `.kupa Takım 5` • `.macsonuc Takım g/b/m`"
      )] });
    }

    if (cmd === "k") {
      const uid = getUserFromMention(args[0]);
      if (!uid) return message.reply("Kullanım: `.k @oyuncu İsim | 🇹🇷 | STP | 5M€`");
      const raw = message.content.slice(PREFIX.length + 1).trim().replace(args[0], "").trim();
      const parts = raw.split("|").map(x => x.trim());
      if (parts.length < 4) return message.reply("Oyuncu bilgilerini şu sırayla yaz: `İsim | Bayrak | Mevki | Değer`");
      if (!isTD(member)) return message.reply("Bu komut sadece teknik direktörler ve yetkililer içindir.");
      const managedTeam = Object.values(db.teams[guildId] || {}).find(t => t.td === message.author.id);
      db.players[uid] = { userId: uid, guildId, name: parts[0], flag: parts[1], position: parts[2].toUpperCase(), value: parts[3], team: db.players[uid]?.team || managedTeam?.name || null, registeredBy: message.author.id };
      saveData();
      return message.reply({ embeds: [embed("✅ Oyuncu kaydedildi", `${mention(uid)}\n${formatPlayer(db.players[uid])}`, 0x2ecc71)] });
    }

    if (cmd === "ara") {
      const q = args.join(" ").toLowerCase();
      const found = Object.values(db.players).filter(p => p.guildId === guildId && `${p.name} ${p.position}`.toLowerCase().includes(q)).slice(0, 15);
      return message.reply({ embeds: [embed("🔎 Oyuncu Arama", found.length ? found.map(p => `${mention(p.userId)} — ${formatPlayer(p)} — Kayıtlı`).join("\n") : "Sonuç bulunamadı.")] });
    }

    if (cmd === "değerver" || cmd === "degerver") {
      if (!isTD(member)) return message.reply("Bu komut sadece teknik direktörler içindir.");
      const uid = getUserFromMention(args[0]), p = uid && db.players[uid];
      if (!p) return message.reply("Kayıtlı oyuncuyu etiketle. Örnek: `.değerver @oyuncu 10M€`");
      const ownerTeam = p.team && getTeam(guildId, p.team);
      if (ownerTeam && ownerTeam.td !== message.author.id && !isStaff(member)) return message.reply("Bu oyuncu senin takımında değil.");
      if (!args[1] || !Number.isFinite(parseMoney(args[1]))) return message.reply("Geçerli bir değer yaz. Örnek: `.değerver @oyuncu 10M€`");
      p.value = args[1]; saveData();
      return message.reply(`✅ ${mention(uid)} oyuncusunun yeni değeri: **${p.value}**`);
    }

    if (cmd === "takimkur") {
      if (!isTD(member)) return message.reply("Sadece yetkililer/teknik direktörler takım oluşturabilir.");
      const name = args.join(" ");
      if (!name) return message.reply("Kullanım: `.takimkur Galatasaray`");
      const teams = db.teams[guildId] ||= {};
      if (teams[name]) return message.reply("Bu takım zaten var.");
      teams[name] = { name, td: message.author.id, captain: null, formation: "4-3-3", tactic: "Dengeli", starters: {}, subs: [], trophies: 0, wins: 0, draws: 0, losses: 0, channels: {} };
      const tdWallet = ensureWallet(message.author.id);
      if (!tdWallet.starterBonusGiven) { tdWallet.cash += 100000000; tdWallet.starterBonusGiven = true; }
      saveData(); return message.reply(`✅ **${name}** takımı oluşturuldu. Teknik direktör: ${mention(message.author.id)}`);
    }

    if (cmd === "takimrol") {
      if (!isStaff(member)) return message.reply("Bu komut sadece sunucu yöneticilerine açık.");
      const role = message.mentions.roles.first();
      const name = args.slice(0, -1).join(" ");
      const team = getTeam(guildId, name);
      if (!team || !role) return message.reply("Kullanım: `.takimrol Galatasaray @Galatasaray`");
      team.roleId = role.id; saveData(); return message.reply(`✅ ${team.name} takım rolü ayarlandı.`);
    }

    if (cmd === "takim") {
      const name = args.join(" ");
      const team = getTeam(guildId, name);
      if (!team) return message.reply("Takım bulunamadı.");
      const players = Object.values(db.players).filter(p => p.guildId === guildId && p.team === team.name);
      const roster = teamRosterText(team);
      const totalValue = players.reduce((sum, p) => sum + (parseMoney(p.value) || 0), 0);
      return message.reply({ embeds: [embed(`🏟️ ${team.name} | Takım Bilgileri`,
        `**Teknik Direktör:** ${mention(team.td)}\n**Kaptan:** ${mention(team.captain)}\n**Toplam Değer:** ${money(totalValue)}\n**Kupa:** ${team.trophies || 0}\n**${team.wins || 0} G • ${team.draws || 0} B • ${team.losses || 0} M**\n**Penaltı:** ${mention(team.setPieces?.penalty)} • **Frikik:** ${mention(team.setPieces?.freekick)} • **Korner:** ${mention(team.setPieces?.corner)}\n\n${roster}\n\n**Kayıtlı takım oyuncusu:** ${players.length}`
      )] });
    }

    if (cmd === "takimata" || cmd === "takimoyuncu") {
      if (!isTD(member)) return message.reply("Sadece teknik direktörler kullanabilir.");
      const uid = getUserFromMention(args[args.length - 1]);
      const teamName = args.slice(0, -1).join(" ");
      const team = getTeam(guildId, teamName);
      const p = uid && db.players[uid];
      if (!team || !p) return message.reply("Kullanım: `.takimata Galatasaray @oyuncu`");
      p.team = team.name; saveData(); return message.reply(`✅ ${mention(uid)} artık **${team.name}** oyuncusu.`);
    }

    if (cmd === "kadroyap") {
      if (!isTD(member)) return message.reply("Sadece teknik direktörler kullanabilir.");
      const team = getTeam(guildId, args.join(" "));
      if (!team) return message.reply("Takım bulunamadı.");
      const channel = message.channel;
      team.channels.roster = channel.id;
      const panel = await channel.send({ embeds: [embed(`📋 ${team.name} — Kadro Yönetimi`, teamRosterText(team))], components: rosterControls(team.name) });
      team.panelMessageId = panel.id; saveData();
      return;
    }

    if (cmd === "takimlar") {
      const teams = Object.values(db.teams[guildId] || {});
      return message.reply({ embeds: [embed("🏟️ Kayıtlı Takımlar", teams.length ? teams.map(t => `• **${t.name}** — TD: ${mention(t.td)}`).join("\n") : "Henüz takım oluşturulmamış.")] });
    }

    if (cmd === "takimtd") {
      if (!isStaff(member)) return message.reply("Sadece yöneticiler takım teknik direktörünü değiştirebilir.");
      const target = message.mentions.members.first();
      const teamName = args.slice(0, -1).join(" ");
      const team = getTeam(guildId, teamName);
      if (!team || !target) return message.reply("Kullanım: `.takimtd Galatasaray @üye`");
      team.td = target.id;
      const newTdWallet = ensureWallet(target.id);
      if (!newTdWallet.starterBonusGiven) { newTdWallet.cash += 100000000; newTdWallet.starterBonusGiven = true; }
      saveData();
      return message.reply(`✅ ${team.name} teknik direktörü ${target} olarak ayarlandı.`);
    }

    if (cmd === "kanalayarla") {
      if (!isStaff(member)) return message.reply("Sadece yöneticiler kanal ayarlayabilir.");
      const ch = message.mentions.channels.first();
      const raw = message.content.slice(PREFIX.length + cmd.length).trim().replace(/<#[0-9]+>/, "").trim();
      const bits = raw.split(/\s+/);
      const kind = bits.pop()?.toLowerCase();
      const teamName = bits.join(" ");
      const team = getTeam(guildId, teamName);
      if (!team || !ch || !["sohbet", "kadro"].includes(kind)) return message.reply("Kullanım: `.kanalayarla Galatasaray sohbet #kanal` veya `.kanalayarla Galatasaray kadro #kanal`");
      team.channels ||= {}; team.channels[kind] = ch.id;
      if (team.roleId) {
        await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
        await ch.permissionOverwrites.edit(team.roleId, { ViewChannel: true, SendMessages: kind === "sohbet" });
      }
      if (kind === "kadro") await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      saveData();
      return message.reply(`✅ ${team.name} ${kind} kanalı ${ch} olarak ayarlandı. Rol izinlerini kontrol etmeyi unutma.`);
    }

    if (cmd === "antkanal" || cmd === "penkanal") {
      if (!isStaff(member)) return message.reply("Sadece yöneticiler ayarlayabilir.");
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply(`Kullanım: \`.${cmd} #kanal\``);
      const conf = getConfig(guildId);
      if (cmd === "antkanal") conf.trainingChannel = ch.id; else conf.penaltyChannel = ch.id;
      saveData(); return message.reply(`✅ ${cmd === "antkanal" ? "Antrenman" : "Penaltı"} kanalı ${ch} olarak ayarlandı.`);
    }

    if (cmd === "maas") {
      if (!isTD(member)) return message.reply("Sadece teknik direktörler kullanabilir.");
      const uid = getUserFromMention(args[0]); const amount = parseMoney(args[1]);
      const p = uid && db.players[uid];
      if (!p || !Number.isFinite(amount) || amount <= 0) return message.reply("Kullanım: `.maas @oyuncu 1M`");
      const team = p.team && getTeam(guildId, p.team);
      if (!team || (team.td !== message.author.id && !isStaff(member))) return message.reply("Bu oyuncunun takımının teknik direktörü değilsin.");
      const w = ensureWallet(message.author.id); const total = w.cash + w.bank;
      if (total < amount) return message.reply("Maaş ödemek için yeterli bakiyen yok.");
      const fromCash = Math.min(w.cash, amount); w.cash -= fromCash; w.bank -= (amount - fromCash);
      ensureWallet(uid).cash += amount; p.salary = money(amount); saveData();
      return message.reply(`💶 ${mention(uid)} oyuncusuna ${money(amount)} maaş ödendi.`);
    }

    if (cmd === "kupa") {
      if (!isStaff(member)) return message.reply("Sadece yöneticiler kupa sayısını değiştirebilir.");
      const team = getTeam(guildId, args.slice(0, -1).join(" ")); const count = Number(args.at(-1));
      if (!team || !Number.isInteger(count) || count < 0) return message.reply("Kullanım: `.kupa Galatasaray 5`");
      team.trophies = count; saveData(); return message.reply(`🏆 ${team.name} kupa sayısı: **${count}**`);
    }

    if (cmd === "macsonuc") {
      if (!isStaff(member)) return message.reply("Sadece yöneticiler maç istatistiği girebilir.");
      const result = (args.at(-1) || "").toLowerCase(); const team = getTeam(guildId, args.slice(0, -1).join(" "));
      if (!team || !["g", "b", "m"].includes(result)) return message.reply("Kullanım: `.macsonuc Galatasaray g` (g=galibiyet, b=beraberlik, m=mağlubiyet)");
      if (result === "g") team.wins++; else if (result === "b") team.draws++; else team.losses++;
      saveData(); return message.reply(`📊 ${team.name} maç istatistiği güncellendi.`);
    }

    if (cmd === "oyuncusil") {
      if (!isTD(member)) return message.reply("Sadece teknik direktörler kullanabilir.");
      const uid = getUserFromMention(args[0]); const p = uid && db.players[uid];
      if (!p) return message.reply("Kayıtlı oyuncuyu etiketle: `.oyuncusil @oyuncu`");
      const team = p.team && getTeam(guildId, p.team);
      if (team && team.td !== message.author.id && !isStaff(member)) return message.reply("Bu oyuncu senin takımında değil.");
      if (team) { for (const [pos, id] of Object.entries(team.starters || {})) if (id === uid) delete team.starters[pos]; team.subs = (team.subs || []).filter(x => x !== uid); }
      delete db.players[uid]; saveData(); return message.reply("✅ Oyuncu kaydı silindi.");
    }

    if (cmd === "kap") {
      if (!isTD(member)) return message.reply("Transfer menüsünü sadece teknik direktörler kullanabilir.");
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("transfer:normal").setLabel("Transfer").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("transfer:loan").setLabel("Kiralık").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("transfer:free").setLabel("Serbest").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("transfer:renew").setLabel("Sözleşme Yenile").setStyle(ButtonStyle.Secondary)
      );
      return message.reply({ embeds: [embed("🔄 Transfer Merkezi", "İşlem türünü seç. Sonrasında `.transfer` komutuyla işlemi kaydedebilirsin.")], components: [row] });
    }

    if (cmd === "transferkanal") {
      if (!isStaff(member)) return message.reply("Sadece yöneticiler ayarlayabilir.");
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply("Kullanım: `.transferkanal #kanal`");
      getConfig(guildId).transferChannel = ch.id; saveData(); return message.reply("✅ Transfer duyuru kanalı ayarlandı.");
    }

    if (cmd === "transfer") {
      if (!isTD(member)) return message.reply("Sadece teknik direktörler kullanabilir.");
      const uid = getUserFromMention(args[0]);
      const p = uid && db.players[uid];
      if (!p) return message.reply("Kullanım: `.transfer @oyuncu yeni takım | bedel | maaş | ek madde`");
      const rest = message.content.split(args[0])[1] || "";
      const fields = rest.trim().split("|").map(x => x.trim());
      const team = getTeam(guildId, fields[0] || "");
      if (!team) return message.reply("Yeni takım bulunamadı.");
      const oldTeam = p.team || "Takımsız";
      const sourceTeam = p.team && getTeam(guildId, p.team);
      if (!isStaff(member) && team.td !== message.author.id && sourceTeam?.td !== message.author.id) return message.reply("Bu transferi yalnızca eski veya yeni takımın teknik direktörü yapabilir.");
      const transferType = pendingTransferTypes.get(message.author.id) || fields[4] || "Transfer";
      pendingTransferTypes.delete(message.author.id);
      const fee = transferType === "Serbest Transfer" ? 0 : (parseMoney(fields[1]) || 0);
      const buyerWallet = ensureWallet(team.td);
      if (fee > 0 && buyerWallet.cash + buyerWallet.bank < fee) return message.reply("Yeni takımın teknik direktörünün bonservis için yeterli bakiyesi yok.");
      const fromCash = Math.min(buyerWallet.cash, fee); buyerWallet.cash -= fromCash; buyerWallet.bank -= (fee - fromCash);
      if (sourceTeam && fee > 0) ensureWallet(sourceTeam.td).cash += fee;
      p.team = team.name;
      if (fields[1]) p.transferFee = fields[1];
      if (fields[2]) p.salary = fields[2];
      if (fields[3]) p.addons = fields[3];
      saveData();
      const chId = getConfig(guildId).transferChannel;
      const ch = chId && message.guild.channels.cache.get(chId);
      const card = embed("🔔 TRANSFER TAMAMLANDI", `${mention(uid)}\n**${oldTeam} ➜ ${team.name}**\n${formatPlayer(p)}\n**Bonservis:** ${fields[1] || "Belirtilmedi"}\n**Maaş:** ${fields[2] || "Belirtilmedi"}\n**Ek Madde:** ${p.addons || "Yok"}\n**Tür:** ${transferType}`, 0x3498db);
      if (ch) await ch.send({ embeds: [card] });
      return message.reply({ embeds: [card] });
    }

    if (cmd === "ant") {
      const p = getPlayerByUser(message.author.id);
      if (!p) return message.reply("Önce teknik direktörüne oyuncu kaydı yaptırmalısın.");
      const conf = getConfig(guildId);
      if (conf.trainingChannel && conf.trainingChannel !== message.channel.id) return message.reply("Bu komut sadece antrenman kanalında kullanılabilir.");
      const t = db.training[message.author.id] ||= { count: 0, date: "" };
      t.count++;
      let reward = ""; let shownCount = t.count;
      if (t.count >= 10) {
        shownCount = 10; t.count = 0;
        const old = parseMoney(p.value) || 0;
        p.value = `${(old + 2000000).toLocaleString("tr-TR")}€`;
        reward = "\n🎉 10 antrenman tamamlandı! Oyuncu değerine **+2M€** eklendi.";
      }
      saveData();
      return message.reply({ embeds: [embed("🏋️ Antrenman", `${mention(message.author.id)}\n**İlerleme:** ${shownCount}/10${reward}`, 0x2ecc71)] });
    }

    if (cmd === "pen") {
      const p = getPlayerByUser(message.author.id);
      if (!p) return message.reply("Önce oyuncunu kaydettirmelisin.");
      const conf = getConfig(guildId);
      if (conf.penaltyChannel && conf.penaltyChannel !== message.channel.id) return message.reply("Bu komut sadece penaltı kanalında kullanılabilir.");
      const result = Math.random();
      let title, desc;
      if (result < 0.45) {
        const old = parseMoney(p.value) || 0;
        p.value = `${(old + 3000000).toLocaleString("tr-TR")}€`;
        title = "⚽ GOOOOOL!"; desc = `${mention(message.author.id)} penaltıyı gole çevirdi! Değerine **+3M€** eklendi.`;
      } else if (result < 0.75) { title = "🧤 KALECİ KURTARDI!"; desc = "Kaleci köşeyi doğru tahmin etti. Değer değişmedi."; }
      else { title = "❌ DIŞARI!"; desc = "Şut auta gitti. Değer değişmedi."; }
      saveData(); return message.reply({ embeds: [embed(title, desc, 0xf1c40f)] });
    }


    if (cmd === "başlat" || cmd === "baslat") {
      if (!isStaff(member)) return message.reply("Maçı sadece sunucu yetkilileri başlatabilir.");
      const active = db.activeMatches[guildId];
      if (active) {
        if (!active.paused) return message.reply("Zaten devam eden bir maç var. Durdurmak için `.durdur` yaz.");
        active.paused = false; active.channelId = message.channel.id; saveData(); startMatchTimer(guildId);
        return message.reply(`▶️ Maç devam ediyor! **Dakika ${active.minute}**\n${active.teams.home.name} ${active.score.home} - ${active.score.away} ${active.teams.away.name}`);
      }
      const pair = message.content.slice(PREFIX.length + cmd.length).trim().split("|").map(x => x.trim());
      if (pair.length !== 2 || !pair[0] || !pair[1]) return message.reply("Kullanım: `.başlat Galatasaray | Fenerbahçe`");
      const home = getTeam(guildId, pair[0]), away = getTeam(guildId, pair[1]);
      if (!home || !away || home.name === away.name) return message.reply("İki farklı ve kayıtlı takım adı yazmalısın.");
      const homeIds = [...new Set(Object.values(home.starters || {}).filter(Boolean))];
      const awayIds = [...new Set(Object.values(away.starters || {}).filter(Boolean))];
      if (!homeIds.length || !awayIds.length) return message.reply("Maç için iki takımın da kadrosunda en az bir kayıtlı oyuncu olmalı.");
      const homeRating = matchTeamRating(home), awayRating = matchTeamRating(away);
      const newMatch = {
        guildId, channelId: message.channel.id, minute: 0, paused: false, finished: false,
        teams: { home: { name: home.name, rating: homeRating }, away: { name: away.name, rating: awayRating } },
        lineups: { home: homeIds, away: awayIds }, score: { home: 0, away: 0 }, goals: [],
        stats: { home: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0, saves: 0, offsides: 0, injuries: 0 }, away: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0, saves: 0, offsides: 0, injuries: 0 } },
        playerStats: {}
      };
      for (const uid of [...homeIds, ...awayIds]) matchPlayerStat(newMatch, uid, 'appearances', 0);
      db.activeMatches[guildId] = newMatch; saveData();
      await message.channel.send({ embeds: [embed('⚽ MAÇ BAŞLIYOR', `🏟️ **${home.name}** vs **${away.name}**\n📋 ${home.formation || '4-3-3'} • ${away.formation || '4-3-3'}\n🎮 ${home.tactic || 'Dengeli'} • ${away.tactic || 'Dengeli'}\n\n⏱️ Her 10 saniyede bir maç dakikası ilerleyecek.`, 0x3498db)] });
      startMatchTimer(guildId); return;
    }

    if (cmd === "durdur") {
      if (!isStaff(member)) return message.reply("Maçı sadece sunucu yetkilileri durdurabilir.");
      const match = db.activeMatches[guildId];
      if (!match || match.paused) return message.reply("Durdurulabilecek aktif bir maç yok.");
      match.paused = true; saveData(); await stopMatchTimer(guildId);
      return message.reply(`⏸️ Maç duraklatıldı. **Dakika ${match.minute}** — kaldığı yerden devam etmek için .başlat yaz.`);
    }

    if (cmd === "maçı" && (args[0] || '').toLowerCase() === 'bitir') {
      if (!isStaff(member)) return message.reply("Maçı sadece sunucu yetkilileri bitirebilir.");
      const match = db.activeMatches[guildId];
      if (!match) return message.reply("Aktif maç bulunamadı.");
      await stopMatchTimer(guildId);
      const report = finishMatchStats(match);
      delete db.activeMatches[guildId]; saveData();
      return message.reply({ embeds: [embed(`🏁 MAÇ ${match.minute}. DAKİKADA BİTİRİLDİ`, report, 0xe67e22)] });
    }

    if (cmd === "bal") {
      const w = ensureWallet(message.author.id);
      return message.reply({ embeds: [embed("💰 Bakiye", `👤 Kullanıcı: ${message.author}\n👛 Cüzdan: **${money(w.cash)}**\n🏦 Banka: **${money(w.bank)}**\n💶 Toplam: **${money(w.cash + w.bank)}**`)] });
    }
    if (cmd === "deposit" || cmd === "withdraw") {
      const amount = parseMoney(args[0]);
      const w = ensureWallet(message.author.id);
      if (!Number.isFinite(amount) || amount <= 0) return message.reply(`Kullanım: \`.${cmd} 1000000\``);
      if (cmd === "deposit") {
        if (w.cash < amount) return message.reply("Cüzdanında yeterli para yok.");
        w.cash -= amount; w.bank += amount;
      } else {
        if (w.bank < amount) return message.reply("Bankanda yeterli para yok.");
        w.bank -= amount; w.cash += amount;
      }
      saveData(); return message.reply(`✅ İşlem tamamlandı: **${money(amount)}**`);
    }

    if (cmd === "rolver") {
      if (!isStaff(member)) return message.reply("Bu komut sadece yetkililere açık.");
      const target = message.mentions.members.first();
      const roleName = args.slice(1).join(" ");
      const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
      if (!target || !role) return message.reply("Kullanım: `.rolver @üye rol adı`");
      await target.roles.add(role);
      return message.reply(`✅ ${role.name} rolü verildi.`);
    }

    if (cmd === "mute") {
      if (!isStaff(member)) return message.reply("Bu komut sadece yetkililere açık.");
      const target = message.mentions.members.first(), duration = parseDuration(args[1]);
      if (!target || !duration) return message.reply("Kullanım: `.mute @üye 30m` veya `.mute @üye 1h`");
      await target.timeout(duration, "ProLeague RP moderasyon");
      return message.reply(`🔇 ${target.user.tag} susturuldu.`);
    }
    if (cmd === "ban") {
      if (!isStaff(member)) return message.reply("Bu komut sadece yetkililere açık.");
      const target = message.mentions.members.first();
      if (!target) return message.reply("Kullanım: `.ban @üye sebep`");
      await target.ban({ reason: args.slice(1).join(" ") || "Sebep belirtilmedi" });
      return message.reply(`⛔ ${target.user.tag} sunucudan yasaklandı.`);
    }
    if (cmd === "lock" || cmd === "locked") {
      if (!isStaff(member)) return message.reply("Bu komut sadece yetkililere açık.");
      const everyone = message.guild.roles.everyone;
      await message.channel.permissionOverwrites.edit(everyone, {
        SendMessages: cmd === "locked" ? null : false
      });
      return message.reply(cmd === "lock" ? "🔒 Kanal kilitlendi." : "🔓 Kanal açıldı.");
    }
    if (cmd === "m") {
      const s = db.messages[message.author.id] || { daily: 0, weekly: 0, total: 0, day: "", week: "" };
      resetStatsPeriod(s); saveData();
      return message.reply({ embeds: [embed("💬 Mesaj İstatistikleri", `Günlük: **${s.daily || 0}**\nHaftalık: **${s.weekly || 0}**\nToplam: **${s.total || 0}**`)] });
    }
    if (cmd === "ses") {
      const s = db.voice[message.author.id] || { total: 0, daily: 0, weekly: 0, day: "", week: "" };
      resetStatsPeriod(s); saveData();
      return message.reply({ embeds: [embed("🎙️ Ses İstatistikleri", `Günlük Ses: **${s.daily || 0} sn**\nHaftalık Ses: **${s.weekly || 0} sn**\nToplam Ses: **${s.total || 0} sn**`)] });
    }
  } catch (err) {
    console.error(`Komut hatası (${cmd}):`, err);
    if (!message.replied && !message.deferred) message.reply("❌ İşlem sırasında hata oluştu. Botun gerekli Discord izinlerini kontrol edin.").catch(() => {});
  }
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const id = oldState.id || newState.id;
  const s = db.voice[id] ||= { total: 0, daily: 0, weekly: 0, day: "", week: "" };
  resetStatsPeriod(s);
  if (oldState.channelId && s.joinedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - s.joinedAt) / 1000));
    s.total += seconds; s.daily += seconds; s.weekly += seconds;
    delete s.joinedAt;
  }
  if (newState.channelId) s.joinedAt = Date.now();
  saveData();
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isButton()) {
      const [action, key] = interaction.customId.split(":");
      if (action === "transfer") {
        if (!isTD(interaction.member)) return interaction.reply({ content: "Bu menüyü sadece teknik direktörler kullanabilir.", ephemeral: true });
        const labels = { normal: "Transfer", loan: "Kiralık", free: "Serbest Transfer", renew: "Sözleşme Yenileme" };
        pendingTransferWizards.set(interaction.user.id, { type: labels[key], guildId: interaction.guildId });
        const teams = teamOptions(interaction.guildId);
        if (!teams.length) return interaction.reply({ content: "Önce `.takimkur` ile takımlar oluşturulmalı.", ephemeral: true });
        const menu = new StringSelectMenuBuilder().setCustomId("tw:oldteam").setPlaceholder("Eski takımı seç").addOptions(teams);
        return interaction.reply({ content: `İşlem: **${labels[key]}**\nÖnce eski takımı seç:`, components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
      }
      if (action.startsWith("roster_")) {
        const team = getTeam(interaction.guildId, key);
        if (!team) return interaction.reply({ content: "Takım bulunamadı.", ephemeral: true });
        if (team.td !== interaction.user.id && !isStaff(interaction.member)) return interaction.reply({ content: "Bu kadroyu sadece takımın teknik direktörü yönetebilir.", ephemeral: true });
        if (action === "roster_add" || action === "roster_remove") {
          const opts = registeredOptions(interaction.guildId);
          if (!opts.length) return interaction.reply({ content: "Henüz kayıtlı oyuncu yok.", ephemeral: true });
          const menu = new StringSelectMenuBuilder().setCustomId(`select:${action}:${key}`).setPlaceholder("Oyuncu seç").addOptions(opts);
          return interaction.reply({ content: action === "roster_add" ? "Eklenecek oyuncuyu seç:" : "Çıkarılacak oyuncuyu seç:", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }
        if (action === "roster_captain") {
          const opts = registeredOptions(interaction.guildId);
          if (!opts.length) return interaction.reply({ content: "Kayıtlı oyuncu yok.", ephemeral: true });
          const menu = new StringSelectMenuBuilder().setCustomId(`select:captain:${key}`).setPlaceholder("Kaptan seç").addOptions(opts);
          return interaction.reply({ content: "Kaptan olacak oyuncuyu seç:", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }
        if (action === "roster_tactic") {
          const choices = ["Kontra Atak", "Pas Oyunu", "Direkt Hücum", "Yüksek Pres", "Uzun Topla Kontra", "Tiki-Taka", "Defansif", "Dengeli", "Kanat Oyunu"];
          const menu = new StringSelectMenuBuilder().setCustomId(`select:tactic:${key}`).setPlaceholder("Taktik seç").addOptions(choices.map(x => ({ label: x, value: x })));
          return interaction.reply({ content: "Takım taktiğini seç:", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }
        if (action === "roster_formation") {
          const choices = ["4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "4-4-2", "3-2-4-1", "5-3-2"];
          const menu = new StringSelectMenuBuilder().setCustomId(`select:formation:${key}`).setPlaceholder("Diziliş seç").addOptions(choices.map(x => ({ label: x, value: x })));
          return interaction.reply({ content: "Diziliş seç:", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }
        if (action === "roster_roles") {
          const menu = new StringSelectMenuBuilder().setCustomId(`select:role:${key}`).setPlaceholder("Duran top görevi seç").addOptions([
            { label: "Penaltıcı", value: "penalty" }, { label: "Frikikçi", value: "freekick" }, { label: "Kornerci", value: "corner" }
          ]);
          return interaction.reply({ content: "Görev seç:", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }
        if (action === "roster_corner" || action === "roster_freekick") {
          const opts = action === "roster_corner" ? ["Kısa Pas", "Arka Direk", "Ön Direk"] : ["Kaleye Şut", "Yakın Pas", "Orta"];
          const kind = action === "roster_corner" ? "cornerstyle" : "freekickstyle";
          const menu = new StringSelectMenuBuilder().setCustomId(`select:${kind}:${key}`).setPlaceholder("Tür seç").addOptions(opts.map(x => ({ label: x, value: x })));
          return interaction.reply({ content: "Uygulanacak türü seç:", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }
        if (action === "roster_link") {
          const opts = registeredOptions(interaction.guildId).filter(o => db.players[o.value]?.team === team.name);
          if (opts.length < 2) return interaction.reply({ content: "Bağlantı kurmak için takımda en az iki kayıtlı oyuncu olmalı.", ephemeral: true });
          const menu = new StringSelectMenuBuilder().setCustomId(`select:linkfirst:${key}`).setPlaceholder("İlk oyuncuyu seç").addOptions(opts);
          return interaction.reply({ content: "Bağlantı kurulacak ilk oyuncuyu seç:", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }
      }
    }
    if (interaction.isStringSelectMenu()) {
      const parts = interaction.customId.split(":");
      const [kind, action, key, extraId] = parts;
      if (kind === "tw") {
        const state = pendingTransferWizards.get(interaction.user.id);
        if (!state || state.guildId !== interaction.guildId) return interaction.reply({ content: "Transfer oturumu bulunamadı. `.kap` ile yeniden başla.", ephemeral: true });
        const picked = interaction.values[0];
        if (action === "oldteam") {
          const oldTeam = getTeam(interaction.guildId, picked);
          if (!oldTeam || (oldTeam.td !== interaction.user.id && !isStaff(interaction.member))) return interaction.reply({ content: "Eski takımın teknik direktörü değilsin.", ephemeral: true });
          state.oldTeam = picked;
          const choices = teamOptions(interaction.guildId, state.type === "Sözleşme Yenileme" ? null : picked);
          if (!choices.length) return interaction.update({ content: "Yeni takım bulunamadı.", components: [] });
          const menu = new StringSelectMenuBuilder().setCustomId("tw:newteam").setPlaceholder("Yeni takımı seç").addOptions(choices);
          return interaction.update({ content: `Eski takım: **${picked}**\nŞimdi yeni takımı seç:`, components: [new ActionRowBuilder().addComponents(menu)] });
        }
        if (action === "newteam") {
          state.newTeam = picked;
          const oldTeam = getTeam(interaction.guildId, state.oldTeam);
          const players = Object.values(db.players).filter(p => p.guildId === interaction.guildId && p.team === oldTeam.name).slice(0, 25)
            .map(p => ({ label: (p.name || "Oyuncu").slice(0, 100), description: `${p.position || "?"} • ${p.value || "0€"}`.slice(0, 100), value: p.userId }));
          if (!players.length) return interaction.update({ content: "Eski takımda kayıtlı oyuncu yok.", components: [] });
          const menu = new StringSelectMenuBuilder().setCustomId("tw:player").setPlaceholder("Transfer edilecek oyuncuyu seç").addOptions(players);
          return interaction.update({ content: `**${state.oldTeam} ➜ ${state.newTeam}**\nOyuncuyu seç:`, components: [new ActionRowBuilder().addComponents(menu)] });
        }
        if (action === "player") {
          state.playerId = picked;
          const modal = new ModalBuilder().setCustomId("tw:modal").setTitle("Transfer detayları");
          const fee = new TextInputBuilder().setCustomId("fee").setLabel("Bonservis (ör. 2M€; serbestte 0)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(30);
          const salary = new TextInputBuilder().setCustomId("salary").setLabel("Maaş (ör. 500K€)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(30);
          const addons = new TextInputBuilder().setCustomId("addons").setLabel("Ek maddeler (isteğe bağlı)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300);
          modal.addComponents(new ActionRowBuilder().addComponents(fee), new ActionRowBuilder().addComponents(salary), new ActionRowBuilder().addComponents(addons));
          return interaction.showModal(modal);
        }
      }
      if (kind !== "select") return;
      const team = getTeam(interaction.guildId, key);
      if (!team) return interaction.reply({ content: "Takım bulunamadı.", ephemeral: true });
      if (team.td !== interaction.user.id && !isStaff(interaction.member)) return interaction.reply({ content: "Yetkin yok.", ephemeral: true });
      const value = interaction.values[0];
      if (action === "roster_add" || action === "roster_remove") {
        const p = db.players[value];
        if (!p) return interaction.reply({ content: "Oyuncu bulunamadı.", ephemeral: true });
        if (action === "roster_add") {
          p.team = team.name;
          const posMenu = new StringSelectMenuBuilder().setCustomId(`select:position:${key}:${value}`).setPlaceholder("Mevki seç").addOptions(["KL","STP1","STP2","STP3","SLB","SĞB","DOS1","DOS2","OS","OOS1","OOS2","SLO","SĞO","SNT","SGK","SLK","YEDEK"].map(x => ({ label: x === "YEDEK" ? "Yedek" : x, value: x })));
          return interaction.update({ content: `${mention(value)} için mevki seç:`, components: [new ActionRowBuilder().addComponents(posMenu)] });
        }
        for (const [pos, id] of Object.entries(team.starters || {})) if (id === value) delete team.starters[pos];
        team.subs = (team.subs || []).filter(id => id !== value);
        p.team = null; saveData(); await refreshRosterPanel(interaction.guild, team);
        return interaction.update({ content: "Oyuncu kadrodan çıkarıldı.", components: [] });
      }
      if (action === "position") {
        const uid = extraId;
        team.starters ||= {}; team.subs ||= [];
        if (value === "YEDEK") { if (!team.subs.includes(uid)) team.subs.push(uid); }
        else { team.starters[value] = uid; team.subs = team.subs.filter(x => x !== uid); }
        saveData(); await refreshRosterPanel(interaction.guild, team);
        return interaction.update({ content: value === "YEDEK" ? `✅ ${mention(uid)} yedeklere eklendi.` : `✅ ${mention(uid)} **${value}** mevkiine eklendi.`, components: [] });
      }
      if (action === "captain") { team.captain = value; saveData(); await refreshRosterPanel(interaction.guild, team); return interaction.update({ content: `✅ Kaptan: ${mention(value)}`, components: [] }); }
      if (action === "tactic") { team.tactic = value; saveData(); await refreshRosterPanel(interaction.guild, team); return interaction.update({ content: `✅ Taktik: **${value}**`, components: [] }); }
      if (action === "formation") { team.formation = value; saveData(); await refreshRosterPanel(interaction.guild, team); return interaction.update({ content: `✅ Diziliş: **${value}**`, components: [] }); }
      if (action === "cornerstyle") { team.cornerType = value; saveData(); await refreshRosterPanel(interaction.guild, team); return interaction.update({ content: `✅ Korner tipi: **${value}**`, components: [] }); }
      if (action === "freekickstyle") { team.freeKickType = value; saveData(); await refreshRosterPanel(interaction.guild, team); return interaction.update({ content: `✅ Frikik tipi: **${value}**`, components: [] }); }
      if (action === "linkfirst") {
        const opts = registeredOptions(interaction.guildId).filter(o => db.players[o.value]?.team === team.name && o.value !== value);
        if (!opts.length) return interaction.update({ content: "İkinci oyuncu bulunamadı.", components: [] });
        const menu = new StringSelectMenuBuilder().setCustomId(`select:linksecond:${key}:${value}`).setPlaceholder("İkinci oyuncuyu seç").addOptions(opts);
        return interaction.update({ content: `${mention(value)} ile bağlantı kuracak ikinci oyuncuyu seç:`, components: [new ActionRowBuilder().addComponents(menu)] });
      }
      if (action === "linksecond") {
        const firstId = extraId; const secondId = value;
        team.connections ||= [];
        if (!team.connections.some(c => c.includes(firstId) && c.includes(secondId))) team.connections.push([firstId, secondId]);
        saveData(); await refreshRosterPanel(interaction.guild, team);
        return interaction.update({ content: `🔗 Bağlantı kuruldu: ${mention(firstId)} ↔ ${mention(secondId)}`, components: [] });
      }

      if (action === "role") {
        const opts = registeredOptions(interaction.guildId);
        if (!opts.length) return interaction.reply({ content: "Oyuncu yok.", ephemeral: true });
        const menu = new StringSelectMenuBuilder().setCustomId(`select:assignrole:${key}:${value}`).setPlaceholder("Oyuncuyu seç").addOptions(opts);
        return interaction.update({ content: "Bu görevi vereceğin oyuncuyu seç:", components: [new ActionRowBuilder().addComponents(menu)] });
      }
      if (action === "assignrole") {
        const roleType = extraId; const uid = value;
        team.setPieces ||= {};
        team.setPieces[roleType] = uid; saveData(); await refreshRosterPanel(interaction.guild, team);
        return interaction.update({ content: `✅ Duran top görevi **${roleType}** oyuncuya verildi: ${mention(uid)}`, components: [] });
      }
    }
    if (interaction.isModalSubmit() && interaction.customId === "tw:modal") {
      const state = pendingTransferWizards.get(interaction.user.id);
      if (!state || state.guildId !== interaction.guildId) return interaction.reply({ content: "Transfer oturumu bulunamadı. `.kap` ile yeniden başla.", ephemeral: true });
      const oldTeam = getTeam(interaction.guildId, state.oldTeam);
      const newTeam = getTeam(interaction.guildId, state.newTeam);
      const player = db.players[state.playerId];
      if (!oldTeam || !newTeam || !player || player.team !== oldTeam.name) {
        pendingTransferWizards.delete(interaction.user.id);
        return interaction.reply({ content: "Transfer bilgileri değişmiş. İşlemi yeniden başlat.", ephemeral: true });
      }
      if (oldTeam.td !== interaction.user.id && !isStaff(interaction.member)) return interaction.reply({ content: "Eski takımın teknik direktörü değilsin.", ephemeral: true });
      const feeText = interaction.fields.getTextInputValue("fee").trim();
      const salaryText = interaction.fields.getTextInputValue("salary").trim();
      const addonsText = interaction.fields.getTextInputValue("addons").trim();
      const fee = state.type === "Serbest Transfer" ? 0 : (feeText ? parseMoney(feeText) : 0);
      if (!Number.isFinite(fee) || fee < 0) return interaction.reply({ content: "Bonservis tutarı geçersiz.", ephemeral: true });
      const buyerWallet = ensureWallet(newTeam.td);
      if (fee > 0 && buyerWallet.cash + buyerWallet.bank < fee) return interaction.reply({ content: "Yeni takımın teknik direktörünün yeterli bakiyesi yok.", ephemeral: true });
      const cashPart = Math.min(buyerWallet.cash, fee); buyerWallet.cash -= cashPart; buyerWallet.bank -= (fee - cashPart);
      if (fee > 0) ensureWallet(oldTeam.td).cash += fee;
      if (state.type !== "Sözleşme Yenileme") player.team = newTeam.name;
      if (salaryText) player.salary = salaryText;
      if (addonsText) player.addons = addonsText;
      if (state.type === "Kiralık") player.loan = { from: oldTeam.name, until: null };
      if (state.type === "Sözleşme Yenileme") player.contractRenewedAt = Date.now();
      saveData(); pendingTransferWizards.delete(interaction.user.id);
      const card = embed("🔔 TRANSFER / SÖZLEŞME DUYURUSU", `${mention(player.userId)}\n**${oldTeam.name} ➜ ${newTeam.name}**\n${formatPlayer(player)}\n**Bonservis:** ${feeText || (state.type === "Serbest Transfer" ? "Ücretsiz" : "Belirtilmedi")}\n**Maaş:** ${salaryText || player.salary || "Belirtilmedi"}\n**Ek Madde:** ${addonsText || "Yok"}\n**İşlem:** ${state.type}`, 0x3498db);
      const transferChannelId = getConfig(interaction.guildId).transferChannel;
      const transferChannel = transferChannelId && interaction.guild.channels.cache.get(transferChannelId);
      if (transferChannel) await transferChannel.send({ embeds: [card] });
      return interaction.reply({ embeds: [card], ephemeral: false });
    }
  } catch (e) {
    console.error("Etkileşim hatası:", e);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) interaction.reply({ content: "İşlem sırasında hata oluştu.", ephemeral: true }).catch(() => {});
  }
});

client.login(TOKEN);
