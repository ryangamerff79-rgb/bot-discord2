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

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_RANK = "1490184769831698655";
const CANAL_LOGS = "1488589113954271282";
const CARGO_CLIENTE = "1494143094327742594";

const IMG = "https://cdn.discordapp.com/attachments/1373392385014370334/1497072312413851790/1294723.webp";

// ================= DB =================
let db = {
tickets:{},
pix:{},
entregues:{},
vendas:{},
rankMsg:null,
cooldown:{}
};

if (fs.existsSync("dados.json")) {
db = JSON.parse(fs.readFileSync("dados.json"));
}

const salvar = () => {
fs.writeFileSync("dados.json", JSON.stringify(db,null,2));
};

// ================= MP =================
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// ================= PRODUTOS =================
const PRODUTOS = {
opt5:{ nome:"Otimização Básica", preco:5, link:"https://www.mediafire.com/file/vb4klwyfxmxt5sa/OTIMIZA%25C3%2587%25C3%2583O_BASICA.rar/file" },
opt10:{ nome:"Otimização Avançada", preco:10, link:"https://www.mediafire.com/file/iidtoou88ozkwll/OTIMIZA%25C3%2587%25C3%2583O_AVAN%25C3%2587ADA.rar/file" },
opt20:{ nome:"Otimização Suprema", preco:20, link:"https://www.mediafire.com/file/61ivdjr64yb9o6t/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file" }
};

// ================= COMANDOS =================
const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Abrir loja"),
new SlashCommandBuilder().setName("rank").setDescription("Ver ranking")
].map(c=>c.toJSON());

client.once("ready", async ()=>{
console.log("✅ V13 ONLINE");

const rest = new REST({version:"10"}).setToken(TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body:commands });

});

// ================= FUNÇÕES =================
async function gerarPix(produtoId, userId){
try{
return await payment.create({
body:{
transaction_amount: Number(PRODUTOS[produtoId].preco),
description: PRODUTOS[produtoId].nome,
payment_method_id:"pix",
payer:{ email:`user${userId}@gmail.com` },
metadata:{ user_id:userId, produto:produtoId }
}
});
}catch{
return null;
}
}

async function atualizarRank(){
const canal = await client.channels.fetch(CANAL_RANK);

const ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.map((x,i)=>`${i+1}. <@${x[0]}> - ${x[1]}`)
.join("\n") || "Sem compras";

if(!db.rankMsg){
const m = await canal.send("Carregando...");
db.rankMsg = m.id;
}

const msg = await canal.messages.fetch(db.rankMsg);
msg.edit(`🏆 **TOP COMPRADORES**\n\n${ranking}`);

salvar();
}

// ================= INTERAÇÕES =================
client.on("interactionCreate", async i=>{

// comandos
if(i.isChatInputCommand()){

if(i.commandName==="painel"){
return i.reply({
content:"🛒 Loja",
components:[
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(1),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(3),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(4)
)
]
});
}

if(i.commandName==="rank"){
const ranking = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.map((x,i)=>`${i+1}. <@${x[0]}> - ${x[1]}`)
.join("\n") || "Sem compras";

return i.reply({ content:`🏆 Rank:\n\n${ranking}` });
}
}

// botões
if(i.isButton()){

// anti spam
const now = Date.now();
if(db.cooldown[i.user.id] && now - db.cooldown[i.user.id] < 3000){
return i.reply({ content:"⏳ Aguarde...", ephemeral:true });
}
db.cooldown[i.user.id] = now;

// copiar pix
if(i.customId.startsWith("copiar_")){
const id = i.customId.split("_")[1];
return i.reply({ content: db.pix[id], ephemeral:true });
}

// ticket existente
if(db.tickets[i.user.id]){
return i.reply({ content:"❌ Já tem pagamento aberto", ephemeral:true });
}

const produtoId = i.customId;
const produto = PRODUTOS[produtoId];

await i.deferReply({ ephemeral:true });

const pg = await gerarPix(produtoId, i.user.id);
if(!pg) return i.editReply("Erro PIX");

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now().toString();

db.pix[pixId] = pix;
salvar();

// criar ticket privado
const canal = await i.guild.channels.create({
name:`ticket-${i.user.username}`,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:i.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:i.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

db.tickets[i.user.id] = canal.id;
salvar();

const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

await canal.send({
content:`<@${i.user.id}> ⏰ Expira em 12 minutos`,
embeds:[
new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`📦 ${produto.nome}\n💰 R$${produto.preco}`)
.setImage(qr)
.addFields({ name:"PIX copia e cola", value:`\`\`\`${pix.substring(0,1000)}\`\`\`` })
],
components:[
new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pixId}`).setLabel("📋 Copiar PIX").setStyle(1)
)
]
});

i.editReply(`✅ Ticket criado: ${canal}`);

// aviso
setTimeout(()=> canal.send("⚠️ Vai expirar em 2 minutos"), 600000);

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

// ================= WEBHOOK =================
app.post("/webhook",(req,res)=>{
res.sendStatus(200);

setTimeout(async ()=>{
try{

const id = req.body?.data?.id;
if(!id || db.entregues[id]) return;

const pg = await payment.get({ id });
if(pg.status !== "approved") return;

const userId = pg.metadata.user_id;
const produtoId = pg.metadata.produto;
const produto = PRODUTOS[produtoId];

// entrega
const entrega = produto.link;

const user = await client.users.fetch(userId);

// DM
await user.send({
content:`🎉 **Compra confirmada!**

📦 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔗 Download:
${entrega}`
}).catch(()=>{});

// cargo
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(userId);
member.roles.add(CARGO_CLIENTE).catch(()=>{});

// salvar
db.entregues[id]=true;
db.vendas[userId]=(db.vendas[userId]||0)+1;
salvar();

// fechar ticket
const canalId = db.tickets[userId];
if(canalId){
const canal = await client.channels.fetch(canalId);
canal.delete().catch(()=>{});
delete db.tickets[userId];
}

// embed bonito (igual sua imagem)
const recentes = await client.channels.fetch(CANAL_RECENTES);

const embed = new EmbedBuilder()
.setAuthor({ name:"🏆 Compra aprovada com sucesso!" })
.setDescription(`📦 **Produtos adquiridos**
1x - ${produto.nome}

💰 **Valor pago**
R$ ${produto.preco},00

✨ **Avaliação**
⭐⭐⭐⭐⭐ 5 estrelas!`)
.setImage(IMG)
.setColor("Green");

recentes.send({ embeds:[embed] });

// logs
const logs = await client.channels.fetch(CANAL_LOGS);
logs.send(`✅ Compra: ${userId} | ${produto.nome}`);

// rank
atualizarRank();

}catch(e){
console.log("ERRO:", e);
}
},200);
});

app.listen(process.env.PORT || 3000);
client.login(TOKEN);
