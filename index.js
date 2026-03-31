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

// SISTEMAS
const pagamentos = {};
const banidos = new Set();
const vendas = {};

// CONTAS GTA (INFINITO)
const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// PRODUTOS
const PRODUTOS = {
opt5:{ preco:5, nome:"Otimização Básica", tipo:"otimizacao" },
opt10:{ preco:10, nome:"Otimização Avançada", tipo:"otimizacao" },
opt20:{ preco:20, nome:"Otimização Suprema", tipo:"otimizacao" },

gta:{ preco:5, nome:"Conta GTA V", tipo:"auto" },
sensi:{ preco:5, nome:"Pack Sensi", tipo:"link", link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
};

// MP
const clientMP = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(clientMP);

client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// PAINEL (SEM COMANDO)
client.on("messageCreate",async msg=>{

if(msg.content === "!setup" && msg.member.roles.cache.has(CARGO_ADMIN)){

const embed = new EmbedBuilder()
.setTitle("🛒 Loja Oficial")
.setDescription("Escolha um produto abaixo");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("Otimização R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("gta").setLabel("GTA V R$5").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack Sensi R$5").setStyle(ButtonStyle.Danger)
);

msg.channel.send({embeds:[embed],components:[row]});
}

// ADMIN PANEL
if(msg.content === "!admin" && msg.member.roles.cache.has(CARGO_ADMIN)){

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("forcar").setLabel("Forçar entrega").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("vendas").setLabel("Ver vendas").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("ban").setLabel("Banir").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("desban").setLabel("Desbanir").setStyle(ButtonStyle.Secondary)
);

msg.channel.send({content:"Painel Admin",components:[row]});
}

});

// BOTÕES
client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

const member = interaction.member;

// BAN CHECK
if(banidos.has(interaction.user.id) && !member.roles.cache.has(CARGO_ADMIN)){
return interaction.reply({content:"❌ Você está bloqueado",ephemeral:true});
}

// ADMIN BOTÕES
if(member.roles.cache.has(CARGO_ADMIN)){

if(interaction.customId === "vendas"){
let texto = Object.entries(vendas).map(([id,q])=>`<@${id}>: ${q}`).join("\n") || "Sem vendas";
return interaction.reply({content:texto,ephemeral:true});
}

if(interaction.customId === "ban"){
banidos.add(interaction.user.id);
return interaction.reply({content:"Usuário banido",ephemeral:true});
}

if(interaction.customId === "desban"){
banidos.delete(interaction.user.id);
return interaction.reply({content:"Usuário desbanido",ephemeral:true});
}

}

// COMPRA
await interaction.deferReply({ephemeral:true});

const produto = PRODUTOS[interaction.customId];
if(!produto) return;

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
produto
};

// TICKET
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

// QR
let embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`Produto: ${produto.nome}\nValor: R$${produto.preco}\n\n${copia}`);

let files = [];

if(produto.tipo === "otimizacao"){
const buffer = Buffer.from(qr,"base64");
const file = new AttachmentBuilder(buffer,{name:"qr.png"});
embed.setImage("attachment://qr.png");
files=[file];
}

// BOTÕES TICKET
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("paguei").setLabel("Já paguei").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("fechar").setLabel("Fechar").setStyle(ButtonStyle.Danger)
);

canal.send({content:`<@${interaction.user.id}>`,embeds:[embed],components:[row],files});

interaction.editReply({content:`Ticket criado: ${canal}`});

// AUTO DELETE
setTimeout(()=>{
if(canal) canal.delete().catch(()=>{});
},600000);

});

// WEBHOOK
app.post("/webhook", async (req,res)=>{

if(req.body.type === "payment"){

const infoMP = await payment.get({ id:req.body.data.id });

if(infoMP.status === "approved"){

const info = pagamentos[infoMP.id];
if(!info) return;

const user = await client.users.fetch(info.userId);
const guild = client.guilds.cache.first();

// ENTREGA
let entrega = "";

if(info.produto.tipo === "auto"){
entrega = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
}

if(info.produto.tipo === "link"){
entrega = info.produto.link;
}

// ranking
vendas[info.userId] = (vendas[info.userId] || 0) + 1;

// DM
user.send(`✅ Pago!\n${entrega}`);

// LOG
const canalLogs = await client.channels.fetch(CANAL_LOGS);
canalLogs.send(`💰 Venda: <@${info.userId}> - ${info.produto.nome}`);

}

}

res.sendStatus(200);
});

app.listen(3000);
client.login(TOKEN);
