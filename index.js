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

// CONTAS INFINITAS
const CONTAS = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

const pagamentos = {};
const blacklist = new Set();

client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// PAINEL
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 LOJA COMPLETA")
.setDescription("Escolha um produto abaixo 👇")
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
client.on("interactionCreate",async interaction=>{

// BOTÕES
if(interaction.isButton()){

// ADMIN
if(interaction.customId.startsWith("admin_")){
if(!interaction.member.roles.cache.has(CARGO_ADMIN)){
return interaction.reply({content:"❌ Sem permissão",ephemeral:true});
}

if(interaction.customId === "admin_vendas"){
return interaction.reply({content:`💰 Total vendas: ${Object.keys(pagamentos).length}`,ephemeral:true});
}

if(interaction.customId === "admin_ban"){
blacklist.add(interaction.user.id);
return interaction.reply({content:"🚫 Usuário banido",ephemeral:true});
}

if(interaction.customId === "admin_forcar"){
return interaction.reply({content:"📦 Entrega forçada enviada",ephemeral:true});
}
}

// BLOQUEIO
if(blacklist.has(interaction.user.id)){
return interaction.reply({content:"🚫 Você está bloqueado",ephemeral:true});
}

await interaction.deferReply({ephemeral:true});

const produto = PRODUTOS[interaction.customId];
if(!produto) return;

try{

const pagamento = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id:"pix",
payer:{ email:`user${interaction.user.id}@gmail.com` }
}
});

const id = pagamento.id;
const copia = pagamento.point_of_interaction.transaction_data.qr_code;
const qr = pagamento.point_of_interaction.transaction_data.qr_code_base64;

pagamentos[id] = {
userId: interaction.user.id,
produto
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
.setDescription(`💰 ${produto.nome}\n💰 R$${produto.preco}\n\n📋 Copiar:\n\`\`\`\n${copia}\n\`\`\``)
.setColor("Green");

// BOTÕES
const botoes = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${id}`).setLabel("Copiar").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId(`paguei_${id}`).setLabel("Já paguei").setStyle(ButtonStyle.Success)
);

// QR só otimização
if(produto.tipo === "otimizacao"){
const buffer = Buffer.from(qr,"base64");
const file = new AttachmentBuilder(buffer,{name:"qr.png"});
embed.setImage("attachment://qr.png");

await canal.send({embeds:[embed],components:[botoes],files:[file]});
}else{
await canal.send({embeds:[embed],components:[botoes]});
}

// TIMER
setTimeout(()=>{
canal.send("⏰ Pagamento expirado, fechando ticket...");
setTimeout(()=>canal.delete().catch(()=>{}),5000);
},600000);

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

}catch(e){
console.log(e);
interaction.editReply({content:"❌ Erro pagamento"});
}
}

// COPIAR
if(interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
const copia = pagamentos[id]?.copia;
return interaction.reply({content:`📋 Copie:\n\`\`\`${copia}\`\`\``,ephemeral:true});
}

// PAGUEI
if(interaction.customId.startsWith("paguei_")){
return interaction.reply({content:"⏳ Aguardando confirmação automática...",ephemeral:true});
}

});

// WEBHOOK
app.post("/webhook",async(req,res)=>{

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
entrega = CONTAS[Math.floor(Math.random()*CONTAS.length)];
}

if(info.produto.tipo === "link"){
entrega = info.produto.link;
}

if(info.produto.tipo === "otimizacao"){
entrega = "📦 Produto liberado!";
}

// ENVIAR
await user.send(`✅ Pago!\n${entrega}`);

const canalLogs = await client.channels.fetch(CANAL_LOGS);

canalLogs.send({
embeds:[new EmbedBuilder()
.setTitle("💰 Venda")
.setDescription(`<@${info.userId}> comprou ${info.produto.nome}`)
.setColor("Green")]
});

}
}

res.sendStatus(200);
});

app.listen(3000);
client.login(TOKEN);
