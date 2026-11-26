require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.GuildMember, Partials.Message, Partials.Channel]
});

const PREFIX = '.';
const DATA_DIR = path.join(__dirname, 'data');
const POSITIONS = ['SNT', 'SĞK', 'SLK', 'OOS', 'MO', 'DOS', 'STP', 'KL'];
const INSTANCE_ID = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const CLUB_TEMPLATES = [
  { id: 'galatasaray', name: 'Galatasaray', emoji: '🦁' },
  { id: 'fenerbahce', name: 'Fenerbahçe', emoji: '🐥' },
  { id: 'real-madrid', name: 'Real Madrid', emoji: '👑' },
  { id: 'barcelona', name: 'Barcelona', emoji: '🔴🔵' },
  { id: 'manchester-city', name: 'Manchester City', emoji: '🩵' },
  { id: 'manchester-united', name: 'Manchester United', emoji: '🔴' },
  { id: 'liverpool', name: 'Liverpool', emoji: '🔴' },
  { id: 'arsenal', name: 'Arsenal', emoji: '🔴⚪' },
  { id: 'chelsea', name: 'Chelsea', emoji: '🔵' },
  { id: 'bayern-munih', name: 'Bayern Münih', emoji: '🔴⚪' },
  { id: 'psg', name: 'PSG', emoji: '🔵🔴' },
  { id: 'juventus', name: 'Juventus', emoji: '⚫⚪' },
  { id: 'inter', name: 'Inter', emoji: '⚫🔵' },
  { id: 'milan', name: 'Milan', emoji: '🔴⚫' },
  { id: 'atletico-madrid', name: 'Atletico Madrid', emoji: '🔴⚪' },
  { id: 'borussia-dortmund', name: 'Borussia Dortmund', emoji: '🟡⚫' }
];

const QUIZ_POOL = [
  { id: 'q1', diff: 'Kolay', q: 'Şampiyonlar Ligi tarihinde en çok şampiyon olan kulüp hangisidir?', opts: ['Milan', 'Real Madrid', 'Bayern Münih', 'Liverpool'], ans: 1, reward: 15 },
  { id: 'q2', diff: 'Kolay', q: 'Futbol maçı normal sürede kaç dakikadır?', opts: ['80', '100', '90', '75'], ans: 2, reward: 10 },
  { id: 'q3', diff: 'Orta', q: 'Süper Lig tarihinde üst üste en fazla şampiyon olan takım hangisidir?', opts: ['Fenerbahçe', 'Beşiktaş', 'Trabzonspor', 'Galatasaray'], ans: 3, reward: 20 },
  { id: 'q4', diff: 'Orta', q: 'Bir futbol takımında sahada kaleci dahil en fazla kaç oyuncu bulunur?', opts: ['10', '11', '12', '9'], ans: 1, reward: 20 },
  { id: 'q5', diff: 'Zor', q: '2022 Dünya Kupası finalinde Arjantin hangi takımı penaltılarla yendi?', opts: ['Hırvatistan', 'Brezilya', 'Fransa', 'Hollanda'], ans: 2, reward: 30 }
];

const DEFAULTS = {
  'config.json': {
    registerChannelId: null,
    trainingChannelId: null,
    transfermarktChannelId: null,
    kapApprovalChannelId: null,
    unregisteredRoleId: null,
    registeredRoleId: null,
    autoRoleId: null,
    staffRoleId: null
  },
  'players.json': {},
  'clubs.json': {},
  'fixtures.json': { weeks: [] },
  'matches.json': { active: null },
  'activity.json': { users: {}, dayKey: '' },
  'quiz.json': { active: null, usedIds: [] },
  'kap.json': {}
};

function getDayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function writeJson(file, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const p = path.join(DATA_DIR, file);
  const tmp = `${p}.tmp.${INSTANCE_ID}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function readJson(file) {
  try {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return structuredClone(DEFAULTS[file] ?? {});
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error(`[JSON READ ERR] ${file}:`, err.message);
    return structuredClone(DEFAULTS[file] ?? {});
  }
}

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const [file, def] of Object.entries(DEFAULTS)) {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) writeJson(file, def);
  }
  const clubs = readJson('clubs.json');
  let changed = false;
  for (const tpl of CLUB_TEMPLATES) {
    if (!clubs[tpl.id]) {
      clubs[tpl.id] = {
        id: tpl.id,
        name: tpl.name,
        emoji: tpl.emoji,
        coachId: null,
        captainId: null,
        penaltyId: null,
        freekickId: null,
        cornerId: null,
        tactic: '4-3-3 Hücum',
        xi: [],
        bench: [],
        positions: {},
        form: [],
        stats: { o: 0, g: 0, b: 0, m: 0, ag: 0, yg: 0, p: 0 }
      };
      changed = true;
    } else if (!Array.isArray(clubs[tpl.id].form)) {
      clubs[tpl.id].form = [];
      changed = true;
    }
  }
  if (changed) writeJson('clubs.json', clubs);
}

function getPlayer(userId, fallbackName = 'Oyuncu') {
  const players = readJson('players.json');
  if (!players[userId]) {
    players[userId] = {
      userId,
      name: fallbackName,
      flag: '🇹🇷',
      position: 'STP',
      valueM: 5,
      clubId: null,
      walletM: 0,
      bankM: 0,
      training: 0,
      stats: {
        goals: 0,
        assists: 0,
        matches: 0,
        yellows: 0,
        reds: 0,
        penGoals: 0,
        penMiss: 0,
        motm: 0
      }
    };
    writeJson('players.json', players);
  }
  return players[userId];
}

function savePlayer(player) {
  const players = readJson('players.json');
  players[player.userId] = player;
  writeJson('players.json', players);
}

function formatNick(p) {
  return `${p.name} | ${p.flag} | ${p.position} | ${p.valueM}M€`.slice(0, 32);
}

async function syncNick(member, p) {
  if (!member || !member.manageable) return;
  const nick = formatNick(p);
  if (member.nickname !== nick) {
    await member.setNickname(nick).catch(() => {});
  }
}

function findClub(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  const clubs = readJson('clubs.json');
  return (
    Object.values(clubs).find(
      (c) => c.id === q || c.name.toLowerCase() === q || c.name.toLowerCase().includes(q)
    ) || null
  );
}

function isStaff(member, config) {
  if (!member) return false;
  if (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  ) {
    return true;
  }
  return Boolean(config.staffRoleId && member.roles.cache.has(config.staffRoleId));
}

function canManageClub(member, club, config) {
  if (!member || !club) return false;
  return isStaff(member, config) || club.coachId === member.id;
}

function syncClubRosterFromGuild(guild, club) {
  const role = guild.roles.cache.find((r) => r.name.toLowerCase() === club.name.toLowerCase());
  if (!role) return [];
  const memberIds = [...role.members.keys()];
  const players = readJson('players.json');
  let pChanged = false;
  for (const id of memberIds) {
    const p = getPlayer(id, role.members.get(id).displayName);
    if (p.clubId !== club.id) {
      p.clubId = club.id;
      players[id] = p;
      pChanged = true;
    }
    if (!club.xi.includes(id) && !club.bench.includes(id)) {
      if (club.xi.length < 11) club.xi.push(id);
      else club.bench.push(id);
    }
  }
  club.xi = club.xi.filter((id) => memberIds.includes(id));
  club.bench = club.bench.filter((id) => memberIds.includes(id));
  if (pChanged) writeJson('players.json', players);
  return memberIds;
}

function recordMessageActivity(userId) {
  const act = readJson('activity.json');
  const today = getDayKey();
  if (act.dayKey !== today) {
    act.dayKey = today;
    for (const u of Object.values(act.users)) u.daily = 0;
  }
  if (!act.users[userId]) act.users[userId] = { daily: 0, weekly: 0, monthly: 0, voiceSec: 0 };
  act.users[userId].daily += 1;
  act.users[userId].weekly += 1;
  act.users[userId].monthly += 1;
  writeJson('activity.json', act);
}

const voiceJoinMap = new Map();
client.on('voiceStateUpdate', (oldState, newState) => {
  try {
    const uid = newState.id || oldState.id;
    if (!uid || newState.member?.user.bot) return;
    if (!oldState.channelId && newState.channelId) {
      voiceJoinMap.set(uid, Date.now());
    } else if (oldState.channelId && !newState.channelId) {
      const start = voiceJoinMap.get(uid);
      voiceJoinMap.delete(uid);
      if (start) {
        const sec = Math.max(1, Math.floor((Date.now() - start) / 1000));
        const act = readJson('activity.json');
        if (!act.users[uid]) act.users[uid] = { daily: 0, weekly: 0, monthly: 0, voiceSec: 0 };
        act.users[uid].voiceSec += sec;
        writeJson('activity.json', act);
      }
    }
  } catch (err) {
    console.error('[VOICE ERR]', err.message);
  }
});

let matchTimer = null;

function pickPlayerFromClub(club, fallbackLabel) {
  const pool = club.xi.length > 0 ? club.xi : [...club.xi, ...club.bench];
  const players = readJson('players.json');
  if (pool.length === 0) return { id: null, name: fallbackLabel };
  const chosenId = pool[Math.floor(Math.random() * pool.length)];
  return { id: chosenId, name: players[chosenId]?.name || fallbackLabel };
}

function applyStandings(homeId, awayId, homeGoals, awayGoals) {
  const clubs = readJson('clubs.json');
  const h = clubs[homeId];
  const a = clubs[awayId];
  if (!h || !a) return;

  h.form = Array.isArray(h.form) ? h.form : [];
  a.form = Array.isArray(a.form) ? a.form : [];

  h.stats.o += 1;
  a.stats.o += 1;
  h.stats.ag += homeGoals;
  h.stats.yg += awayGoals;
  a.stats.ag += awayGoals;
  a.stats.yg += homeGoals;

  if (homeGoals > awayGoals) {
    h.stats.g += 1;
    h.stats.p += 3;
    a.stats.m += 1;
    h.form.push('W');
    a.form.push('L');
  } else if (awayGoals > homeGoals) {
    a.stats.g += 1;
    a.stats.p += 3;
    h.stats.m += 1;
    a.form.push('W');
    h.form.push('L');
  } else {
    h.stats.b += 1;
    a.stats.b += 1;
    h.stats.p += 1;
    a.stats.p += 1;
    h.form.push('D');
    a.form.push('D');
  }
  h.form = h.form.slice(-5);
  a.form = a.form.slice(-5);
  writeJson('clubs.json', clubs);
}

async function finishMatch(match, channel) {
  if (matchTimer) {
    clearInterval(matchTimer);
    matchTimer = null;
  }
  const clubs = readJson('clubs.json');
  const players = readJson('players.json');
  const participantIds = [...(clubs[match.homeId]?.xi || []), ...(clubs[match.awayId]?.xi || [])];
  let motmId = null;
  let bestScore = -1;

  for (const pid of participantIds) {
    if (players[pid]) {
      players[pid].stats.matches += 1;
      const g = match.playerContributions[pid]?.goals || 0;
      const as = match.playerContributions[pid]?.assists || 0;
      const sc = g * 5 + as * 3 + Math.random();
      if (sc > bestScore) {
        bestScore = sc;
        motmId = pid;
      }
    }
  }
  if (motmId && players[motmId]) players[motmId].stats.motm += 1;
  writeJson('players.json', players);
  applyStandings(match.homeId, match.awayId, match.homeGoals, match.awayGoals);

  if (match.fixtureWeekIndex !== null && match.fixtureMatchIndex !== null) {
    const fx = readJson('fixtures.json');
    const wk = fx.weeks[match.fixtureWeekIndex];
    if (wk && wk.matches[match.fixtureMatchIndex]) {
      wk.matches[match.fixtureMatchIndex].played = true;
      wk.matches[match.fixtureMatchIndex].score = `${match.homeGoals}-${match.awayGoals}`;
      writeJson('fixtures.json', fx);
    }
  }

  const motmName = motmId && players[motmId] ? players[motmId].name : 'Bilinmiyor';
  const embed = new EmbedBuilder()
    .setTitle(`🏁 MAÇ SONUCU: ${match.homeName} ${match.homeGoals} - ${match.awayGoals} ${match.awayName}`)
    .setColor(0x2ecc71)
    .addFields(
      { name: '⭐ Maçın Oyuncusu', value: motmName, inline: false },
      {
        name: '📊 İstatistikler',
        value:
          `Şut: **${match.stats.home.shots}** - **${match.stats.away.shots}**\n` +
          `İsabetli Şut: **${match.stats.home.shotsOnTarget}** - **${match.stats.away.shotsOnTarget}**\n` +
          `Kurtarış: **${match.stats.home.saves}** - **${match.stats.away.saves}**\n` +
          `Faul: **${match.stats.home.fouls}** - **${match.stats.away.fouls}** | Ofsayt: **${match.stats.home.offsides}** - **${match.stats.away.offsides}**\n` +
          `Sarı Kart: **${match.stats.home.yellows}** - **${match.stats.away.yellows}** | Kırmızı: **${match.stats.home.reds}** - **${match.stats.away.reds}**\n` +
          `Penaltı: **${match.stats.home.pens}** - **${match.stats.away.pens}** | Korner: **${match.stats.home.corners}** - **${match.stats.away.corners}** | Frikik: **${match.stats.home.freekicks}** - **${match.stats.away.freekicks}**`
      }
    );

  if (channel) await channel.send({ embeds: [embed] }).catch(() => {});
  writeJson('matches.json', { active: null });
}

async function simulateOneMinute() {
  const data = readJson('matches.json');
  const match = data.active;
  if (!match || match.status !== 'running') return;

  match.minute += 1;
  match.lastTickAt = Date.now();
  const clubs = readJson('clubs.json');
  const players = readJson('players.json');
  const channel = match.channelId ? await client.channels.fetch(match.channelId).catch(() => null) : null;

  if (match.minute === 45 && !match.halftimeSent) {
    match.halftimeSent = true;
    match.status = 'paused';
    writeJson('matches.json', { active: match });
    if (channel) {
      await channel
        .send(`⏸️ **DEVRE ARASI** — ${match.homeName} **${match.homeGoals}** - **${match.awayGoals}** ${match.awayName}. Devam etmek için \`.başlat\` yazın.`)
        .catch(() => {});
    }
    return;
  }

  if (match.minute > 90) {
    await finishMatch(match, channel);
    return;
  }

  const events = [];
  for (const side of [
    { key: 'home', club: clubs[match.homeId], label: match.homeName },
    { key: 'away', club: clubs[match.awayId], label: match.awayName }
  ]) {
    if (!side.club) continue;
    const st = match.stats[side.key];
    const actor = pickPlayerFromClub(side.club, side.label);

    if (Math.random() < 0.22) {
      st.shots += 1;
      if (Math.random() < 0.48) {
        st.shotsOnTarget += 1;
        if (Math.random() < 0.24) {
          if (side.key === 'home') match.homeGoals += 1;
          else match.awayGoals += 1;

          let assistText = '';
          if (actor.id && players[actor.id]) {
            players[actor.id].stats.goals += 1;
            match.playerContributions[actor.id] = match.playerContributions[actor.id] || { goals: 0, assists: 0 };
            match.playerContributions[actor.id].goals += 1;
          }
          if (Math.random() < 0.65) {
            const assister = pickPlayerFromClub(side.club, side.label);
            if (assister.id && assister.id !== actor.id && players[assister.id]) {
              players[assister.id].stats.assists += 1;
              match.playerContributions[assister.id] = match.playerContributions[assister.id] || { goals: 0, assists: 0 };
              match.playerContributions[assister.id].assists += 1;
              assistText = ` (Asist: **${assister.name}**)`;
            }
          }
          events.push(
            `⚽ **GOL! ${match.minute}'** — **${actor.name}** (${side.label})${assistText} | Skor: **${match.homeName} ${match.homeGoals} - ${match.awayGoals} ${match.awayName}**`
          );
        } else {
          st.saves += 1;
          events.push(`🧤 **${match.minute}'** — **${actor.name}** (${side.label}) şut çekti, kaleci kurtardı!`);
        }
      } else {
        events.push(`🎯 **${match.minute}'** — **${actor.name}** (${side.label}) dışarı vurdu.`);
      }
    }

    if (Math.random() < 0.13) {
      st.fouls += 1;
      if (Math.random() < 0.22) {
        st.yellows += 1;
        if (actor.id && players[actor.id]) players[actor.id].stats.yellows += 1;
        events.push(`🟨 **SARI KART ${match.minute}'** — **${actor.name}** (${side.label})`);
      } else if (Math.random() < 0.04) {
        st.reds += 1;
        if (actor.id && players[actor.id]) players[actor.id].stats.reds += 1;
        events.push(`🟥 **KIRMIZI KART ${match.minute}'** — **${actor.name}** (${side.label}) oyundan atıldı!`);
      }
    }

    if (Math.random() < 0.08) {
      st.offsides += 1;
      events.push(`🚩 **OFSAYT ${match.minute}'** — **${actor.name}** (${side.label})`);
    }
    if (Math.random() < 0.08) {
      st.corners += 1;
      events.push(`📐 **KORNER ${match.minute}'** — ${side.label} köşe vuruşu kazandı.`);
    }
    if (Math.random() < 0.07) {
      st.freekicks += 1;
      events.push(`🎯 **SERBEST VURUŞ ${match.minute}'** — **${actor.name}** (${side.label})`);
    }
    if (Math.random() < 0.025) {
      st.pens += 1;
      if (Math.random() < 0.72) {
        if (side.key === 'home') match.homeGoals += 1;
        else match.awayGoals += 1;
        if (actor.id && players[actor.id]) {
          players[actor.id].stats.goals += 1;
          match.playerContributions[actor.id] = match.playerContributions[actor.id] || { goals: 0, assists: 0 };
          match.playerContributions[actor.id].goals += 1;
        }
        events.push(`⚽🎯 **PENALTI GOLÜ! ${match.minute}'** — **${actor.name}** (${side.label}) ağları sarstı!`);
      } else {
        events.push(`❌🎯 **PENALTI KAÇTI! ${match.minute}'** — **${actor.name}** (${side.label}) penaltıdan yararlanamadı.`);
      }
    }

    if ((match.minute === 60 || match.minute === 75) && side.club.bench.length > 0 && side.club.xi.length > 0 && Math.random() < 0.5) {
      const outId = side.club.xi[Math.floor(Math.random() * side.club.xi.length)];
      const inId = side.club.bench[0];
      side.club.xi = side.club.xi.map((id) => (id === outId ? inId : id));
      side.club.bench = side.club.bench.filter((id) => id !== inId).concat(outId);
      const outName = players[outId]?.name || 'Oyuncu';
      const inName = players[inId]?.name || 'Yedek';
      events.push(`🔄 **DEĞİŞİKLİK ${match.minute}'** (${side.label}) — Giren: **${inName}**, Çıkan: **${outName}**`);
    }
  }

  writeJson('players.json', players);
  writeJson('clubs.json', clubs);
  writeJson('matches.json', { active: match });

  if (events.length > 0 && channel) {
    await channel.send(events.join('\n')).catch(() => {});
  }
}

