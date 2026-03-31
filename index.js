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
opt5:{ preco:5, nome:"Otimização Básica", tipo:"otimizacao", link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10:{ preco:10, nome:"Otimização Avançada", tipo:"otimizacao", link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file" },
opt20:{ preco:20, nome:"Otimização Suprema", tipo:"otimizacao", link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" },

gta:{ preco:5, nome:"Conta GTA V Steam", tipo:"conta" },
sensi:{ preco:5, nome:"Pack Sensi PRO", tipo:"sensi", link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
};

// CONTAS GTA (INFINITO)
const CONTAS = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

const pagamentos = {};

// READY
client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// ================= PAINÉIS =================

// OTIMIZAÇÃO
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 Imperial Otimizações")
.setDescription(`
🔧 Básica — R$5
⚡ Avançada — R$10
👑 Suprema — R$20

💻 Aumente FPS e desempenho!
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

// GTA
client.on("messageCreate",async msg=>{
if(msg.content === "!painelgta"){

const embed = new EmbedBuilder()
.setTitle("🎮 CONTAS GTA V")
.setDescription(`
🔥 ENTREGA AUTOMÁTICA
🔥 CONTA COM GTA
🔥 ACESSO IMEDIATO

💰 R$5
`)
.setColor("Blue");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("gta").setLabel("Comprar GTA").setStyle(ButtonStyle.Success)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// SENSI
client.on("messageCreate",async msg=>{
if(msg.content === "!painelsensi"){

const embed = new EmbedBuilder()
.setTitle("🎯 PACK SENSI")
.setDescription(`
🔥 MELHORE SUA MIRA
🔥 CONFIG PRO

💰 R$5
`)
.setColor("Purple");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("sensi").setLabel("Comprar Pack").setStyle(ButtonStyle.Primary)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// ================= COMPRA =================

client.on("interactionCreate", async interaction => {
if (!interaction.isButton()) return;

// botão já paguei
if(interaction.customId.startsWith("check_")){
const idPagamento = interaction.customId.split("_")[1];

const pagamentoInfo = await payment.get({ id: idPagamento });

if(pagamentoInfo.status === "approved"){
await interaction.reply({ content:"✅ Pagamento aprovado!", ephemeral:true });
}else{
await interaction.reply({ content:"⏳ Ainda não aprovado.", ephemeral:true });
}
return;
}

await interaction.deferReply({ ephemeral:true });

const produto = PRODUTOS[interaction.customId];
if (!produto) return;

const pagamentoMP = await payment.create({
body: {
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id: "pix",
payer: { email: `user${interaction.user.id}@gmail.com` }
}
});

const idPagamento = pagamentoMP.id;
const copiaecola = pagamentoMP.point_of_interaction.transaction_data.qr_code;

pagamentos[idPagamento] = {
userId: interaction.user.id,
produto: produto,
canalId: null
};

// cria ticket
const canal = await interaction.guild.channels.create({
name: `ticket-${interaction.user.username}`,
type: 0,
parent: CATEGORIA_ID,
permissionOverwrites: [
{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
{ id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
]
});

pagamentos[idPagamento].canalId = canal.id;

// embed
const embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`
💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔑 Copia e cola:
${copiaecola}

⏳ Expira em 10 minutos
`)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`check_${idPagamento}`)
.setLabel("Já paguei")
.setStyle(ButtonStyle.Success)
);

// QR só otimização
if(produto.tipo === "otimizacao"){
const qr = pagamentoMP.point_of_interaction.transaction_data.qr_code_base64;
const buffer = Buffer.from(qr, "base64");

canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row],
files:[{ attachment: buffer, name: "qrcode.png" }]
});
}else{
canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row]
});
}

// auto delete
setTimeout(async ()=>{
try{
await canal.send("⏰ Tempo expirado!");
setTimeout(()=> canal.delete().catch(()=>{}), 5000);
}catch{}
}, 600000);

interaction.editReply({ content: `✅ Ticket criado: ${canal}` });

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
if(!info) return;

const user = await client.users.fetch(info.userId);

let mensagem = `✅ Pagamento aprovado!\n\n📦 Produto: ${info.produto.nome}\n\n`;

if(info.produto.tipo === "otimizacao" || info.produto.tipo === "sensi"){
mensagem += `📥 Download:\n${info.produto.link}`;
}

if(info.produto.tipo === "conta"){
const conta = CONTAS[Math.floor(Math.random()*CONTAS.length)];
mensagem += `🎮 Conta:\n${conta}`;
}

await user.send(mensagem);

// LOG
const canalLogs = await client.channels.fetch(CANAL_LOGS);

const logEmbed = new EmbedBuilder()
.setTitle("💰 Venda Confirmada")
.addFields(
{ name:"Cliente", value:`<@${info.userId}>`, inline:true },
{ name:"Produto", value:info.produto.nome, inline:true },
{ name:"Valor", value:`R$${info.produto.preco}`, inline:true }
)
.setColor("Green")
.setTimestamp();

canalLogs.send({embeds:[logEmbed]});

// deletar ticket
if(info.canalId){
const canal = await client.channels.fetch(info.canalId).catch(()=>null);
if(canal){
await canal.send("✅ Pagamento aprovado! Fechando...");
setTimeout(()=> canal.delete().catch(()=>{}), 5000);
}
}

}
}

res.sendStatus(200);
});

app.listen(3000);

client.login(TOKEN);
