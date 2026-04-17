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
GatewayIntentBits.DirectMessages
]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// CANAIS
const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_FEEDBACK = "1467351899497041942";
const CANAL_RANK = "1490184769831698655";

// BANCO
let db = {
entregues: {},
tickets: {},
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
opt5: { preco: 5, nome: "Otimização Básica", tipo: "link", link: "https://..." },
opt10: { preco: 10, nome: "Otimização Avançada", tipo: "link", link: "https://..." },
opt20: { preco: 20, nome: "Otimização Suprema", tipo: "link", link: "https://..." },
gta: { preco: 5, nome: "Conta GTA V", tipo: "auto" },
sensi: { preco: 5, nome: "Pack Sensi", tipo: "link", link: "https://..." }
};

// CONTAS
const CONTAS_GTA = ["conta1:senha","conta2:senha"];

// SLASH
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja")
].map(c => c.toJSON());

client.once("ready", async () => {
console.log("✅ BOT ONLINE");

const rest = new REST({ version: "10" }).setToken(TOKEN);

await rest.put(
Routes.applicationCommands(CLIENT_ID),
{ body: commands }
);

console.log("✅ Slash registrados");
});

// FUNÇÃO RANK
async function atualizarRanking() {
const canal = await client.channels.fetch(CANAL_RANK).catch(()=>null);
if (!canal) return;

let ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> - ${x[1]} compras`)
.join("\n");

canal.send(`🏆 RANKING ATUAL\n\n${ranking || "Sem dados"}`);
}

// INTERAÇÕES
client.on("interactionCreate", async interaction => {
try {

// SLASH
if (interaction.isChatInputCommand()) {
if (interaction.commandName === "painel") {

let total = Object.values(db.vendas).reduce((a,b)=>a+b,0);

return interaction.reply({
content: `🚀 DIDDY STORE\n💰 ${total} vendas\n💳 Pagou = recebeu`,
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

// BOTÕES
if (interaction.isButton()) {

if (interaction.customId.startsWith("copiar_")) {
const pix = interaction.customId.replace("copiar_", "");
return interaction.reply({ content: pix, ephemeral: true });
}

if (db.tickets[interaction.user.id]) {
return interaction.reply({ content: "❌ Já tem pagamento aberto!", ephemeral: true });
}

const produto = PRODUTOS[interaction.customId];
if (!produto) return;

await interaction.reply({ content: "⏳ Gerando pagamento...", ephemeral: true });

// 🔥 RETRY PIX
let pg;
let tentativas = 0;

while (tentativas < 3) {
try {
pg = await payment.create({
body: {
transaction_amount: Number(produto.preco),
description: produto.nome,
payment_method_id: "pix",
payer: { email: `user${interaction.user.id}@gmail.com` },
metadata: {
user_id: interaction.user.id,
produto: interaction.customId
}
}
});

if (pg?.point_of_interaction?.transaction_data?.qr_code) break;

} catch (err) {
console.log("ERRO MP:", err.message);
}

tentativas++;
}

if (!pg?.point_of_interaction?.transaction_data?.qr_code) {
return interaction.editReply({ content: "❌ Falha ao gerar PIX" });
}

const pix = pg.point_of_interaction.transaction_data.qr_code;
const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

// CRIA TICKET
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
.setDescription(`Produto: ${produto.nome}\nValor: R$${produto.preco}\n\nPIX:\n${pix}`)
.setImage(qr)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${pix}`)
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Primary)
);

await canal.send({
content: `<@${interaction.user.id}>`,
embeds: [embed],
components: [row]
});

interaction.editReply({ content: `✅ Ticket: ${canal}` });
}

} catch (err) {
console.log("ERRO:", err);
}
});

// MENSAGEM (feedback)
client.on("messageCreate", async msg => {
if (!msg.guild && msg.author.id !== client.user.id) {

if (!msg.content.includes("|")) return;

const [nota, comentario] = msg.content.split("|");

if (isNaN(nota) || nota < 1 || nota > 1000) return;

db.feedbacks.push({ user: msg.author.id, nota: Number(nota), comentario });
salvar();

const canal = await client.channels.fetch(CANAL_FEEDBACK);
canal.send(`⭐ Avaliação\n👤 <@${msg.author.id}>\nNota: ${nota}\n💬 ${comentario}`);

msg.reply("✅ Avaliação enviada!");
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
if (!pg || db.entregues[pg.id]) return;

if (pg.status === "approved") {

const userId = pg.metadata.user_id;
const produto = PRODUTOS[pg.metadata.produto];
const user = await client.users.fetch(userId).catch(()=>null);
if (!user) return;

let entrega = produto.tipo === "auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

db.entregues[pg.id] = true;
delete db.tickets[user.id];

db.vendas[user.id] = (db.vendas[user.id]||0)+1;
db.dinheiro[user.id] = (db.dinheiro[user.id]||0)+produto.preco;

salvar();

// DM + feedback instrução
await user.send(`✅ Pagamento aprovado!\n\n${entrega}\n\n⭐ Envie:\nnota|comentário\nEx: 1000|muito bom`).catch(()=>{});

// LOGS
const logs = await client.channels.fetch(CANAL_LOGS);
logs.send(`💰 Compra confirmada\n👤 <@${user.id}>\n📦 ${produto.nome}`);

const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 <@${user.id}> comprou ${produto.nome}`);

// 🔥 ATUALIZA RANK
atualizarRanking();

}

} catch (err) {
console.log("ERRO WEBHOOK:", err);
}
},100);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("🔥 Webhook rodando"));

client.login(TOKEN);
