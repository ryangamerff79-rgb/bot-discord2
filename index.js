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
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.DirectMessages,
GatewayIntentBits.MessageContent
]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1488589113954271282";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_FEEDBACK = "1467351899497041942";
const CANAL_RANK = "1490184769831698655";

const CARGO_CLIENTE = "1494143094327742594";
const CARGO_STAFF = "1466621093799268443";

// BANCO
let db = { entregues:{}, tickets:{}, pix:{}, vendas:{}, dinheiro:{}, feedbacks:[] };

if (fs.existsSync("dados.json")) {
db = JSON.parse(fs.readFileSync("dados.json"));
}

function salvar(){
fs.writeFileSync("dados.json", JSON.stringify(db,null,2));
}

// MP
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5: { preco:5, nome:"Otimização Básica", link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10:{ preco:10,nome:"Otimização Avançada", link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25A7%25C3%25B5es_diddy.rar/file"},
opt20:{ preco:20,nome:"Otimização Suprema", link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file"},
sensi:{ preco:5,nome:"Pack Sensi", link:"https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file"},
gta:{ preco:5,nome:"Conta GTA V", tipo:"auto"}
};

const CONTAS = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// SLASH
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
new SlashCommandBuilder().setName("lucrohoje").setDescription("Ver lucro hoje"),
new SlashCommandBuilder().setName("lucromes").setDescription("Ver lucro mês"),
new SlashCommandBuilder().setName("vendasmes").setDescription("Vendas mês"),
new SlashCommandBuilder()
.setName("reenviar")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o=>o.setName("produto").setDescription("ID produto").setRequired(true)),
new SlashCommandBuilder()
.setName("anunciar")
.addStringOption(o=>o.setName("msg").setDescription("Mensagem").setRequired(true)),
new SlashCommandBuilder().setName("fecharticket").setDescription("Fechar ticket")
].map(c=>c.toJSON());

client.once("ready", async ()=>{
console.log("✅ BOT ONLINE");
const rest = new REST({ version:"10" }).setToken(TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body:commands });
console.log("✅ Comandos registrados");
});

// GERAR PIX
async function gerarPix(produtoId,userId){
for(let i=1;i<=3;i++){
try{
const pg = await payment.create({
body:{
transaction_amount:Number(PRODUTOS[produtoId].preco),
description:PRODUTOS[produtoId].nome,
payment_method_id:"pix",
payer:{email:`user${userId}@gmail.com`},
metadata:{user_id:userId,produto:produtoId}
}
});
if(pg?.point_of_interaction?.transaction_data) return pg;
}catch(e){console.log("MP erro tentativa",i);}
}
return null;
}

