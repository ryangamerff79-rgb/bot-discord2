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
const pagamentosAprovados = new Set();

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
Limpeza e mais leveza

⚡ **Avançada — R$10**
Mais FPS e desempenho

👑 **Suprema — R$20**
Máximo desempenho

👇 Clique abaixo para comprar
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

// INTERAÇÕES
client.on("interactionCreate",async interaction=>{
if(!interaction.isButton()) return;

// BOTÃO "JÁ PAGUEI"
if(interaction.customId.startsWith("check_")){

await interaction.deferReply({ flags: 64 });

const id = interaction.customId.split("_")[1];

const pagamentoInfo = await payment.get({ id });

if(pagamentoInfo.status === "approved"){

const info = pagamentos[id];
if(!info) return interaction.editReply("❌ Pagamento não encontrado");

if(pagamentosAprovados.has(id)){
return interaction.editReply("⚠️ Já foi aprovado");
}

pagamentosAprovados.add(id);

const user = await client.users.fetch(info.userId);

await user.send(`✅ Pagamento confirmado!

📦 Produto: ${info.produto.nome}
📦 Download:
${info.produto.link}`);

const canal = await client.channels.fetch(info.canalId).catch(()=>null);

if(canal){
canal.send("✅ Pagamento aprovado! Ticket será fechado...");
setTimeout(()=> canal.delete().catch(()=>{}), 5000);
}

return interaction.editReply("✅ Pagamento confirmado!");

}else{
return interaction.editReply("❌ Ainda não foi pago");
}
}

// COMPRA
await interaction.deferReply({ flags: 64 });

const produto = PRODUTOS[interaction.customId];
if(!produto) return;

const pagamento = await payment.create({
body: {
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id: "pix",
payer: {
email: `user${interaction.user.id}@gmail.com`
},
external_reference: `${interaction.user.id}-${Date.now()}`
}
});

const idPagamento = pagamento.id;

const qr = pagamento.point_of_interaction.transaction_data.qr_code_base64;
const copiaecola = pagamento.point_of_interaction.transaction_data.qr_code;

pagamentos[idPagamento] = {
userId: interaction.user.id,
produto: produto,
canalId: null,
expira: Date.now() + 1000 * 60 * 15
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

pagamentos[idPagamento].canalId = canal.id;

// embed
const embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔑 Copia e cola PIX:
\`\`\`
${copiaecola}
\`\`\`

📱 Escaneie o QR Code abaixo

Após pagar, clique em "Já paguei"`)
.setColor("Green");

// botão check
const rowCheck = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`check_${idPagamento}`)
.setLabel("Já paguei")
.setStyle(ButtonStyle.Success)
);

// qr imagem
const buffer = Buffer.from(qr, "base64");

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[rowCheck],
files:[{
attachment: buffer,
name: "qrcode.png"
}]
});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});
});

// WEBHOOK PRO
app.post("/webhook", async (req,res)=>{

try{

const data = req.body;

if(data.type !== "payment") return res.sendStatus(200);

const pagamentoInfo = await payment.get({
id: data.data.id
});

const info = pagamentos[pagamentoInfo.id];
if(!info) return res.sendStatus(200);

if(pagamentosAprovados.has(pagamentoInfo.id)){
return res.sendStatus(200);
}

if(pagamentoInfo.status !== "approved"){
return res.sendStatus(200);
}

if(Date.now() > info.expira){
return res.sendStatus(200);
}

pagamentosAprovados.add(pagamentoInfo.id);

const user = await client.users.fetch(info.userId);

await user.send(`✅ Pagamento aprovado!

📦 Produto: ${info.produto.nome}
📦 Download:
${info.produto.link}`);

const canalLogs = await client.channels.fetch(CANAL_LOGS);

canalLogs.send(`💰 Venda: <@${info.userId}> - ${info.produto.nome}`);

const canal = await client.channels.fetch(info.canalId).catch(()=>null);

if(canal){
canal.send("✅ Pagamento aprovado! Ticket será fechado...");
setTimeout(()=> canal.delete().catch(()=>{}), 5000);
}

}catch(err){
console.log("ERRO WEBHOOK:", err);
}

res.sendStatus(200);
});

// EXPIRAÇÃO
setInterval(()=>{

for(const id in pagamentos){

const p = pagamentos[id];

if(Date.now() > p.expira){

client.channels.fetch(p.canalId).then(canal=>{
if(canal){
canal.send("⏰ Pagamento expirado, fechando ticket...");
setTimeout(()=> canal.delete().catch(()=>{}), 5000);
}
}).catch(()=>{});

delete pagamentos[id];
}
}

}, 60000);

app.listen(3000);

client.login(TOKEN);
