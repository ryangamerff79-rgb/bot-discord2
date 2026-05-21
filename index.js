const {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionsBitField,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const { MercadoPagoConfig, Payment } = require("mercadopago");
const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_RANK = "1490184769831698655";
const CANAL_LOGS = "1488589113954271282";
const CARGO_CLIENTE = "1494143094327742594";

const IMG = "https://cdn.discordapp.com/attachments/1373392385014370334/1497072312413851790/1294723.webp";

const EMBED_PAINEL = "https://cdn.discordapp.com/attachments/1504981948106408182/1506132172321460294/8a0b88a4-3ee0-442f-ad5f-760341da1179.png";
const EMBED_SENSI = "https://cdn.discordapp.com/attachments/1504981948106408182/1506141414252089484/content.png";
const EMBED_GTA = "https://cdn.discordapp.com/attachments/1504981948106408182/1506140642089242644/59f6df83-2b8d-4044-87de-3191a5146e6c.png";

let db = {
  tickets: {},
  pix: {},
  entregues: {},
  vendas: {},
  rankMsg: null,
  cooldown: {},
  blacklist: {}
};

if (fs.existsSync("dados.json")) {
  db = JSON.parse(fs.readFileSync("dados.json"));
}

function salvar() {
  fs.writeFileSync("dados.json", JSON.stringify(db, null, 2));
}

const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// =========================
// PRODUTOS
// =========================
const PRODUTOS = {
  opt5: { nome: "Otimização Básica", preco: 5, link: "https://www.mediafire.com/file/vb4klwyfxmxt5sa/OTIMIZA%25C3%2587%25C3%2583O_BASICA.rar/file" },
  opt10: { nome: "Otimização Avançada", preco: 10, link: "https://www.mediafire.com/file/iidtoou88ozkwll/OTIMIZA%25C3%2587%25C3%2583O_AVAN%25C3%2587ADA.rar/file" },
  opt20: { nome: "Otimização Suprema", preco: 20, link: "https://www.mediafire.com/file/61ivdjr64yb9o6t/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" },
  omega: { nome: "Otimização Omega", preco: 35, link: "https://www.mediafire.com/file/dlrwhlg55bs24yd/OMEGA+PACk.rar/file" },

  sensi: { nome: "Pack Sensi", preco: 5, link: "https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file", imagem: EMBED_SENSI },

  fivem: { nome: "Pack FiveM", preco: 10, link: "https://www.mediafire.com/file/5yirnjceinkjoaf/pack+fivem.rar/file" },

  gta: { nome: "Conta GTA V", preco: 5, tipo: "gta", imagem: EMBED_GTA }
};

// =========================
// CONTAS GTA
// =========================
const CONTAS_GTA = [
  "PODTOPTAP:dream282521",
  "gta19710559:85sJzrKnu",
  "vykl99911:Leng123?",
  "finnickloveschrismas:10011990t",
  "halotic21:Ddjac210392",
  "msfaraz69:blj55566"
];

// =========================
// SLASH COMMANDS
// =========================
const commands = [
  new SlashCommandBuilder().setName("painel").setDescription("Painel principal"),
  new SlashCommandBuilder().setName("painelsensi").setDescription("Pack Sensi"),
  new SlashCommandBuilder().setName("painelgta").setDescription("Conta GTA V"),
  new SlashCommandBuilder().setName("painelfivem").setDescription("Pack FiveM"),
  new SlashCommandBuilder().setName("rank").setDescription("Ranking de compras")
].map(c => c.toJSON());

// =========================
// READY
// =========================
client.once("ready", async () => {

  console.log("✅ BOT ONLINE");

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("✅ Slash Commands registradas");

  await atualizarRank();
});

// =========================
// RANK AUTOMÁTICO (SEM SPAM)
// =========================
async function atualizarRank() {

  try {

    const canal = await client.channels.fetch(CANAL_RANK);

    const ranking = Object.entries(db.vendas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((x, i) => `🏆 ${i + 1}. <@${x[0]}> - ${x[1]} compras`)
      .join("\n") || "Sem compras ainda";

    const embed = new EmbedBuilder()
      .setTitle("🏆 TOP COMPRADORES")
      .setDescription(ranking)
      .setColor("Gold")
      .setFooter({ text: "DIDDY STORE" });

    if (!db.rankMsg) {
      const msg = await canal.send({ embeds: [embed] });
      db.rankMsg = msg.id;
      salvar();
      return;
    }

    const msg = await canal.messages.fetch(db.rankMsg).catch(() => null);
    if (msg) await msg.edit({ embeds: [embed] });

  } catch (e) {
    console.log(e);
  }
}

// =========================
// COMANDO GTA RANDOM
// =========================
function contaGtaRandom() {
  return CONTAS_GTA[Math.floor(Math.random() * CONTAS_GTA.length)];
}

// =========================
// RESTO DO BOT (SEM MUDANÇA)
// =========================
app.listen(process.env.PORT || 3000);
client.login(TOKEN);
