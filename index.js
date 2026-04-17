const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder,
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
const CANAL_RECENTES = "1494137996612472943";
const CANAL_FEEDBACK = "1467351899497041942";
const CANAL_RANK = "1490184769831698655";

// BANCO
let db = {
entregues:{},
historico:[],
ranking:{},
pendenteFeedback:{}
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
new SlashCommandBuilder().setName("lucrototal").setDescription("Ver lucro total"),
new SlashCommandBuilder().setName("lucromes").setDescription("Ver lucro do mês"),
new SlashCommandBuilder().setName("lucrohoje").setDescription("Ver lucro de hoje"),
new SlashCommandBuilder().setName("reenviar").setDescription("Reenviar produto")
.addUserOption(opt=>opt.setName("user").setDescription("Usuário").setRequired(true))
].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(TOKEN);

await rest.put(Routes.applicationCommands(client.user.id),{body:commands});
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

// FEEDBACK CAPTURA
if(msg.channel.type === 1 && db.pendenteFeedback[msg.author.id]){
const canal = client.channels.cache.get(CANAL_FEEDBACK);
canal.send(`⭐ Feedback de <@${msg.author.id}>:\n${msg.content}`);
delete db.pendenteFeedback[msg.author.id];
salvar();
}
});

// INTERAÇÕES
client.on("interactionCreate", async interaction => {

try{

// BOTÃO COPIAR
if(interaction.isButton() && interaction.customId.startsWith("copiar_")){
const pix = interaction.customId.replace("copiar_","");
return interaction.reply({content:`📋 PIX:\n${pix}`,ephemeral:true});
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

const pix = pg.point_of_interaction.transaction_data.qr_code;
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:interaction.user.id,allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Produto: ${produto.nome}\nValor: R$${produto.preco}\n\nPIX:\n${pix}`)
.setImage(qrUrl)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pix}`).setLabel("📋 Copiar PIX").setStyle(ButtonStyle.Primary)
);

await canal.send({content:`<@${interaction.user.id}>`,embeds:[embed],components:[row]});

interaction.editReply({content:`✅ Ticket criado: ${canal}`});

setTimeout(()=>canal.delete().catch(()=>{}),600000);
}

// SLASH
if(interaction.isChatInputCommand()){
if(interaction.user.id !== OWNER_ID) return interaction.reply({content:"❌ Apenas dono",ephemeral:true});

if(interaction.commandName==="lucrototal"){
let total=db.historico.reduce((a,b)=>a+b.valor,0);
return interaction.reply(`💰 Total: R$${total}`);
}

if(interaction.commandName==="lucromes"){
let mes=new Date().getMonth();
let total=db.historico.filter(x=>new Date(x.data).getMonth()===mes).reduce((a,b)=>a+b.valor,0);
return interaction.reply(`📅 Mês: R$${total}`);
}

if(interaction.commandName==="lucrohoje"){
let hoje=new Date().toDateString();
let total=db.historico.filter(x=>new Date(x.data).toDateString()===hoje).reduce((a,b)=>a+b.valor,0);
return interaction.reply(`📆 Hoje: R$${total}`);
}

if(interaction.commandName==="reenviar"){
const user=interaction.options.getUser("user");
return user.send("📦 Reenvio do produto solicitado.").then(()=>interaction.reply("✅ Reenviado"));
}

}

}catch(e){console.log(e);}
});

// WEBHOOK
app.post("/webhook",(req,res)=>{
res.sendStatus(200);

setTimeout(async ()=>{
try{

const id=req.body.data?.id;
if(!id) return;

const pg=await payment.get({id});
if(db.entregues[pg.id]) return;

if(pg.status==="approved"){

const userId=pg.metadata.user_id;
const produto=PRODUTOS[pg.metadata.produto];
const user=await client.users.fetch(userId);

let entrega = produto.tipo==="auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

db.entregues[pg.id]=true;

db.historico.push({
valor:produto.preco,
data:new Date()
});

// ranking
let mes=new Date().getMonth();
db.ranking[user.id]=db.ranking[user.id]||{};
db.ranking[user.id][mes]=(db.ranking[user.id][mes]||0)+1;

salvar();

await user.send(`✅ Pagamento aprovado!\n\n${entrega}\n\n⭐ Avalie de 1 a 10 e comente!`);

db.pendenteFeedback[user.id]=true;
salvar();

const logs=await client.channels.fetch(CANAL_LOGS);
logs.send(`💰 Compra: <@${user.id}> - ${produto.nome}`);

const recentes=await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 <@${user.id}> comprou ${produto.nome}`);

// ranking canal
const canalRank=await client.channels.fetch(CANAL_RANK);
let top=Object.entries(db.ranking)
.map(([id,data])=>({id,total:Object.values(data).reduce((a,b)=>a+b,0)}))
.sort((a,b)=>b.total-a.total)
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x.id}> - ${x.total} compras`)
.join("\n");

canalRank.send(`🏆 Ranking:\n${top}`);

}

}catch(e){console.log(e);}
},100);

});

// PORTA
const PORT=process.env.PORT;
app.listen(PORT,()=>console.log("🔥 Webhook rodando"));

// LOGIN
client.login(TOKEN);
