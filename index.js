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
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5:{ preco:5, nome:"Otimização Básica", tipo:"otimizacao" },
opt10:{ preco:10, nome:"Otimização Avançada", tipo:"otimizacao" },
opt20:{ preco:20, nome:"Otimização Suprema", tipo:"otimizacao" },

gta:{ preco:5, nome:"Conta GTA V", tipo:"auto" },
sensi:{ preco:5, nome:"Pack Sensi", tipo:"link", link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
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

client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// PAINEL
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 LOJA COMPLETA")
.setDescription(`
💻 Otimizações (FPS + desempenho)
🎮 Contas GTA V
🎯 Pack Sensi PRO

👇 Clique abaixo para comprar
`)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("Otimização R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("gta").setLabel("GTA V R$5").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack Sensi R$5").setStyle(ButtonStyle.Danger)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

if(!interaction.isButton()) return;

// BOTÃO COPIAR
if(interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
const data = pagamentos[id];

if(!data){
return interaction.reply({content:"❌ Pagamento não encontrado",ephemeral:true});
}

return interaction.reply({
content:`📋 Copie o PIX:\n\`\`\`\n${data.copia}\n\`\`\``,
ephemeral:true
});
}

// BOTÃO PAGUEI
if(interaction.customId.startsWith("paguei_")){
return interaction.reply({
content:"⏳ Aguardando confirmação automática...",
ephemeral:true
});
}

// COMPRA
const produto = PRODUTOS[interaction.customId];
if(!produto) return;

await interaction.deferReply({ephemeral:true});

try{

const mpPayment = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id:"pix",
payer:{ email:`user${interaction.user.id}@gmail.com` }
}
});

const id = mpPayment.id;
const copia = mpPayment.point_of_interaction.transaction_data.qr_code;
const qr = mpPayment.point_of_interaction.transaction_data.qr_code_base64;

// SALVAR
pagamentos[id] = {
userId: interaction.user.id,
produto,
copia
};

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

// EMBED
let embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`💰 ${produto.nome}
💰 R$${produto.preco}

📋 Copie:
\`\`\`
${copia}
\`\`\`
`)
.setColor("Green");

// BOTÕES
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${id}`)
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId(`paguei_${id}`)
.setLabel("✅ Já paguei")
.setStyle(ButtonStyle.Success)
);

// QR apenas otimização
if(produto.tipo === "otimizacao"){
const buffer = Buffer.from(qr,"base64");
const file = new AttachmentBuilder(buffer,{name:"qr.png"});
embed.setImage("attachment://qr.png");

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row],
files:[file]
});
}else{
await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row]
});
}

// EXPIRAÇÃO
setTimeout(()=>{
canal.send("⏰ Pagamento expirado!");
setTimeout(()=>canal.delete().catch(()=>{}),5000);
},600000);

interaction.editReply({
content:`✅ Ticket criado: ${canal}`
});

}catch(err){
console.log(err);
interaction.editReply({
content:"❌ Erro ao gerar pagamento"
});
}

});

// WEBHOOK
app.post("/webhook",async(req,res)=>{

try{

if(req.body.type === "payment"){

const data = await payment.get({id:req.body.data.id});

if(data.status === "approved"){

const info = pagamentos[data.id];
if(!info) return;

const user = await client.users.fetch(info.userId);
const guild = client.guilds.cache.first();

// ENTREGA
let entrega = "";

if(info.produto.tipo === "auto"){
entrega = `🎮 Conta GTA:\n\`\`\`\n${CONTAS[Math.floor(Math.random()*CONTAS.length)]}\n\`\`\``;
}

if(info.produto.tipo === "link"){
entrega = `📦 Download:\n${info.produto.link}`;
}

if(info.produto.tipo === "otimizacao"){
entrega = "📦 Produto liberado!";
}

// ENVIAR
await user.send(`✅ Pagamento aprovado!\n\n${entrega}`);

// LOG
const canalLogs = await client.channels.fetch(CANAL_LOGS);

canalLogs.send({
embeds:[new EmbedBuilder()
.setTitle("💰 Venda Aprovada")
.setDescription(`<@${info.userId}> comprou ${info.produto.nome}`)
.setColor("Green")
.setTimestamp()]
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
