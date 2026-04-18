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
GatewayIntentBits.DirectMessages
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
opt5: { preco: 5, nome: "Otimização Básica", tipo: "link", link: "LINK" },
opt10: { preco: 10, nome: "Otimização Avançada", tipo: "link", link: "LINK" },
opt20: { preco: 20, nome: "Otimização Suprema", tipo: "link", link: "LINK" },
gta: { preco: 5, nome: "Conta GTA V", tipo: "auto" },
sensi: { preco: 5, nome: "Pack Sensi", tipo: "link", link: "LINK" }
};

const CONTAS_GTA = [
"login:senha1",
"login:senha2"
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
async function gerarPix(produto, userId) {
for (let i = 1; i <= 3; i++) {
try {
console.log("🔁 Tentativa", i);

const pg = await payment.create({
body: {
transaction_amount: Number(produto.preco),
description: produto.nome,
payment_method_id: "pix",
payer: { email: `user${userId}@gmail.com` },
metadata: { user_id: userId, produto: produto.nome }
}
});

if (pg?.point_of_interaction?.transaction_data) {
console.log("✅ PIX OK");
return pg;
}

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
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger)
)
]
});
}
}

if (interaction.isButton()) {

if (interaction.customId.startsWith("copiar_")) {
const id = interaction.customId.replace("copiar_", "");
const pix = db.pix[id];
return interaction.reply({ content: pix, ephemeral: true });
}

const produto = PRODUTOS[interaction.customId];
if (!produto) return;

await interaction.reply({ content: "⏳ Gerando pagamento...", ephemeral: true });

const pg = await gerarPix(produto, interaction.user.id);

if (!pg) {
return interaction.editReply({ content: "❌ Erro ao gerar PIX" });
}

const pix = pg.point_of_interaction.transaction_data.qr_code;

// salva pix com ID curto
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

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Produto: ${produto.nome}\nValor: R$${produto.preco}`)
.setImage(qr)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${pixId}`) // 🔥 AGORA FUNCIONA
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Primary)
);

await canal.send({
content: `<@${interaction.user.id}>`,
embeds: [embed],
components: [row]
});

interaction.editReply({ content: `✅ Ticket criado: ${canal}` });
}

} catch (err) {
console.log("❌ ERRO:", err);
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

if (pg.status === "approved") {

const user = await client.users.fetch(pg.metadata.user_id).catch(()=>null);
if (!user) return;

db.entregues[id] = true;
db.vendas[user.id] = (db.vendas[user.id]||0)+1;
salvar();

await user.send("✅ Pagamento aprovado!").catch(()=>{});

const rank = await client.channels.fetch(CANAL_RANK);
rank.send(`🏆 Nova compra! <@${user.id}>`);

}
} catch(e){
console.log("WEBHOOK ERRO:", e);
}
},100);
});

app.listen(process.env.PORT || 3000, () => {
console.log("🔥 Webhook rodando");
});

client.login(TOKEN);
