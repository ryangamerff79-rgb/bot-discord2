const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder
} = require("discord.js");

const mercadopago = require("mercadopago");
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

mercadopago.configure({
access_token: MP_TOKEN
});

const PRODUTOS = {
opt5:{ preco:5, nome:"Básica", link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10:{ preco:10, nome:"Avançada", link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file" },
opt20:{ preco:20, nome:"Suprema", link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" }
};

// salvar pagamentos
const pagamentos = {};

client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// painel
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 Loja Automática")
.setDescription("Escolha um produto abaixo:")
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// clique
client.on("interactionCreate",async interaction=>{
if(!interaction.isButton())return;

const produto = PRODUTOS[interaction.customId];
if(!produto)return;

// cria pagamento
const pagamento = await mercadopago.payment.create({
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id: "pix",
payer: { email: `user${interaction.user.id}@gmail.com` }
});

const idPagamento = pagamento.body.id;

const qr = pagamento.body.point_of_interaction.transaction_data.qr_code_base64;
const copiaecola = pagamento.body.point_of_interaction.transaction_data.qr_code;

// salvar
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

const embed = new EmbedBuilder()
.setTitle("💳 PIX")
.setDescription(`💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔑 Copia e cola:
${copiaecola}

Após pagar, aguarde confirmação automática`)
.setImage(`data:image/png;base64,${qr}`)
.setColor("Green");

canal.send({content:`<@${interaction.user.id}>`,embeds:[embed]});

interaction.reply({content:`Ticket criado: ${canal}`,ephemeral:true});
});

// webhook
app.post("/webhook", async (req,res)=>{

const data = req.body;

if(data.type === "payment"){

const payment = await mercadopago.payment.findById(data.data.id);

if(payment.body.status === "approved"){

const info = pagamentos[payment.body.id];
if(!info)return;

const user = await client.users.fetch(info.userId);

// DM cliente
await user.send(`✅ Pagamento aprovado!

📦 Produto: ${info.produto.nome}
📦 Download:
${info.produto.link}

🎥 Tutorial:
https://cdn.discordapp.com/attachments/1468729150071377950/1478085121344143440/bandicam_2026-03-02_14-41-04-216.mp4`);

// LOG DE VENDA
const canalLogs = await client.channels.fetch(CANAL_LOGS);

const logEmbed = new EmbedBuilder()
.setTitle("💰 Nova Venda")
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

res.sendStatus(200);
});

app.listen(3000);

client.login(TOKEN);
