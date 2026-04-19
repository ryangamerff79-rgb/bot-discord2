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

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_FEEDBACK = "1467351899497041942";
const CANAL_RANK = "1490184769831698655";
const CARGO_CLIENTE = "1494143094327742594";

// BANCO
let db = {
tickets: {},
pix: {},
entregues: {},
vendas: {},
rankMsg: null
};

if (fs.existsSync("dados.json")) {
db = JSON.parse(fs.readFileSync("dados.json"));
}

function salvar() {
fs.writeFileSync("dados.json", JSON.stringify(db, null, 2));
}

// MP
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5: { preco: 5, nome: "Otimização Básica", link: "https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10: { preco: 10, nome: "Otimização Avançada", link: "https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file" },
opt20: { preco: 20, nome: "Otimização Suprema", link: "https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" },
sensi: { preco: 5, nome: "Pack Sensi", link: "https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file" }
};

const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// SLASH COMMANDS (SEM ERRO)
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
new SlashCommandBuilder().setName("anunciar").setDescription("Enviar anuncio")
.addStringOption(o=>o.setName("mensagem").setDescription("Mensagem").setRequired(true))
].map(c => c.toJSON());

client.once("ready", async () => {
console.log("✅ BOT ONLINE");

const rest = new REST({ version: "10" }).setToken(TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

console.log("✅ Slash registrados");
});

// GERAR PIX
async function gerarPix(produtoId, userId) {
for (let i = 1; i <= 3; i++) {
try {
const pg = await payment.create({
body: {
transaction_amount: Number(PRODUTOS[produtoId]?.preco || 5),
description: PRODUTOS[produtoId]?.nome || "Produto",
payment_method_id: "pix",
payer: { email: `user${userId}@gmail.com` },
metadata: { user_id: userId, produto: produtoId }
}
});
if (pg?.point_of_interaction?.transaction_data) return pg;
} catch {}
}
return null;
}

// RANK FIXO
async function atualizarRank() {
const canal = await client.channels.fetch(CANAL_RANK);

const ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`${i+1}. <@${x[0]}> - ${x[1]}`)
.join("\n") || "Sem compras ainda";

if (!db.rankMsg) {
const msg = await canal.send("🏆 Rank carregando...");
db.rankMsg = msg.id;
}

const msg = await canal.messages.fetch(db.rankMsg);
msg.edit(`🏆 **TOP COMPRADORES**\n\n${ranking}`);

salvar();
}

// INTERAÇÃO
client.on("interactionCreate", async interaction => {

if (interaction.isChatInputCommand()) {

if (interaction.commandName === "painel") {
return interaction.reply({
content: "🛒 Loja",
components: [
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("gta").setLabel("GTA").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(ButtonStyle.Secondary)
)
]
});
}

if (interaction.commandName === "anunciar") {
const msg = interaction.options.getString("mensagem");
interaction.channel.send(`📢 ${msg}`);
return interaction.reply({ content: "✅ Anunciado", ephemeral: true });
}
}

// BOTÕES
if (interaction.isButton()) {

if (interaction.customId.startsWith("copiar_")) {
const id = interaction.customId.split("_")[1];
return interaction.reply({ content: db.pix[id], ephemeral: true });
}

if (db.tickets[interaction.user.id]) {
return interaction.reply({ content: "❌ Já tem ticket!", ephemeral: true });
}

const produtoId = interaction.customId;
let produto = PRODUTOS[produtoId];

if (produtoId === "gta") {
produto = { nome: "Conta GTA V", preco: 5 };
}

await interaction.reply({ content: "Gerando pagamento...", ephemeral: true });

const pg = await gerarPix(produtoId, interaction.user.id);
if (!pg) return interaction.editReply("Erro PIX");

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now().toString();

db.pix[pixId] = pix;
salvar();

const canal = await interaction.guild.channels.create({
name: `ticket-${interaction.user.username}`,
parent: CATEGORIA_ID,
permissionOverwrites: [
{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
{ id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
]
});

db.tickets[interaction.user.id] = canal.id;
salvar();

await canal.send({
content: `<@${interaction.user.id}> ⏰ Expira em 12 minutos\n⚠️ Aviso em 2 minutos`,
embeds: [
new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`📦 ${produto.nome}\n💰 R$${produto.preco}\n\n📲 Copie abaixo:`)
.addFields({ name: "PIX", value: pix.substring(0,1000) })
],
components: [
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pixId}`).setLabel("Copiar PIX").setStyle(ButtonStyle.Primary)
)
]
});

interaction.editReply(`✅ ${canal}`);

// aviso 2 min
setTimeout(()=>canal.send("⚠️ Vai expirar em 2 minutos"), 600000);

// expira 12 min
setTimeout(()=>{
if (db.tickets[interaction.user.id]) {
delete db.tickets[interaction.user.id];
salvar();
canal.delete().catch(()=>{});
}
}, 720000);
}
});

// WEBHOOK
app.post("/webhook", (req,res)=>{
res.sendStatus(200);

setTimeout(async ()=>{
try {

const id = req.body?.data?.id;
if (!id || db.entregues[id]) return;

const pg = await payment.get({ id });
if (pg.status !== "approved") return;

const userId = pg.metadata.user_id;
const produtoId = pg.metadata.produto;

let entrega =
produtoId === "gta"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: PRODUTOS[produtoId].link;

const user = await client.users.fetch(userId);

// DM
await user.send(`✅ Compra confirmada!\n\n${entrega}`).catch(()=>{});

// cargo
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(userId);
member.roles.add(CARGO_CLIENTE).catch(()=>{});

// salvar
db.entregues[id] = true;
db.vendas[userId] = (db.vendas[userId]||0)+1;
salvar();

// fechar ticket
const canalId = db.tickets[userId];
if (canalId) {
const canal = await client.channels.fetch(canalId);
canal.delete().catch(()=>{});
delete db.tickets[userId];
}

// recentes
const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 <@${userId}> comprou ${produtoId}`);

// rank
atualizarRank();

} catch {}
},100);
});

app.listen(process.env.PORT || 3000);
client.login(TOKEN);
