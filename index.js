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
SlashCommandBuilder,
ChannelType
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
GatewayIntentBits.DirectMessages
]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_RANK = "1490184769831698655";

const CARGO_PERMISSAO = "1466621093799268443";
const CARGO_CLIENTE = "1494143094327742594";

// BANCO
let db = { tickets:{}, pix:{}, vendas:{}, dinheiro:{}, entregues:{} };
if (fs.existsSync("dados.json")) db = JSON.parse(fs.readFileSync("dados.json"));

function salvar() {
fs.writeFileSync("dados.json", JSON.stringify(db, null, 2));
}

// MP
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// PRODUTOS
const PRODUTOS = {
opt5:{preco:5,nome:"Básica",tipo:"link",link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file"},
opt10:{preco:10,nome:"Avançada",tipo:"link",link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file"},
opt20:{preco:20,nome:"Suprema",tipo:"link",link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file"},
gta:{preco:5,nome:"GTA V",tipo:"auto"},
sensi:{preco:5,nome:"Pack",tipo:"link",link:"https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file"}
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
new SlashCommandBuilder().setName("lucromes").setDescription("Ver lucro do mês"),
new SlashCommandBuilder().setName("ranking").setDescription("Top compradores"),

new SlashCommandBuilder()
.setName("anunciar")
.setDescription("Anunciar mensagem")
.addStringOption(o=>o.setName("msg").setDescription("Mensagem").setRequired(true)),

new SlashCommandBuilder()
.setName("reenviar")
.setDescription("Reenviar produto")
.addUserOption(o=>o.setName("user").setDescription("Usuário").setRequired(true))
.addStringOption(o=>o.setName("produto").setDescription("ID produto").setRequired(true)),

new SlashCommandBuilder().setName("fechar").setDescription("Fechar ticket")
].map(c=>c.toJSON());

client.once("ready", async ()=>{
console.log("✅ BOT ONLINE");

const rest = new REST({version:"10"}).setToken(TOKEN);

await rest.put(
Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
{ body: commands }
);

console.log("✅ COMANDOS PRONTOS");
});

// GERAR PIX
async function gerarPix(produtoId,userId){
for(let i=0;i<3;i++){
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
client.on("interactionCreate", async i=>{
try{

if(i.isChatInputCommand()){

if(i.commandName!=="painel" && !i.member.roles.cache.has(CARGO_PERMISSAO))
return i.reply({content:"❌ Sem permissão",ephemeral:true});

// PAINEL
if(i.commandName==="painel"){
return i.reply({
content:"🛒 DIDDY STORE",
components:[new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("gta").setLabel("GTA").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("sensi").setLabel("Pack").setStyle(ButtonStyle.Secondary)
)]
});
}

// LUCRO
if(i.commandName==="lucromes"){
let total = Object.values(db.dinheiro).reduce((a,b)=>a+b,0);
return i.reply(`💰 R$${total}`);
}

// RANK
if(i.commandName==="ranking"){
let r = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.map((x,i)=>`TOP ${i+1}: <@${x[0]}> - ${x[1]} compras`)
.join("\n");

return i.reply(r||"Sem dados");
}

// ANUNCIAR
if(i.commandName==="anunciar"){
i.channel.send(`📢 ${i.options.getString("msg")}`);
return i.reply({content:"✅ enviado",ephemeral:true});
}

// REENVIAR
if(i.commandName==="reenviar"){
const user = i.options.getUser("user");
const produto = PRODUTOS[i.options.getString("produto")];

let entrega = produto.tipo==="auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

user.send(entrega).catch(()=>{});
return i.reply("✅ enviado");
}

// FECHAR
if(i.commandName==="fechar"){
i.channel.delete().catch(()=>{});
}

}

// BOTÕES
if(i.isButton()){

const produtoId = i.customId;
if(!PRODUTOS[produtoId]) return;

const pg = await gerarPix(produtoId,i.user.id);
if(!pg) return i.reply("❌ erro pix");

const pix = pg.point_of_interaction.transaction_data.qr_code;
const pixId = Date.now();

db.pix[pixId]=pix;
salvar();

const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

const canal = await i.guild.channels.create({
name:`ticket-${i.user.username}`,
type:ChannelType.GuildText,
parent:CATEGORIA_ID
});

db.tickets[i.user.id]=canal.id;
salvar();

const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`\`\`\`\n${pix}\n\`\`\`\n⚠️ expira em 2 minutos`)
.setImage(qr);

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`copiar_${pixId}`).setLabel("Copiar PIX").setStyle(ButtonStyle.Primary)
);

canal.send({content:`<@${i.user.id}>`,embeds:[embed],components:[row]});
i.reply({content:`✅ Ticket criado: ${canal}`,ephemeral:true});

// expira
setTimeout(()=>{
if(db.tickets[i.user.id]){
delete db.tickets[i.user.id];
salvar();
canal.delete().catch(()=>{});
}
},120000);

}

}catch(e){console.log(e)}
});

// WEBHOOK
app.post("/webhook",(req,res)=>{
res.sendStatus(200);

setTimeout(async()=>{
try{
const id=req.body?.data?.id;
if(!id) return;

const pg = await payment.get({id});
if(!pg || db.entregues[id]) return;
if(pg.status!=="approved") return;

const user = await client.users.fetch(pg.metadata.user_id);
const produto = PRODUTOS[pg.metadata.produto];

let entrega = produto.tipo==="auto"
? CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)]
: produto.link;

db.entregues[id]=true;
db.vendas[user.id]=(db.vendas[user.id]||0)+1;
db.dinheiro[user.id]=(db.dinheiro[user.id]||0)+produto.preco;
salvar();

// entrega
await user.send(`✅ Compra aprovada\n\n${entrega}`).catch(()=>{});

// cargo
const guild = client.guilds.cache.get(GUILD_ID);
const membro = await guild.members.fetch(user.id);
membro.roles.add(CARGO_CLIENTE).catch(()=>{});

// recentes
client.channels.fetch(CANAL_RECENTES)
.then(c=>c.send(`🛒 <@${user.id}> comprou ${produto.nome} - R$${produto.preco}`));

// rank atualizado
const rank = Object.entries(db.vendas)
.sort((a,b)=>b[1]-a[1])
.map((x,i)=>`TOP ${i+1}: <@${x[0]}> - ${x[1]}`)
.join("\n");

client.channels.fetch(CANAL_RANK).then(c=>c.send(rank));

}catch(e){console.log(e)}
},100);
});

app.listen(process.env.PORT||3000,()=>console.log("🔥 WEBHOOK ON"));
client.login(TOKEN);
