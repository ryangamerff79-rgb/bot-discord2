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
GatewayIntentBits.GuildMembers,
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
const CARGO_CLIENTE = "1494143094327742594"; // 👈 SEU CARGO

// BANCO
let db = {
entregues: {},
tickets: {},
pix: {},
vendas: {},
dinheiro: {},
feedbacks: []
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
opt5: { preco: 5, nome: "Otimização Básica", tipo: "link", link: "SEU_LINK" },
opt10: { preco: 10, nome: "Otimização Avançada", tipo: "link", link: "SEU_LINK" },
opt20: { preco: 20, nome: "Otimização Suprema", tipo: "link", link: "SEU_LINK" },
gta: { preco: 5, nome: "Conta GTA V", tipo: "auto" },
sensi: { preco: 5, nome: "Pack Sensi", tipo: "link", link: "SEU_LINK" }
};

const CONTAS_GTA = [
"login1:senha1",
"login2:senha2"
];

// SLASH
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja")
].map(c => c.toJSON());

client.once("ready", async () => {
console.log("✅ BOT ONLINE");

const rest = new REST({ version: "10" }).setToken(TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

console.log("✅ Slash registrados");
});

// GERAR PIX (3 tentativas)
async function gerarPix(produtoId, userId) {
for (let i = 1; i <= 3; i++) {
try {
const pg = await payment.create({
body: {
transaction_amount: Number(PRODUTOS[produtoId].preco),
description: PRODUTOS[produtoId].nome,
payment_method_id: "pix",
payer: { email: `user${userId}@gmail.com` },
metadata: { user_id: userId, produto: produtoId }
}
});

if (pg?.point_of_interaction?.transaction_data) return pg;

} catch (err) {
console.log("❌ ERRO MP:", err.message);
}
}
return null;
}

// INTERAÇÃO
client.on("interactionCreate", async interaction => {
try {

if (interaction.isChatInputCommand()) {
if (interaction.commandName === "painel") {

let total = Object.values(db.vendas).reduce((a,b)=>a+b,0);

return interaction.reply({
content: `🚀 DIDDY STORE\n💰 ${total} vendas`,
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
}

if (interaction.isButton()) {

if (interaction.customId.startsWith("copiar_")) {
const id = interaction.customId.replace("copiar_", "");
return interaction.reply({ content: db.pix[id], ephemeral: true });
}

if (db.tickets[interaction.user.id]) {
return interaction.reply({ content: "❌ Já tem pagamento aberto!", ephemeral: true });
}

const produtoId = interaction.customId;
if (!PRODUTOS[produtoId]) return;

await interaction.reply({ content: "⏳ Gerando pagamento...", ephemeral: true });

const pg = await gerarPix(produtoId, interaction.user.id);
if (!pg) return interaction.editReply({ content: "❌ Falha ao gerar PIX" });

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now().toString();

db.pix[pixId] = pix;
salvar();

const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

const canal = await interaction.guild.channels.create({
name: `ticket-${interaction.user.username}`,
type: 0,
parent: CATEGORIA_ID,
permissionOverwrites: [
{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
{ id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
]
});

db.tickets[interaction.user.id] = canal.id;
salvar();

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Produto: ${PRODUTOS[produtoId].nome}\nValor: R$${PRODUTOS[produtoId].preco}`)
.setImage(qr)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${pixId}`)
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Primary)
);

await canal.send({
content: `<@${interaction.user.id}>`,
embeds: [embed],
components: [row]
});

interaction.editReply({ content: `✅ Ticket criado: ${canal}` });

// FECHAR EM 10 MIN
setTimeout(async () => {
if (db.tickets[interaction.user.id]) {
delete db.tickets[interaction.user.id];
salvar();
canal.delete().catch(()=>{});
}
}, 600000);
}

} catch (err) {
console.log("❌ ERRO INTERACTION:", err);
}
});

// WEBHOOK
app.post("/webhook", (req, res) => {
res.sendStatus(200);

setTimeout(async () => {
try {

const id = req.body?.data?.id;
if (!id) return;

const pg = await payment.get({ id });
if (!pg || db.entregues[id]) return;
if (pg.status !== "approved") return;

const userId = pg.metadata?.user_id;
const produtoId = pg.metadata?.produto;
const produto = PRODUTOS[produtoId];
if (!produto) return;

// ENTREGA
let entrega = produto.tipo === "auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

// SALVAR
db.entregues[id] = true;
delete db.tickets[userId];

db.vendas[userId] = (db.vendas[userId]||0)+1;
db.dinheiro[userId] = (db.dinheiro[userId]||0)+produto.preco;

salvar();

// DM
const user = await client.users.fetch(userId).catch(()=>null);
if (user) {
await user.send(
`✅ Pagamento aprovado!

📦 Produto: ${produto.nome}
💰 R$${produto.preco}

🔗 Entrega:
${entrega}

⭐ Envie:
nota: 1000
comentario: exemplo`
).catch(()=>{});
}

// DAR CARGO
try {
const guilds = client.guilds.cache;
guilds.forEach(async (guild) => {
const member = await guild.members.fetch(userId).catch(()=>null);
if (member) {
await member.roles.add(CARGO_CLIENTE).catch(()=>{});
}
});
} catch {}

// LOGS
const logs = await client.channels.fetch(CANAL_LOGS);
logs.send(`💰 Compra confirmada\n👤 <@${userId}>\n📦 ${produto.nome}`);

// RECENTES
const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 NOVA COMPRA\n👤 <@${userId}>\n📦 ${produto.nome}\n💰 R$${produto.preco}`);

// RANK
const rank = await client.channels.fetch(CANAL_RANK);
rank.send(`🏆 <@${userId}> comprou ${produto.nome}`);

} catch (err) {
console.log("❌ ERRO WEBHOOK:", err);
}
}, 100);
});

// FEEDBACK
client.on("messageCreate", async msg => {
if (msg.channel.type !== 1) return;

const nota = Number(msg.content.match(/nota:\s*(\d+)/i)?.[1]);
const comentario = msg.content.match(/comentario:\s*(.+)/i)?.[1];

if (!nota || !comentario) return;

db.feedbacks.push({ user: msg.author.id, nota, comentario });
salvar();

const canal = await client.channels.fetch(CANAL_FEEDBACK);
canal.send(`⭐ Feedback\n👤 <@${msg.author.id}>\nNota: ${nota}\n${comentario}`);

msg.reply("✅ Avaliação enviada!");
});

// SERVER
app.listen(process.env.PORT || 3000, () => {
console.log("🔥 Webhook rodando");
});

client.login(TOKEN);
