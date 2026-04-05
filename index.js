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
GatewayIntentBits.MessageContent,
GatewayIntentBits.DirectMessages
]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";
const CANAL_FEEDBACK = "1467351899497041942";

// MP
const clientMP = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(clientMP);

// PRODUTOS
const PRODUTOS = {
opt20:{ preco:20, nome:"Otimização Suprema", tipo:"otimizacao" },
gta:{ preco:5, nome:"Conta GTA V", tipo:"auto" },
sensi:{ preco:5, nome:"Pack Sensi", tipo:"link", link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file" }
};

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
.setTitle("🔥 LOJA OFICIAL")
.setDescription(`
🚀 **Otimização Suprema — R$20**
🎮 **Conta GTA V — R$5**
🎯 **Pack Sensi — R$5**

👇 Clique abaixo para comprar
`)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt20").setLabel("Otimização").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("gta").setLabel("GTA V").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("sensi").setLabel("Sensi").setStyle(ButtonStyle.Success)
);

msg.channel.send({embeds:[embed],components:[row]});
}
});

// INTERAÇÃO
client.on("interactionCreate",async interaction=>{
if(!interaction.isButton()) return;

const produto = PRODUTOS[interaction.customId];

if(!produto) return;

await interaction.reply({content:"⏳ Gerando pagamento...", ephemeral:true});

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
const idPagamento = pagamento.id;

pagamentos[idPagamento] = {
userId: interaction.user.id,
produto
};

// CRIA TICKET
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
const buffer = Buffer.from(qr, "base64");
const attachment = new AttachmentBuilder(buffer, { name:"qrcode.png" });

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`💰 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

📋 Copie o código abaixo:
\`\`\`
${copia}
\`\`\``)
.setImage("attachment://qrcode.png")
.setColor("Green");

// BOTÕES
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("copiar_pix")
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId(`ja_paguei_${idPagamento}`)
.setLabel("✅ Já paguei")
.setStyle(ButtonStyle.Success)
);

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row],
files:[attachment]
});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// TIMER
setTimeout(async()=>{
if(pagamentos[idPagamento]){
canal.send("⏰ Pagamento expirado!");
canal.delete();
delete pagamentos[idPagamento];
}
}, 600000);

}catch(err){
console.log(err);
interaction.editReply({content:"❌ Erro no pagamento"});
}

// BOTÃO COPIAR
if(interaction.customId === "copiar_pix"){
return interaction.reply({content:"📋 Copie o código acima 👆", ephemeral:true});
}

// BOTÃO JÁ PAGUEI
if(interaction.customId.startsWith("ja_paguei_")){
return interaction.reply({content:"🔎 Verificando pagamento...", ephemeral:true});
}

});

// WEBHOOK
app.post("/webhook", async (req,res)=>{

try{

if(req.body.type === "payment"){

const pagamentoInfo = await payment.get({ id:req.body.data.id });

if(pagamentoInfo.status === "approved"){

const info = pagamentos[pagamentoInfo.id];
if(!info) return;

const user = await client.users.fetch(info.userId);
const guild = client.guilds.cache.first();

// ENTREGA
let entrega = "";

if(info.produto.tipo === "auto"){
const conta = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
entrega = `🎮 Conta:\n\`\`\`${conta}\`\`\``;
}

if(info.produto.tipo === "link"){
entrega = `📦 Download:\n${info.produto.link}`;
}

if(info.produto.tipo === "otimizacao"){
entrega = "🚀 Sua otimização será enviada!";
}

// DM + AVALIAÇÃO
await user.send(`✅ Pagamento aprovado!\n\n${entrega}

⭐ Avalie de 1 a 10 e escreva um comentário:`);

// esperar resposta
const collector = user.dmChannel.createMessageCollector({ time:600000 });

collector.on("collect",async m=>{
const canalFeed = await client.channels.fetch(CANAL_FEEDBACK);

canalFeed.send(`⭐ Avaliação de <@${user.id}>
📝 ${m.content}`);
collector.stop();
});

// LOG
const logs = await client.channels.fetch(CANAL_LOGS);
logs.send(`💰 Venda: ${info.produto.nome} | R$${info.produto.preco}`);

delete pagamentos[pagamentoInfo.id];

}

}

}catch(e){ console.log(e); }

res.sendStatus(200);
});

app.listen(3000);
client.login(TOKEN);
