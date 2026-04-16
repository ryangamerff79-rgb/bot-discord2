const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder
} = require("discord.js");

const { MercadoPagoConfig, Payment } = require("mercadopago");
const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.DirectMessages
]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";
const CANAL_COMPRAS = "1494137996612472943";

// BANCO
let db = { vendas:{}, dinheiro:{}, entregues:{} };

if(fs.existsSync("dados.json")){
db = JSON.parse(fs.readFileSync("dados.json"));
}

function salvar(){
fs.writeFileSync("dados.json", JSON.stringify(db, null, 2));
}

// MP
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5:{preco:5,nome:"Otimização Básica",tipo:"link",link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file"},
opt10:{preco:10,nome:"Otimização Avançada",tipo:"link",link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25A7%25C3%25B5es_diddy.rar/file"},
opt20:{preco:20,nome:"Otimização Suprema",tipo:"link",link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file"},
gta:{preco:5,nome:"Conta GTA V",tipo:"auto"},
sensi:{preco:5,nome:"Pack Sensi",tipo:"link",link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file"}
};

// CONTAS GTA
const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566",
"fxnslyfiug:Malaikane2024"
];

client.once("clientReady", () => console.log("✅ BOT ONLINE"));

// PAINEL
client.on("messageCreate", async msg => {
if(msg.content === "!painel"){
msg.channel.send({
content:"🚀 Loja",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5 Básico").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10 Avançado").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20 Supremo").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("gta").setLabel("GTA V").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(ButtonStyle.Secondary)
)]
});
}
});

// INTERAÇÃO
client.on("interactionCreate", async interaction => {

try{

// COMPRA
if(interaction.isButton() && PRODUTOS[interaction.customId]){

const produto = PRODUTOS[interaction.customId];

await interaction.reply({content:"⏳ Gerando pagamento...",flags:64});

const pg = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id: "pix",
payer:{email:`user${interaction.user.id}@gmail.com`},
metadata:{user_id:interaction.user.id,produto:interaction.customId}
}
});

const pix = pg.point_of_interaction.transaction_data.qr_code;
const qr = pg.point_of_interaction.transaction_data.qr_code_base64;

// CRIAR TICKET
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:interaction.user.id,allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

// EMBED LIMPO
const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO VIA PIX")
.setDescription("Escaneie o QR Code abaixo")
.setColor("Green");

// BOTÃO
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${pg.id}`)
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Primary)
);

// ENVIO
if(qr){
const buffer = Buffer.from(qr, "base64");

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed.setImage("attachment://qrcode.png")],
files:[{attachment:buffer,name:"qrcode.png"}],
components:[row]
});
}

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// EXPIRA 10 MIN
setTimeout(()=>canal.delete().catch(()=>{}),600000);
}

// COPIAR PIX
if(interaction.isButton() && interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
const pg = await payment.get({id});
const pix = pg.point_of_interaction.transaction_data.qr_code;

return interaction.reply({content:`📋 PIX:\n${pix}`,flags:64});
}

}catch(e){
console.log("ERRO INTERAÇÃO:", e);
}

});

// WEBHOOK (SEM 502)
app.post("/webhook", async (req, res) => {

// RESPONDE IMEDIATO
res.status(200).send("OK");

try{

console.log("WEBHOOK:", req.body);

if(!req.body?.data?.id) return;

const pg = await payment.get({id:req.body.data.id});

if(db.entregues[pg.id]) return;
if(pg.status !== "approved") return;

const userId = pg.metadata?.user_id;
const produtoId = pg.metadata?.produto;

if(!userId || !produtoId) return;

const user = await client.users.fetch(userId).catch(()=>null);
if(!user) return;

const produto = PRODUTOS[produtoId];

// ENTREGA
let entrega = "";

if(produto.tipo === "auto"){
entrega = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
}

if(produto.tipo === "link"){
entrega = produto.link;
}

// SALVAR
db.entregues[pg.id] = true;
db.vendas[userId] = (db.vendas[userId]||0)+1;
db.dinheiro[userId] = (db.dinheiro[userId]||0)+produto.preco;
salvar();

// DM
let enviado = true;

await user.send(`✅ Pagamento aprovado!\n\n📦 Produto:\n${entrega}`)
.catch(()=> enviado = false);

// FALLBACK
if(!enviado){
for(const guild of client.guilds.cache.values()){
const canal = guild.channels.cache.find(c => c.name === `ticket-${user.username}`);
if(canal){
canal.send(`📦 Entrega:\n${entrega}`);
break;
}
}
}

// LOGS
const canalLogs = await client.channels.fetch(CANAL_LOGS).catch(()=>null);
if(canalLogs){
canalLogs.send(`💰 <@${userId}> comprou ${produto.nome}`);
}

// COMPRAS RECENTES
const canalCompras = await client.channels.fetch(CANAL_COMPRAS).catch(()=>null);
if(canalCompras){
canalCompras.send(`💸 ${user.username} comprou ${produto.nome}`);
}

}catch(e){
console.log("ERRO WEBHOOK:", e);
}

});

// PORTA CORRETA (IMPORTANTE)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log("🔥 Webhook rodando na porta " + PORT);
});

client.login(TOKEN);
