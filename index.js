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
opt5:{ preco:5, nome:"Otimização Básica" },
opt10:{ preco:10, nome:"Otimização Avançada" },
opt20:{ preco:20, nome:"Otimização Suprema" }
};

const pagamentos = {};

client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// PAINEL
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 Imperial Otimizações")
.setDescription(`
🔧 **Básica — R$5**
PC mais leve e rápido

⚡ **Avançada — R$10**
FPS estável + menos delay

👑 **Suprema — R$20**
Máximo desempenho

👇 Clique para comprar
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

// COMPRA
client.on("interactionCreate",async interaction=>{
if(!interaction.isButton())return;

await interaction.deferReply({ ephemeral:true });

const produto = PRODUTOS[interaction.customId];
if(!produto)return;

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
const qrBase64 = pagamento.point_of_interaction.transaction_data.qr_code_base64;
const copiaecola = pagamento.point_of_interaction.transaction_data.qr_code;

pagamentos[idPagamento] = {
userId: interaction.user.id,
produto: produto
};

// criar canal
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

// converter QR
const buffer = Buffer.from(qrBase64, "base64");
const attachment = new AttachmentBuilder(buffer, { name:"qrcode.png" });

// embed
const embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

📋 Copia e cola:
\`\`\`
${copiaecola}
\`\`\`

Após pagar, aguarde confirmação automática`)
.setImage("attachment://qrcode.png")
.setColor("Green");

// botão copiar
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setLabel("Copiar código PIX")
.setStyle(ButtonStyle.Link)
.setURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(copiaecola)}`)
);

// enviar
canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row],
files:[attachment]
});

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

// DM
await user.send(`✅ Pagamento aprovado!

📦 Produto: ${info.produto.nome}
Obrigado pela compra!`);

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
