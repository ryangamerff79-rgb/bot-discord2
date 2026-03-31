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

// MP
const clientMP = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(clientMP);

// PRODUTOS
const PRODUTOS = {
opt5:{ preco:5, nome:"Otimização Básica", tipo:"otimizacao" },
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

const pagamentos = {};

client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// PAINEL
client.on("messageCreate",async msg=>{
if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🛒 Loja")
.setDescription("Escolha o produto");

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

if(!interaction.isButton()) return;

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

const idPagamento = pagamento.id;
const copia = pagamento.point_of_interaction.transaction_data.qr_code;
const qr = pagamento.point_of_interaction.transaction_data.qr_code_base64;

// salva PIX
pagamentos[idPagamento] = {
userId: interaction.user.id,
produto,
pix: copia
};

// cria ticket
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

// embed
let embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

⏳ Expira em: 10:00

📋 Copie:
```
${copia}
````)
.setColor("Green");

let files = [];

if(produto.tipo === "otimizacao"){
const buffer = Buffer.from(qr,"base64");
const file = new AttachmentBuilder(buffer,{name:"qr.png"});
embed.setImage("attachment://qr.png");
files=[file];
}

// BOTÕES
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("copiar_pix").setLabel("📋 Copiar PIX").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("abrir_banco").setLabel("🏦 Abrir Banco").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("paguei").setLabel("✅ Já paguei").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("fechar").setLabel("❌ Fechar").setStyle(ButtonStyle.Danger)
);

canal.send({content:`<@${interaction.user.id}>`,embeds:[embed],components:[row],files});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// CONTADOR
let minutos = 10;

const intervalo = setInterval(()=>{
minutos--;

if(minutos === 2){
canal.send("⚠️ Seu pagamento expira em 2 minutos!");
}

if(minutos <= 0){
clearInterval(intervalo);
canal.send("❌ Pagamento expirado!");
setTimeout(()=>canal.delete().catch(()=>{}),3000);
}

},60000);

}catch(err){
console.log(err);
interaction.editReply({content:"❌ Erro no pagamento"});
}

// BOTÕES FUNCIONAIS
if(interaction.customId === "copiar_pix"){
const data = Object.values(pagamentos).find(p=>p.userId === interaction.user.id);
return interaction.reply({
content:`📋 Copie:\n\```\n${data.pix}\n````,
ephemeral:true
});
}

if(interaction.customId === "abrir_banco"){
return interaction.reply({
content:"Abra seu app do banco e cole o PIX.",
ephemeral:true
});
}

if(interaction.customId === "fechar"){
interaction.channel.delete().catch(()=>{});
}

});

// WEBHOOK
app.post("/webhook", async (req,res)=>{

if(req.body.type === "payment"){

const infoMP = await payment.get({ id:req.body.data.id });

if(infoMP.status === "approved"){

const info = pagamentos[infoMP.id];
if(!info) return;

const user = await client.users.fetch(info.userId);

// ENTREGA
let entrega = "";

if(info.produto.tipo === "auto"){
entrega = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
}

if(info.produto.tipo === "link"){
entrega = info.produto.link;
}

// DM
user.send(`✅ Pagamento aprovado!\n${entrega}`);

// LOG
const canalLogs = await client.channels.fetch(CANAL_LOGS);
canalLogs.send(`💰 Venda: <@${info.userId}> - ${info.produto.nome}`);

}

}

res.sendStatus(200);
});

app.listen(3000);
client.login(TOKEN);
