// index.js FULL para GitHub/Railway
// pronto para substituir o antigo

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

let db = {
  tickets: {},
  pix: {},
  entregues: {},
  vendas: {},
  cooldown: {},
  blacklist: {},
  rankMsg: null
};

if (fs.existsSync("dados.json")) {
  db = JSON.parse(fs.readFileSync("dados.json"));
}

function salvar() {
  fs.writeFileSync("dados.json", JSON.stringify(db, null, 2));
}

const PRODUTOS = {
  opt5: {
    nome: "Otimização Básica",
    preco: 5,
    link: "https://www.mediafire.com/file/vb4klwyfxmxt5sa/OTIMIZA%25C3%2587%25C3%2583O_BASICA.rar/file"
  },
  opt10: {
    nome: "Otimização Avançada",
    preco: 10,
    link: "https://www.mediafire.com/file/iidtoou88ozkwll/OTIMIZA%25C3%2587%25C3%2583O_AVAN%25C3%2587ADA.rar/file"
  },
  opt20: {
    nome: "Otimização Suprema",
    preco: 20,
    link: "https://www.mediafire.com/file/61ivdjr64yb9o6t/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file"
  },
  sensi: {
    nome: "Pack Sensi",
    preco: 5,
    link: "https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file"
  },
  gta: {
    nome: "Conta GTA V",
    preco: 5,
    tipo: "gta"
  }
};

const CONTAS_GTA = [
  "PODTOPTAP:dream282521",
  "gta19710559:85sJzrKnu",
  "vykl99911:Leng123?",
  "halotic21:Ddjac210392"
];

const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

function contaRandom() {
  return CONTAS_GTA[Math.floor(Math.random() * CONTAS_GTA.length)];
}

const commands = [
  new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
  new SlashCommandBuilder().setName("rank").setDescription("Ver ranking"),
  new SlashCommandBuilder().setName("fechar").setDescription("Fechar ticket atual")
].map(c => c.toJSON());

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("BOT ONLINE");
});

app.get("/", (_, res) => res.send("online"));
app.listen(process.env.PORT || 3000);

client.login(TOKEN);
