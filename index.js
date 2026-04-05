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

// MERCADO PAGO
const clientMP = new MercadoPagoConfig({
accessToken: MP_TOKEN
});
const payment = new Payment(clientMP);

// SISTEMAS
let vendas = 0;
let ranking = {};
let ticketsAbertos = new Set();
const pagamentos = {};

// PRODUTOS
const PRODUTOS = {
opt5:{ preco:5, nome:"🚀 limpeza", tipo:"otimizacao" },
opt10:{ preco:10, nome:"⚡ FPS Estável", tipo:"otimizacao" },
opt20:{ preco:20, nome:"👑 Máximo Desempenho", tipo:"otimizacao" },

gta:{ preco:5, nome:"🎮 Conta GTA V", tipo:"auto" },
sensi:{ preco:5, nome:"🎯 pack de Sensi ", tipo:"link", link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
};

const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// READY
client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// PAINEL
client.on("messageCreate",async msg=>{

if(msg.content === "!painel"){
msg.channel.send({
embeds:[new EmbedBuilder()
.setTitle("🚀 limpeza")
.setDescription("🔥 SEM LAG | MAIS FPS\n💰 A partir de R$5")
.setColor("Green")],
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger)
)]
});
}

if(msg.content === "!rank"){
let texto = "🏆 Ranking de Compras:\n\n";

const top = Object.entries(ranking)
.sort((a,b)=>b[1]-a[1])
.slice(0,10);

top.forEach(([id,qtd],i)=>{
texto += `${i+1}. <@${id}> - ${qtd} compras\n`;
});

msg.channel.send(texto || "Sem dados ainda.");
}

});

// COMPRA
client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

const produto = PRODUTOS[interaction.customId];
if(!produto) return;

// ANTI SPAM
if(ticketsAbertos.has(interaction.user.id)){
return interaction.reply({content:"❌ Você já tem um ticket aberto!",ephemeral:true});
}

await interaction.deferReply({ephemeral:true});

try{

const pagamentoMP = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id:"pix",
payer:{ email:`user${interaction.user.id}@gmail.com` }
}
});

const id = pagamentoMP.id;
const copia = pagamentoMP.point_of_interaction.transaction_data.qr_code;
const qr = pagamentoMP.point_of_interaction.transaction_data.qr_code_base64;

pagamentos[id] = {
userId: interaction.user.id,
produto,
canalId:null,
copia
};

ticketsAbertos.add(interaction.user.id);

// CRIAR TICKET
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.id}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

pagamentos[id].canalId = canal.id;

// EMBED
let embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`💰 ${produto.nome}
💰 R$${produto.preco}

📋 Copie:
\`\`\`
${copia}
\`\`\``)
.setColor("Green");

// BOTÕES
const botoes = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${id}`).setLabel("📋 Copiar PIX").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId(`paguei_${id}`).setLabel("✅ Já paguei").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId(`fechar_${id}`).setLabel("🔒 Fechar").setStyle(ButtonStyle.Danger)
);

// QR só otimização
if(produto.tipo === "otimizacao"){
const buffer = Buffer.from(qr,"base64");
const file = new AttachmentBuilder(buffer,{name:"pix.png"});
embed.setImage("attachment://pix.png");

canal.send({embeds:[embed],components:[botoes],files:[file]});
}else{
canal.send({embeds:[embed],components:[botoes]});
}

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// AUTO DELETE 10 MIN
setTimeout(()=>{
if(canal){
canal.delete().catch(()=>{});
ticketsAbertos.delete(interaction.user.id);
}
},600000);

}catch(e){
console.log(e);
interaction.editReply({content:"❌ Erro no pagamento"});
}

});

// BOTÕES
client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

if(interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
const copia = pagamentos[id]?.copia;

return interaction.reply({
content:`📋 Copie:\n\`\`\`\n${copia}\n\`\`\``,
ephemeral:true
});
}

if(interaction.customId.startsWith("fechar_")){
ticketsAbertos.delete(interaction.user.id);
await interaction.channel.send("🔒 Ticket fechado!");
setTimeout(()=>interaction.channel.delete().catch(()=>{}),2000);
}

if(interaction.customId.startsWith("paguei_")){
return interaction.reply({content:"⏳ Aguardando confirmação automática...",ephemeral:true});
}

});

// WEBHOOK
app.post("/webhook", async (req,res)=>{

try{

if(req.body.type === "payment"){

const infoMP = await payment.get({id:req.body.data.id});

if(infoMP.status === "approved"){

const info = pagamentos[infoMP.id];
if(!info) return;

// ENTREGA
let entrega = "";

if(info.produto.tipo === "auto"){
entrega = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
}

if(info.produto.tipo === "link"){
entrega = info.produto.link;
}

if(info.produto.tipo === "otimizacao"){
entrega = "📦 Entrega manual ou configure depois";
}

// CONTADOR
vendas++;
ranking[info.userId] = (ranking[info.userId] || 0) + 1;
ticketsAbertos.delete(info.userId);

const user = await client.users.fetch(info.userId);

// DM + fallback
try{
await user.send(`✅ Pagamento aprovado!\n\n${entrega}`);
}catch{
const canal = await client.channels.fetch(info.canalId);
canal.send(`⚠️ DM bloqueada!\n\n${entrega}`);
}

// ticket
const canal = await client.channels.fetch(info.canalId);
canal.send(`✅ PAGAMENTO APROVADO!\n\n${entrega}`);

// LOG
const logs = await client.channels.fetch(CANAL_LOGS);

logs.send({
embeds:[new EmbedBuilder()
.setTitle("💰 Venda Aprovada")
.setDescription(`
👤 Cliente: <@${info.userId}>
📦 Produto: ${info.produto.nome}
💰 Valor: R$${info.produto.preco}

📊 Total vendas: ${vendas}
`)
.setColor("Green")]
});

}

}

}catch(e){
console.log(e);
}

res.sendStatus(200);
});

app.listen(3000);
client.login(TOKEN);
