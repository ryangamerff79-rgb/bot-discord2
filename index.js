const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder,
AttachmentBuilder,
REST,
Routes,
SlashCommandBuilder
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
const OWNER_ID = "853430402601058305";

const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";
const CANAL_RECENTES = "1494137996612472943";

// BANCO
let db = {
entregues:{},
historico:[]
};

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

client.once("ready", async ()=>{
console.log("✅ BOT ONLINE");

// SLASH COMMANDS
const commands = [
new SlashCommandBuilder().setName("lucrototal").setDescription("Ver lucro total")
].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(TOKEN);

await rest.put(
Routes.applicationCommands(client.user.id),
{body:commands}
);

});

// PAINEL
client.on("messageCreate",msg=>{
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

// INTERAÇÕES
client.on("interactionCreate", async interaction => {

try{

// BOTÃO COPIAR
if(interaction.isButton() && interaction.customId.startsWith("copiar_")){
const pix = interaction.customId.replace("copiar_","");
return interaction.reply({
content:`📋 PIX:\n${pix}`,
ephemeral:true
});
}

// COMPRA
if(interaction.isButton()){

const produto = PRODUTOS[interaction.customId];
if(!produto) return;

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

// 🔥 PIX
const pix = pg.point_of_interaction.transaction_data.qr_code;

// 🔥 QR PROFISSIONAL (API externa)
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

// CRIAR TICKET
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:interaction.user.id,allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

// EMBED
const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(
`Produto: ${produto.nome}
Valor: R$${produto.preco}

📋 PIX:
${pix}

⏳ Expira em 10 minutos`
)
.setImage(qrUrl)
.setColor("Green");

// BOTÃO
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${pix}`)
.setLabel("📋 Copiar PIX")
.setStyle(ButtonStyle.Primary)
);

await canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row]
});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

// FECHAR
setTimeout(()=>canal.delete().catch(()=>{}),600000);
}

// SLASH
if(interaction.isChatInputCommand()){
if(interaction.user.id !== OWNER_ID) return;

if(interaction.commandName==="lucrototal"){
let total = db.historico.reduce((a,b)=>a+b.valor,0);
interaction.reply(`💰 Total: R$${total}`);
}
}

}catch(err){
console.log("ERRO:",err);
}

});

// WEBHOOK
app.post("/webhook",(req,res)=>{
res.sendStatus(200);

setTimeout(async ()=>{
try{

const id = req.body.data?.id;
if(!id) return;

const pg = await payment.get({id});
if(db.entregues[pg.id]) return;

if(pg.status==="approved"){

const userId = pg.metadata.user_id;
const produto = PRODUTOS[pg.metadata.produto];

const user = await client.users.fetch(userId);

let entrega = produto.tipo==="auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

db.entregues[pg.id]=true;

db.historico.push({
valor:produto.preco
});

salvar();

await user.send(`✅ Pagamento aprovado!\n\n${entrega}`);

const logs = await client.channels.fetch(CANAL_LOGS);
logs.send(`💰 <@${user.id}> comprou ${produto.nome}`);

const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 <@${user.id}> comprou ${produto.nome}`);

}

}catch(e){console.log(e);}
},100);

});

// PORTA
const PORT = process.env.PORT;
app.listen(PORT,()=>console.log("🔥 Webhook rodando"));

// LOGIN
client.login(TOKEN);
