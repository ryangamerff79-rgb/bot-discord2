const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder,
AttachmentBuilder,
ComponentType
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
const CANAL_FEEDBACK = "1467351899497041942";

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

// CONTAS GTA INFINITAS
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
client.on("messageCreate",async msg=>{

if(msg.content === "!painel"){
const embed = new EmbedBuilder()
.setTitle("🚀 Imperial Otimizações")
.setDescription("Escolha sua otimização:")
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("Básica R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("Avançada R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("Suprema R$20").setStyle(ButtonStyle.Danger)
);

msg.channel.send({embeds:[embed],components:[row]});
}

if(msg.content === "!painelgta"){
const embed = new EmbedBuilder()
.setTitle("🎮 GTA V")
.setDescription("🔥 Conta GTA V apenas R$5");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("gta").setLabel("Comprar").setStyle(ButtonStyle.Primary)
);

msg.channel.send({embeds:[embed],components:[row]});
}

if(msg.content === "!painelsensi"){
const embed = new EmbedBuilder()
.setTitle("🎯 Pack Sensi")
.setDescription("🔥 Melhor sensi por R$5");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("sensi").setLabel("Comprar").setStyle(ButtonStyle.Success)
);

msg.channel.send({embeds:[embed],components:[row]});
}

});

// ================= COMPRA =================
client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

const produto = PRODUTOS[interaction.customId];
if(!produto) return;

await interaction.reply({content:"⏳ Gerando pagamento...", ephemeral:true});

try{

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

// QR
let files = [];
if(produto.tipo === "otimizacao"){
const buffer = Buffer.from(qrBase64, "base64");
files.push(new AttachmentBuilder(buffer,{name:"qrcode.png"}));
}

// embed
const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`💰 ${produto.nome}
💰 R$${produto.preco}

📋 COPIE O PIX:
\`\`\`
${copiaecola}
\`\`\``)
.setColor("Green");

if(files.length) embed.setImage("attachment://qrcode.png");

// BOTÕES FUNCIONANDO
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${idPagamento}`).setLabel("📋 Copiar PIX").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId(`ja_paguei_${idPagamento}`).setLabel("✅ Já paguei").setStyle(ButtonStyle.Success)
);

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row],
files
});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// AUTO DELETE 10 MIN
setTimeout(()=>{
if(canal) canal.delete().catch(()=>{});
},600000);

}catch(e){
console.log(e);
interaction.editReply({content:"❌ Erro ao gerar pagamento"});
}

});

// ================= BOTÕES =================
client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return;

// COPIAR PIX
if(interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
const info = pagamentos[id];
if(!info) return;

const pagamentoInfo = await payment.get({id});
const copia = pagamentoInfo.point_of_interaction.transaction_data.qr_code;

return interaction.reply({
content:`📋 Copie abaixo:\n\`\`\`\n${copia}\n\`\`\``,
ephemeral:true
});
}

// JA PAGUEI
if(interaction.customId.startsWith("ja_paguei_")){
return interaction.reply({
content:"⏳ Aguardando confirmação automática do pagamento...",
ephemeral:true
});
}

});

// ================= WEBHOOK =================
app.post("/webhook", async (req,res)=>{

try{

if(req.body.type === "payment"){

const pagamentoInfo = await payment.get({id:req.body.data.id});

if(pagamentoInfo.status === "approved"){

const info = pagamentos[pagamentoInfo.id];
if(!info) return;

const user = await client.users.fetch(info.userId);

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
entrega = "✅ Sua otimização será entregue!";
}

// DM + AVALIAÇÃO
await user.send(`${entrega}

⭐ Avalie de 1 a 10 respondendo aqui!`).catch(()=>{});

// LOG
const canalLogs = await client.channels.fetch(CANAL_LOGS);

canalLogs.send({
embeds:[
new EmbedBuilder()
.setTitle("💰 Venda")
.setDescription(`Cliente: <@${info.userId}>
Produto: ${info.produto.nome}`)
.setColor("Green")
]
});

}

}

}catch(e){console.log(e);}

res.sendStatus(200);
});

app.listen(3000);

client.login(TOKEN);
