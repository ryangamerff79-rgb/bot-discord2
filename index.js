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
const CANAL_LOGS = "1484365314140541078";

// MERCADO PAGO
const clientMP = new MercadoPagoConfig({
accessToken: MP_TOKEN
});
const payment = new Payment(clientMP);

// PRODUTOS
const PRODUTOS = {
opt5:{ preco:5, nome:"Otimização Básica", tipo:"otimizacao" },
opt10:{ preco:10, nome:"Otimização Avançada", tipo:"otimizacao" },
opt20:{ preco:20, nome:"Otimização Suprema", tipo:"otimizacao" },

gta:{ preco:5, nome:"Conta GTA V", tipo:"auto" },
sensi:{ preco:5, nome:"Pack Sensi", tipo:"link", link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
};

// CONTAS GTA (INFINITO)
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
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// PAINEL OTIMIZAÇÃO
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 Imperial Otimizações")
.setDescription(`
🔧 Básica — R$5  
⚡ Avançada — R$10  
👑 Suprema — R$20  
`)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("Básica").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("Avançada").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("Suprema").setStyle(ButtonStyle.Danger)
);

msg.channel.send({embeds:[embed],components:[row]});
}

// PAINEL GTA
if(msg.content === "!painelgta"){

const embed = new EmbedBuilder()
.setTitle("🎮 Contas GTA V")
.setDescription(`
🔥 Conta com GTA V instalado  
⚡ Acesso imediato  
💰 Apenas R$5  
`)
.setColor("Blue");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("gta").setLabel("Comprar GTA V").setStyle(ButtonStyle.Primary)
);

msg.channel.send({embeds:[embed],components:[row]});
}

// PAINEL SENSI
if(msg.content === "!painelsensi"){

const embed = new EmbedBuilder()
.setTitle("🎯 Pack Sensi PRO")
.setDescription(`
🔥 Melhor sensi para FPS  
⚡ Jogabilidade insana  
💰 Apenas R$5  
`)
.setColor("Purple");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("sensi").setLabel("Comprar Pack").setStyle(ButtonStyle.Success)
);

msg.channel.send({embeds:[embed],components:[row]});
}

});

// COMPRA
client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

await interaction.deferReply({ ephemeral:true });

const produto = PRODUTOS[interaction.customId];

if(!produto){
return interaction.editReply({content:"❌ Produto não encontrado"});
}

try{

const pagamento = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id:"pix",
payer:{
email:`user${interaction.user.id}@gmail.com`
}
}
});

const idPagamento = pagamento.id;
const copiaecola = pagamento.point_of_interaction.transaction_data.qr_code;
const qrBase64 = pagamento.point_of_interaction.transaction_data.qr_code_base64;

pagamentos[idPagamento] = {
userId: interaction.user.id,
produto: produto
};

// criar ticket
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

// EMBED
let embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

📋 Copia e cola:
\`\`\`
${copiaecola}
\`\`\``)
.setColor("Green");

// BOTÃO COPIAR
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setLabel("Copiar PIX")
.setStyle(ButtonStyle.Link)
.setURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(copiaecola)}`)
);

// SE FOR OTIMIZAÇÃO → TEM QR
if(produto.tipo === "otimizacao"){
const buffer = Buffer.from(qrBase64, "base64");
const attachment = new AttachmentBuilder(buffer, { name:"qrcode.png" });

embed.setImage("attachment://qrcode.png");

canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row],
files:[attachment]
});
}else{
canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row]
});
}

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

}catch(err){
console.log(err);
interaction.editReply({content:"❌ Erro ao gerar pagamento"});
}

});

// WEBHOOK
app.post("/webhook", async (req,res)=>{

try{

if(req.body.type === "payment"){

const pagamentoInfo = await payment.get({
id: req.body.data.id
});

if(pagamentoInfo.status === "approved"){

const info = pagamentos[pagamentoInfo.id];
if(!info)return;

const user = await client.users.fetch(info.userId);
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(info.userId);

// ENTREGA
let entrega = "";

if(info.produto.tipo === "auto"){
const conta = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
entrega = `🎮 Conta GTA:\n\`\`\`\n${conta}\n\`\`\``;
}

if(info.produto.tipo === "link"){
entrega = `📦 Download:\n${info.produto.link}`;
}

if(info.produto.tipo === "otimizacao"){
entrega = "✅ Produto liberado! (envio manual ou configure depois)";
}

// enviar no ticket
const canal = guild.channels.cache.find(c=>c.name === `ticket-${member.user.username}`);
if(canal){
canal.send(`✅ Pagamento aprovado!\n\n${entrega}`);
}

// DM
await user.send(`✅ Pagamento aprovado!\n\n${entrega}`);

// LOG
const canalLogs = await client.channels.fetch(CANAL_LOGS);

const logEmbed = new EmbedBuilder()
.setTitle("💰 Venda Aprovada")
.addFields(
{ name:"Cliente", value:`<@${info.userId}>`, inline:true },
{ name:"Produto", value:info.produto.nome, inline:true },
{ name:"Valor", value:`R$${info.produto.preco}`, inline:true }
)
.setColor("Green")
.setTimestamp();

canalLogs.send({embeds:[logEmbed]});

}

}

}catch(e){
console.log(e);
}

res.sendStatus(200);
});

app.listen(3000);

client.login(TOKEN);
