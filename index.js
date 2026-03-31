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

// ================= CONTAS INFINITAS =================
const CONTAS = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// ================= PRODUTOS =================
const PRODUTOS = {
opt5:{ preco:5, nome:"🔥 Otimização Básica", tipo:"arquivo", link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },

opt10:{ preco:10, nome:"⚡ Otimização Avançada", tipo:"arquivo", link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file" },

opt20:{ preco:20, nome:"👑 Otimização Suprema", tipo:"arquivo", link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" },

steam:{ preco:5, nome:"🎮 Conta GTA V Steam", tipo:"conta" },

sensi:{ preco:5, nome:"🎯 Pack Sensi PRO", tipo:"arquivo", link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
};

const pagamentos = {};

// ================= BOT ONLINE =================
client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// ================= PAINEL OTIMIZAÇÃO =================
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 IMPERIAL OTIMIZAÇÕES")
.setDescription(`
🔥 **BÁSICA — R$5**
Deixe seu PC leve e rápido

⚡ **AVANÇADA — R$10**
Mais FPS e menos travamentos

👑 **SUPREMA — R$20**
Desempenho máximo

💻 MAIS FPS + ZERO LAG
`)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("Básica").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("Avançada").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("Suprema").setStyle(ButtonStyle.Danger)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// ================= PAINEL CONTAS =================
client.on("messageCreate",async msg=>{
if(msg.content === "!contas"){

const embed = new EmbedBuilder()
.setTitle("🎮 CONTAS GTA V STEAM")
.setDescription(`
🔥 ENTREGA AUTOMÁTICA
🔥 CONTA PRONTA PRA JOGAR

💰 APENAS R$5

⚠️ ESTOQUE INFINITO
`)
.setColor("Blue");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("steam").setLabel("Comprar").setStyle(ButtonStyle.Primary)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// ================= PAINEL SENSI =================
client.on("messageCreate",async msg=>{
if(msg.content === "!sensi"){

const embed = new EmbedBuilder()
.setTitle("🎯 PACK SENSI PRO")
.setDescription(`
🔥 MELHORE SUA MIRA
🔥 MAIS PRECISÃO

💰 APENAS R$5
`)
.setColor("Purple");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("sensi").setLabel("Comprar").setStyle(ButtonStyle.Success)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// ================= COMPRA =================
client.on("interactionCreate",async interaction=>{
if(!interaction.isButton())return;

await interaction.deferReply({ ephemeral: true });

const produto = PRODUTOS[interaction.customId];
if(!produto)return;

const pagamento = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id:"pix",
payer:{ email:`user${interaction.user.id}@gmail.com` }
}
});

const idPagamento = pagamento.id;
const copiaecola = pagamento.point_of_interaction.transaction_data.qr_code;

pagamentos[idPagamento] = {
userId: interaction.user.id,
produto: produto,
entregue:false
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

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`
💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔑 Copia e cola:
${copiaecola}

⚠️ Após pagar aguarde confirmação automática
`)
.setColor("Green");

canal.send({content:`<@${interaction.user.id}>`,embeds:[embed]});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});
});

// ================= WEBHOOK =================
app.post("/webhook", async (req,res)=>{

const data = req.body;

if(data.type === "payment"){

const pagamentoInfo = await payment.get({
id: data.data.id
});

if(pagamentoInfo.status === "approved"){

const info = pagamentos[pagamentoInfo.id];

if(!info || info.entregue) return;

info.entregue = true;

const user = await client.users.fetch(info.userId);

// ================= ENTREGA =================
if(info.produto.tipo === "conta"){

const conta = CONTAS[Math.floor(Math.random() * CONTAS.length)];

await user.send(`🎮 SUA CONTA GTA V:
${conta}`);

}else{

await user.send(`✅ Pagamento aprovado!

📦 Produto: ${info.produto.nome}
📥 Download:
${info.produto.link}`);
}

// ================= LOG =================
try{

const canalLogs = await client.channels.fetch(CANAL_LOGS);

if(!canalLogs){
console.log("❌ Canal de logs não encontrado");
return;
}

const logEmbed = new EmbedBuilder()
.setTitle("💰 NOVA VENDA")
.addFields(
{ name:"Cliente", value:`<@${info.userId}>`, inline:true },
{ name:"Produto", value:info.produto.nome, inline:true },
{ name:"Valor", value:`R$${info.produto.preco}`, inline:true }
)
.setColor("Green")
.setTimestamp();

await canalLogs.send({embeds:[logEmbed]});

}catch(err){
console.log("ERRO AO ENVIAR LOG:", err);
}

// ================= AUTO DELETE =================
setTimeout(()=>{
client.channels.cache.forEach(c=>{
if(c.name === `ticket-${user.username}`){
c.delete().catch(()=>{});
}
});
}, 60000);

}
}

res.sendStatus(200);
});

app.listen(3000);

client.login(TOKEN);
