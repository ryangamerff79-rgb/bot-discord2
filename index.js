const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder,
AttachmentBuilder
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
GatewayIntentBits.MessageContent
]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";
const CANAL_FEEDBACK = "1467351899497041942";
const CANAL_RANK = "1490184769831698655";

// BANCO
let vendas = {};
let dinheiro = {};
let semanal = {};

if(fs.existsSync("dados.json")){
const data = JSON.parse(fs.readFileSync("dados.json"));
vendas = data.vendas || {};
dinheiro = data.dinheiro || {};
semanal = data.semanal || {};
}

function salvar(){
fs.writeFileSync("dados.json", JSON.stringify({
vendas, dinheiro, semanal
}, null, 2));
}

// MERCADO PAGO
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5:{ preco:5, nome:"Otimização Básica", tipo:"otimizacao" },
opt10:{ preco:10, nome:"Otimização Avançada", tipo:"otimizacao" },
opt20:{ preco:20, nome:"Otimização Suprema", tipo:"otimizacao" },
gta:{ preco:5, nome:"Conta GTA V", tipo:"auto" },
sensi:{ preco:5, nome:"Pack Sensi", tipo:"link", link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
};

const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

const pagamentos = {};

client.once("ready",()=>{
console.log(`✅ BOT ONLINE: ${client.user.tag}`);
});

// ================= PAINÉIS =================
client.on("messageCreate", async msg=>{

if(msg.content === "!painel"){
msg.channel.send({
content:"🚀 Otimizações",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger)
)]
});
}

if(msg.content === "!painelgta"){
msg.channel.send({
content:"🎮 GTA V R$5",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("gta").setLabel("Comprar").setStyle(ButtonStyle.Primary)
)]
});
}

if(msg.content === "!painelsensi"){
msg.channel.send({
content:"🎯 Pack Sensi R$5",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("sensi").setLabel("Comprar").setStyle(ButtonStyle.Success)
)]
});
}

// COMANDOS RANK
if(msg.content === "!ranking"){
let top = Object.entries(vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> — ${x[1]} compras`)
.join("\n");

msg.channel.send(`🏆 Ranking:\n${top || "Sem vendas"}`);
}

if(msg.content === "!rankingmoney"){
let top = Object.entries(dinheiro)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> — R$${x[1]}`)
.join("\n");

msg.channel.send(`💰 Ranking:\n${top || "Sem vendas"}`);
}

});

// ================= COMPRA =================
client.on("interactionCreate", async interaction=>{
if(!interaction.isButton()) return;

const produto = PRODUTOS[interaction.customId];
if(!produto) return;

await interaction.reply({content:"⏳ Gerando pagamento...", ephemeral:true});

const pg = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id:"pix",
payer:{ email:`user${interaction.user.id}@gmail.com` }
}
});

const id = pg.id;
const pix = pg.point_of_interaction.transaction_data.qr_code;
const qr = pg.point_of_interaction.transaction_data.qr_code_base64;

pagamentos[id] = { user:interaction.user.id, produto };

// ticket
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

// embed
const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO")
.setDescription(`Produto: ${produto.nome}
Valor: R$${produto.preco}

PIX:
\`\`\`
${pix}
\`\`\`

⏳ Expira em 10 minutos`)
.setColor("Green");

let files=[];
if(produto.tipo==="otimizacao"){
const buffer = Buffer.from(qr,"base64");
files.push(new AttachmentBuilder(buffer,{name:"qr.png"}));
embed.setImage("attachment://qr.png");
}

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${id}`).setLabel("📋 Copiar").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId(`paguei_${id}`).setLabel("✅ Já paguei").setStyle(ButtonStyle.Success)
);

canal.send({content:`<@${interaction.user.id}>`,embeds:[embed],components:[row],files});

interaction.editReply({content:`✅ Ticket: ${canal}`});

// delete
setTimeout(()=>canal.delete().catch(()=>{}),600000);
});

// ================= BOTÕES =================
client.on("interactionCreate", async interaction=>{
if(!interaction.isButton()) return;

if(interaction.customId.startsWith("copiar_")){
return interaction.reply({content:"📋 Copie o PIX acima 👆", ephemeral:true});
}

if(interaction.customId.startsWith("paguei_")){
return interaction.reply({content:"⏳ Aguardando confirmação automática...", ephemeral:true});
}
});

// ================= WEBHOOK =================
app.post("/webhook", async (req,res)=>{

if(req.body.type === "payment"){

const pg = await payment.get({id:req.body.data.id});

if(pg.status === "approved"){

const info = pagamentos[pg.id];
if(!info) return;

const user = await client.users.fetch(info.user);

// ENTREGA
let entrega="";
if(info.produto.tipo==="auto"){
entrega = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
}
if(info.produto.tipo==="link"){
entrega = info.produto.link;
}
if(info.produto.tipo==="otimizacao"){
entrega="Produto será entregue!";
}

// SALVAR
vendas[user.id] = (vendas[user.id] || 0) + 1;
dinheiro[user.id] = (dinheiro[user.id] || 0) + info.produto.preco;
semanal[user.id] = (semanal[user.id] || 0) + 1;
salvar();

// DM
await user.send(`✅ Compra aprovada!\n\n${entrega}\n\n⭐ Avalie de 1 a 10`).catch(()=>{});

// LOG
const canalLogs = await client.channels.fetch(CANAL_LOGS);
canalLogs.send(`💰 Venda: <@${user.id}> - ${info.produto.nome}`);

// ATUALIZA RANK AUTOMATICO
atualizarRanking();

}

}

res.sendStatus(200);
});

// ================= RANK AUTO =================
async function atualizarRanking(){

const canal = await client.channels.fetch(CANAL_RANK);

let top = Object.entries(vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> — ${x[1]} compras`)
.join("\n");

canal.send(`🏆 TOP COMPRADORES:\n${top || "Sem vendas"}`);
}

// ================= RESET SEMANAL =================
setInterval(()=>{
semanal = {};
salvar();
console.log("🔄 reset semanal");
}, 7 * 24 * 60 * 60 * 1000);

// ================= AVALIAÇÃO =================
client.on("messageCreate", async msg=>{
if(msg.channel.type === 1){
const nota = parseInt(msg.content);
if(!isNaN(nota)){
const canal = await client.channels.fetch(CANAL_FEEDBACK);
canal.send(`⭐ ${nota}/10 - ${msg.author}`);
}
}
});

app.listen(3000);
client.login(TOKEN);
