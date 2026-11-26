require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
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
  AttachmentBuilder,
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
  { id: 'galatasaray', name: 'Galatasaray', short: 'GS', color: '#f59e0b', emoji: '🦁' },
  { id: 'fenerbahce', name: 'Fenerbahçe', short: 'FB', color: '#facc15', emoji: '🐥' },
  { id: 'real-madrid', name: 'Real Madrid', short: 'RMA', color: '#e2e8f0', emoji: '👑' },
  { id: 'barcelona', name: 'Barcelona', short: 'BAR', color: '#9333ea', emoji: '🔴🔵' },
  { id: 'manchester-city', name: 'Manchester City', short: 'MCI', color: '#38bdf8', emoji: '🩵' },
  { id: 'manchester-united', name: 'Manchester United', short: 'MUN', color: '#ef4444', emoji: '🔴' },
  { id: 'liverpool', name: 'Liverpool', short: 'LIV', color: '#dc2626', emoji: '🔴' },
  { id: 'arsenal', name: 'Arsenal', short: 'ARS', color: '#f43f5e', emoji: '🔴⚪' },
  { id: 'chelsea', name: 'Chelsea', short: 'CHE', color: '#2563eb', emoji: '🔵' },
  { id: 'bayern-munih', name: 'Bayern Münih', short: 'BAY', color: '#e11d48', emoji: '🔴⚪' },
  { id: 'psg', name: 'PSG', short: 'PSG', color: '#3b82f6', emoji: '🔵🔴' },
  { id: 'juventus', name: 'Juventus', short: 'JUV', color: '#cbd5e1', emoji: '⚫⚪' },
  { id: 'inter', name: 'Inter', short: 'INT', color: '#0284c7', emoji: '⚫🔵' },
  { id: 'milan', name: 'Milan', short: 'MIL', color: '#f97316', emoji: '🔴⚫' },
  { id: 'atletico-madrid', name: 'Atletico Madrid', short: 'ATM', color: '#fb7185', emoji: '🔴⚪' },
  { id: 'borussia-dortmund', name: 'Borussia Dortmund', short: 'BVB', color: '#eab308', emoji: '🟡⚫' }
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
        short: tpl.short,
        color: tpl.color,
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
    } else {
      if (!clubs[tpl.id].short) clubs[tpl.id].short = tpl.short;
      if (!clubs[tpl.id].color) clubs[tpl.id].color = tpl.color;
      if (!Array.isArray(clubs[tpl.id].form)) clubs[tpl.id].form = [];
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
      avatarUrl: null,
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
  return Object.values(clubs).find(
    (c) => c.id === q || c.name.toLowerCase() === q || c.name.toLowerCase().includes(q)
  ) || null;
}

function isStaff(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator) || member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return true;
  }
  if (config.staffRoleId && member.roles.cache.has(config.staffRoleId)) return true;
  return false;
}

function canManageClub(member, club, config) {
  if (!member || !club) return false;
  if (isStaff(member, config)) return true;
  return club.coachId === member.id;
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
    for (const u of Object.values(act.users)) {
      u.daily = 0;
    }
  }
  if (!act.users[userId]) {
    act.users[userId] = { daily: 0, weekly: 0, monthly: 0, voiceSec: 0 };
  }
  act.users[userId].daily += 1;
  act.users[userId].weekly += 1;
  act.users[userId].monthly += 1;
  writeJson('activity.json', act);
}

