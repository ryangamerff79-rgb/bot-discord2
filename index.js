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
const CANAL_RECENTES = "1494137996612472943";
const CANAL_RANK = "1490184769831698655";
const CARGO_CLIENTE = "1494143094327742594";
const CARGO_ADMIN = "1466621093799268443";

// DB
let db = {
tickets:{},
pix:{},
entregues:{},
vendas:{},
logs:[],
rankMsg:null,
bloqueados:{},
tentativas:{}
};

if (fs.existsSync("dados.json")) db = JSON.parse(fs.readFileSync("dados.json"));
const salvar = ()=> fs.writeFileSync("dados.json", JSON.stringify(db,null,2));

// MP
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5: { nome:"Otimização Básica", preco:5, link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file" },
opt10: { nome:"Otimização Avançada", preco:10, link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file" },
opt20: { nome:"Otimização Suprema", preco:20, link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" },
sensi: { nome:"Pack Sensi", preco:5, link:"https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file" }
};

const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// COMANDOS
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
new SlashCommandBuilder().setName("anunciar")
.setDescription("Enviar anuncio")
.addStringOption(o=>o.setName("msg").setDescription("Mensagem").setRequired(true)),
new SlashCommandBuilder().setName("lucrohoje").setDescription("Lucro de hoje"),
new SlashCommandBuilder().setName("lucromes").setDescription("Lucro do mês"),
new SlashCommandBuilder().setName("rank").setDescription("Ver rank"),
new SlashCommandBuilder().setName("fecharticket").setDescription("Fechar ticket"),
new SlashCommandBuilder().setName("reenviar")
.setDescription("Reenviar produto")
.addUserOption(o=>o.setName("user").setDescription("Usuário").setRequired(true))
.addStringOption(o=>o.setName("produto").setDescription("Produto").setRequired(true))
].map(c=>c.toJSON());

client.once("ready", async ()=>{
console.log("✅ ONLINE");

const rest = new REST({version:"10"}).setToken(TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body:commands });
});

// FUNÇÕES
function isAdmin(member){
return member.roles.cache.has(CARGO_ADMIN);
}

// RANK
async function atualizarRank(){
const canal = await client.channels.fetch(CANAL_RANK);

const ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.map((x,i)=>`${i+1}. <@${x[0]}> - ${x[1]} compras`)
.join("\n") || "Sem compras";

if(!db.rankMsg){
const m = await canal.send("Carregando...");
db.rankMsg = m.id;
}

const msg = await canal.messages.fetch(db.rankMsg);
msg.edit(`🏆 **TOP COMPRADORES**\n\n${ranking}`);
salvar();
}

// PIX
async function gerarPix(produtoId, userId){
try{
return await payment.create({
body:{
transaction_amount:Number(PRODUTOS[produtoId]?.preco || 5),
description:PRODUTOS[produtoId]?.nome || "Produto",
payment_method_id:"pix",
payer:{ email:`user${userId}@gmail.com` },
metadata:{ user_id:userId, produto:produtoId }
}
});
}catch{return null;}
}

