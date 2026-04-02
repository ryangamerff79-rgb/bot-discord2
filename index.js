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
const CARGO_ADMIN = "1466621093799268443";

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

const CONTAS = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

const pagamentos = {};
const vendas = [];
const blacklist = new Set();

client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// ================= PAINEL LOJA =================
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🛒 LOJA OFICIAL")
.setDescription("🔥 Produtos disponíveis abaixo")
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("Otimização R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("gta").setLabel("GTA V R$5").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack Sensi R$5").setStyle(ButtonStyle.Danger)
);

msg.channel.send({embeds:[embed],components:[row]});
}

// ================= PAINEL ADMIN =================
if(msg.content === "!admin"){

if(!msg.member.roles.cache.has(CARGO_ADMIN)){
return msg.reply("❌ Sem permissão");
}

const embed = new EmbedBuilder()
.setTitle("⚙️ PAINEL ADMIN")
.setDescription("Controle total da loja")
.setColor("Red");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("ver_vendas").setLabel("📊 Ver vendas").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("forcar_entrega").setLabel("📦 Forçar entrega").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("banir_user").setLabel("🚫 Banir").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("desbanir_user").setLabel("✅ Desbanir").setStyle(ButtonStyle.Secondary)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// ================= INTERAÇÕES =================
client.on("interactionCreate", async interaction => {

if(!interaction.isButton()) return;

// COPIAR PIX
if(interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
return interaction.reply({
content:`📋 Copie:\n\`\`\`\n${pagamentos[id].copia}\n\`\`\``,
ephemeral:true
});
}

// JÁ PAGUEI (verificação manual rápida)
if(interaction.customId.startsWith("paguei_")){
const id = interaction.customId.split("_")[1];

const data = await payment.get({id});

if(data.status === "approved"){
entregar(id);
return interaction.reply({content:"✅ Pagamento confirmado!",ephemeral:true});
}else{
return interaction.reply({content:"❌ Ainda não caiu, aguarde...",ephemeral:true});
}
}

// ADMIN
if(interaction.customId === "ver_vendas"){
return interaction.reply({
content:`💰 Total vendas: ${vendas.length}`,
ephemeral:true
});
}

if(interaction.customId === "banir_user"){
blacklist.add(interaction.user.id);
return interaction.reply({content:"🚫 Usuário banido",ephemeral:true});
}

if(interaction.customId === "desbanir_user"){
blacklist.delete(interaction.user.id);
return interaction.reply({content:"✅ Usuário desbanido",ephemeral:true});
}

// COMPRA
const produto = PRODUTOS[interaction.customId];
if(!produto) return;

if(blacklist.has(interaction.user.id)){
return interaction.reply({content:"🚫 Você está bloqueado",ephemeral:true});
}

await interaction.deferReply({ephemeral:true});

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

pagamentos[id] = {
userId: interaction.user.id,
produto,
copia
};

// criar ticket
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.id}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

// embed
let embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`💰 ${produto.nome}\n💰 R$${produto.preco}\n\n\`\`\`\n${copia}\n\`\`\``)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${id}`).setLabel("📋 Copiar").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId(`paguei_${id}`).setLabel("✅ Já paguei").setStyle(ButtonStyle.Success)
);

if(produto.tipo === "otimizacao"){
const file = new AttachmentBuilder(Buffer.from(qr,"base64"),{name:"qr.png"});
embed.setImage("attachment://qr.png");
canal.send({embeds:[embed],components:[row],files:[file]});
}else{
canal.send({embeds:[embed],components:[row]});
}

interaction.editReply({content:`✅ Ticket: ${canal}`});

// expira
setTimeout(()=>{
canal.send("⏰ Expirado!");
setTimeout(()=>canal.delete().catch(()=>{}),5000);
},600000);

});

// ================= ENTREGA =================
async function entregar(id){

const info = pagamentos[id];
if(!info) return;

const user = await client.users.fetch(info.userId);

let entrega = "";

if(info.produto.tipo === "auto"){
entrega = CONTAS[Math.floor(Math.random()*CONTAS.length)];
}

if(info.produto.tipo === "link"){
entrega = info.produto.link;
}

await user.send(`✅ Pagamento aprovado!\n\n${entrega}`);

vendas.push({
user:info.userId,
produto:info.produto.nome
});

// LOG
const canalLogs = await client.channels.fetch(CANAL_LOGS);

canalLogs.send({
embeds:[new EmbedBuilder()
.setTitle("💰 Venda")
.setDescription(`<@${info.userId}> comprou ${info.produto.nome}`)
.setColor("Green")]
});
}

// ================= WEBHOOK =================
app.post("/webhook",async(req,res)=>{
if(req.body.type === "payment"){
const data = await payment.get({id:req.body.data.id});
if(data.status === "approved"){
entregar(data.id);
}
}
res.sendStatus(200);
});

app.listen(3000);

client.login(TOKEN);
