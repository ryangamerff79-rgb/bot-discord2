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
const OWNER_ID = "853430402601058305";

const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";

// BANCO
let db={vendas:{},dinheiro:{},entregues:{},entregas:{},mensal:{}};

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
gta:{preco:5,nome:"Conta GTA V",tipo:"auto"},
sensi:{preco:5,nome:"Pack Sensi",tipo:"link",link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file"}
};

const CONTAS_GTA=["conta1:senha","conta2:senha"];

// ================= BOT ONLINE + COMANDOS =================
client.once("clientReady", async () => {

console.log("✅ BOT ONLINE");

const commands = [
{
name: "lucro",
description: "Ver lucro total"
},
{
name: "lucromes",
description: "Ver lucro do mês"
},
{
name: "vendas",
description: "Ver total de vendas"
},
{
name: "reenviar",
description: "Reenviar produto",
options: [
{
name: "usuario",
type: 6,
description: "Usuário",
required: true
}
]
}
];

await client.application.commands.set(commands);

console.log("✅ Comandos registrados");

});

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

// embed corrigido
const embed=new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Produto: ${produto.nome}\nValor: R$${produto.preco}\n\n📋 PIX:\n${pix}\n\n⏳ Expira em 10 minutos`)
.setColor("Green");

// botão copiar
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pg.id}`).setLabel("📋 Copiar PIX").setStyle(ButtonStyle.Primary)
);

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row]
});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// expiração
setTimeout(()=>canal.delete().catch(()=>{}),600000);
}

// COPIAR PIX
if(interaction.isButton() && interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
const pg = await payment.get({id});
const pix = pg.point_of_interaction.transaction_data.qr_code;

return interaction.reply({content:`📋 PIX:\n${pix}`,flags:64});
}

// COMANDOS
if(interaction.isChatInputCommand()){

// LUCRO TOTAL
if(interaction.commandName==="lucro"){
if(interaction.user.id !== OWNER_ID) return interaction.reply({content:"❌ Sem permissão",flags:64});

let total = Object.values(db.dinheiro).reduce((a,b)=>a+b,0);
interaction.reply({content:`💰 Lucro total: R$${total}`,flags:64});
}

// LUCRO MENSAL
if(interaction.commandName==="lucromes"){
if(interaction.user.id !== OWNER_ID) return interaction.reply({content:"❌ Sem permissão",flags:64});

const mes = new Date().getMonth();
let total = Object.values(db.mensal[mes]||{}).reduce((a,b)=>a+b,0);
interaction.reply({content:`📅 Lucro do mês: R$${total}`,flags:64});
}

// VENDAS
if(interaction.commandName==="vendas"){
if(interaction.user.id !== OWNER_ID) return interaction.reply({content:"❌ Sem permissão",flags:64});

let total = Object.values(db.vendas).reduce((a,b)=>a+b,0);
interaction.reply({content:`📦 Total de vendas: ${total}`,flags:64});
}

// REENVIAR
if(interaction.commandName==="reenviar"){
if(interaction.user.id !== OWNER_ID) return interaction.reply({content:"❌ Sem permissão",flags:64});

const user = interaction.options.getUser("usuario");
const entrega = db.entregas[user.id];

if(!entrega) return interaction.reply({content:"❌ Nenhuma entrega encontrada",flags:64});

await user.send(`📦 Reenvio:\n${entrega}`).catch(()=>{});
interaction.reply({content:"✅ Reenviado!",flags:64});
}

}

}catch(e){
console.log(e);
}

});

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
res.sendStatus(200);

try{

if(!req.body.data?.id) return;

const pg = await payment.get({id:req.body.data.id});

if(db.entregues[pg.id]) return;
if(pg.status !== "approved") return;

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
db.entregas[userId]=entrega;
db.vendas[userId]=(db.vendas[userId]||0)+1;
db.dinheiro[userId]=(db.dinheiro[userId]||0)+produto.preco;

const mes = new Date().getMonth();
if(!db.mensal[mes]) db.mensal[mes]={};
db.mensal[mes][userId]=(db.mensal[mes][userId]||0)+produto.preco;

salvar();

// DM + fallback
let enviadoDM = true;

await user.send(`✅ Compra confirmada!\n${entrega}`).catch(()=>{
enviadoDM = false;
});

if(!enviadoDM){
for(const guild of client.guilds.cache.values()){
const canal = guild.channels.cache.find(c => c.name === `ticket-${user.username}`);
if(canal){
canal.send(`📦 Entrega:\n${entrega}`);
break;
}
}
}

// LOGS
const canalLogs=await client.channels.fetch(CANAL_LOGS);
canalLogs.send(`💰 <@${userId}> comprou ${produto.nome}`);

}catch(e){
console.log("ERRO WEBHOOK:", e);
}

});

// PORTA
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 Webhook rodando"));

client.login(TOKEN);