const voiceJoinMap = new Map();
client.on('voiceStateUpdate', (oldState, newState) => {
  try {
    const uid = newState.id || oldState.id;
    if (!uid || (newState.member && newState.member.user.bot)) return;
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

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawClubCrest(ctx, cx, cy, radius, club) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#182235';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = club?.color || '#60a5fa';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(11, Math.floor(radius * 0.72))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((club?.short || 'CLB').slice(0, 3), cx, cy + 1);
  ctx.restore();
}

async function renderFixtureImage(weekNumber, matches, clubsMap) {
  const rows = matches.length;
  const width = 1040;
  const height = 220 + rows * 76 + 50;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#070b14');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1e293b';
  roundRect(ctx, width / 2 - 75, 26, 150, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PROLEAGUE', width / 2, 46);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(`${weekNumber}. HAFTA FİKSTÜRÜ`, width / 2, 98);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.fillText(`${rows} maç`, width / 2, 128);

  matches.forEach((m, idx) => {
    const y = 160 + idx * 76;
    const home = clubsMap[m.homeId] || { name: m.homeId, short: 'EV', color: '#38bdf8' };
    const away = clubsMap[m.awayId] || { name: m.awayId, short: 'DEP', color: '#f97316' };

    const rowGrad = ctx.createLinearGradient(60, y, width - 60, y);
    rowGrad.addColorStop(0, '#132238');
    rowGrad.addColorStop(0.5, '#0f172a');
    rowGrad.addColorStop(1, '#261829');

    ctx.fillStyle = rowGrad;
    roundRect(ctx, 60, y, width - 120, 62, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawClubCrest(ctx, 102, y + 31, 20, home);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(home.name, 134, y + 38);

    const centerText = m.played && m.score ? m.score : 'VS';
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, width / 2 - 36, y + 15, 72, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(centerText, width / 2, y + 37);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(away.name, width - 134, y + 38);
    drawClubCrest(ctx, width - 102, y + 31, 20, away);
  });

  return canvas.toBuffer('image/png');
}

async function renderStandingsImage(sortedClubs) {
  const rows = sortedClubs.length;
  const width = 1060;
  const height = 190 + rows * 54 + 40;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PUAN DURUMU', width / 2, 54);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px sans-serif';
  ctx.fillText('Genel Durum', width / 2, 80);

  const cols = [
    { label: '#', x: 85, align: 'center' },
    { label: 'TAKIM', x: 130, align: 'left' },
    { label: 'O', x: 470, align: 'center' },
    { label: 'G', x: 515, align: 'center' },
    { label: 'B', x: 560, align: 'center' },
    { label: 'M', x: 605, align: 'center' },
    { label: 'AG', x: 655, align: 'center' },
    { label: 'YG', x: 705, align: 'center' },
    { label: 'AV', x: 755, align: 'center' },
    { label: 'P', x: 805, align: 'center' },
    { label: 'FORM', x: 925, align: 'center' }
  ];

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px sans-serif';
  for (const c of cols) {
    ctx.textAlign = c.align;
    ctx.fillText(c.label, c.x, 122);
  }

  sortedClubs.forEach((club, idx) => {
    const y = 138 + idx * 54;
    const isLeader = idx === 0;
    const av = club.stats.ag - club.stats.yg;

    ctx.fillStyle = isLeader ? '#2a1f0d' : '#111827';
    roundRect(ctx, 55, y, width - 110, 46, 10);
    ctx.fill();

    ctx.lineWidth = isLeader ? 2 : 1;
    ctx.strokeStyle = isLeader ? '#f59e0b' : 'rgba(255,255,255,0.06)';
    ctx.stroke();

    ctx.fillStyle = isLeader ? '#f59e0b' : '#cbd5e1';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(idx + 1), 85, y + 28);

    drawClubCrest(ctx, 145, y + 23, 15, club);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(club.name, 170, y + (isLeader ? 21 : 28));

    if (isLeader) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('LİDER', 170, y + 37);
    }

    const vals = [
      club.stats.o,
      club.stats.g,
      club.stats.b,
      club.stats.m,
      club.stats.ag,
      club.stats.yg,
      av >= 0 ? `+${av}` : String(av),
      club.stats.p
    ];
    const xs = [470, 515, 560, 605, 655, 705, 755, 805];

    vals.forEach((v, i) => {
      ctx.textAlign = 'center';
      ctx.font = i === 7 ? 'bold 17px sans-serif' : '15px sans-serif';
      ctx.fillStyle = i === 7 ? '#ffffff' : i === 6 ? (av >= 0 ? '#4ade80' : '#f87171') : '#cbd5e1';
      ctx.fillText(String(v), xs[i], y + 28);
    });

    const formArr = Array.isArray(club.form) && club.form.length > 0 ? club.form.slice(-5) : ['N', 'N', 'N', 'N', 'N'];
    for (let k = 0; k < 5; k++) {
      const code = formArr[k] || 'N';
      const dotColor = code === 'W' ? '#22c55e' : code === 'D' ? '#eab308' : code === 'L' ? '#ef4444' : '#475569';
      ctx.beginPath();
      ctx.arc(872 + k * 24, y + 23, 7, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
    }
  });

  return canvas.toBuffer('image/png');
}

async function renderTopScorersImage(playersList, clubsMap) {
  const top10 = playersList.slice(0, 10);
  const width = 920;
  const height = 175 + Math.max(1, top10.length) * 72 + 35;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GOL KRALLIĞI', width / 2, 56);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.fillText('İlk 10', width / 2, 86);

  if (top10.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px sans-serif';
    ctx.fillText('Henüz gol kaydı bulunmuyor.', width / 2, 175);
    return canvas.toBuffer('image/png');
  }

  for (let i = 0; i < top10.length; i++) {
    const p = top10[i];
    const y = 120 + i * 72;
    const isFirst = i === 0;
    const club = p.clubId ? clubsMap[p.clubId] : null;

    ctx.fillStyle = isFirst ? '#261e0e' : '#111827';
    roundRect(ctx, 50, y, width - 100, 62, 14);
    ctx.fill();

    ctx.lineWidth = isFirst ? 2 : 1;
    ctx.strokeStyle = isFirst ? '#eab308' : 'rgba(255,255,255,0.07)';
    ctx.stroke();

    ctx.fillStyle = isFirst ? '#facc15' : '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 82, y + 37);

    const avX = 126;
    const avY = y + 31;
    let avatarDrawn = false;
    if (p.avatarUrl) {
      try {
        const img = await loadImage(p.avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, 21, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, avX - 21, avY - 21, 42, 42);
        ctx.restore();
        avatarDrawn = true;
      } catch {
        avatarDrawn = false;
      }
    }
    if (!avatarDrawn) {
      ctx.beginPath();
      ctx.arc(avX, avY, 21, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText((p.name || 'O').slice(0, 1).toUpperCase(), avX, avY + 5);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${p.name} ${p.flag || ''}`, 160, y + 27);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText(club ? club.name : 'Kulüpsüz', 160, y + 48);

    ctx.fillStyle = isFirst ? '#facc15' : '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(p.stats?.goals || 0), width - 122, y + 36);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('GOL', width - 82, y + 36);
  }

  return canvas.toBuffer('image/png');
}

let matchTimer = null;

function pickPlayerFromClub(club, fallbackLabel) {
  const pool = club.xi.length > 0 ? club.xi : [...club.xi, ...club.bench];
  const players = readJson('players.json');
  if (pool.length === 0) return { id: null, name: fallbackLabel };
  const chosenId = pool[Math.floor(Math.random() * pool.length)];
  const p = players[chosenId];
  return { id: chosenId, name: p ? p.name : fallbackLabel };
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
  match.status = 'finished';
  const clubs = readJson('clubs.json');
  const players = readJson('players.json');
  const homeClub = clubs[match.homeId];
  const awayClub = clubs[match.awayId];

  const participantIds = [...(homeClub?.xi || []), ...(awayClub?.xi || [])];
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
  if (motmId && players[motmId]) {
    players[motmId].stats.motm += 1;
  }
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

  if (channel) {
    await channel.send({ embeds: [embed] }).catch(() => {});
  }

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
  const homeClub = clubs[match.homeId];
  const awayClub = clubs[match.awayId];
  const channel = match.channelId ? await client.channels.fetch(match.channelId).catch(() => null) : null;

  if (match.minute === 45 && !match.halftimeSent) {
    match.halftimeSent = true;
    match.status = 'paused';
    writeJson('matches.json', { active: match });
    if (channel) {
      await channel.send(`⏸️ **DEVRE ARASI** — ${match.homeName} **${match.homeGoals}** - **${match.awayGoals}** ${match.awayName}. Devam etmek için \`.başlat\` yazın.`).catch(() => {});
    }
    return;
  }

  if (match.minute > 90) {
    await finishMatch(match, channel);
    return;
  }

  const events = [];
  const sides = [
    { key: 'home', club: homeClub, label: match.homeName },
    { key: 'away', club: awayClub, label: match.awayName }
  ];

  for (const side of sides) {
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
          events.push(`⚽ **GOL! ${match.minute}'** — **${actor.name}** (${side.label})${assistText} | Skor: **${match.homeName} ${match.homeGoals} - ${match.awayGoals} ${match.awayName}**`);
        } else {
          st.saves += 1;
          events.push(`🧤 **${match.minute}'** — **${actor.name}** (${side.label}) net şut çekti, kaleci kurtardı!`);
        }
      } else {
        events.push(`🎯 **${match.minute}'** — **${actor.name}** (${side.label}) dışarı vurdu.`);
      }
    }

    if (Math.random() < 0.14) {
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

    if (Math.random() < 0.09) {
      st.offsides += 1;
      events.push(`🚩 **OFSAYT ${match.minute}'** — **${actor.name}** (${side.label})`);
    }
    if (Math.random() < 0.09) {
      st.corners += 1;
      events.push(`📐 **KORNER ${match.minute}'** — ${side.label} köşe vuruşu kazandı.`);
    }
    if (Math.random() < 0.08) {
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

const processingMessages = new Set();
const repliedMessages = new Set();

async function sendOnce(message, payload) {
  if (repliedMessages.has(message.id)) return null;
  repliedMessages.add(message.id);
  setTimeout(() => repliedMessages.delete(message.id), 30000);
  return message.reply(payload).catch(() => null);
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
  if (processingMessages.has(message.id)) return;
  processingMessages.add(message.id);
  setTimeout(() => processingMessages.delete(message.id), 30000);

  try {
    recordMessageActivity(message.author.id);

    if (!message.content.startsWith(PREFIX)) return;
    const raw = message.content.slice(PREFIX.length).trim();
    if (!raw) return;

    const args = raw.split(/\s+/);
    const cmd = args.shift().toLowerCase();
    const config = readJson('config.json');

    if (cmd === 'k') {
      if (config.registerChannelId && message.channel.id !== config.registerChannelId) {
        return sendOnce(message, '❌ Bu komut yalnızca kayıt kanalında çalışır.');
      }
      const target = message.mentions.members.first();
      if (!target) return sendOnce(message, '❌ Kullanım: `.k @oyuncu İsim | 🇹🇷 | STP | 5M€`');

      const body = raw.slice(1).replace(/<@!?\d+>/, '').trim();
      const parts = body.split('|').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 4) return sendOnce(message, '❌ Örnek: `.k @oyuncu Ali | 🇹🇷 | STP | 5M€`');

      const [name, flag, posRaw, valRaw] = parts;
      const pos = posRaw.toUpperCase();
      const val = parseFloat(valRaw.replace(/[^0-9.]/g, ''));

      const p = getPlayer(target.id, name);
      p.name = name;
      p.flag = flag;
      if (POSITIONS.includes(pos)) p.position = pos;
      if (!Number.isNaN(val) && val >= 0) p.valueM = val;
      p.avatarUrl = target.user.displayAvatarURL({ extension: 'png', size: 128 });
      savePlayer(p);

      if (config.unregisteredRoleId && target.roles.cache.has(config.unregisteredRoleId)) {
        await target.roles.remove(config.unregisteredRoleId).catch(() => {});
      }
      if (config.registeredRoleId) {
        await target.roles.add(config.registeredRoleId).catch(() => {});
      }
      await syncNick(target, p);

      return sendOnce(message, `✅ **${p.name}** kaydedildi! (${p.flag} | ${p.position} | ${p.valueM}M€)`);
    }

    if (cmd === 'değerver' || cmd === 'degerver') {
      if (!isStaff(message.member, config)) return sendOnce(message, '❌ Yetkin yok.');
      const target = message.mentions.members.first();
      const numArg = args.find((a) => !a.startsWith('<@'));
      const addVal = numArg ? parseFloat(numArg.replace(/[^0-9.-]/g, '')) : NaN;
      if (!target || Number.isNaN(addVal)) return sendOnce(message, '❌ Kullanım: `.değerver @oyuncu 5M`');

      const p = getPlayer(target.id, target.displayName);
      p.valueM = Math.max(0, Number((p.valueM + addVal).toFixed(2)));
      savePlayer(p);
      await syncNick(target, p);

      return sendOnce(message, `📈 **${p.name}** yeni değeri: **${p.valueM}M€** (${addVal >= 0 ? '+' : ''}${addVal}M€)`);
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
      return sendOnce(message, { embeds: [embed] });
    }

    if (cmd === 'ara') {
      const query = args.join(' ').trim().toLowerCase();
      if (!query) return sendOnce(message, '❌ Kullanım: `.ara Messi`');
      const players = readJson('players.json');
      const matches = Object.values(players).filter(
        (p) => p.name.toLowerCase().includes(query) || p.position.toLowerCase() === query
      );
      if (matches.length === 0) return sendOnce(message, `🔍 **${query}** için oyuncu bulunamadı.`);

      const lines = matches.slice(0, 10).map(
        (p) => `• **${p.name}** ${p.flag} | \`${p.position}\` | **${p.valueM}M€** | ⚽ ${p.stats.goals} | 🅰️ ${p.stats.assists}`
      );
      return sendOnce(message, `🔎 **Arama Sonuçları (${query}):**\n${lines.join('\n')}`);
    }

    if (cmd === 'takim' || cmd === 'takım') {
      const club = findClub(args[0]);
      if (!club) {
        const list = Object.values(readJson('clubs.json')).map((c) => `${c.emoji || '⚽'} ${c.name}`).join(', ');
        return sendOnce(message, `❌ Geçersiz takım. Takımlar: ${list}`);
      }

      const clubs = readJson('clubs.json');
      const liveClub = clubs[club.id];
      syncClubRosterFromGuild(message.guild, liveClub);
      const action = (args[1] || '').toLowerCase();

      if (action === 'ekle') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Bu takımın kadrosunu yönetme yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray ekle @oyuncu`');
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
        return sendOnce(message, `✅ **${p.name}** → **${liveClub.name}** kadrosuna eklendi.`);
      }

      if (action === 'cikar' || action === 'çıkar') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Bu takımın kadrosunu yönetme yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray çıkar @oyuncu`');
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
        return sendOnce(message, `✅ **${p.name}** kadrodan çıkarıldı.`);
      }

      if (action === 'mevki') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        const pos = (args[3] || '').toUpperCase();
        if (!mem || !POSITIONS.includes(pos)) {
          return sendOnce(message, `❌ Kullanım: \`.takim ${liveClub.name} mevki @oyuncu STP\` (${POSITIONS.join(', ')})`);
        }
        liveClub.positions[mem.id] = pos;
        const p = getPlayer(mem.id, mem.displayName);
        p.position = pos;
        savePlayer(p);
        await syncNick(mem, p);
        writeJson('clubs.json', clubs);
        return sendOnce(message, `✅ **${p.name}** mevkisi **${pos}** yapıldı.`);
      }

      if (action === 'kaptan') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray kaptan @oyuncu`');
        liveClub.captainId = mem.id;
        writeJson('clubs.json', clubs);
        return sendOnce(message, `©️ **${liveClub.name}** yeni kaptanı: <@${mem.id}>`);
      }

      if (action === 'penaltici' || action === 'penaltıcı') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray penaltıcı @oyuncu`');
        liveClub.penaltyId = mem.id;
        writeJson('clubs.json', clubs);
        return sendOnce(message, `🎯 **${liveClub.name}** penaltıcısı: <@${mem.id}>`);
      }

      if (action === 'frikikci' || action === 'frikikçi') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray frikikçi @oyuncu`');
        liveClub.freekickId = mem.id;
        writeJson('clubs.json', clubs);
        return sendOnce(message, `🏹 **${liveClub.name}** frikikçisi: <@${mem.id}>`);
      }

      if (action === 'kornerci') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray kornerci @oyuncu`');
        liveClub.cornerId = mem.id;
        writeJson('clubs.json', clubs);
        return sendOnce(message, `📐 **${liveClub.name}** kornercisi: <@${mem.id}>`);
      }

      if (action === 'taktik') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Yetkin yok.');
        const tac = args.slice(2).join(' ').trim();
        if (!tac) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray taktik 4-3-3 Hücum`');
        liveClub.tactic = tac;
        writeJson('clubs.json', clubs);
        return sendOnce(message, `🧠 **${liveClub.name}** taktiği **${tac}** olarak ayarlandı.`);
      }

      if (action === '11') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray 11 @oyuncu`');
        liveClub.bench = liveClub.bench.filter((id) => id !== mem.id);
        if (!liveClub.xi.includes(mem.id)) liveClub.xi.push(mem.id);
        writeJson('clubs.json', clubs);
        return sendOnce(message, `✅ <@${mem.id}> İlk 11'e alındı.`);
      }

      if (action === 'yedek') {
        if (!canManageClub(message.member, liveClub, config)) return sendOnce(message, '❌ Yetkin yok.');
        const mem = message.mentions.members.first();
        if (!mem) return sendOnce(message, '❌ Kullanım: `.takim Galatasaray yedek @oyuncu`');
        liveClub.xi = liveClub.xi.filter((id) => id !== mem.id);
        if (!liveClub.bench.includes(mem.id)) liveClub.bench.push(mem.id);
        writeJson('clubs.json', clubs);
        return sendOnce(message, `✅ <@${mem.id}> Yedeğe alındı.`);
      }

      writeJson('clubs.json', clubs);
      const players = readJson('players.json');
      const fmtList = (arr) =>
        arr.length > 0
          ? arr.map((id, i) => `${i + 1}. ${players[id]?.name || `<@${id}>`} (\`${liveClub.positions[id] || players[id]?.position || 'STP'}\`)`).join('\n')
          : 'Oyuncu yok';

      const embed = new EmbedBuilder()
        .setTitle(`${liveClub.emoji || '⚽'} ${liveClub.name} Kadro & Taktik`)
        .setColor(0xe67e22)
        .addFields(
          { name: '🧠 Taktik', value: liveClub.tactic, inline: true },
          { name: '©️ Kaptan', value: liveClub.captainId ? `<@${liveClub.captainId}>` : 'Seçilmedi', inline: true },
          { name: '🎯 Duran Toplar', value: `Pen: ${liveClub.penaltyId ? `<@${liveClub.penaltyId}>` : '-'} | Frikik: ${liveClub.freekickId ? `<@${liveClub.freekickId}>` : '-'} | Korner: ${liveClub.cornerId ? `<@${liveClub.cornerId}>` : '-'}`, inline: false },
          { name: '🟢 İlk 11', value: fmtList(liveClub.xi), inline: false },
          { name: '🟡 Yedekler', value: fmtList(liveClub.bench), inline: false }
        );
      return sendOnce(message, { embeds: [embed] });
    }

    if (cmd === 'başlat' || cmd === 'baslat') {
      const mData = readJson('matches.json');
      if (mData.active && mData.active.status === 'paused') {
        mData.active.status = 'running';
        mData.active.lastTickAt = Date.now();
        writeJson('matches.json', mData);
        startMatchLoop();
        return sendOnce(message, `▶️ Maç devam ediyor! (**${mData.active.minute}'**)`);
      }
      if (mData.active && mData.active.status === 'running') {
        return sendOnce(message, '⚠️ Zaten devam eden bir maç var.');
      }

      const joined = raw.slice(cmd.length).trim();
      const [hRaw, aRaw] = joined.split('|').map((s) => s.trim());
      const home = findClub(hRaw);
      const away = findClub(aRaw);
      if (!home || !away || home.id === away.id) {
        return sendOnce(message, '❌ Kullanım: `.başlat Galatasaray | Fenerbahçe`');
      }

      const activeMatch = {
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
      };

      writeJson('matches.json', { active: activeMatch });
      startMatchLoop();
      return sendOnce(message, `⚽ **MAÇ BAŞLADI:** ${home.emoji || '⚽'} **${home.name}** vs **${away.name}** ${away.emoji || '⚽'} (90 dk | 1 dk = 10 sn)`);
    }

    if (cmd === 'durdur') {
      const mData = readJson('matches.json');
      if (!mData.active || mData.active.status !== 'running') {
        return sendOnce(message, '❌ Durdurulacak aktif maç yok.');
      }
      mData.active.status = 'paused';
      writeJson('matches.json', mData);
      if (matchTimer) {
        clearInterval(matchTimer);
        matchTimer = null;
      }
      return sendOnce(message, `⏸️ Maç **${mData.active.minute}. dakikada** durduruldu.`);
    }

    if (cmd === 'maçı' && (args[0] || '').toLowerCase() === 'bitir') {
      const mData = readJson('matches.json');
      if (!mData.active) return sendOnce(message, '❌ Aktif maç bulunamadı.');
      await finishMatch(mData.active, message.channel);
      return sendOnce(message, '🏁 Maç sonlandırıldı ve istatistikler işlendi.');
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
      if (!wk) return sendOnce(message, `❌ ${weekNum}. hafta bulunamadı.`);

      const buf = await renderFixtureImage(weekNum, wk.matches, clubs);
      const file = new AttachmentBuilder(buf, { name: `fikstur-hafta-${weekNum}.png` });
      return sendOnce(message, { files: [file] });
    }

    if (cmd === 'puandurum') {
      const clubs = Object.values(readJson('clubs.json')).sort((a, b) => {
        if (b.stats.p !== a.stats.p) return b.stats.p - a.stats.p;
        const avDiff = (b.stats.ag - b.stats.yg) - (a.stats.ag - a.stats.yg);
        if (avDiff !== 0) return avDiff;
        return b.stats.ag - a.stats.ag;
      });

      const buf = await renderStandingsImage(clubs);
      const file = new AttachmentBuilder(buf, { name: 'puandurum.png' });
      return sendOnce(message, { files: [file] });
    }

    if (cmd === 'golkrallığı' || cmd === 'golkralligi') {
      const players = Object.values(readJson('players.json')).sort(
        (a, b) => (b.stats?.goals || 0) - (a.stats?.goals || 0)
      );
      const clubs = readJson('clubs.json');
      const buf = await renderTopScorersImage(players, clubs);
      const file = new AttachmentBuilder(buf, { name: 'golkralligi.png' });
      return sendOnce(message, { files: [file] });
    }

    if (cmd === 'kap') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('kap_btn_transfer').setLabel('📋 Kap').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('kap_btn_loan').setLabel('Kiralık Kap').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('kap_btn_free').setLabel('Serbest Kap').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('kap_btn_renew').setLabel('Sözleşme yenileme').setStyle(ButtonStyle.Success)
      );
      return sendOnce(message, { content: '📢 **PROLEAGUE TRANSFER & KAP MERKEZİ** — İşlem türünü seçin:', components: [row] });
    }

    if (cmd === 'ant') {
      if (config.trainingChannelId && message.channel.id !== config.trainingChannelId) {
        return sendOnce(message, '❌ Bu komut yalnızca antrenman kanalında çalışır.');
      }
      const p = getPlayer(message.author.id, message.member.displayName);
      p.training += 1;
      let bonusMsg = '';
      if (p.training >= 10) {
        p.training = 0;
        p.valueM = Number((p.valueM + 2).toFixed(2));
        bonusMsg = `\n🎉 **10 antrenman tamamlandı! Değerin +2M€ arttı → Yeni değer: ${p.valueM}M€**`;
        await syncNick(message.member, p);
      }
      savePlayer(p);
      return sendOnce(message, `🏋️ **${p.name}** antrenman yaptı! İlerleme: **${p.training}/10**${bonusMsg}`);
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
        return sendOnce(message, `⚽🎯 **GOL!** **${p.name}** penaltıyı gole çevirdi! **+3M€** değer kazandı (Yeni değer: **${p.valueM}M€**).`);
      } else if (roll < 0.88) {
        p.stats.penMiss += 1;
        savePlayer(p);
        return sendOnce(message, `🧤 **KURTARIŞ!** Kaleci **${p.name}** oyuncusunun penaltısını çıkardı!`);
      } else {
        p.stats.penMiss += 1;
        savePlayer(p);
        return sendOnce(message, `❌ **KAÇTI!** **${p.name}** penaltıyı dışarı attı.`);
      }
    }

    if (cmd === 'bal') {
      const target = message.mentions.users.first() || message.author;
      const p = getPlayer(target.id, target.username);
      const clubs = Object.values(readJson('clubs.json'));
      const coached = clubs.find((c) => c.coachId === target.id);
      if (coached && p.bankM === 0 && p.walletM === 0) {
        p.bankM = 100;
        savePlayer(p);
      }
      return sendOnce(message, `💰 **${p.name}** Bakiye:\n• Cüzdan: **${p.walletM}M€**\n• Banka: **${p.bankM}M€**`);
    }

    if (cmd === 'deposit') {
      const amt = parseFloat(args[0]);
      if (Number.isNaN(amt) || amt <= 0) return sendOnce(message, '❌ Kullanım: `.deposit 20`');
      const p = getPlayer(message.author.id, message.member.displayName);
      if (p.walletM < amt) return sendOnce(message, '❌ Cüzdanında yeterli bakiye yok.');
      p.walletM = Number((p.walletM - amt).toFixed(2));
      p.bankM = Number((p.bankM + amt).toFixed(2));
      savePlayer(p);
      return sendOnce(message, `🏦 **${amt}M€** bankaya yatırıldı. Cüzdan: **${p.walletM}M€** | Banka: **${p.bankM}M€**`);
    }

    if (cmd === 'withdraw') {
      const amt = parseFloat(args[0]);
      if (Number.isNaN(amt) || amt <= 0) return sendOnce(message, '❌ Kullanım: `.withdraw 20`');
      const p = getPlayer(message.author.id, message.member.displayName);
      if (p.bankM < amt) return sendOnce(message, '❌ Bankada yeterli bakiye yok.');
      p.bankM = Number((p.bankM - amt).toFixed(2));
      p.walletM = Number((p.walletM + amt).toFixed(2));
      savePlayer(p);
      return sendOnce(message, `💵 **${amt}M€** bankadan çekildi. Cüzdan: **${p.walletM}M€** | Banka: **${p.bankM}M€**`);
    }

    if (cmd === 'balver') {
      if (!isStaff(message.member, config)) return sendOnce(message, '❌ Yetkin yok.');
      const target = message.mentions.members.first();
      const numArg = args.find((a) => !a.startsWith('<@'));
      const amt = numArg ? parseFloat(numArg) : NaN;
      if (!target || Number.isNaN(amt)) return sendOnce(message, '❌ Kullanım: `.balver @oyuncu 50`');
      const p = getPlayer(target.id, target.displayName);
      p.walletM = Number((p.walletM + amt).toFixed(2));
      savePlayer(p);
      return sendOnce(message, `✅ **${p.name}** cüzdanına **${amt}M€** eklendi (Yeni cüzdan: **${p.walletM}M€**).`);
    }

    if (cmd === 'quiz') {
      const qData = readJson('quiz.json');
      const available = QUIZ_POOL.filter((item) => !qData.usedIds.includes(item.id));
      if (available.length === 0) return sendOnce(message, '🏁 Tüm quiz soruları tüketildi!');

      const chosen = available[Math.floor(Math.random() * available.length)];
      const quizMsg = await sendOnce(
        message,
        `🧠 **FUTBOL QUİZ (${chosen.diff})** — Ödül: **${chosen.reward}M€** (Süre: 5 dk)\n**${chosen.q}**\n` +
        chosen.opts.map((o, idx) => `**${idx + 1}.** ${o}`).join('\n') +
        `\n*Cevap için 1, 2, 3 veya 4 yazın.*`
      );
      if (!quizMsg) return;

      qData.active = {
        id: chosen.id,
        ans: String(chosen.ans + 1),
        reward: chosen.reward,
        channelId: message.channel.id,
        expiresAt: Date.now() + 5 * 60 * 1000
      };
      writeJson('quiz.json', qData);

      const collector = message.channel.createMessageCollector({
        filter: (m) => !m.author.bot && ['1', '2', '3', '4'].includes(m.content.trim()),
        time: 5 * 60 * 1000,
        max: 1
      });

      collector.on('collect', async (ansMsg) => {
        const latest = readJson('quiz.json');
        if (!latest.active || latest.active.id !== chosen.id) return;
        if (latest.usedIds.includes(chosen.id)) return;

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
        if (latest.active && latest.active.id === chosen.id) {
          latest.active = null;
          writeJson('quiz.json', latest);
          await quizMsg.edit(`${quizMsg.content}\n\n⏰ Süre doldu.`).catch(() => {});
        }
      });
      return;
    }

    if (cmd === 'sil') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return sendOnce(message, '❌ Yetkin yok.');
      const count = parseInt(args[0], 10);
      if (!count || count < 1 || count > 100) return sendOnce(message, '❌ Kullanım: `.sil 10` (1-100 arası)');
      await message.delete().catch(() => {});
      const deleted = await message.channel.bulkDelete(count, true).catch(() => null);
      const info = await message.channel.send(`🧹 **${deleted ? deleted.size : 0}** mesaj silindi.`);
      setTimeout(() => info.delete().catch(() => {}), 4000);
      return;
    }

    if (cmd === 'rolver') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return sendOnce(message, '❌ Yetkin yok.');
      const mem = message.mentions.members.first();
      const role = message.mentions.roles.first();
      if (!mem || !role) return sendOnce(message, '❌ Kullanım: `.rolver @oyuncu @rol`');
      await mem.roles.add(role);
      return sendOnce(message, `✅ <@${mem.id}> kullanıcısına **${role.name}** rolü verildi.`);
    }

    if (cmd === 'rolal') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return sendOnce(message, '❌ Yetkin yok.');
      const mem = message.mentions.members.first();
      const role = message.mentions.roles.first();
      if (!mem || !role) return sendOnce(message, '❌ Kullanım: `.rolal @oyuncu @rol`');
      await mem.roles.remove(role);
      return sendOnce(message, `✅ <@${mem.id}> kullanıcısından **${role.name}** rolü alındı.`);
    }

    if (cmd === 'lock') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return sendOnce(message, '❌ Yetkin yok.');
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      return sendOnce(message, '🔒 Kanal kilitlendi.');
    }

    if (cmd === 'unlock') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return sendOnce(message, '❌ Yetkin yok.');
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      return sendOnce(message, '🔓 Kanal kilidi açıldı.');
    }

    if (cmd === 'mute') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return sendOnce(message, '❌ Yetkin yok.');
      const mem = message.mentions.members.first();
      const durStr = args[1] || '1h';
      const match = durStr.match(/^(\d+)(s|m|h|d)$/i);
      if (!mem || !match) return sendOnce(message, '❌ Kullanım: `.mute @oyuncu 1h`');
      const val = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const ms = unit === 's' ? val * 1000 : unit === 'm' ? val * 60000 : unit === 'h' ? val * 3600000 : val * 86400000;
      await mem.timeout(ms, 'PROLEAGUE Mute');
      return sendOnce(message, `🔇 <@${mem.id}> **${durStr}** susturuldu.`);
    }

    if (cmd === 'ban') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return sendOnce(message, '❌ Yetkin yok.');
      const mem = message.mentions.members.first();
      if (!mem) return sendOnce(message, '❌ Kullanım: `.ban @oyuncu sebep`');
      const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
      await mem.ban({ reason });
      return sendOnce(message, `🔨 **${mem.user.tag}** yasaklandı. Sebep: ${reason}`);
    }

    if (cmd === 'oto-rol') {
      if (!isStaff(message.member, config)) return sendOnce(message, '❌ Yetkin yok.');
      const role = message.mentions.roles.first();
      if (!role) return sendOnce(message, '❌ Kullanım: `.oto-rol @rol`');
      config.autoRoleId = role.id;
      writeJson('config.json', config);
      return sendOnce(message, `✅ Yeni üyelere otomatik verilecek rol: **${role.name}**`);
    }

    if (cmd === 'oto-rol-kapat') {
      if (!isStaff(message.member, config)) return sendOnce(message, '❌ Yetkin yok.');
      config.autoRoleId = null;
      writeJson('config.json', config);
      return sendOnce(message, '✅ Otomatik rol kapatıldı.');
    }

    if (cmd === 'm') {
      const target = message.mentions.users.first() || message.author;
      const act = readJson('activity.json');
      const u = act.users[target.id] || { daily: 0, weekly: 0, monthly: 0 };
      return sendOnce(
        message,
        `💬 **${target.username} Mesaj İstatistikleri:**\n• Günlük: **${u.daily}**\n• Haftalık: **${u.weekly}**\n• Aylık: **${u.monthly}**`
      );
    }

    if (cmd === 'ses') {
      const target = message.mentions.users.first() || message.author;
      const act = readJson('activity.json');
      const u = act.users[target.id] || { voiceSec: 0 };
      const mins = Math.floor(u.voiceSec / 60);
      return sendOnce(message, `🎙️ **${target.username} Ses Aktivitesi:** **${mins} dakika** (${u.voiceSec} sn)`);
    }

    if (cmd === 'yardım' || cmd === 'yardim') {
      const embed = new EmbedBuilder()
        .setTitle('⚽ PROLEAGUE RP — Komut Menüsü')
        .setColor(0x1abc9c)
        .addFields(
          {
            name: '👤 Oyuncu & Lig Komutları',
            value:
              '`.kariyer [@üye]` • `.ara <isim/mevki>` • `.takim <Takım>`\n' +
              '`.fiksür [hafta]` • `.puandurum` • `.golkrallığı` • `.kap` • `.ant` • `.pen`\n' +
              '`.bal [@üye]` • `.deposit <miktar>` • `.withdraw <miktar>` • `.quiz`\n' +
              '`.m [@üye]` • `.ses [@üye]` • `.yardım`'
          },
          {
            name: '🛡️ Yetkili & TD Komutları',
            value:
              '`.k @üye İsim | Ülke | Mevki | Değer` • `.değerver @üye <miktar>`\n' +
              '`.takim <Takım> ekle/çıkar/mevki/kaptan/penaltıcı/frikikçi/kornerci/taktik/11/yedek`\n' +
              '`.başlat Takım1 | Takım2` • `.durdur` • `.maçı bitir`\n' +
              '`.balver @üye <miktar>` • `.sil <sayı>` • `.rolver` • `.rolal` • `.lock` • `.unlock` • `.mute` • `.ban`\n' +
              '`.oto-rol @rol` • `.oto-rol-kapat`'
          }
        );
      return sendOnce(message, { embeds: [embed] });
    }

    if (cmd === 'ayar') {
      if (!isStaff(message.member, config)) return sendOnce(message, '❌ Yetkin yok.');
      const key = (args[0] || '').toLowerCase();
      if (key === 'kayit') {
        config.registerChannelId = message.channel.id;
        writeJson('config.json', config);
        return sendOnce(message, '✅ Kayıt kanalı ayarlandı.');
      }
      if (key === 'antrenman') {
        config.trainingChannelId = message.channel.id;
        writeJson('config.json', config);
        return sendOnce(message, '✅ Antrenman kanalı ayarlandı.');
      }
      if (key === 'transfermarkt') {
        config.transfermarktChannelId = message.channel.id;
        writeJson('config.json', config);
        return sendOnce(message, '✅ Transfermarkt kanalı ayarlandı.');
      }
      if (key === 'kaponay') {
        config.kapApprovalChannelId = message.channel.id;
        writeJson('config.json', config);
        return sendOnce(message, '✅ KAP onay kanalı ayarlandı.');
      }
      if (key === 'td') {
        const club = findClub(args[1]);
        const mem = message.mentions.members.first();
        if (!club || !mem) return sendOnce(message, '❌ Kullanım: `.ayar td Galatasaray @td`');
        const clubs = readJson('clubs.json');
        clubs[club.id].coachId = mem.id;
        writeJson('clubs.json', clubs);
        const p = getPlayer(mem.id, mem.displayName);
        if (p.walletM === 0 && p.bankM === 0) {
          p.bankM = 100;
          savePlayer(p);
        }
        return sendOnce(message, `✅ **${club.name}** Teknik Direktörü <@${mem.id}> oldu (Başlangıç bütçesi: **100M€**).`);
      }
      return sendOnce(message, 'ℹ️ Kullanım: `.ayar kayit | antrenman | transfermarkt | kaponay` veya `.ayar td <Takım> @üye`');
    }
  } catch (err) {
    console.error('[MESSAGE ERR]', err.message);
    await sendOnce(message, '❌ Komut çalışırken bir hata oluştu.');
  }
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

        const iPlayer = new TextInputBuilder().setCustomId('player').setLabel('Oyuncu').setStyle(TextInputStyle.Short).setRequired(true);
        const iFrom = new TextInputBuilder().setCustomId('fromClub').setLabel('Eski Takım').setStyle(TextInputStyle.Short).setRequired(true);
        const iTo = new TextInputBuilder().setCustomId('toClub').setLabel('Yeni Takım').setStyle(TextInputStyle.Short).setRequired(true);
        const iDeal = new TextInputBuilder().setCustomId('deal').setLabel('Maaş & Bonservis').setStyle(TextInputStyle.Short).setRequired(true);
        const iExtra = new TextInputBuilder().setCustomId('extra').setLabel('Ek Maddeler').setStyle(TextInputStyle.Paragraph).setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(iPlayer),
          new ActionRowBuilder().addComponents(iFrom),
          new ActionRowBuilder().addComponents(iTo),
          new ActionRowBuilder().addComponents(iDeal),
          new ActionRowBuilder().addComponents(iExtra)
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
