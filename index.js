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
const CARGO_ADM = "1466621093799268443";

// MP
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

// CONTAS GTA
const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

let vendas = 0;
let banidos = new Set();
const pagamentos = {};

client.once("ready",()=>console.log("BOT ONLINE"));


// ================= PAINEIS =================

client.on("messageCreate", async msg=>{

if(msg.content === "!painel"){
msg.channel.send({
embeds:[new EmbedBuilder().setTitle("🚀 OTIMIZAÇÕES").setColor("Green")],
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("Básica R$5").setStyle(1),
new ButtonBuilder().setCustomId("opt10").setLabel("Avançada R$10").setStyle(3),
new ButtonBuilder().setCustomId("opt20").setLabel("Suprema R$20").setStyle(4)
)]
});
}

if(msg.content === "!painelgta"){
msg.channel.send({
embeds:[new EmbedBuilder().setTitle("🎮 GTA V R$5").setColor("Blue")],
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("gta").setLabel("Comprar").setStyle(1)
)]
});
}

if(msg.content === "!painelsensi"){
msg.channel.send({
embeds:[new EmbedBuilder().setTitle("🎯 PACK SENSI R$5").setColor("Purple")],
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("sensi").setLabel("Comprar").setStyle(3)
)]
});
}

if(msg.content === "!admin"){
if(!msg.member.roles.cache.has(CARGO_ADM)) return;

msg.channel.send({
embeds:[new EmbedBuilder().setTitle("🛠️ PAINEL ADMIN").setColor("Red")],
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("admin_forcar").setLabel("⚡ Forçar Entrega").setStyle(3),
new ButtonBuilder().setCustomId("admin_vendas").setLabel("📊 Vendas").setStyle(1),
new ButtonBuilder().setCustomId("admin_banir").setLabel("🚫 Banir").setStyle(4),
new ButtonBuilder().setCustomId("admin_desbanir").setLabel("✅ Desbanir").setStyle(2)
)]
});
}

});


// ================= INTERAÇÕES =================

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return;

// ================= ANTI BAN =================
if(banidos.has(interaction.user.id)){
return interaction.reply({ephemeral:true,content:"🚫 Você está bloqueado"});
}

// ================= ADMIN =================
if(interaction.customId.startsWith("admin_")){

if(!interaction.member.roles.cache.has(CARGO_ADM)){
return interaction.reply({ephemeral:true,content:"❌ Sem permissão"});
}

if(interaction.customId === "admin_vendas"){
return interaction.reply({ephemeral:true,content:`💰 Total: ${vendas}`});
}

if(interaction.customId === "admin_banir"){
banidos.add(interaction.user.id);
return interaction.reply({ephemeral:true,content:"🚫 Você foi banido (teste)"});
}

if(interaction.customId === "admin_desbanir"){
banidos.delete(interaction.user.id);
return interaction.reply({ephemeral:true,content:"✅ Desbanido"});
}

if(interaction.customId === "admin_forcar"){
const ultimo = Object.keys(pagamentos).pop();
if(!ultimo) return interaction.reply({ephemeral:true,content:"❌ Nada encontrado"});

const info = pagamentos[ultimo];

let entrega = "";
if(info.produto.tipo==="auto"){
entrega = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
}
if(info.produto.tipo==="link"){
entrega = info.produto.link;
}
if(info.produto.tipo==="otimizacao"){
entrega = "✅ Produto liberado";
}

const canal = interaction.guild.channels.cache.find(c=>c.name === `ticket-${info.userId}`);
if(canal) canal.send(`⚡ ENTREGA FORÇADA:\n${entrega}`);

return interaction.reply({ephemeral:true,content:"✅ Entregue"});
}

}

// ================= COPIAR =================
if(interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
const dados = pagamentos[id];

return interaction.reply({
ephemeral:true,
content:`📋 Copie:\n\`\`\`\n${dados.pix}\n\`\`\``
});
}

// ================= PAGUEI =================
if(interaction.customId.startsWith("paguei_")){
return interaction.reply({
ephemeral:true,
content:"⏳ Estamos verificando automaticamente..."
});
}

// ================= COMPRA =================
const produto = PRODUTOS[interaction.customId];
if(!produto) return;

await interaction.deferReply({ephemeral:true});

try{

const pagamento = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id:"pix",
payer:{ email:`user${interaction.user.id}@gmail.com` }
}
});

const copia = pagamento.point_of_interaction.transaction_data.qr_code;
const qr = pagamento.point_of_interaction.transaction_data.qr_code_base64;

pagamentos[pagamento.id] = {
userId: interaction.user.id,
produto,
pix: copia
};

const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.id}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`\`\`\`\n${copia}\n\`\`\``)
.setColor("Green");

const botoes = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pagamento.id}`).setLabel("📋 Copiar").setStyle(2),
new ButtonBuilder().setCustomId(`paguei_${pagamento.id}`).setLabel("✅ Já paguei").setStyle(3)
);

if(produto.tipo==="otimizacao"){
const buffer = Buffer.from(qr,"base64");
const file = new AttachmentBuilder(buffer,{name:"pix.png"});
embed.setImage("attachment://pix.png");

canal.send({embeds:[embed],components:[botoes],files:[file]});
}else{
canal.send({embeds:[embed],components:[botoes]});
}

interaction.editReply({content:`✅ Ticket: ${canal}`});

// AUTO DELETE
setTimeout(()=>canal.delete().catch(()=>{}),600000);

}catch(e){
console.log(e);
interaction.editReply({content:"❌ Erro no pagamento"});
}

});


// ================= WEBHOOK =================

app.post("/webhook", async (req,res)=>{

if(req.body.type === "payment"){

const infoMP = await payment.get({ id:req.body.data.id });

if(infoMP.status === "approved"){

const info = pagamentos[infoMP.id];
if(!info) return;

vendas++;

let entrega = "";
if(info.produto.tipo==="auto"){
entrega = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
}
if(info.produto.tipo==="link"){
entrega = info.produto.link;
}
if(info.produto.tipo==="otimizacao"){
entrega = "✅ Compra confirmada";
}

const guild = client.guilds.cache.first();
const canal = guild.channels.cache.find(c=>c.name === `ticket-${info.userId}`);

if(canal){
canal.send(`✅ PAGAMENTO APROVADO\n${entrega}`);
}

// LOG
const logs = await client.channels.fetch(CANAL_LOGS);
logs.send(`💰 Venda\nUsuário: <@${info.userId}>\nProduto: ${info.produto.nome}\nValor: R$${info.produto.preco}`);

}

}

res.sendStatus(200);
});

app.listen(3000);
client.login(TOKEN);