// INTERAÇÃO
client.on("interactionCreate", async interaction=>{
try{

// SLASH
if(interaction.isChatInputCommand()){

if(interaction.commandName==="painel"){
let total = Object.values(db.vendas).reduce((a,b)=>a+b,0);

return interaction.reply({
content:`🚀 DIDDY STORE\n💰 ${total} vendas`,
components:[
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("gta").setLabel("GTA").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(ButtonStyle.Secondary)
)
]
});
}

// COMANDOS STAFF
if(!interaction.member.roles.cache.has(CARGO_STAFF))
return interaction.reply({content:"❌ Sem permissão",ephemeral:true});

if(interaction.commandName==="anunciar"){
const msg = interaction.options.getString("msg");
interaction.channel.send(msg);
return interaction.reply({content:"✅ Enviado",ephemeral:true});
}

if(interaction.commandName==="fecharticket"){
interaction.channel.delete();
}

if(interaction.commandName==="reenviar"){
const user = interaction.options.getUser("user");
const prod = interaction.options.getString("produto");
const produto = PRODUTOS[prod];
if(!produto) return interaction.reply("Produto inválido");

let entrega = produto.tipo==="auto"
? CONTAS[Math.floor(Math.random()*CONTAS.length)]
: produto.link;

user.send(`📦 Reenvio:\n${entrega}`);
return interaction.reply("✅ Reenviado");
}

}

// BOTÕES
if(interaction.isButton()){

if(interaction.customId.startsWith("copiar_")){
const id = interaction.customId.split("_")[1];
return interaction.reply({content:db.pix[id],ephemeral:true});
}

if(db.tickets[interaction.user.id])
return interaction.reply({content:"❌ Já tem ticket",ephemeral:true});

const produtoId = interaction.customId;
if(!PRODUTOS[produtoId]) return;

await interaction.reply({content:"⏳ Gerando PIX...",ephemeral:true});

const pg = await gerarPix(produtoId,interaction.user.id);
if(!pg) return interaction.editReply("❌ Erro PIX");

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now().toString();
db.pix[pixId]=pix;

const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID
});

db.tickets[interaction.user.id]=canal.id;
salvar();

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO")
.setDescription(`Produto: ${PRODUTOS[produtoId].nome}\nValor: R$${PRODUTOS[produtoId].preco}\n\n⏳ Expira em 2 minutos`)
.setImage(qr)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pixId}`).setLabel("📋 Copiar PIX").setStyle(ButtonStyle.Primary)
);

await canal.send({content:`<@${interaction.user.id}>`,embeds:[embed],components:[row]});

interaction.editReply(`✅ Ticket: ${canal}`);

// EXPIRA 2 MIN
setTimeout(()=>{
if(db.tickets[interaction.user.id]){
delete db.tickets[interaction.user.id];
salvar();
canal.delete().catch(()=>{});
}
},120000);

}

}catch(err){console.log(err);}
});

// WEBHOOK
app.post("/webhook",(req,res)=>{
res.sendStatus(200);

setTimeout(async ()=>{
try{
const id = req.body?.data?.id;
if(!id) return;

const pg = await payment.get({id});
if(!pg || db.entregues[id]) return;
if(pg.status!=="approved") return;

const userId = pg.metadata.user_id;
const produto = PRODUTOS[pg.metadata.produto];

const user = await client.users.fetch(userId).catch(()=>null);
if(!user) return;

let entrega = produto.tipo==="auto"
? CONTAS[Math.floor(Math.random()*CONTAS.length)]
: produto.link;

// SALVAR
db.entregues[id]=true;
db.vendas[user.id]=(db.vendas[user.id]||0)+1;
db.dinheiro[user.id]=(db.dinheiro[user.id]||0)+produto.preco;
salvar();

// DAR CARGO
try{
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(user.id);
member.roles.add(CARGO_CLIENTE);
}catch{}

// DM
await user.send(`✅ Compra aprovada!\n\n${entrega}\n\nEnvie:\nnota:100\ncomentario: ótimo`).catch(()=>{});

// LOGS
client.channels.fetch(CANAL_LOGS).then(c=>c.send(`💰 <@${user.id}> comprou ${produto.nome}`));

// RECENTES
client.channels.fetch(CANAL_RECENTES).then(c=>c.send(`🛒 ${produto.nome} - R$${produto.preco} - <@${user.id}>`));

// RANK
let ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> - ${x[1]} compras`)
.join("\n");

client.channels.fetch(CANAL_RANK).then(c=>c.send(`🏆 TOP:\n${ranking}`));

}catch(e){console.log(e);}
},100);
});

// FEEDBACK
client.on("messageCreate", async msg=>{
if(msg.channel.type!==1) return;

const nota = Number(msg.content.match(/nota:\s*(\d+)/i)?.[1]);
const comentario = msg.content.match(/comentario:\s*(.+)/i)?.[1];

if(!nota||!comentario) return;

db.feedbacks.push({user:msg.author.id,nota,comentario});
salvar();

client.channels.fetch(CANAL_FEEDBACK)
.then(c=>c.send(`⭐ <@${msg.author.id}> - ${nota}\n${comentario}`));

msg.reply("✅ Avaliação enviada");
});

// SERVER
app.listen(process.env.PORT||3000,()=>console.log("🔥 Webhook ON"));

client.login(TOKEN);
