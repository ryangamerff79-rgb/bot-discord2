const {
Client,
GatewayIntentBits,
Partials,
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
GatewayIntentBits.GuildMembers,
GatewayIntentBits.DirectMessages,
GatewayIntentBits.MessageContent
],
partials: [Partials.Channel]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_FEEDBACK = "1467351899497041942";
const CANAL_RANK = "1490184769831698655";
const CARGO_CLIENTE = "1494143094327742594";
const CARGO_STAFF = "1466621093799268443";

// BANCO
let db = {
entregues: {},
tickets: {},
pix: {},
vendas: {},
dinheiro: {},
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

// PIX
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

// RANK
async function atualizarRank() {
const canal = await client.channels.fetch(CANAL_RANK);

const ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`**${i+1}.** <@${x[0]}> - ${x[1]} compras`)
.join("\n") || "Sem compras";

if (!db.rankMsg) {
const msg = await canal.send(`🏆 RANK\n\n${ranking}`);
db.rankMsg = msg.id;
} else {
const msg = await canal.messages.fetch(db.rankMsg).catch(()=>null);
if (msg) msg.edit(`🏆 RANK\n\n${ranking}`);
}
salvar();
}

// PERMISSÃO
function isStaff(member){
return member.roles.cache.has(CARGO_STAFF);
}

// SLASH
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
new SlashCommandBuilder().setName("lucrohoje").setDescription("Ver lucro hoje"),
new SlashCommandBuilder().setName("lucromes").setDescription("Ver lucro mês"),
new SlashCommandBuilder().setName("vendasmês").setDescription("Ver vendas mês"),
new SlashCommandBuilder().setName("anunciar").setDescription("Enviar anúncio").addStringOption(o=>o.setName("msg").setDescription("Mensagem").setRequired(true)),
new SlashCommandBuilder().setName("reenviar").setDescription("Reenviar produto").addUserOption(o=>o.setName("user").setRequired(true)).addStringOption(o=>o.setName("produto").setRequired(true)),
new SlashCommandBuilder().setName("fecharticket").setDescription("Fechar ticket")
].map(c=>c.toJSON());

client.once("ready", async () => {
const rest = new REST({ version: "10" }).setToken(TOKEN);
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
console.log("ONLINE");
});

// INTERAÇÕES
client.on("interactionCreate", async interaction => {

if (interaction.isChatInputCommand()) {

const member = await interaction.guild.members.fetch(interaction.user.id);

if (interaction.commandName === "painel") {
return interaction.reply({
content:"🛒 Loja",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(1),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(3),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(4),
new ButtonBuilder().setCustomId("gta").setLabel("GTA").setStyle(2),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(2)
)]
});
}

// STAFF
if (!isStaff(member)) return interaction.reply({content:"Sem permissão",ephemeral:true});

if (interaction.commandName === "anunciar") {
const msg = interaction.options.getString("msg");
interaction.channel.send(`📢 ${msg}`);
interaction.reply({content:"Enviado",ephemeral:true});
}

if (interaction.commandName === "fecharticket") {
interaction.channel.delete().catch(()=>{});
}

}

// BOTÃO
if (interaction.isButton()) {

if (interaction.customId.startsWith("copiar_")) {
const id = interaction.customId.split("_")[1];
return interaction.reply({ content: db.pix[id], ephemeral: true });
}

if (db.tickets[interaction.user.id]) {
return interaction.reply({ content: "Já tem aberto", ephemeral: true });
}

const produto = PRODUTOS[interaction.customId];
if (!produto) return;

await interaction.reply({ content:"Gerando...",ephemeral:true });

const pg = await gerarPix(interaction.customId, interaction.user.id);
if (!pg) return;

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now().toString();

db.pix[pixId]=pix;
salvar();

const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id: interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id: interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

db.tickets[interaction.user.id]=canal.id;
salvar();

await canal.send(`💳 PIX:\n${pix}`);

interaction.editReply({content:`Ticket: ${canal}`});

// fechar em 12 min
setTimeout(()=> canal.delete().catch(()=>{}),720000);

}
});

// WEBHOOK
app.post("/webhook",(req,res)=>{
res.sendStatus(200);

setTimeout(async()=>{
const id = req.body?.data?.id;
if (!id || db.entregues[id]) return;

const pg = await payment.get({id});
if (pg.status !== "approved") return;

const userId = pg.metadata.user_id;
const produto = PRODUTOS[pg.metadata.produto];

const user = await client.users.fetch(userId).catch(()=>null);
if (!user) return;

const entrega = produto.tipo==="auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

db.entregues[id]=true;
db.vendas[userId]=(db.vendas[userId]||0)+1;
db.dinheiro[userId]=(db.dinheiro[userId]||0)+produto.preco;

const canalId = db.tickets[userId];
delete db.tickets[userId];
salvar();

// FECHA TICKET AO PAGAR
if (canalId){
const canal = await client.channels.fetch(canalId).catch(()=>null);
if (canal) canal.delete().catch(()=>{});
}

// cargo
const guild = await client.guilds.fetch(GUILD_ID);
const member = await guild.members.fetch(userId);
member.roles.add(CARGO_CLIENTE).catch(()=>{});

// DM
await user.send(`🎉 Compra confirmada!\n${entrega}`).catch(()=>{});

// recentes
const rec = await client.channels.fetch(CANAL_RECENTES);
rec.send(`<@${userId}> comprou ${produto.nome} - R$${produto.preco}`);

// rank
atualizarRank();

},100);
});

// FEEDBACK
client.on("messageCreate", async msg=>{
if (!msg.guild && msg.content.includes("nota:")) {
const canal = await client.channels.fetch(CANAL_FEEDBACK);
canal.send(msg.content);
}
});

app.listen(process.env.PORT||3000);
client.login(TOKEN);
