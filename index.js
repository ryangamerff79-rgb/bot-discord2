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
opt5: { preco: 5, nome: "Otimização Básica", tipo: "link", link: "https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10: { preco: 10, nome: "Otimização Avançada", tipo: "link", link: "https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file" },
opt20: { preco: 20, nome: "Otimização Suprema", tipo: "link", link: "https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" },
gta: { preco: 5, nome: "Conta GTA V", tipo: "auto" },
sensi: { preco: 5, nome: "Pack Sensi", tipo: "link", link: "https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
};

// CONTAS
const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566",
"fxnslyfiug:Malaikane2024"
];

// 🔥 FUNÇÃO RETRY PIX
async function gerarPixComRetry(produto, userId) {

for (let i = 1; i <= 3; i++) {
try {

console.log(`🔁 Tentativa ${i}`);

const pg = await payment.create({
body: {
transaction_amount: Number(produto.preco),
description: produto.nome,
payment_method_id: "pix",
payer: { email: `user${userId}@gmail.com` },
metadata: {
user_id: userId,
produto: produto.id
}
}
});

const pix = pg?.point_of_interaction?.transaction_data?.qr_code;

if (pix) {
console.log("✅ PIX OK");
return { pix };
}

console.log("⚠️ PIX vazio");

} catch (err) {
console.log(`❌ ERRO tentativa ${i}:`, err.message);
}

await new Promise(r => setTimeout(r, 1000));
}

return null;
}

// SLASH
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
new SlashCommandBuilder().setName("lucro").setDescription("Ver lucro"),
new SlashCommandBuilder().setName("ranking").setDescription("Top clientes"),
new SlashCommandBuilder().setName("media").setDescription("Média de avaliações")
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

// INTERAÇÃO
client.on("interactionCreate", async interaction => {
try {

// SLASH
if (interaction.isChatInputCommand()) {

if (interaction.commandName === "painel") {

let total = Object.values(db.vendas).reduce((a,b)=>a+b,0);

return interaction.reply({
content: `🚀 DIDDY STORE\n💰 ${total} vendas\n💳 Pagou = recebeu na hora`,
components: [
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5 Básica").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10 Avançada").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20 Suprema").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("gta").setLabel("GTA V").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(ButtonStyle.Secondary)
)
]
});
}

if (interaction.commandName === "lucro") {
let vendas = Object.values(db.vendas).reduce((a,b)=>a+b,0);
let dinheiro = Object.values(db.dinheiro).reduce((a,b)=>a+b,0);
return interaction.reply(`💰 ${vendas} vendas\n💵 R$${dinheiro}`);
}

if (interaction.commandName === "ranking") {
let ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,5)
.map((x,i)=>`#${i+1} <@${x[0]}> - ${x[1]}`)
.join("\n");

return interaction.reply(`🏆 TOP\n${ranking || "Sem dados"}`);
}

if (interaction.commandName === "media") {
if (!db.feedbacks.length) return interaction.reply("Sem avaliações");
let media = db.feedbacks.reduce((a,b)=>a+b.nota,0)/db.feedbacks.length;
return interaction.reply(`⭐ ${media.toFixed(1)}/5`);
}
}

// BOTÃO
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

produto.id = interaction.customId;

await interaction.reply({ content: "⏳ Gerando pagamento...", ephemeral: true });

// 🔥 USANDO RETRY
const resultado = await gerarPixComRetry(produto, interaction.user.id);

if (!resultado) {
return interaction.editReply({
content: "❌ Falha ao gerar PIX (3 tentativas)"
});
}

const pix = resultado.pix;
const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

// 🔥 cria ticket só depois
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

await user.send(`✅ Pagamento aprovado!\n\n${entrega}`).catch(()=>{});

const logs = await client.channels.fetch(CANAL_LOGS);
logs.send(`💰 <@${user.id}> comprou ${produto.nome}`);

const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 <@${user.id}> comprou ${produto.nome}`);
}

} catch (err) {
console.log("❌ ERRO WEBHOOK:", err);
}
},100);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("🔥 Webhook rodando"));

client.login(TOKEN);
