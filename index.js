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
GatewayIntentBits.MessageContent,
GatewayIntentBits.DirectMessages
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

const CARGO_PERMITIDO = "1466621093799268443";
const CARGO_CLIENTE = "1494143094327742594";

// BANCO
let db = { entregues:{}, tickets:{}, vendas:{}, dinheiro:{}, feedbacks:[] };

if (fs.existsSync("dados.json")) {
db = JSON.parse(fs.readFileSync("dados.json"));
}
function salvar(){ fs.writeFileSync("dados.json", JSON.stringify(db,null,2)); }

// MP
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5: { preco: 5, nome: "Otimização Básica", tipo: "link", link: "https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10: { preco: 10, nome: "Otimização Avançada", tipo: "link", link: "https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25A7%25C3%25B5es_diddy.rar/file" },
opt20: { preco: 20, nome: "Otimização Suprema", tipo: "link", link: "https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" },
gta: { preco: 5, nome: "Conta GTA V", tipo: "auto" },
sensi: { preco: 5, nome: "Pack Sensi", tipo: "link", link: "https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file" }
};

const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// COMANDOS (TODOS COM DESCRIPTION = SEM ERRO)
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
new SlashCommandBuilder().setName("lucrohoje").setDescription("Ver lucro de hoje"),
new SlashCommandBuilder().setName("lucromes").setDescription("Ver lucro do mês"),
new SlashCommandBuilder().setName("vendasmensal").setDescription("Ver vendas do mês"),
new SlashCommandBuilder().setName("rank").setDescription("Ver ranking"),
new SlashCommandBuilder()
.setName("anunciar")
.setDescription("Enviar anuncio")
.addStringOption(o=>o.setName("msg").setDescription("mensagem").setRequired(true)),

new SlashCommandBuilder()
.setName("reenviar")
.setDescription("Reenviar produto")
.addStringOption(o=>o.setName("id").setDescription("id user").setRequired(true))
.addStringOption(o=>o.setName("produto").setDescription("produto").setRequired(true)),

new SlashCommandBuilder().setName("fecharticket").setDescription("Fechar ticket")
].map(c=>c.toJSON());

// READY
client.once("ready", async () => {
console.log("✅ BOT ONLINE");

const rest = new REST({ version: "10" }).setToken(TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

console.log("✅ Slash registrados");
});

// PERMISSÃO
function temPermissao(member){
return member.roles.cache.has(CARGO_PERMITIDO);
}

// PIX
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
}catch{}
}
return null;
}

// INTERAÇÃO
client.on("interactionCreate", async interaction=>{
try{

// COMANDOS
if(interaction.isChatInputCommand()){

if(interaction.commandName==="painel"){
let total = Object.values(db.vendas).reduce((a,b)=>a+b,0);

return interaction.reply({
content:`🚀 DIDDY STORE\n💰 ${total} vendas`,
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(1),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(3),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(4),
new ButtonBuilder().setCustomId("gta").setLabel("GTA").setStyle(2),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(2)
)]
});
}

// PROTEGIDOS
if(["anunciar","reenviar","fecharticket"].includes(interaction.commandName)){
if(!temPermissao(interaction.member)) return interaction.reply({content:"❌ Sem permissão",ephemeral:true});
}

if(interaction.commandName==="anunciar"){
let msg = interaction.options.getString("msg");
interaction.channel.send(msg);
return interaction.reply({content:"✅ Enviado",ephemeral:true});
}

if(interaction.commandName==="fecharticket"){
interaction.channel.delete().catch(()=>{});
return;
}

if(interaction.commandName==="reenviar"){
let user = await client.users.fetch(interaction.options.getString("id"));
let produto = PRODUTOS[interaction.options.getString("produto")];

let entrega = produto.tipo==="auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

user.send(`📦 Reenvio:\n${entrega}`);
return interaction.reply("✅ Reenviado");
}

if(interaction.commandName==="rank"){
let ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> - ${x[1]} compras`)
.join("\n");

return interaction.reply(`🏆 RANKING\n${ranking||"Sem dados"}`);
}
}

// BOTÕES
if(interaction.isButton()){

if(db.tickets[interaction.user.id]) return interaction.reply({content:"❌ Já tem ticket",ephemeral:true});

const produtoId = interaction.customId;
if(!PRODUTOS[produtoId]) return;

await interaction.reply({content:"⏳ Gerando PIX...",ephemeral:true});

const pg = await gerarPix(produtoId,interaction.user.id);
if(!pg) return interaction.editReply("❌ Erro PIX");

const pix = pg.point_of_interaction.transaction_data.qr_code;
const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id: interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel]},
{ id: interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

db.tickets[interaction.user.id]=canal.id;
salvar();

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO")
.setDescription(`Produto: ${PRODUTOS[produtoId].nome}\nValor: R$${PRODUTOS[produtoId].preco}\n\n⏳ Expira em 2 minutos`)
.setImage(qr)
.setColor("Green");

await canal.send({content:`<@${interaction.user.id}>`,embeds:[embed]});
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

setTimeout(async()=>{
try{
const id = req.body?.data?.id;
if(!id) return;

const pg = await payment.get({id});
if(!pg || db.entregues[id]) return;
if(pg.status!=="approved") return;

const userId = pg.metadata.user_id;
const produto = PRODUTOS[pg.metadata.produto];

const user = await client.users.fetch(userId);

let entrega = produto.tipo==="auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

// SALVAR
db.entregues[id]=true;
db.vendas[userId]=(db.vendas[userId]||0)+1;
db.dinheiro[userId]=(db.dinheiro[userId]||0)+produto.preco;
delete db.tickets[userId];
salvar();

// CARGO
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(userId).catch(()=>null);
if(member) member.roles.add(CARGO_CLIENTE).catch(()=>{});

// DM
await user.send(`✅ Compra confirmada\n\n📦 ${entrega}\n\n⭐ Envie:\nnota: 10\ncomentario: texto`).catch(()=>{});

// LOGS
client.channels.fetch(CANAL_LOGS).then(c=>c.send(`💰 <@${userId}> comprou ${produto.nome}`));
client.channels.fetch(CANAL_RECENTES).then(c=>c.send(`🛒 <@${userId}> comprou ${produto.nome} - R$${produto.preco}`));

// RANK AUTO
let ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)
.map((x,i)=>`#${i+1} <@${x[0]}> - ${x[1]}`)
.join("\n");

client.channels.fetch(CANAL_RANK).then(c=>c.send(`🏆 RANK ATUALIZADO\n${ranking}`));

}catch(e){console.log(e);}
},100);
});

// FEEDBACK
client.on("messageCreate", async msg=>{
if(msg.channel.type!==1) return;

let nota = msg.content.match(/nota:\s*(\d+)/i)?.[1];
let comentario = msg.content.match(/comentario:\s*(.+)/i)?.[1];

if(!nota||!comentario) return;

db.feedbacks.push({user:msg.author.id,nota,comentario});
salvar();

client.channels.fetch(CANAL_FEEDBACK)
.then(c=>c.send(`⭐ <@${msg.author.id}>\nNota: ${nota}\n${comentario}`));

msg.reply("✅ Avaliação enviada");
});

// SERVER
app.listen(process.env.PORT||3000,()=>console.log("🔥 Webhook rodando"));
client.login(TOKEN);