// INTERAÇÕES
client.on("interactionCreate", async i=>{

// COMANDOS
if(i.isChatInputCommand()){

// painel
if(i.commandName==="painel"){
return i.reply({
content:"🛒 Loja",
components:[
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(1),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(3),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(4),
new ButtonBuilder().setCustomId("gta").setLabel("GTA").setStyle(2),
new ButtonBuilder().setCustomId("sensi").setLabel("Sensi").setStyle(2)
)
]
});
}

// ADMIN CHECK
if(!isAdmin(i.member)){
return i.reply({content:"❌ Sem permissão",ephemeral:true});
}

// anunciar
if(i.commandName==="anunciar"){
const msg = i.options.getString("msg");
i.channel.send(`📢 ${msg}`);
return i.reply({content:"✅ Enviado",ephemeral:true});
}

// lucro hoje
if(i.commandName==="lucrohoje"){
const total = db.logs
.filter(x=> new Date(x.data).toDateString()===new Date().toDateString())
.reduce((a,b)=>a+b.valor,0);
return i.reply(`💰 Hoje: R$${total}`);
}

// lucro mês
if(i.commandName==="lucromes"){
const total = db.logs
.filter(x=> new Date(x.data).getMonth()===new Date().getMonth())
.reduce((a,b)=>a+b.valor,0);
return i.reply(`💰 Mês: R$${total}`);
}

// rank
if(i.commandName==="rank"){
atualizarRank();
return i.reply({content:"✅ Atualizado",ephemeral:true});
}

// fechar ticket
if(i.commandName==="fecharticket"){
if(i.channel.name.includes("ticket")){
i.channel.delete().catch(()=>{});
}
}

// reenviar
if(i.commandName==="reenviar"){
const user = i.options.getUser("user");
const produto = i.options.getString("produto");

let entrega =
produto==="gta"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: PRODUTOS[produto]?.link;

user.send(`📦 Reenvio:\n${entrega}`).catch(()=>{});
return i.reply({content:"✅ Enviado",ephemeral:true});
}
}

// BOTÕES
if(i.isButton()){

// anti spam
const now = Date.now();
if(db.tentativas[i.user.id] && now - db.tentativas[i.user.id] < 4000){
return i.reply({content:"⏳ Aguarde...",ephemeral:true});
}
db.tentativas[i.user.id]=now;

// copiar
if(i.customId.startsWith("copiar_")){
const id = i.customId.split("_")[1];
return i.reply({content:db.pix[id],ephemeral:true});
}

// ticket aberto
if(db.tickets[i.user.id]){
return i.reply({content:"❌ Já tem pagamento aberto",ephemeral:true});
}

const produtoId = i.customId;
const produto = PRODUTOS[produtoId] || { nome:"Conta GTA", preco:5 };

await i.deferReply({ephemeral:true});

const pg = await gerarPix(produtoId,i.user.id);
if(!pg) return i.editReply("Erro PIX");

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now().toString();

db.pix[pixId]=pix;
salvar();

const canal = await i.guild.channels.create({
name:`ticket-${i.user.username}`,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:i.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:i.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

db.tickets[i.user.id]=canal.id;
salvar();

const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

await canal.send({
content:`<@${i.user.id}> ⏰ Expira em 12 minutos`,
embeds:[
new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`📦 ${produto.nome}\n💰 R$${produto.preco}`)
.setImage(qr)
.addFields({name:"PIX copia e cola",value:`\`\`\`${pix.substring(0,1000)}\`\`\``})
],
components:[
new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`copiar_${pixId}`)
.setLabel("📋 Copiar PIX")
.setStyle(1)
)
]
});

i.editReply(`✅ ${canal}`);

// aviso
setTimeout(()=> canal.send("⚠️ Vai expirar em 2 minutos"),600000);

// expira
setTimeout(()=>{
if(db.tickets[i.user.id]){
delete db.tickets[i.user.id];
salvar();
canal.delete().catch(()=>{});
}
},720000);
}
});

// WEBHOOK
app.post("/webhook",(req,res)=>{
res.sendStatus(200);

setTimeout(async ()=>{
try{
const id = req.body?.data?.id;
if(!id || db.entregues[id]) return;

const pg = await payment.get({ id });
if(!pg || pg.status!=="approved") return;

const userId = pg.metadata?.user_id;
const produtoId = pg.metadata?.produto;
const valor = Number(pg.transaction_amount);

// validação
const precoReal = produtoId==="gta" ? 5 : PRODUTOS[produtoId]?.preco;
if(valor !== precoReal){
db.bloqueados[userId]=true;
salvar();
return;
}

// entrega
let entrega =
produtoId==="gta"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: PRODUTOS[produtoId].link;

const user = await client.users.fetch(userId);

await user.send(`🎉 Compra confirmada!\n\n📦 ${entrega}`).catch(()=>{});

// cargo
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(userId);
member.roles.add(CARGO_CLIENTE).catch(()=>{});

// salvar
db.entregues[id]=true;
db.vendas[userId]=(db.vendas[userId]||0)+1;
db.logs.push({user:userId,valor:valor,data:new Date()});
salvar();

// fechar ticket
const canalId = db.tickets[userId];
if(canalId){
const canal = await client.channels.fetch(canalId);
canal.delete().catch(()=>{});
delete db.tickets[userId];
}

// recentes
const recentes = await client.channels.fetch(CANAL_RECENTES);
recentes.send(`🛒 <@${userId}> comprou ${produtoId} por R$${valor}`);

// rank
atualizarRank();

}catch(e){
console.log(e);
}
},200);
});

app.listen(process.env.PORT||3000);
client.login(TOKEN);
