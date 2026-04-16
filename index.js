const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder,
AttachmentBuilder,
ModalBuilder,
TextInputBuilder,
TextInputStyle
} = require("discord.js");

const { MercadoPagoConfig, Payment } = require("mercadopago");
const express = require("express");
const fs = require("fs");

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
const CANAL_RANK = "1490184769831698655";
const CANAL_FEEDBACK = "1467351899497041942";

// BANCO
let db={vendas:{},dinheiro:{},entregues:{},mensal:{}};

if(fs.existsSync("dados.json")){
db = JSON.parse(fs.readFileSync("dados.json"));
}

function salvar(){
fs.writeFileSync("dados.json",JSON.stringify(db,null,2));
}

// MP
const mp = new MercadoPagoConfig({accessToken:MP_TOKEN});
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS={
gta:{preco:5,nome:"Conta GTA V",tipo:"auto",qr:"https://cdn.discordapp.com/attachments/1373392385014370334/1494130892661330040/melifile6374195053668223283.png"},
sensi:{preco:5,nome:"Pack Sensi",tipo:"link",link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file",qr:"https://cdn.discordapp.com/attachments/1373392385014370334/1494130719570661506/melifile7170941545129788461.png"}
};

const CONTAS_GTA=["conta1:senha","conta2:senha"];

client.once("clientReady",()=>console.log("✅ BOT ONLINE"));

// ================= PAINEL =================
client.on("messageCreate",async msg=>{
if(msg.content==="!painel"){
msg.channel.send({
content:"🚀 Loja",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("gta").setLabel("GTA V").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(ButtonStyle.Success)
)]
});
}
});

// ================= INTERAÇÕES =================
client.on("interactionCreate", async interaction => {
try{

// COMPRA
if(interaction.isButton() && PRODUTOS[interaction.customId]){

const produto = PRODUTOS[interaction.customId];

await interaction.reply({content:"⏳ Gerando pagamento...",flags:64});

const pg = await payment.create({
body:{
transaction_amount:Number(produto.preco),
description:produto.nome,
payment_method_id:"pix",
payer:{email:`user${interaction.user.id}@gmail.com`},
metadata:{user_id:interaction.user.id,produto:interaction.customId}
}
});

const pix = pg.point_of_interaction.transaction_data.qr_code;

// ticket
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:interaction.user.id,allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

let embed=new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Produto: ${produto.nome}\nValor: R$${produto.preco}\n\n📋 PIX:\n\```\n${pix}\n```\n⏳ Expira em 10 minutos`)
.setImage(produto.qr)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pg.id}`).setLabel("📋 Copiar PIX").setStyle(ButtonStyle.Primary)
);

await canal.send({content:`<@${interaction.user.id}>`,embeds:[embed],components:[row]});
interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// expiração
setTimeout(()=>canal.delete().catch(()=>{}),600000);
}

// COPIAR PIX
if(interaction.isButton() && interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
const pg = await payment.get({id});
const pix = pg.point_of_interaction.transaction_data.qr_code;

return interaction.reply({content:`📋 PIX:\n\```\n${pix}\n````,flags:64});
}

// FEEDBACK
if(interaction.isModalSubmit() && interaction.customId==="feedback"){
const nota = interaction.fields.getTextInputValue("nota");
const msg = interaction.fields.getTextInputValue("msg");

const canal = await client.channels.fetch(CANAL_FEEDBACK);
canal.send(`⭐ Nota: ${nota}\n💬 ${msg}\n👤 <@${interaction.user.id}>`);

interaction.reply({content:"✅ Feedback enviado!",flags:64});
}

}catch(e){console.log(e);}
});

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
res.sendStatus(200);

try{

if(!req.body.data?.id) return;

const pg = await payment.get({id:req.body.data.id});

if(db.entregues[pg.id]) return;
if(pg.status !== "approved") return;

// anti fraude tempo
const createdAt = new Date(pg.date_created).getTime();
if(Date.now() - createdAt > 600000) return;

const userId = pg.metadata?.user_id;
const produtoId = pg.metadata?.produto;

const user = await client.users.fetch(userId);
const produto = PRODUTOS[produtoId];

// ENTREGA
let entrega = produto.tipo==="auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

// SALVAR
db.entregues[pg.id]=true;
db.vendas[userId]=(db.vendas[userId]||0)+1;

// mensal
const mes = new Date().getMonth();
if(!db.mensal[mes]) db.mensal[mes]={};
db.mensal[mes][userId]=(db.mensal[mes][userId]||0)+1;

salvar();

// DM + feedback
const modal = new ModalBuilder()
.setCustomId("feedback")
.setTitle("Deixe seu feedback");

modal.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId("nota").setLabel("Nota (1-10)").setStyle(TextInputStyle.Short)
),
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId("msg").setLabel("Comentário").setStyle(TextInputStyle.Paragraph)
)
);

await user.send(`✅ Compra confirmada!\n${entrega}`).catch(()=>{});

// LOGS
const canalLogs=await client.channels.fetch(CANAL_LOGS);
canalLogs.send(`💰 Compra confirmada\n👤 <@${userId}>\n📦 ${produto.nome}`);

// RANK MENSAL
const canalRank=await client.channels.fetch(CANAL_RANK);
let top=Object.entries(db.mensal[new Date().getMonth()]||{})
.sort((a,b)=>b[1]-a[1]).slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> — ${x[1]} compras`).join("\n");

canalRank.send(`🏆 Ranking mensal:\n${top}`);

}catch(e){
console.log("ERRO WEBHOOK:", e);
}
});

// PORTA
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 Webhook rodando"));

client.login(TOKEN);
