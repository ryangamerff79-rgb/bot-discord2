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

const CATEGORIA_ID = "1466619720487800845";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_RANK = "1490184769831698655";
const CANAL_LOGS = "1488589113954271282";
const CARGO_CLIENTE = "1494143094327742594";

// DB
let db = {
tickets:{},
pix:{},
entregues:{},
vendas:{},
rankMsg:null,
bloqueados:{},
tentativas:{},
transacoes:{}
};

if (fs.existsSync("dados.json")) {
db = JSON.parse(fs.readFileSync("dados.json"));
}

const salvar = ()=>fs.writeFileSync("dados.json",JSON.stringify(db,null,2));

// MP
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5:{nome:"Otimização Básica",preco:5,link:"SEU_LINK"},
opt10:{nome:"Otimização Avançada",preco:10,link:"SEU_LINK"},
opt20:{nome:"Otimização Suprema",preco:20,link:"SEU_LINK"},
sensi:{nome:"Pack Sensi",preco:5,link:"SEU_LINK"}
};

// SLASH
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
new SlashCommandBuilder()
.setName("anunciar")
.setDescription("Enviar anúncio")
.addStringOption(o=>o.setName("mensagem").setDescription("Mensagem").setRequired(true))
].map(c=>c.toJSON());

client.once("ready", async ()=>{
console.log("🔥 V12 FINAL ONLINE");

const rest = new REST({version:"10"}).setToken(TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body:commands });
});

// LOG
async function log(msg){
try{
const canal = await client.channels.fetch(CANAL_LOGS);
canal.send(msg);
}catch{}
}

// PIX
async function gerarPix(produtoId,userId){
try{
return await payment.create({
body:{
transaction_amount:Number(PRODUTOS[produtoId].preco),
description:PRODUTOS[produtoId].nome,
payment_method_id:"pix",
payer:{email:`user${userId}@gmail.com`},
metadata:{user_id:userId,produto:produtoId}
}
});
}catch{return null;}
}

// RANK
async function atualizarRank(){
const canal = await client.channels.fetch(CANAL_RANK);

const ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.map((x,i)=>`**${i+1}.** <@${x[0]}> - ${x[1]}`)
.join("\n") || "Sem compras";

if(!db.rankMsg){
const m = await canal.send("Carregando...");
db.rankMsg = m.id;
}

const msg = await canal.messages.fetch(db.rankMsg);
msg.edit(`🏆 RANK\n\n${ranking}`);
salvar();
}

// INTERAÇÃO
client.on("interactionCreate", async i=>{

if(i.isChatInputCommand()){

if(i.commandName==="painel"){
return i.reply({
content:"🛒 Loja",
components:[
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(1),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(3),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(4),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(2)
)
]
});
}

if(i.commandName==="anunciar"){
const msg = i.options.getString("mensagem");
i.channel.send(`📢 ${msg}`);
return i.reply({content:"✅ enviado",ephemeral:true});
}
}

if(i.isButton()){

// bloqueado
if(db.bloqueados[i.user.id]){
return i.reply({content:"🚫 Bloqueado",ephemeral:true});
}

// anti spam
const now = Date.now();
if(db.tentativas[i.user.id] && now - db.tentativas[i.user.id] < 3000){
return i.reply({content:"⏳ Aguarde...",ephemeral:true});
}
db.tentativas[i.user.id]=now;

// copiar
if(i.customId.startsWith("copiar_")){
const id = i.customId.split("_")[1];
return i.reply({content:db.pix[id],ephemeral:true});
}

// ticket existente
if(db.tickets[i.user.id]){
return i.reply({content:"❌ Já tem pagamento aberto",ephemeral:true});
}

const produtoId = i.customId;
const produto = PRODUTOS[produtoId];

await i.deferReply({ephemeral:true});

const pg = await gerarPix(produtoId,i.user.id);
if(!pg) return i.editReply("Erro PIX");

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now().toString();

db.pix[pixId]=pix;
salvar();

// ticket privado
const canal = await i.guild.channels.create({
name:`ticket-${i.user.username}`,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:i.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:i.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

db.tickets[i.user.id]=canal.id;
salvar();

await log(`📩 Ticket: <@${i.user.id}>`);

const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300&data=${encodeURIComponent(pix)}`;

await canal.send({
content:`<@${i.user.id}> ⏰ Expira em 12 min`,
embeds:[
new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`📦 ${produto.nome}\n💰 R$${produto.preco}`)
.setImage(qr)
.addFields({name:"PIX",value:`\`\`\`${pix.substring(0,1000)}\`\`\``})
],
components:[
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pixId}`).setLabel("Copiar PIX").setStyle(1)
)
]
});

i.editReply(`✅ ${canal}`);

// aviso
setTimeout(()=>canal.send("⚠️ Vai expirar em 2 minutos"),600000);

// expira
setTimeout(()=>{
if(db.tickets[i.user.id]){
delete db.tickets[i.user.id];
salvar();
canal.delete().catch(()=>{});
}
},720000);

}
});

// WEBHOOK
app.post("/webhook",(req,res)=>{
res.sendStatus(200);

setTimeout(async ()=>{
try{

const id = req.body?.data?.id;
if(!id || db.entregues[id]) return;

const pg = await payment.get({id});
if(!pg || pg.status!=="approved") return;

const userId = pg.metadata.user_id;
const produtoId = pg.metadata.produto;
const valor = Number(pg.transaction_amount);

// validação forte
if(valor !== PRODUTOS[produtoId].preco){
db.bloqueados[userId]=true;
salvar();
await log(`🚨 FRAUDE: <@${userId}>`);
return;
}

// salva transação
db.transacoes[id]={
userId,
produtoId,
valor,
data:new Date().toISOString()
};

// entrega
const user = await client.users.fetch(userId);
await user.send(`🎉 Compra confirmada!\n\n${PRODUTOS[produtoId].link}`).catch(()=>{});

// cargo
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(userId);
member.roles.add(CARGO_CLIENTE).catch(()=>{});

// salvar
db.entregues[id]=true;
db.vendas[userId]=(db.vendas[userId]||0)+1;
salvar();

// fechar ticket
const canalId = db.tickets[userId];
if(canalId){
const canal = await client.channels.fetch(canalId);
canal.delete().catch(()=>{});
delete db.tickets[userId];
}

// recentes
const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 <@${userId}> comprou ${produtoId} R$${valor}`);

// log
await log(`💰 Compra: <@${userId}> - ${produtoId}`);

// rank
atualizarRank();

}catch(e){
console.log(e);
}
},200);
});

app.listen(process.env.PORT||3000);
client.login(TOKEN);