function startMatchLoop() {
  if (matchTimer) clearInterval(matchTimer);
  matchTimer = setInterval(() => {
    simulateOneMinute().catch((err) => console.error('[MATCH TICK ERR]', err.message));
  }, 10000);
}

const inFlightMessages = new Map();

async function runCommandOnce(message, handler) {
  if (inFlightMessages.has(message.id)) return inFlightMessages.get(message.id);
  const task = (async () => {
    try {
      await handler();
    } finally {
      setTimeout(() => inFlightMessages.delete(message.id), 30000);
    }
  })();
  inFlightMessages.set(message.id, task);
  return task;
}

client.on('guildMemberAdd', async (member) => {
  try {
    const config = readJson('config.json');
    const roles = [config.unregisteredRoleId, config.autoRoleId].filter(Boolean);
    if (roles.length > 0) await member.roles.add(roles).catch(() => {});
  } catch (err) {
    console.error('[MEMBER ADD ERR]', err.message);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (inFlightMessages.has(message.id)) return;

  return runCommandOnce(message, async () => {
    recordMessageActivity(message.author.id);
    if (!message.content.startsWith(PREFIX)) return;

    const raw = message.content.slice(PREFIX.length).trim();
    if (!raw) return;

    const args = raw.split(/\s+/);
    const cmd = args.shift().toLowerCase();
    const config = readJson('config.json');

    if (cmd === 'k') {
      if (config.registerChannelId && message.channel.id !== config.registerChannelId) {
        return message.reply('❌ Bu komut yalnızca kayıt kanalında çalışır.');
      }
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Kullanım: `.k @oyuncu İsim | 🇹🇷 | STP | 5M€`');
      const body = raw.slice(1).replace(/<@!?\d+>/, '').trim();
      const parts = body.split('|').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 4) return message.reply('❌ Örnek: `.k @oyuncu Ali | 🇹🇷 | STP | 5M€`');

      const [name, flag, posRaw, valRaw] = parts;
      const p = getPlayer(target.id, name);
      p.name = name;
      p.flag = flag;
      if (POSITIONS.includes(posRaw.toUpperCase())) p.position = posRaw.toUpperCase();
      const val = parseFloat(valRaw.replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(val) && val >= 0) p.valueM = val;
      savePlayer(p);

      if (config.unregisteredRoleId && target.roles.cache.has(config.unregisteredRoleId)) {
        await target.roles.remove(config.unregisteredRoleId).catch(() => {});
      }
      if (config.registeredRoleId) await target.roles.add(config.registeredRoleId).catch(() => {});
      await syncNick(target, p);

      return message.reply(`✅ **${p.name}** kaydedildi! (${p.flag} | ${p.position} | ${p.valueM}M€)`);
    }

    if (cmd === 'değerver' || cmd === 'degerver') {
      if (!isStaff(message.member, config)) return message.reply('❌ Yetkin yok.');
      const target = message.mentions.members.first();
      const numArg = args.find((a) => !a.startsWith('<@'));
      const addVal = numArg ? parseFloat(numArg.replace(/[^0-9.-]/g, '')) : NaN;
      if (!target || Number.isNaN(addVal)) return message.reply('❌ Kullanım: `.değerver @oyuncu 5M`');
      const p = getPlayer(target.id, target.displayName);
      p.valueM = Math.max(0, Number((p.valueM + addVal).toFixed(2)));
      savePlayer(p);
      await syncNick(target, p);
      return message.reply(`📈 **${p.name}** yeni değeri: **${p.valueM}M€** (${addVal >= 0 ? '+' : ''}${addVal}M€)`);
    }

    if (cmd === 'kariyer') {
      const target = message.mentions.users.first() || message.author;
      const p = getPlayer(target.id, target.username);
      const clubs = readJson('clubs.json');
      const clubName = p.clubId && clubs[p.clubId] ? `${clubs[p.clubId].emoji || '⚽'} ${clubs[p.clubId].name}` : 'Kulüpsüz';
      const embed = new EmbedBuilder()
        .setTitle(`📋 Kariyer: ${p.name} ${p.flag}`)
        .setColor(0x3498db)
        .addFields(
          { name: 'Takım', value: clubName, inline: true },
          { name: 'Mevki', value: p.position, inline: true },
          { name: 'Değer', value: `${p.valueM}M€`, inline: true },
          { name: 'Maç', value: `${p.stats.matches}`, inline: true },
          { name: 'Gol', value: `${p.stats.goals}`, inline: true },
          { name: 'Asist', value: `${p.stats.assists}`, inline: true },
          { name: 'Sarı / Kırmızı', value: `${p.stats.yellows} / ${p.stats.reds}`, inline: true },
          { name: 'Antrenman', value: `${p.training}/10`, inline: true }
        );
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ara') {
      const query = args.join(' ').trim().toLowerCase();
      if (!query) return message.reply('❌ Kullanım: `.ara Messi`');
      const matches = Object.values(readJson('players.json')).filter(
        (p) => p.name.toLowerCase().includes(query) || p.position.toLowerCase() === query
      );
      if (matches.length === 0) return message.reply(`🔍 **${query}** için oyuncu bulunamadı.`);
      return message.reply(
        `🔎 **Arama Sonuçları (${query}):**\n` +
          matches
            .slice(0, 10)
            .map((p) => `• **${p.name}** ${p.flag} | \`${p.position}\` | **${p.valueM}M€** | ⚽ ${p.stats.goals} | 🅰️ ${p.stats.assists}`)
            .join('\n')
      );
    }

    if (cmd === 'takim' || cmd === 'takım') {
      const club = findClub(args[0]);
      if (!club) {
        const list = Object.values(readJson('clubs.json')).map((c) => `${c.emoji || '⚽'} ${c.name}`).join(', ');
        return message.reply(`❌ Geçersiz takım. Takımlar: ${list}`);
      }
      const clubs = readJson('clubs.json');
      const liveClub = clubs[club.id];
      syncClubRosterFromGuild(message.guild, liveClub);
      const action = (args[1] || '').toLowerCase();

      if (action === 'ekle') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return message.reply('❌ Kullanım: `.takim Galatasaray ekle @üye`');
        const p = getPlayer(mem.id, mem.displayName);
        p.clubId = liveClub.id;
        savePlayer(p);
        if (!liveClub.xi.includes(mem.id) && !liveClub.bench.includes(mem.id)) {
          if (liveClub.xi.length < 11) liveClub.xi.push(mem.id);
          else liveClub.bench.push(mem.id);
        }
        const role = message.guild.roles.cache.find((r) => r.name.toLowerCase() === liveClub.name.toLowerCase());
        if (role) await mem.roles.add(role).catch(() => {});
        writeJson('clubs.json', clubs);
        return message.reply(`✅ **${p.name}** → **${liveClub.name}** kadrosuna eklendi.`);
      }

      if (action === 'cikar' || action === 'çıkar') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return message.reply('❌ Kullanım: `.takim Galatasaray çıkar @üye`');
        liveClub.xi = liveClub.xi.filter((id) => id !== mem.id);
        liveClub.bench = liveClub.bench.filter((id) => id !== mem.id);
        const p = getPlayer(mem.id, mem.displayName);
        if (p.clubId === liveClub.id) {
          p.clubId = null;
          savePlayer(p);
        }
        const role = message.guild.roles.cache.find((r) => r.name.toLowerCase() === liveClub.name.toLowerCase());
        if (role) await mem.roles.remove(role).catch(() => {});
        writeJson('clubs.json', clubs);
        return message.reply(`✅ **${p.name}** kadrodan çıkarıldı.`);
      }

      if (action === 'mevki') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        const pos = (args[3] || '').toUpperCase();
        if (!mem || !POSITIONS.includes(pos)) return message.reply('❌ Kullanım: `.takim Galatasaray mevki @üye STP`');
        liveClub.positions[mem.id] = pos;
        const p = getPlayer(mem.id, mem.displayName);
        p.position = pos;
        savePlayer(p);
        await syncNick(mem, p);
        writeJson('clubs.json', clubs);
        return message.reply(`✅ **${p.name}** mevkisi **${pos}** yapıldı.`);
      }

      if (action === 'kaptan') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return message.reply('❌ Kullanım: `.takim Galatasaray kaptan @üye`');
        liveClub.captainId = mem.id;
        writeJson('clubs.json', clubs);
        return message.reply(`©️ **${liveClub.name}** kaptanı: <@${mem.id}>`);
      }

      if (action === 'penaltici' || action === 'penaltıcı') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return message.reply('❌ Kullanım: `.takim Galatasaray penaltıcı @üye`');
        liveClub.penaltyId = mem.id;
        writeJson('clubs.json', clubs);
        return message.reply(`🎯 **${liveClub.name}** penaltıcısı: <@${mem.id}>`);
      }

      if (action === 'frikikci' || action === 'frikikçi') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return message.reply('❌ Kullanım: `.takim Galatasaray frikikçi @üye`');
        liveClub.freekickId = mem.id;
        writeJson('clubs.json', clubs);
        return message.reply(`🏹 **${liveClub.name}** frikikçisi: <@${mem.id}>`);
      }

      if (action === 'kornerci') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return message.reply('❌ Kullanım: `.takim Galatasaray kornerci @üye`');
        liveClub.cornerId = mem.id;
        writeJson('clubs.json', clubs);
        return message.reply(`📐 **${liveClub.name}** kornercisi: <@${mem.id}>`);
      }

      if (action === 'taktik') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const tac = args.slice(2).join(' ').trim();
        if (!tac) return message.reply('❌ Kullanım: `.takim Galatasaray taktik 4-3-3 Hücum`');
        liveClub.tactic = tac;
        writeJson('clubs.json', clubs);
        return message.reply(`🧠 **${liveClub.name}** taktiği **${tac}** yapıldı.`);
      }

      if (action === '11') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return message.reply('❌ Kullanım: `.takim Galatasaray 11 @üye`');
        liveClub.bench = liveClub.bench.filter((id) => id !== mem.id);
        if (!liveClub.xi.includes(mem.id)) liveClub.xi.push(mem.id);
        writeJson('clubs.json', clubs);
        return message.reply(`✅ <@${mem.id}> İlk 11'e alındı.`);
      }

      if (action === 'yedek') {
        if (!canManageClub(message.member, liveClub, config)) return message.reply('❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return message.reply('❌ Kullanım: `.takim Galatasaray yedek @üye`');
        liveClub.xi = liveClub.xi.filter((id) => id !== mem.id);
        if (!liveClub.bench.includes(mem.id)) liveClub.bench.push(mem.id);
        writeJson('clubs.json', clubs);
        return message.reply(`✅ <@${mem.id}> Yedeğe alındı.`);
      }

      writeJson('clubs.json', clubs);
      const players = readJson('players.json');
      const fmt = (arr) =>
        arr.length > 0
          ? arr.map((id, i) => `${i + 1}. ${players[id]?.name || `<@${id}>`} (\`${liveClub.positions[id] || players[id]?.position || 'STP'}\`)`).join('\n')
          : 'Oyuncu yok';

      const embed = new EmbedBuilder()
        .setTitle(`${liveClub.emoji || '⚽'} ${liveClub.name} Kadro & Taktik`)
        .setColor(0xe67e22)
        .addFields(
          { name: '🧠 Taktik', value: liveClub.tactic, inline: true },
          { name: '©️ Kaptan', value: liveClub.captainId ? `<@${liveClub.captainId}>` : 'Seçilmedi', inline: true },
          {
            name: '🎯 Duran Toplar',
            value: `Pen: ${liveClub.penaltyId ? `<@${liveClub.penaltyId}>` : '-'} | Frikik: ${liveClub.freekickId ? `<@${liveClub.freekickId}>` : '-'} | Korner: ${liveClub.cornerId ? `<@${liveClub.cornerId}>` : '-'}`,
            inline: false
          },
          { name: '🟢 İlk 11', value: fmt(liveClub.xi), inline: false },
          { name: '🟡 Yedekler', value: fmt(liveClub.bench), inline: false }
        );
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'başlat' || cmd === 'baslat') {
      const mData = readJson('matches.json');
      if (mData.active && mData.active.status === 'paused') {
        mData.active.status = 'running';
        mData.active.lastTickAt = Date.now();
        writeJson('matches.json', mData);
        startMatchLoop();
        return message.reply(`▶️ Maç devam ediyor! (**${mData.active.minute}'**)`);
      }
      if (mData.active && mData.active.status === 'running') {
        return message.reply('⚠️ Zaten devam eden bir maç var.');
      }

      const [hRaw, aRaw] = raw.slice(cmd.length).trim().split('|').map((s) => s.trim());
      const home = findClub(hRaw);
      const away = findClub(aRaw);
      if (!home || !away || home.id === away.id) {
        return message.reply('❌ Kullanım: `.başlat Galatasaray | Fenerbahçe`');
      }

      writeJson('matches.json', {
        active: {
          homeId: home.id,
          awayId: away.id,
          homeName: home.name,
          awayName: away.name,
          channelId: message.channel.id,
          minute: 0,
          homeGoals: 0,
          awayGoals: 0,
          status: 'running',
          halftimeSent: false,
          lastTickAt: Date.now(),
          fixtureWeekIndex: null,
          fixtureMatchIndex: null,
          playerContributions: {},
          stats: {
            home: { shots: 0, shotsOnTarget: 0, saves: 0, fouls: 0, offsides: 0, yellows: 0, reds: 0, pens: 0, corners: 0, freekicks: 0 },
            away: { shots: 0, shotsOnTarget: 0, saves: 0, fouls: 0, offsides: 0, yellows: 0, reds: 0, pens: 0, corners: 0, freekicks: 0 }
          }
        }
      });
      startMatchLoop();
      return message.reply(`⚽ **MAÇ BAŞLADI:** ${home.emoji || '⚽'} **${home.name}** vs **${away.name}** ${away.emoji || '⚽'}`);
    }

    if (cmd === 'durdur') {
      const mData = readJson('matches.json');
      if (!mData.active || mData.active.status !== 'running') return message.reply('❌ Durdurulacak aktif maç yok.');
      mData.active.status = 'paused';
      writeJson('matches.json', mData);
      if (matchTimer) {
        clearInterval(matchTimer);
        matchTimer = null;
      }
      return message.reply(`⏸️ Maç **${mData.active.minute}. dakikada** durduruldu.`);
    }

    if (cmd === 'maçı' && (args[0] || '').toLowerCase() === 'bitir') {
      const mData = readJson('matches.json');
      if (!mData.active) return message.reply('❌ Aktif maç yok.');
      await finishMatch(mData.active, message.channel);
      return message.reply('🏁 Maç sonlandırıldı ve istatistikler işlendi.');
    }

    if (cmd === 'fiksür' || cmd === 'fikstür' || cmd === 'fikstur') {
      const fx = readJson('fixtures.json');
      const clubs = readJson('clubs.json');

      if (!fx.weeks || fx.weeks.length === 0) {
        const ids = Object.keys(clubs);
        const weeks = [];
        const totalWeeks = ids.length - 1;
        const half = ids.length / 2;
        const rotating = ids.slice(1);
        for (let w = 0; w < totalWeeks; w++) {
          const round = [ids[0], ...rotating];
          const matches = [];
          for (let i = 0; i < half; i++) {
            matches.push({ homeId: round[i], awayId: round[round.length - 1 - i], played: false, score: null });
          }
          weeks.push({ week: w + 1, matches });
          rotating.unshift(rotating.pop());
        }
        fx.weeks = weeks;
        writeJson('fixtures.json', fx);
      }

      const weekNum = parseInt(args[0], 10) || 1;
      const wk = fx.weeks[weekNum - 1];
      if (!wk) return message.reply(`❌ ${weekNum}. hafta bulunamadı.`);

      const lines = wk.matches.map((m, idx) => {
        const h = clubs[m.homeId]?.name || m.homeId;
        const a = clubs[m.awayId]?.name || m.awayId;
        const mid = m.played && m.score ? `**${m.score}**` : '**VS**';
        return `\`${idx + 1}.\` ${h} ${mid} ${a}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📅 ${weekNum}. HAFTA FİKSTÜRÜ (${wk.matches.length} maç)`)
        .setColor(0x5865f2)
        .setDescription(lines.join('\n'));
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'puandurum') {
      const clubs = Object.values(readJson('clubs.json')).sort((a, b) => {
        if (b.stats.p !== a.stats.p) return b.stats.p - a.stats.p;
        const avDiff = b.stats.ag - b.stats.yg - (a.stats.ag - a.stats.yg);
        return avDiff !== 0 ? avDiff : b.stats.ag - a.stats.ag;
      });

      const formIcon = (f) => (f === 'W' ? '🟢' : f === 'D' ? '🟡' : f === 'L' ? '🔴' : '⚪');
      const rows = clubs.map((c, idx) => {
        const av = c.stats.ag - c.stats.yg;
        const avStr = av >= 0 ? `+${av}` : `${av}`;
        const fStr = (c.form || []).slice(-5).map(formIcon).join('') || '⚪⚪⚪⚪⚪';
        const tag = idx === 0 ? ' 👑 **LİDER**' : '';
        return `**${idx + 1}.** ${c.emoji || '⚽'} **${c.name}**${tag}\n` +
          `O: \`${c.stats.o}\` | G: \`${c.stats.g}\` | B: \`${c.stats.b}\` | M: \`${c.stats.m}\` | AG: \`${c.stats.ag}\` | YG: \`${c.stats.yg}\` | AV: \`${avStr}\` | **P: ${c.stats.p}** | ${fStr}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🏆 PUAN DURUMU — Genel Durum')
        .setColor(0xf59e0b)
        .setDescription(rows.slice(0, 16).join('\n\n'));
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'golkrallığı' || cmd === 'golkralligi') {
      const players = Object.values(readJson('players.json'))
        .sort((a, b) => (b.stats?.goals || 0) - (a.stats?.goals || 0))
        .slice(0, 10);
      const clubs = readJson('clubs.json');

      const desc =
        players.length > 0
          ? players
              .map((p, idx) => {
                const cName = p.clubId && clubs[p.clubId] ? clubs[p.clubId].name : 'Kulüpsüz';
                const crown = idx === 0 ? '👑 ' : '';
                return `**${idx + 1}.** ${crown}**${p.name}** ${p.flag || ''} — *${cName}* → **${p.stats?.goals || 0} GOL**`;
              })
              .join('\n')
          : 'Henüz gol kaydı bulunmuyor.';

      const embed = new EmbedBuilder()
        .setTitle('⚽ GOL KRALLIĞI — İlk 10')
        .setColor(0xfacc15)
        .setDescription(desc);
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'kap') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('kap_btn_transfer').setLabel('📋 Kap').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('kap_btn_loan').setLabel('Kiralık Kap').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('kap_btn_free').setLabel('Serbest Kap').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('kap_btn_renew').setLabel('Sözleşme yenileme').setStyle(ButtonStyle.Success)
      );
      return message.reply({ content: '📢 **PROLEAGUE TRANSFER & KAP MERKEZİ** — İşlem türünü seçin:', components: [row] });
    }

    if (cmd === 'ant') {
      if (config.trainingChannelId && message.channel.id !== config.trainingChannelId) {
        return message.reply('❌ Bu komut yalnızca antrenman kanalında çalışır.');
      }
      const p = getPlayer(message.author.id, message.member.displayName);
      p.training += 1;
      let bonus = '';
      if (p.training >= 10) {
        p.training = 0;
        p.valueM = Number((p.valueM + 2).toFixed(2));
        bonus = `\n🎉 **10 antrenman tamamlandı! +2M€ değer → Yeni değer: ${p.valueM}M€**`;
        await syncNick(message.member, p);
      }
      savePlayer(p);
      return message.reply(`🏋️ **${p.name}** antrenman yaptı! İlerleme: **${p.training}/10**${bonus}`);
    }

    if (cmd === 'pen') {
      const p = getPlayer(message.author.id, message.member.displayName);
      const roll = Math.random();
      if (roll < 0.65) {
        p.stats.penGoals += 1;
        p.stats.goals += 1;
        p.valueM = Number((p.valueM + 3).toFixed(2));
        savePlayer(p);
        await syncNick(message.member, p);
        return message.reply(`⚽🎯 **GOL!** **${p.name}** penaltıyı gole çevirdi! **+3M€** değer (Yeni: **${p.valueM}M€**).`);
      } else if (roll < 0.88) {
        p.stats.penMiss += 1;
        savePlayer(p);
        return message.reply(`🧤 **KURTARIŞ!** Kaleci **${p.name}** oyuncusunun penaltısını çıkardı!`);
      } else {
        p.stats.penMiss += 1;
        savePlayer(p);
        return message.reply(`❌ **KAÇTI!** **${p.name}** penaltıyı dışarı attı.`);
      }
    }

    if (cmd === 'bal') {
      const target = message.mentions.users.first() || message.author;
      const p = getPlayer(target.id, target.username);
      const coached = Object.values(readJson('clubs.json')).find((c) => c.coachId === target.id);
      if (coached && p.bankM === 0 && p.walletM === 0) {
        p.bankM = 100;
        savePlayer(p);
      }
      return message.reply(`💰 **${p.name}** Bakiye:\n• Cüzdan: **${p.walletM}M€**\n• Banka: **${p.bankM}M€**`);
    }

    if (cmd === 'deposit') {
      const amt = parseFloat(args[0]);
      if (Number.isNaN(amt) || amt <= 0) return message.reply('❌ Kullanım: `.deposit 20`');
      const p = getPlayer(message.author.id, message.member.displayName);
      if (p.walletM < amt) return message.reply('❌ Cüzdanında yeterli bakiye yok.');
      p.walletM = Number((p.walletM - amt).toFixed(2));
      p.bankM = Number((p.bankM + amt).toFixed(2));
      savePlayer(p);
      return message.reply(`🏦 **${amt}M€** bankaya yatırıldı. Cüzdan: **${p.walletM}M€** | Banka: **${p.bankM}M€**`);
    }

    if (cmd === 'withdraw') {
      const amt = parseFloat(args[0]);
      if (Number.isNaN(amt) || amt <= 0) return message.reply('❌ Kullanım: `.withdraw 20`');
      const p = getPlayer(message.author.id, message.member.displayName);
      if (p.bankM < amt) return message.reply('❌ Bankada yeterli bakiye yok.');
      p.bankM = Number((p.bankM - amt).toFixed(2));
      p.walletM = Number((p.walletM + amt).toFixed(2));
      savePlayer(p);
      return message.reply(`💵 **${amt}M€** bankadan çekildi. Cüzdan: **${p.walletM}M€** | Banka: **${p.bankM}M€**`);
    }

    if (cmd === 'balver') {
      if (!isStaff(message.member, config)) return message.reply('❌ Yetkin yok.');
      const target = message.mentions.members.first();
      const numArg = args.find((a) => !a.startsWith('<@'));
      const amt = numArg ? parseFloat(numArg) : NaN;
      if (!target || Number.isNaN(amt)) return message.reply('❌ Kullanım: `.balver @üye 50`');
      const p = getPlayer(target.id, target.displayName);
      p.walletM = Number((p.walletM + amt).toFixed(2));
      savePlayer(p);
      return message.reply(`✅ **${p.name}** cüzdanına **${amt}M€** eklendi (Yeni: **${p.walletM}M€**).`);
    }

    if (cmd === 'quiz') {
      const qData = readJson('quiz.json');
      const available = QUIZ_POOL.filter((item) => !qData.usedIds.includes(item.id));
      if (available.length === 0) return message.reply('🏁 Tüm quiz soruları tüketildi!');

      const chosen = available[Math.floor(Math.random() * available.length)];
      const quizMsg = await message.reply(
        `🧠 **FUTBOL QUİZ (${chosen.diff})** — Ödül: **${chosen.reward}M€** (Süre: 5 dk)\n**${chosen.q}**\n` +
          chosen.opts.map((o, idx) => `**${idx + 1}.** ${o}`).join('\n') +
          `\n*Cevap için 1, 2, 3 veya 4 yazın.*`
      );

      qData.active = { id: chosen.id, ans: String(chosen.ans + 1), reward: chosen.reward };
      writeJson('quiz.json', qData);

      const collector = message.channel.createMessageCollector({
        filter: (m) => !m.author.bot && ['1', '2', '3', '4'].includes(m.content.trim()),
        time: 5 * 60 * 1000,
        max: 1
      });

      collector.on('collect', async (ansMsg) => {
        const latest = readJson('quiz.json');
        if (!latest.active || latest.active.id !== chosen.id) return;
        if (ansMsg.content.trim() === latest.active.ans) {
          latest.usedIds.push(chosen.id);
          latest.active = null;
          writeJson('quiz.json', latest);

          const winner = getPlayer(ansMsg.author.id, ansMsg.member?.displayName || ansMsg.author.username);
          winner.walletM = Number((winner.walletM + chosen.reward).toFixed(2));
          savePlayer(winner);
          await ansMsg.reply(`🏆 Tebrikler <@${ansMsg.author.id}>! Doğru cevap ve **+${chosen.reward}M€** (.bal) ödülü senin!`);
        } else {
          await ansMsg.reply(`❌ Yanlış cevap <@${ansMsg.author.id}>!`);
        }
      });

      collector.on('end', async () => {
        const latest = readJson('quiz.json');
        if (latest.active?.id === chosen.id) {
          latest.active = null;
          writeJson('quiz.json', latest);
          await quizMsg.edit(`${quizMsg.content}\n\n⏰ Süre doldu.`).catch(() => {});
        }
      });
    }

    if (cmd === 'sil') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ Yetkin yok.');
      const count = parseInt(args[0], 10);
      if (!count || count < 1 || count > 100) return message.reply('❌ Kullanım: `.sil 10`');
      await message.delete().catch(() => {});
      const deleted = await message.channel.bulkDelete(count, true).catch(() => null);
      const info = await message.channel.send(`🧹 **${deleted ? deleted.size : 0}** mesaj silindi.`);
      setTimeout(() => info.delete().catch(() => {}), 4000);
      return;
    }

    if (cmd === 'rolver') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return message.reply('❌ Yetkin yok.');
      const mem = message.mentions.members.first();
      const role = message.mentions.roles.first();
      if (!mem || !role) return message.reply('❌ Kullanım: `.rolver @üye @rol`');
      await mem.roles.add(role);
      return message.reply(`✅ <@${mem.id}> kullanıcısına **${role.name}** rolü verildi.`);
    }

    if (cmd === 'rolal') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return message.reply('❌ Yetkin yok.');
      const mem = message.mentions.members.first();
      const role = message.mentions.roles.first();
      if (!mem || !role) return message.reply('❌ Kullanım: `.rolal @üye @rol`');
      await mem.roles.remove(role);
      return message.reply(`✅ <@${mem.id}> kullanıcısından **${role.name}** rolü alındı.`);
    }

    if (cmd === 'lock') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ Yetkin yok.');
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      return message.reply('🔒 Kanal kilitlendi.');
    }

    if (cmd === 'unlock') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ Yetkin yok.');
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      return message.reply('🔓 Kanal kilidi açıldı.');
    }

    if (cmd === 'mute') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkin yok.');
      const mem = message.mentions.members.first();
      const durStr = args[1] || '1h';
      const match = durStr.match(/^(\d+)(s|m|h|d)$/i);
      if (!mem || !match) return message.reply('❌ Kullanım: `.mute @üye 1h`');
      const val = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const ms = unit === 's' ? val * 1000 : unit === 'm' ? val * 60000 : unit === 'h' ? val * 3600000 : val * 86400000;
      await mem.timeout(ms, 'PROLEAGUE Mute');
      return message.reply(`🔇 <@${mem.id}> **${durStr}** susturuldu.`);
    }

    if (cmd === 'ban') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Yetkin yok.');
      const mem = message.mentions.members.first();
      if (!mem) return message.reply('❌ Kullanım: `.ban @üye sebep`');
      const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
      await mem.ban({ reason });
      return message.reply(`🔨 **${mem.user.tag}** yasaklandı. Sebep: ${reason}`);
    }

    if (cmd === 'oto-rol') {
      if (!isStaff(message.member, config)) return message.reply('❌ Yetkin yok.');
      const role = message.mentions.roles.first();
      if (!role) return message.reply('❌ Kullanım: `.oto-rol @rol`');
      config.autoRoleId = role.id;
      writeJson('config.json', config);
      return message.reply(`✅ Otomatik rol ayarlandı: **${role.name}**`);
    }

    if (cmd === 'oto-rol-kapat') {
      if (!isStaff(message.member, config)) return message.reply('❌ Yetkin yok.');
      config.autoRoleId = null;
      writeJson('config.json', config);
      return message.reply('✅ Otomatik rol kapatıldı.');
    }

    if (cmd === 'm') {
      const target = message.mentions.users.first() || message.author;
      const u = readJson('activity.json').users[target.id] || { daily: 0, weekly: 0, monthly: 0 };
      return message.reply(`💬 **${target.username} Mesaj İstatistikleri:**\n• Günlük: **${u.daily}**\n• Haftalık: **${u.weekly}**\n• Aylık: **${u.monthly}**`);
    }

    if (cmd === 'ses') {
      const target = message.mentions.users.first() || message.author;
      const sec = readJson('activity.json').users[target.id]?.voiceSec || 0;
      return message.reply(`🎙️ **${target.username} Ses Aktivitesi:** **${Math.floor(sec / 60)} dk** (${sec} sn)`);
    }

    if (cmd === 'yardım' || cmd === 'yardim') {
      const embed = new EmbedBuilder()
        .setTitle('⚽ PROLEAGUE RP — Komut Menüsü')
        .setColor(0x1abc9c)
        .addFields(
          {
            name: '👤 Oyuncu & Lig',
            value:
              '`.kariyer [@üye]` • `.ara <isim/mevki>` • `.takim <Takım>`\n' +
              '`.fiksür [hafta]` • `.puandurum` • `.golkrallığı` • `.kap` • `.ant` • `.pen`\n' +
              '`.bal [@üye]` • `.deposit <miktar>` • `.withdraw <miktar>` • `.quiz`\n' +
              '`.m [@üye]` • `.ses [@üye]` • `.yardım`'
          },
          {
            name: '🛡️ Yetkili & TD',
            value:
              '`.k @üye İsim | Ülke | Mevki | Değer` • `.değerver @üye <miktar>`\n' +
              '`.takim <Takım> ekle/çıkar/mevki/kaptan/penaltıcı/frikikçi/kornerci/taktik/11/yedek`\n' +
              '`.başlat Takım1 | Takım2` • `.durdur` • `.maçı bitir`\n' +
              '`.balver @üye <miktar>` • `.sil <sayı>` • `.rolver` • `.rolal` • `.lock` • `.unlock` • `.mute` • `.ban`\n' +
              '`.oto-rol @rol` • `.oto-rol-kapat` • `.ayar`'
          }
        );
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ayar') {
      if (!isStaff(message.member, config)) return message.reply('❌ Yetkin yok.');
      const key = (args[0] || '').toLowerCase();
      if (key === 'kayit') {
        config.registerChannelId = message.channel.id;
        writeJson('config.json', config);
        return message.reply('✅ Kayıt kanalı ayarlandı.');
      }
      if (key === 'antrenman') {
        config.trainingChannelId = message.channel.id;
        writeJson('config.json', config);
        return message.reply('✅ Antrenman kanalı ayarlandı.');
      }
      if (key === 'transfermarkt') {
        config.transfermarktChannelId = message.channel.id;
        writeJson('config.json', config);
        return message.reply('✅ Transfermarkt kanalı ayarlandı.');
      }
      if (key === 'kaponay') {
        config.kapApprovalChannelId = message.channel.id;
        writeJson('config.json', config);
        return message.reply('✅ KAP onay kanalı ayarlandı.');
      }
      if (key === 'td') {
        const club = findClub(args[1]);
        const mem = message.mentions.members.first();
        if (!club || !mem) return message.reply('❌ Kullanım: `.ayar td Galatasaray @td`');
        const clubs = readJson('clubs.json');
        clubs[club.id].coachId = mem.id;
        writeJson('clubs.json', clubs);
        const p = getPlayer(mem.id, mem.displayName);
        if (p.walletM === 0 && p.bankM === 0) {
          p.bankM = 100;
          savePlayer(p);
        }
        return message.reply(`✅ **${club.name}** Teknik Direktörü <@${mem.id}> oldu (Başlangıç bütçesi: **100M€**).`);
      }
      return message.reply('ℹ️ Kullanım: `.ayar kayit | antrenman | transfermarkt | kaponay` veya `.ayar td <Takım> @üye`');
    }
  });
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('kap_btn_')) {
        const typeMap = {
          kap_btn_transfer: 'KAP',
          kap_btn_loan: 'Kiralık KAP',
          kap_btn_free: 'Serbest KAP',
          kap_btn_renew: 'Sözleşme Yenileme'
        };
        const kapType = typeMap[interaction.customId] || 'KAP';
        const modal = new ModalBuilder()
          .setCustomId(`kap_modal_${encodeURIComponent(kapType)}`)
          .setTitle(`${kapType} Başvurusu`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Oyuncu').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fromClub').setLabel('Eski Takım').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('toClub').setLabel('Yeni Takım').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('deal').setLabel('Maaş & Bonservis').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('extra').setLabel('Ek Maddeler').setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('kap_approve_') || interaction.customId.startsWith('kap_reject_')) {
        const config = readJson('config.json');
        if (!isStaff(interaction.member, config)) {
          return interaction.reply({ content: '❌ Onay/Ret yetkin yok.', ephemeral: true });
        }
        const isApprove = interaction.customId.startsWith('kap_approve_');
        const kapId = interaction.customId.replace(/^kap_(approve|reject)_/, '');
        const kaps = readJson('kap.json');
        const item = kaps[kapId];
        if (!item) return interaction.reply({ content: '❌ KAP kaydı bulunamadı.', ephemeral: true });
        if (item.status !== 'pending') return interaction.reply({ content: '⚠️ Bu KAP zaten sonuçlandırıldı.', ephemeral: true });

        item.status = isApprove ? 'approved' : 'rejected';
        writeJson('kap.json', kaps);

        if (isApprove) {
          const targetClub = findClub(item.toClub);
          const clubs = readJson('clubs.json');
          const players = readJson('players.json');
          const matchedPlayer = Object.values(players).find(
            (p) => p.name.toLowerCase() === item.player.toLowerCase() || `<@${p.userId}>` === item.player.trim()
          );

          if (targetClub && matchedPlayer) {
            const oldClub = matchedPlayer.clubId && clubs[matchedPlayer.clubId] ? clubs[matchedPlayer.clubId] : null;
            if (oldClub) {
              oldClub.xi = oldClub.xi.filter((id) => id !== matchedPlayer.userId);
              oldClub.bench = oldClub.bench.filter((id) => id !== matchedPlayer.userId);
              const oldRole = interaction.guild.roles.cache.find((r) => r.name.toLowerCase() === oldClub.name.toLowerCase());
              const mem = await interaction.guild.members.fetch(matchedPlayer.userId).catch(() => null);
              if (oldRole && mem) await mem.roles.remove(oldRole).catch(() => {});
            }

            matchedPlayer.clubId = targetClub.id;
            players[matchedPlayer.userId] = matchedPlayer;
            writeJson('players.json', players);

            if (!clubs[targetClub.id].bench.includes(matchedPlayer.userId)) {
              clubs[targetClub.id].bench.push(matchedPlayer.userId);
            }
            writeJson('clubs.json', clubs);

            const newRole = interaction.guild.roles.cache.find((r) => r.name.toLowerCase() === targetClub.name.toLowerCase());
            const mem = await interaction.guild.members.fetch(matchedPlayer.userId).catch(() => null);
            if (newRole && mem) await mem.roles.add(newRole).catch(() => {});
          }

          if (config.transfermarktChannelId) {
            const tmCh = await client.channels.fetch(config.transfermarktChannelId).catch(() => null);
            if (tmCh) {
              const annEmbed = new EmbedBuilder()
                .setTitle(`📢 RESMİ ${item.kapType.toUpperCase()} DUYURUSU`)
                .setColor(0xf1c40f)
                .addFields(
                  { name: 'Oyuncu', value: item.player, inline: true },
                  { name: 'Eski → Yeni Takım', value: `${item.fromClub} ➡️ ${item.toClub}`, inline: true },
                  { name: 'Maaş & Bonservis', value: item.deal, inline: false },
                  { name: 'Ek Maddeler', value: item.extra || 'Yok', inline: false }
                );
              await tmCh.send({ embeds: [annEmbed] }).catch(() => {});
            }
          }
          await interaction.update({ content: `✅ **ONAYLANDI** (${item.kapType} — ${item.player})`, components: [] });
        } else {
          await interaction.update({ content: `❌ **REDDEDİLDİ** (${item.kapType} — ${item.player})`, components: [] });
        }
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('kap_modal_')) {
      const kapType = decodeURIComponent(interaction.customId.replace('kap_modal_', ''));
      const player = interaction.fields.getTextInputValue('player').trim();
      const fromClub = interaction.fields.getTextInputValue('fromClub').trim();
      const toClub = interaction.fields.getTextInputValue('toClub').trim();
      const deal = interaction.fields.getTextInputValue('deal').trim();
      const extra = interaction.fields.getTextInputValue('extra').trim();

      const kapId = `kap_${Date.now()}`;
      const kaps = readJson('kap.json');
      kaps[kapId] = { kapId, kapType, player, fromClub, toClub, deal, extra, status: 'pending', authorId: interaction.user.id };
      writeJson('kap.json', kaps);

      const embed = new EmbedBuilder()
        .setTitle(`📝 Yeni ${kapType} Başvurusu`)
        .setColor(0x9b59b6)
        .addFields(
          { name: 'Başvuran', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Oyuncu', value: player, inline: true },
          { name: 'Eski → Yeni Takım', value: `${fromClub} ➡️ ${toClub}`, inline: false },
          { name: 'Maaş & Bonservis', value: deal, inline: true },
          { name: 'Ek Maddeler', value: extra || 'Yok', inline: false }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`kap_approve_${kapId}`).setLabel('Onayla').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`kap_reject_${kapId}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
      );

      const config = readJson('config.json');
      const targetCh = config.kapApprovalChannelId
        ? await client.channels.fetch(config.kapApprovalChannelId).catch(() => interaction.channel)
        : interaction.channel;

      await targetCh.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ KAP başvurusu yetkili onayına gönderildi.', ephemeral: true });
    }
  } catch (err) {
    console.error('[INTERACTION ERR]', err.message);
  }
});

client.once('ready', () => {
  ensureStorage();
  const mData = readJson('matches.json');
  if (mData.active && mData.active.status === 'running') {
    const elapsedSec = Math.floor((Date.now() - (mData.active.lastTickAt || Date.now())) / 1000);
    const catchUpMins = Math.max(0, Math.floor(elapsedSec / 10));
    mData.active.minute = Math.min(90, mData.active.minute + catchUpMins);
    mData.active.lastTickAt = Date.now();
    writeJson('matches.json', mData);
    startMatchLoop();
    console.log(`[MATCH RESUME] Aktif maç ${mData.active.minute}. dakikadan devam ediyor.`);
  }
  console.log(`[PROLEAGUE RP] Aktif: ${client.user.tag} | Instance: ${INSTANCE_ID}`);
});

client.login(process.env.DISCORD_TOKEN);
