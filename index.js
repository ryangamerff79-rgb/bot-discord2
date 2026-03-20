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

// PRODUTOS
const PRODUTOS = {
opt5:{ preco:5, nome:"Básica", link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10:{ preco:10, nome:"Avançada", link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file" },
opt20:{ preco:20, nome:"Suprema", link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" }
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
🔧 **Otimização Básica — R$5**
• Limpeza do sistema
• Remoção de arquivos inúteis
• Mais leveza e rapidez

💻 Ideal para uso geral

---

⚡ **Otimização Avançada — R$10**
• Melhor desempenho no Windows
• Menos input delay
• FPS mais estável nos jogos

🎮 Ideal para quem joga

---

👑 **Otimização Suprema — R$20**
• Tudo da básica + avançada
• Tweaks avançados
• Máximo desempenho

🚀 Ideal pra extrair tudo do PC

---

👇 Clique em um botão para comprar
`)
.setColor("Green")
.setImage("https://cdn.discordapp.com/attachments/1373392385014370334/1484376373916209202/4b754d98-91ab-421e-9032-25001a8d83e9_1.png");

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

// evita erro
await interaction.deferReply({ ephemeral: true });

const produto = PRODUTOS[interaction.customId];
if(!produto)return;

const pagamento = await payment.create({
body: {
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id: "pix",
payer: {
email: `user${interaction.user.id}@gmail.com`
}
}
});

const idPagamento = pagamento.id;

const qr = pagamento.point_of_interaction.transaction_data.qr_code_base64;
const copiaecola = pagamento.point_of_interaction.transaction_data.qr_code;

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

// embed pagamento
const embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔑 Copia e cola:
${copiaecola}

Após pagar, aguarde confirmação automática`)
.setImage(`data:image/png;base64,${qr}`)
.setColor("Green");

canal.send({content:`<@${interaction.user.id}>`,embeds:[embed]});

// resposta
interaction.editReply({content:`Ticket criado: ${canal}`});
});

// WEBHOOK
app.post("/webhook", async (req,res)=>{

const data = req.body;

if(data.type === "payment"){

const pagamentoInfo = await payment.get({
id: data.data.id
});

if(pagamentoInfo.status === "approved"){

const info = pagamentos[pagamentoInfo.id];
if(!info)return;

const user = await client.users.fetch(info.userId);

// DM
await user.send(`✅ Pagamento aprovado!

📦 Produto: ${info.produto.nome}
📦 Download:
${info.produto.link}

🎥 Tutorial:
https://cdn.discordapp.com/attachments/1468729150071377950/1478085121344143440/bandicam_2026-03-02_14-41-04-216.mp4`);

// LOG
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
