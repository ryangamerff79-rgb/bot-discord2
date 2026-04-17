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
GatewayIntentBits.MessageContent
]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";
const CANAL_RECENTES = "1494137996612472943";

// BANCO
let vendas={}, dinheiro={}, entregues={};

if(fs.existsSync("dados.json")){
const data = JSON.parse(fs.readFileSync("dados.json"));
vendas=data.vendas||{};
dinheiro=data.dinheiro||{};
entregues=data.entregues||{};
}

function salvar(){
fs.writeFileSync("dados.json",JSON.stringify({vendas,dinheiro,entregues},null,2));
}

// MP
const mp = new MercadoPagoConfig({accessToken:MP_TOKEN});
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS={
opt5:{preco:5,nome:"Otimização Básica",tipo:"link",link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file"},
opt10:{preco:10,nome:"Otimização Avançada",tipo:"link",link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file"},
opt20:{preco:20,nome:"Otimização Suprema",tipo:"link",link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file"},
gta:{preco:5,nome:"Conta GTA V",tipo:"auto"},
sensi:{preco:5,nome:"Pack Sensi",tipo:"link",link:"https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file"}
};

// CONTAS GTA
const CONTAS_GTA=[
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566",
"fxnslyfiug:Malaikane2024"
];

client.once("clientReady",()=>console.log("✅ BOT ONLINE"));

// PAINEL
client.on("messageCreate",async msg=>{
if(msg.content==="!painel"){
msg.channel.send({
content:"🚀 Loja",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5 Básica").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10 Avançada").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20 Suprema").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("gta").setLabel("GTA V").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(ButtonStyle.Secondary)
)]
});
}
});

// COMPRA
client.on("interactionCreate", async interaction => {
try{

if(!interaction.isButton()) return;
if(!PRODUTOS[interaction.customId]) return;

const produto = PRODUTOS[interaction.customId];

await interaction.reply({content:"⏳ Gerando pagamento...",ephemeral:true});

const pg = await payment.create({
body:{
transaction_amount:Number(produto.preco),
description:produto.nome,
payment_method_id:"pix",
payer:{email:`user${interaction.user.id}@gmail.com`},
metadata:{
user_id:interaction.user.id,
produto:interaction.customId
}
}
});

const pix = pg.point_of_interaction?.transaction_data?.qr_code || "Erro ao gerar PIX";

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

const embed=new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Produto: ${produto.nome}\nValor: R$${produto.preco}\n\nPIX:\n${pix}`)
.setColor("Green");

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed]
});

interaction.editReply({content:`✅ Ticket: ${canal}`});

// fechar 10 min
setTimeout(()=>canal.delete().catch(()=>{}),600000);

}catch(err){
console.log("ERRO BOT:",err);
}
});

// WEBHOOK (RESPOSTA RÁPIDA PRA EVITAR 502)
app.post("/webhook", async (req, res) => {

res.sendStatus(200); // responde rápido

setTimeout(async ()=>{

try {

console.log("WEBHOOK:", req.body);

if (!req.body.data?.id) return;

const pg = await payment.get({ id: req.body.data.id });

if (entregues[pg.id]) return;

if (pg.status === "approved") {

const userId = pg.metadata?.user_id;
const produtoId = pg.metadata?.produto;

if (!userId || !produtoId) return;

const user = await client.users.fetch(userId).catch(()=>null);
if (!user) return;

const produto = PRODUTOS[produtoId];

let entrega = produto.tipo === "auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

entregues[pg.id] = true;

vendas[user.id] = (vendas[user.id]||0)+1;
dinheiro[user.id] = (dinheiro[user.id]||0)+produto.preco;

salvar();

await user.send(`✅ Pagamento aprovado!\n\n${entrega}`).catch(()=>{});

const logs = await client.channels.fetch(CANAL_LOGS);
logs.send(`💰 Compra: <@${user.id}> - ${produto.nome}`);

const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 <@${user.id}> comprou ${produto.nome}`);

}

} catch (err) {
console.log("ERRO WEBHOOK:", err);
}

}, 100);

});

// PORTA CERTA (SEM BUG)
const PORT = process.env.PORT;

app.listen(PORT, () => {
console.log("🔥 Webhook rodando na porta " + PORT);
});

client.login(TOKEN);
