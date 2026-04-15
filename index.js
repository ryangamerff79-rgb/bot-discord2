const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder,
AttachmentBuilder,
ModalBuilder,
TextInputBuilder,
TextInputStyle
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
const CANAL_RANK = "1490184769831698655";

// BANCO
let vendas={}, dinheiro={}, entregues={};

if(fs.existsSync("dados.json")){
const data = JSON.parse(fs.readFileSync("dados.json"));
vendas=data.vendas||{};
dinheiro=data.dinheiro||{};
entregues=data.entregues||{};
}

function salvar(){
fs.writeFileSync("dados.json",JSON.stringify({vendas,dinheiro,entregues},null,2));
}

// MP
const mp = new MercadoPagoConfig({accessToken:MP_TOKEN});
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS={
opt5:{preco:5,nome:"Otimização Básica",tipo:"otimizacao"},
opt10:{preco:10,nome:"Otimização Avançada",tipo:"otimizacao"},
opt20:{preco:20,nome:"Otimização Suprema",tipo:"otimizacao"},
gta:{preco:5,nome:"Conta GTA V",tipo:"auto"},
sensi:{preco:5,nome:"Pack Sensi",tipo:"link",link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file"}
};

const CONTAS_GTA=[
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

client.once("clientReady",()=>console.log("✅ BOT ONLINE"));

// ================= PAINEL =================
client.on("messageCreate",async msg=>{
if(msg.content==="!painel"){
msg.channel.send({
content:"🚀 Loja",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("gta").setLabel("GTA V").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(ButtonStyle.Secondary)
)]
});
}
});

// ================= INTERAÇÕES =================
client.on("interactionCreate", async interaction => {
try{

if(!interaction.isButton()) return;

if(PRODUTOS[interaction.customId]){

const produto = PRODUTOS[interaction.customId];

await interaction.reply({content:"⏳ Gerando pagamento...",flags:64});

const pg = await payment.create({
body:{
transaction_amount:Number(produto.preco),
description:produto.nome,
payment_method_id:"pix",
payer:{email:`user${interaction.user.id}@gmail.com`},
metadata:{
user_id:interaction.user.id,
produto:interaction.customId
}
}
});

const pix = pg.point_of_interaction.transaction_data.qr_code;
const qr = pg.point_of_interaction.transaction_data.qr_code_base64;

// ticket
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:interaction.user.id,allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

let embed=new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Produto: ${produto.nome}
Valor: R$${produto.preco}

📋 PIX:
\`\`\`
${pix}
\`\`\`

⏳ Expira em 10 minutos`)
.setColor("Green");

let files=[];
if(qr){
const buffer=Buffer.from(qr,"base64");
files.push(new AttachmentBuilder(buffer,{name:"qr.png"}));
embed.setImage("attachment://qr.png");
}

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
files
});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// aviso 8 min
setTimeout(()=>{
canal.send("⚠️ Últimos 2 minutos para pagar!");
},480000);

// fechar 10 min
setTimeout(()=>{
canal.send("❌ Pagamento expirado, ticket fechado.");
canal.delete().catch(()=>{});
},600000);

return;
}

}catch(err){
console.log("ERRO:",err);
}
});

// ================= WEBHOOK =================
app.post("/webhook",async(req,res)=>{
try{

console.log("WEBHOOK:", req.body);

if(req.body.data?.id){

const pg = await payment.get({id:req.body.data.id});

// evitar duplicar entrega
if(entregues[pg.id]) return;

// só aprovado
if(pg.status === "approved"){

// validar tempo (10 min)
const createdAt = new Date(pg.date_created).getTime();
if(Date.now() - createdAt > 600000){
console.log("Pagamento expirado ignorado");
return;
}

const userId = pg.metadata?.user_id;
const produtoId = pg.metadata?.produto;

if(!userId || !produtoId) return;

const user = await client.users.fetch(userId).catch(()=>null);
if(!user) return;

const produto = PRODUTOS[produtoId];

// entrega
let entrega="";
if(produto.tipo==="auto"){
entrega=CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
}
if(produto.tipo==="link"){
entrega=produto.link;
}
if(produto.tipo==="otimizacao"){
entrega="✅ Sua otimização será enviada!";
}

// salvar entrega
entregues[pg.id]=true;

// salvar stats
vendas[user.id]=(vendas[user.id]||0)+1;
dinheiro[user.id]=(dinheiro[user.id]||0)+produto.preco;
salvar();

// DM
await user.send(`✅ Pagamento aprovado!\n\n${entrega}`).catch(()=>{});

// logs
const canalLogs=await client.channels.fetch(CANAL_LOGS);
canalLogs.send(`💰 <@${user.id}> comprou ${produto.nome}`);

// ranking
const canalRank=await client.channels.fetch(CANAL_RANK);
let top=Object.entries(vendas).sort((a,b)=>b[1]-a[1]).slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> — ${x[1]} compras`).join("\n");
canalRank.send(`🏆 Ranking:\n${top}`);

}

}

}catch(e){
console.log("ERRO WEBHOOK:",e);
}

res.sendStatus(200);
});

// PORTA RAILWAY
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 Webhook rodando"));

client.login(TOKEN);
