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
let vendas={}, dinheiro={};
if(fs.existsSync("dados.json")){
const data = JSON.parse(fs.readFileSync("dados.json"));
vendas=data.vendas||{};
dinheiro=data.dinheiro||{};
}
function salvar(){
fs.writeFileSync("dados.json",JSON.stringify({vendas,dinheiro},null,2));
}

// MP
const mp = new MercadoPagoConfig({accessToken:MP_TOKEN});
const payment = new Payment(mp);

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

client.once("ready",()=>console.log("✅ BOT ONLINE"));

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

// ================= INTERAÇÃO =================
client.on("interactionCreate", async interaction => {
try{

if(!interaction.isButton()) return;

const produto = PRODUTOS[interaction.customId];
if(!produto) return;

await interaction.reply({content:"⏳ Gerando pagamento...",ephemeral:true});

let pg;

try{
pg = await payment.create({
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
}catch(err){
console.log("ERRO MP:",err);
return interaction.editReply({content:"❌ Erro ao gerar pagamento"});
}

if(!pg?.point_of_interaction){
return interaction.editReply({content:"❌ Erro ao gerar PIX"});
}

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

// embed
let embed=new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Produto: ${produto.nome}
Valor: R$${produto.preco}

📋 PIX:
\`\`\`
${pix}
\`\`\``)
.setColor("Green");

// QR
let files=[];
if(qr){
const buffer=Buffer.from(qr,"base64");
files.push(new AttachmentBuilder(buffer,{name:"qr.png"}));
embed.setImage("attachment://qr.png");
}

// botões (AGORA CORRIGIDO)
const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pg.id}`).setLabel("📋 Copiar PIX").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId(`paguei_${pg.id}`).setLabel("✅ Já paguei").setStyle(ButtonStyle.Success)
);

await canal.send({content:`<@${interaction.user.id}>`,embeds:[embed],components:[row],files});

interaction.editReply({content:`✅ Ticket: ${canal}`});

}catch(err){
console.log("ERRO GERAL:",err);
}
});

// ================= BOTÃO COPIAR =================
client.on("interactionCreate", async interaction=>{
if(!interaction.isButton()) return;

if(interaction.customId.startsWith("copiar_")){

const id = interaction.customId.split("_")[1];

const pg = await payment.get({id});

const pix = pg.point_of_interaction?.transaction_data?.qr_code;

if(!pix){
return interaction.reply({content:"❌ PIX não encontrado",ephemeral:true});
}

const modal=new ModalBuilder()
.setCustomId("pix_modal")
.setTitle("📋 Copiar PIX");

const input=new TextInputBuilder()
.setCustomId("pix")
.setLabel("Segure para copiar")
.setStyle(TextInputStyle.Paragraph)
.setValue(pix);

modal.addComponents(new ActionRowBuilder().addComponents(input));

return interaction.showModal(modal);
}

// botão paguei
if(interaction.customId.startsWith("paguei_")){
return interaction.reply({content:"⏳ Aguardando confirmação automática...",ephemeral:true});
}

});

// ================= WEBHOOK =================
app.post("/webhook",async(req,res)=>{

if(req.body.type==="payment"){

const pg = await payment.get({id:req.body.data.id});

if(pg.status==="approved"){

const userId = pg.metadata.user_id;
const produtoId = pg.metadata.produto;

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
entrega="Produto liberado!";
}

// salvar
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

res.sendStatus(200);
});

app.listen(3000);
client.login(TOKEN);
