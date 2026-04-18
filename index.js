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
SlashCommandBuilder,
ChannelType
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
GatewayIntentBits.MessageContent,
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

const CARGO_PERMISSAO = "1466621093799268443";
const CARGO_CLIENTE = "1494143094327742594";

// BANCO
let db = {
entregues: {},
tickets: {},
pix: {},
vendas: {},
dinheiro: {}
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

// SLASH COMMANDS
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),

new SlashCommandBuilder().setName("lucrohoje").setDescription("Ver lucro de hoje"),
new SlashCommandBuilder().setName("lucromes").setDescription("Ver lucro do mês"),
new SlashCommandBuilder().setName("vendasmes").setDescription("Ver vendas do mês"),
new SlashCommandBuilder().setName("ranking").setDescription("Ver ranking"),

new SlashCommandBuilder()
.setName("anunciar")
.setDescription("Enviar anúncio")
.addStringOption(o=>o.setName("mensagem").setDescription("Mensagem").setRequired(true)),

new SlashCommandBuilder()
.setName("reenviar")
.setDescription("Reenviar produto")
.addUserOption(o=>o.setName("user").setDescription("Usuário").setRequired(true))
.addStringOption(o=>o.setName("produto").setDescription("ID do produto").setRequired(true)),

new SlashCommandBuilder().setName("fechar").setDescription("Fechar ticket")

].map(c => c.toJSON());

client.once("ready", async () => {
console.log("✅ BOT ONLINE");

const rest = new REST({ version: "10" }).setToken(TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

console.log("✅ Comandos registrados");
});

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

// INTERAÇÃO
client.on("interactionCreate", async interaction => {
try {

// COMANDOS
if (interaction.isChatInputCommand()) {

const membro = interaction.member;

if (
interaction.commandName !== "painel" &&
!membro.roles.cache.has(CARGO_PERMISSAO)
) {
return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
}

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

// LUCRO
if (interaction.commandName === "lucrohoje") {
return interaction.reply("💰 Função ativa (adaptar data se quiser)");
}

if (interaction.commandName === "lucromes") {
let total = Object.values(db.dinheiro).reduce((a,b)=>a+b,0);
return interaction.reply(`💰 Total mês: R$${total}`);
}

if (interaction.commandName === "vendasmes") {
let total = Object.values(db.vendas).reduce((a,b)=>a+b,0);
return interaction.reply(`📦 Vendas: ${total}`);
}

// RANK
if (interaction.commandName === "ranking") {
let ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> - ${x[1]} compras`)
.join("\n");

return interaction.reply(`🏆 TOP CLIENTES\n\n${ranking || "Sem dados"}`);
}

// ANUNCIAR
if (interaction.commandName === "anunciar") {
const msg = interaction.options.getString("mensagem");
interaction.channel.send(`📢 ANÚNCIO:\n${msg}`);
return interaction.reply({ content: "✅ Enviado", ephemeral: true });
}

// REENVIAR
if (interaction.commandName === "reenviar") {
const user = interaction.options.getUser("user");
const produtoId = interaction.options.getString("produto");

const produto = PRODUTOS[produtoId];
if (!produto) return interaction.reply("❌ Produto inválido");

let entrega = produto.tipo === "auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

await user.send(`📦 Reenvio:\n${entrega}`).catch(()=>{});

return interaction.reply("✅ Enviado");
}

// FECHAR
if (interaction.commandName === "fechar") {
interaction.channel.delete().catch(()=>{});
}

}

// BOTÃO
if (interaction.isButton()) {

if (interaction.customId.startsWith("copiar_")) {
const id = interaction.customId.replace("copiar_", "");
return interaction.reply({ content: db.pix[id], ephemeral: true });
}

if (db.tickets[interaction.user.id]) {
return interaction.reply({ content: "❌ Já tem ticket aberto", ephemeral: true });
}

const produtoId = interaction.customId;
if (!PRODUTOS[produtoId]) return;

await interaction.reply({ content: "⏳ Gerando pagamento...", ephemeral: true });

const pg = await gerarPix(produtoId, interaction.user.id);
if (!pg) return interaction.editReply("❌ Erro PIX");

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now().toString();

db.pix[pixId] = pix;
salvar();

const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

const canal = await interaction.guild.channels.create({
name: `ticket-${interaction.user.username}`,
type: ChannelType.GuildText,
parent: CATEGORIA_ID
});

db.tickets[interaction.user.id] = canal.id;
salvar();

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`📦 ${PRODUTOS[produtoId].nome}\n💰 R$${PRODUTOS[produtoId].preco}\n\n\`\`\`\n${pix}\n\`\`\``)
.setImage(qr);

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${pixId}`)
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Primary)
);

await canal.send({
content: `<@${interaction.user.id}> ⚠ Ticket expira em 2 minutos`,
embeds: [embed],
components: [row]
});

interaction.editReply(`✅ Ticket: ${canal}`);

// EXPIRA
setTimeout(()=>{
if (db.tickets[interaction.user.id]) {
delete db.tickets[interaction.user.id];
salvar();
canal.delete().catch(()=>{});
}
}, 120000);

}

} catch (err) {
console.log(err);
}
});

// WEBHOOK
app.post("/webhook", (req,res)=>{
res.sendStatus(200);

setTimeout(async ()=>{
try {

const id = req.body?.data?.id;
if (!id) return;

const pg = await payment.get({ id });
if (!pg || db.entregues[id]) return;
if (pg.status !== "approved") return;

const userId = pg.metadata.user_id;
const produto = PRODUTOS[pg.metadata.produto];
const user = await client.users.fetch(userId).catch(()=>null);
if (!user) return;

// ENTREGA
let entrega = produto.tipo === "auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

// SALVAR
db.entregues[id] = true;
db.vendas[user.id] = (db.vendas[user.id]||0)+1;
db.dinheiro[user.id] = (db.dinheiro[user.id]||0)+produto.preco;
salvar();

// DM
await user.send(`✅ Compra aprovada\n\n${entrega}`).catch(()=>{});

// CARGO
const guild = client.guilds.cache.first();
const membro = await guild.members.fetch(user.id).catch(()=>null);
if (membro) membro.roles.add(CARGO_CLIENTE).catch(()=>{});

// LOGS
client.channels.fetch(CANAL_LOGS).then(c=>c.send(`💰 ${produto.nome} - <@${user.id}>`));
client.channels.fetch(CANAL_RECENTES).then(c=>c.send(`🛒 <@${user.id}> comprou ${produto.nome} - R$${produto.preco}`));

// RANK
let ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> - ${x[1]} compras`)
.join("\n");

client.channels.fetch(CANAL_RANK).then(c=>c.send(`🏆 RANK ATUALIZADO\n\n${ranking}`));

} catch (e) {
console.log(e);
}
},100);
});

app.listen(process.env.PORT || 3000, ()=>console.log("🔥 Webhook rodando"));

client.login(TOKEN);
