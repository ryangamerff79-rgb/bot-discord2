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
entregues: {},
tickets: {},
pix: {},
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
opt5: { preco: 5, nome: "Otimização Básica", tipo: "link", link: "https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10: { preco: 10, nome: "Otimização Avançada", tipo: "link", link: "https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file" },
opt20: { preco: 20, nome: "Otimização Suprema", tipo: "link", link: "https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" },
gta: { preco: 5, nome: "Conta GTA V", tipo: "auto" },
sensi: { preco: 5, nome: "Pack Sensi", tipo: "link", link: "https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file" }
};

const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// GERAR PIX
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
.map((x,i)=>`**${i+1}.** <@${x[0]}> - ${x[1]} compras`)
.join("\n");

if (!db.rankMsg) {
const msg = await canal.send(`🏆 **RANK DE COMPRADORES**\n\n${ranking}`);
db.rankMsg = msg.id;
} else {
const msg = await canal.messages.fetch(db.rankMsg);
msg.edit(`🏆 **RANK DE COMPRADORES**\n\n${ranking}`);
}
salvar();
}

// PAINEL
client.on("interactionCreate", async interaction => {
if (interaction.isChatInputCommand()) {
if (interaction.commandName === "painel") {
return interaction.reply({
content: "🛒 **DIDDY STORE**",
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
return interaction.reply({ content: db.pix[interaction.customId.split("_")[1]], ephemeral: true });
}

if (db.tickets[interaction.user.id]) {
return interaction.reply({ content: "❌ Você já tem um pagamento aberto!", ephemeral: true });
}

const produtoId = interaction.customId;
const produto = PRODUTOS[produtoId];
if (!produto) return;

await interaction.reply({ content: "⏳ Gerando pagamento...", ephemeral: true });

const pg = await gerarPix(produtoId, interaction.user.id);
if (!pg) return interaction.editReply({ content: "❌ Erro ao gerar PIX" });

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
.setDescription(`📦 Produto: ${produto.nome}\n💰 Valor: R$${produto.preco}\n\n📲 Copie ou escaneie o QR Code`)
.setImage(qr)
.setColor("Green");

await canal.send({
content: `<@${interaction.user.id}>\n⏰ Este pagamento expira em 2 minutos!`,
embeds: [embed],
components: [
new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${pixId}`)
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Primary)
)
]
});

interaction.editReply({ content: `✅ Ticket criado: ${canal}` });

// expiração
setTimeout(() => {
if (db.tickets[interaction.user.id]) {
delete db.tickets[interaction.user.id];
salvar();
canal.delete().catch(()=>{});
}
}, 120000);
}
});

// WEBHOOK
app.post("/webhook", (req, res) => {
res.sendStatus(200);

setTimeout(async () => {
try {
const id = req.body?.data?.id;
if (!id || db.entregues[id]) return;

const pg = await payment.get({ id });
if (pg.status !== "approved") return;

const userId = pg.metadata.user_id;
const produto = PRODUTOS[pg.metadata.produto];

const user = await client.users.fetch(userId).catch(()=>null);
if (!user) return;

const entrega = produto.tipo === "auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

// salvar
db.entregues[id] = true;
db.vendas[userId] = (db.vendas[userId]||0)+1;
delete db.tickets[userId];
salvar();

// cargo
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(userId);
member.roles.add(CARGO_CLIENTE).catch(()=>{});

// DM profissional
await user.send(
`🎉 **COMPRA CONFIRMADA**

📦 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔗 Entrega:
${entrega}

⭐ Envie:
nota: 10
comentario: ótimo`
).catch(()=>{});

// recentes
const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 **NOVA COMPRA**
👤 <@${userId}>
📦 ${produto.nome}
💰 R$${produto.preco}`);

// rank
await atualizarRank();

} catch (e) {}
}, 100);
});

app.listen(process.env.PORT || 3000);
client.login(TOKEN);
