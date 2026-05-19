import { useState, useEffect, useCallback, useRef } from "react";

// ── CONFIG ────────────────────────────────────────────────────
// Get your FREE key at https://www.football-data.org/client/register
// Free tier: 10 req/min, covers World Cup (competition code: WC)
const FOOTBALL_DATA_API_KEY = "YOUR_API_KEY_HERE";

// ── ADSENSE CONFIG ────────────────────────────────────────────
// Replace with your real AdSense publisher ID and slot IDs
// Get them from https://adsense.google.com after approval
const ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";
const AD_SLOTS = {
  banner:  "1111111111", // horizontal banner — below nav
  feed:    "2222222222", // in-feed — between content cards
  sidebar: "3333333333", // after team submission
};
const WC_COMPETITION_ID = 2000; // FIFA World Cup on football-data.org
const USE_LIVE_SCORES = FOOTBALL_DATA_API_KEY !== "YOUR_API_KEY_HERE";
const POLL_INTERVAL_MS = 60000; // 60s — respects free tier rate limit

const TEAM_BUDGET = 100;
const MAX_TEAMS = 5;
const TEAM_NAMES = ["Team A","Team B","Team C","Team D","Team E"];
const FORMATION = {GK:1,DEF:4,MID:3,FWD:3};
const POS_ORDER = ["GK","DEF","MID","FWD"];
const POS_COLORS = {GK:"#e67e22",DEF:"#2980b9",MID:"#27ae60",FWD:"#e74c3c"};
const MEDALS = ["🥇","🥈","🥉"];

const YOUR_STELLAR_ADDRESS = "GBWCXMK5IEFH6HVBCTVLXA75JVFQW4PFS7ILED54SAUOKYRYLGCP2TIL";

const USDT_TO_FFC = [
  {minUsdt:2,maxUsdt:4.99,label:"Starter",emoji:"💰",noAds:false,adPerk:"50% fewer ads",adPerkShort:"50% less ads",adColor:"#f59e0b"},
  {minUsdt:5,maxUsdt:9.99,label:"Pro",emoji:"💎",noAds:true,adPerk:"100% Ad-Free",adPerkShort:"No ads",adColor:"#10b981"},
  {minUsdt:10,maxUsdt:19.99,label:"Elite",emoji:"🚀",noAds:true,adPerk:"100% Ad-Free",adPerkShort:"No ads",adColor:"#10b981"},
  {minUsdt:20,maxUsdt:99999,label:"Legend",emoji:"👑",noAds:true,adPerk:"100% Ad-Free",adPerkShort:"No ads",adColor:"#10b981"},
];
function ffcForUsdt(u){if(u<2)return null;const t=USDT_TO_FFC.find(x=>u>=x.minUsdt&&u<=x.maxUsdt)||USDT_TO_FFC[USDT_TO_FFC.length-1];return{...t,coins:Math.floor(u*100)};}
const AD_PERK_MS=5*24*60*60*1000;
function adPerkValid(p){return p&&Date.now()<p.ts+AD_PERK_MS;}
function adPerkLabel(p){if(!adPerkValid(p))return null;const d=Math.ceil((p.ts+AD_PERK_MS-Date.now())/(864e5));return`${p.adPerkShort} · ${d}d left`;}

const FLAGS={
  "Mexico":"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷","Czechia":"🇨🇿",
  "Canada":"🇨🇦","Bosnia & Herz.":"🇧🇦","Qatar":"🇶🇦","Switzerland":"🇨🇭",
  "Brazil":"🇧🇷","Morocco":"🇲🇦","Haiti":"🇭🇹","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "USA":"🇺🇸","Paraguay":"🇵🇾","Australia":"🇦🇺","Türkiye":"🇹🇷",
  "Germany":"🇩🇪","Curaçao":"🇨🇼","Ivory Coast":"🇨🇮","Ecuador":"🇪🇨",
  "Netherlands":"🇳🇱","Japan":"🇯🇵","Sweden":"🇸🇪","Tunisia":"🇹🇳",
  "Spain":"🇪🇸","Cape Verde":"🇨🇻","Saudi Arabia":"🇸🇦","Uruguay":"🇺🇾",
  "Belgium":"🇧🇪","Egypt":"🇪🇬","Iran":"🇮🇷","New Zealand":"🇳🇿",
  "France":"🇫🇷","Senegal":"🇸🇳","Iraq":"🇮🇶","Norway":"🇳🇴",
  "Argentina":"🇦🇷","Algeria":"🇩🇿","Austria":"🇦🇹","Jordan":"🇯🇴",
  "Portugal":"🇵🇹","DR Congo":"🇨🇩","Uzbekistan":"🇺🇿","Colombia":"🇨🇴",
  "England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croatia":"🇭🇷","Ghana":"🇬🇭","Panama":"🇵🇦",
};

// ── NAME MAP: football-data.org team names → our names ────────
const FD_NAME_MAP = {
  "Mexico":"Mexico","South Africa":"South Africa","Korea Republic":"South Korea",
  "Czech Republic":"Czechia","Czechia":"Czechia","Canada":"Canada",
  "Bosnia and Herzegovina":"Bosnia & Herz.","Qatar":"Qatar","Switzerland":"Switzerland",
  "Brazil":"Brazil","Morocco":"Morocco","Haiti":"Haiti","Scotland":"Scotland",
  "United States":"USA","USA":"USA","Paraguay":"Paraguay","Australia":"Australia",
  "Turkey":"Türkiye","Türkiye":"Türkiye","Germany":"Germany","Curaçao":"Curaçao",
  "Ivory Coast":"Ivory Coast","Côte d'Ivoire":"Ivory Coast","Ecuador":"Ecuador",
  "Netherlands":"Netherlands","Japan":"Japan","Sweden":"Sweden","Tunisia":"Tunisia",
  "Spain":"Spain","Cape Verde":"Cape Verde","Saudi Arabia":"Saudi Arabia","Uruguay":"Uruguay",
  "Belgium":"Belgium","Egypt":"Egypt","Iran":"Iran","New Zealand":"New Zealand",
  "France":"France","Senegal":"Senegal","Iraq":"Iraq","Norway":"Norway",
  "Argentina":"Argentina","Algeria":"Algeria","Austria":"Austria","Jordan":"Jordan",
  "Portugal":"Portugal","DR Congo":"DR Congo","Democratic Republic of Congo":"DR Congo",
  "Uzbekistan":"Uzbekistan","Colombia":"Colombia","England":"England","Croatia":"Croatia",
  "Ghana":"Ghana","Panama":"Panama",
};
function normalizeName(n){ return FD_NAME_MAP[n] || n; }

// ── STATUS MAP ────────────────────────────────────────────────
// football-data.org statuses: SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, SUSPENDED, CANCELLED
function mapStatus(s){
  if(s==="FINISHED") return "FT";
  if(s==="IN_PLAY"||s==="PAUSED") return "LIVE";
  return "NS";
}

const KITS={
  "Argentina":{p:"#74ACDF",s:"#FFFFFF",a:"#74ACDF",pattern:"stripes_v",pText:"#003082"},
  "Brazil":{p:"#009C3B",s:"#FFDF00",a:"#002776",pattern:"solid",pText:"#002776"},
  "France":{p:"#002395",s:"#FFFFFF",a:"#EF1729",pattern:"solid",pText:"#FFFFFF"},
  "England":{p:"#FFFFFF",s:"#003B72",a:"#CF081F",pattern:"solid",pText:"#003B72"},
  "Spain":{p:"#AA151B",s:"#F1BF00",a:"#AA151B",pattern:"solid",pText:"#F1BF00"},
  "Portugal":{p:"#006600",s:"#FF0000",a:"#006600",pattern:"solid",pText:"#FFFFFF"},
  "Germany":{p:"#FFFFFF",s:"#000000",a:"#FF0000",pattern:"solid",pText:"#000000"},
  "Netherlands":{p:"#FF6600",s:"#FFFFFF",a:"#003082",pattern:"solid",pText:"#FFFFFF"},
  "Belgium":{p:"#000000",s:"#FF0000",a:"#FFCB00",pattern:"solid",pText:"#FF0000"},
  "Croatia":{p:"#FF2020",s:"#FFFFFF",a:"#003DA5",pattern:"check",pText:"#FFFFFF"},
  "Switzerland":{p:"#CF081F",s:"#FFFFFF",a:"#CF081F",pattern:"solid",pText:"#FFFFFF"},
  "Scotland":{p:"#003F87",s:"#FFFFFF",a:"#006EC7",pattern:"solid",pText:"#FFFFFF"},
  "Austria":{p:"#ED2939",s:"#FFFFFF",a:"#ED2939",pattern:"solid",pText:"#FFFFFF"},
  "Norway":{p:"#EF2B2D",s:"#FFFFFF",a:"#002868",pattern:"solid",pText:"#FFFFFF"},
  "Türkiye":{p:"#E30A17",s:"#FFFFFF",a:"#E30A17",pattern:"solid",pText:"#FFFFFF"},
  "Czechia":{p:"#CF081F",s:"#003399",a:"#FFFFFF",pattern:"solid",pText:"#FFFFFF"},
  "Sweden":{p:"#006AA7",s:"#FECC02",a:"#006AA7",pattern:"solid",pText:"#FECC02"},
  "Bosnia & Herz.":{p:"#002F87",s:"#FFCB00",a:"#002F87",pattern:"solid",pText:"#FFCB00"},
  "USA":{p:"#002868",s:"#FFFFFF",a:"#BF0A30",pattern:"solid",pText:"#FFFFFF"},
  "Mexico":{p:"#006847",s:"#FFFFFF",a:"#CE1126",pattern:"solid",pText:"#FFFFFF"},
  "Canada":{p:"#D80621",s:"#FFFFFF",a:"#D80621",pattern:"solid",pText:"#FFFFFF"},
  "Colombia":{p:"#FDD116",s:"#003087",a:"#CE1126",pattern:"solid",pText:"#003087"},
  "Uruguay":{p:"#5EB6E4",s:"#FFFFFF",a:"#001489",pattern:"solid",pText:"#FFFFFF"},
  "Ecuador":{p:"#FFDA00",s:"#1F4A9B",a:"#CE1126",pattern:"solid",pText:"#1F4A9B"},
  "Paraguay":{p:"#D52B1E",s:"#FFFFFF",a:"#0032A0",pattern:"stripes_h",pText:"#FFFFFF"},
  "Morocco":{p:"#C1272D",s:"#006233",a:"#C1272D",pattern:"solid",pText:"#FFFFFF"},
  "Senegal":{p:"#00853F",s:"#FFFFFF",a:"#FDEF42",pattern:"solid",pText:"#FFFFFF"},
  "Egypt":{p:"#CE1126",s:"#FFFFFF",a:"#000000",pattern:"solid",pText:"#FFFFFF"},
  "Algeria":{p:"#FFFFFF",s:"#006233",a:"#D21034",pattern:"solid",pText:"#006233"},
  "Tunisia":{p:"#E70013",s:"#FFFFFF",a:"#E70013",pattern:"solid",pText:"#FFFFFF"},
  "Ghana":{p:"#000000",s:"#FFFFFF",a:"#FCD116",pattern:"solid",pText:"#FFFFFF"},
  "Ivory Coast":{p:"#F77F00",s:"#009A44",a:"#FFFFFF",pattern:"stripes_v",pText:"#FFFFFF"},
  "South Africa":{p:"#007A4D",s:"#FFB81C",a:"#002395",pattern:"solid",pText:"#FFFFFF"},
  "Cape Verde":{p:"#003893",s:"#FFFFFF",a:"#CF2027",pattern:"solid",pText:"#FFFFFF"},
  "DR Congo":{p:"#007FFF",s:"#F7D618",a:"#CE1126",pattern:"solid",pText:"#FFFFFF"},
  "Iran":{p:"#239F40",s:"#FFFFFF",a:"#DA0000",pattern:"solid",pText:"#FFFFFF"},
  "Saudi Arabia":{p:"#006C35",s:"#FFFFFF",a:"#006C35",pattern:"solid",pText:"#FFFFFF"},
  "Qatar":{p:"#8D1B3D",s:"#FFFFFF",a:"#8D1B3D",pattern:"solid",pText:"#FFFFFF"},
  "Australia":{p:"#FFE500",s:"#00843D",a:"#FFE500",pattern:"solid",pText:"#003087"},
  "Japan":{p:"#000080",s:"#FFFFFF",a:"#BC002D",pattern:"solid",pText:"#FFFFFF"},
  "South Korea":{p:"#CE1126",s:"#003478",a:"#FFFFFF",pattern:"solid",pText:"#FFFFFF"},
  "New Zealand":{p:"#000000",s:"#FFFFFF",a:"#CE1126",pattern:"solid",pText:"#FFFFFF"},
  "Curaçao":{p:"#002B7F",s:"#F9E814",a:"#CE1126",pattern:"solid",pText:"#FFFFFF"},
  "Haiti":{p:"#00209F",s:"#D21034",a:"#FFFFFF",pattern:"stripes_h",pText:"#FFFFFF"},
  "Panama":{p:"#FFFFFF",s:"#D21034",a:"#002B7F",pattern:"solid",pText:"#D21034"},
  "Uzbekistan":{p:"#1EB53A",s:"#FFFFFF",a:"#0099B5",pattern:"solid",pText:"#FFFFFF"},
  "Jordan":{p:"#007A3D",s:"#FFFFFF",a:"#CE1126",pattern:"solid",pText:"#FFFFFF"},
  "Iraq":{p:"#CF2027",s:"#FFFFFF",a:"#000000",pattern:"solid",pText:"#FFFFFF"},
  "default":{p:"#555555",s:"#AAAAAA",a:"#333333",pattern:"solid",pText:"#FFFFFF"},
};

const SHIRT_NUMBERS={
  "L. Messi":10,"L. Martínez":9,"R. De Paul":7,"M. Acuña":8,"E. Martínez":1,
  "Vinicius Jr.":7,"Rodrygo":11,"Marquinhos":4,"Alisson":1,"G. Jesus":9,
  "K. Mbappé":10,"A. Griezmann":7,"M. Maignan":16,"L. Hernandez":21,"C. Nkunku":17,
  "J. Bellingham":5,"H. Kane":9,"B. Saka":17,"T. Alexander-Arnold":66,"J. Pickford":1,
  "Pedri":26,"Yamal":19,"A. Morata":9,"D. Carvajal":2,"U. Simon":1,
  "C. Ronaldo":7,"B. Fernandes":8,"R. Leão":17,"R. Dias":6,"D. Costa":99,
  "J. Musiala":10,"F. Wirtz":10,"K. Havertz":7,"A. Rüdiger":2,"M. Neuer":1,
  "V. van Dijk":4,"M. Depay":9,"X. Simons":6,"C. Gakpo":11,"B. Flekken":1,
  "K. De Bruyne":7,"R. Lukaku":9,"T. Courtois":1,"T. Hazard":10,"W. Faes":5,
  "L. Modrić":10,"A. Kramarić":9,"D. Livakovic":23,"J. Gvardiol":3,
  "G. Xhaka":10,"B. Embolo":7,"Y. Sommer":1,"M. Akanji":5,
  "A. Robertson":3,"S. McTominay":6,"L. Ferguson":9,"A. Gunn":1,
  "D. Alaba":8,"M. Sabitzer":7,"C. Gregoritsch":9,"P. Pentz":1,
  "E. Haaland":9,"M. Ødegaard":8,"A. Sørloth":11,"R. Nyland":1,
  "H. Çalhanoğlu":4,"A. Güler":10,"B. Yılmaz":9,"A. Bayındır":23,
  "T. Souček":8,"P. Schick":13,"V. Coufal":2,"J. Staněk":1,
  "A. Isak":14,"D. Kulusevski":10,"V. Lindelöf":2,"R. Olsen":1,
  "E. Džeko":10,"M. Pjanić":8,"S. Kolašinac":5,"I. Šehić":1,
  "C. Pulisic":10,"T. Adams":4,"M. Turner":1,"S. Dest":2,
  "H. Lozano":22,"E. Álvarez":18,"G. Ochoa":13,"C. Salcedo":3,
  "A. Davies":3,"J. David":9,"T. Buchanan":11,"M. Crepeau":1,
  "L. Díaz":7,"M. Caicedo":16,"F. Valverde":15,"D. Núñez":9,"R. Araújo":5,
  "E. Valencia":12,"M. Almirón":10,"R. Sanabria":7,
  "M. Salah":10,"R. Mahrez":7,"I. Bennacer":4,
  "H. Ziyech":7,"Y. En-Nesyri":9,"A. Hakimi":2,"Y. Bono":1,
  "S. Mané":10,"I. Gueye":4,"K. Koulibaly":3,"E. Mendy":1,
  "T. Partey":5,"J. Ayew":9,"L. Ati Zigi":1,
  "S. Fofana":14,"W. Zaha":11,"P. Tau":10,
  "M. Taremi":9,"S. Al-Dawsari":11,"F. Al-Buraikan":9,"A. Afif":11,
  "Son Heung-min":7,"Lee Kang-in":17,"Kim Min-jae":3,
  "K. Mitoma":9,"T. Minamino":7,"M. Leckie":7,"C. Wood":9,
};

const FIXTURES=[
  {id:1,date:"Jun 11",home:"Mexico",away:"South Africa",group:"A"},
  {id:2,date:"Jun 11",home:"South Korea",away:"Czechia",group:"A"},
  {id:3,date:"Jun 12",home:"Canada",away:"Bosnia & Herz.",group:"B"},
  {id:4,date:"Jun 12",home:"USA",away:"Paraguay",group:"D"},
  {id:5,date:"Jun 13",home:"Brazil",away:"Morocco",group:"C"},
  {id:6,date:"Jun 13",home:"Haiti",away:"Scotland",group:"C"},
  {id:7,date:"Jun 14",home:"Germany",away:"Curaçao",group:"E"},
  {id:8,date:"Jun 14",home:"Netherlands",away:"Japan",group:"F"},
  {id:9,date:"Jun 15",home:"Spain",away:"Cape Verde",group:"H"},
  {id:10,date:"Jun 15",home:"Belgium",away:"Egypt",group:"G"},
  {id:11,date:"Jun 16",home:"France",away:"Senegal",group:"I"},
  {id:12,date:"Jun 16",home:"Argentina",away:"Algeria",group:"J"},
  {id:13,date:"Jun 17",home:"Portugal",away:"DR Congo",group:"K"},
  {id:14,date:"Jun 17",home:"England",away:"Croatia",group:"L"},
  {id:15,date:"Jun 18",home:"Brazil",away:"Haiti",group:"C"},
  {id:16,date:"Jun 18",home:"USA",away:"Australia",group:"D"},
  {id:17,date:"Jun 19",home:"Germany",away:"Ivory Coast",group:"E"},
  {id:18,date:"Jun 19",home:"Netherlands",away:"Sweden",group:"F"},
  {id:19,date:"Jun 20",home:"Uruguay",away:"Panama",group:"G"},
  {id:20,date:"Jun 20",home:"Colombia",away:"Ecuador",group:"H"},
  {id:21,date:"Jun 21",home:"Norway",away:"Türkiye",group:"I"},
  {id:22,date:"Jun 21",home:"Austria",away:"Jordan",group:"J"},
  {id:23,date:"Jun 22",home:"Uzbekistan",away:"Ghana",group:"K"},
  {id:24,date:"Jun 22",home:"Ivory Coast",away:"Tunisia",group:"L"},
  {id:25,date:"Jun 23",home:"South Korea",away:"Mexico",group:"A"},
  {id:26,date:"Jun 23",home:"Czechia",away:"South Africa",group:"A"},
  {id:27,date:"Jun 24",home:"Canada",away:"Panama",group:"B"},
  {id:28,date:"Jun 24",home:"Morocco",away:"Scotland",group:"C"},
  {id:29,date:"Jun 25",home:"USA",away:"Colombia",group:"D"},
  {id:30,date:"Jun 25",home:"Germany",away:"Sweden",group:"E"},
  {id:31,date:"Jun 26",home:"Spain",away:"Egypt",group:"H"},
  {id:32,date:"Jun 26",home:"Netherlands",away:"Tunisia",group:"F"},
  {id:33,date:"Jun 27",home:"France",away:"Norway",group:"I"},
  {id:34,date:"Jun 27",home:"Argentina",away:"Austria",group:"J"},
  {id:35,date:"Jun 28",home:"Portugal",away:"Uzbekistan",group:"K"},
  {id:36,date:"Jun 28",home:"England",away:"Ivory Coast",group:"L"},
];

// ── POINTS SYSTEM ─────────────────────────────────────────────
const BASE_PTS={GK:6,DEF:6,MID:5,FWD:4};
const GOAL_PTS={GK:10,DEF:6,MID:5,FWD:4};
const ASSIST_PTS={GK:3,DEF:3,MID:3,FWD:3};
const CS_PTS={GK:4,DEF:4,MID:1,FWD:0};
const YELLOW_PTS=-1;
const RED_PTS=-3;
const SAVE_BONUS_PTS=1;
const GOAL_CONCEDED_PTS={GK:-1,DEF:-1,MID:0,FWD:0};

function genPlayerStats(playerId,fixtureId){
  const seed=playerId*1000+fixtureId;
  const r=(x,m)=>((x*9301+49297)%233280/233280*m)|0;
  return{
    played:r(seed,10)>1,goals:r(seed*3,10)<2?r(seed*7,3):0,
    assists:r(seed*11,10)<3?r(seed*13,2):0,yellowCard:r(seed*17,10)<2,
    redCard:r(seed*19,100)<3,saves:r(seed*23,8),cleanSheet:r(seed*29,10)<4,
    goalsConceded:r(seed*31,5),minutesPlayed:r(seed*37,10)>1?60+r(seed*41,30):r(seed*43,59),
  };
}

function calcPlayerPoints(player,fixtureId){
  const s=genPlayerStats(player.id,fixtureId);
  if(!s.played)return{total:0,breakdown:{},stats:s};
  let pts=0;const breakdown={};
  const playPts=s.minutesPlayed>=60?BASE_PTS[player.pos]:2;pts+=playPts;breakdown.played=playPts;
  const gPts=s.goals*GOAL_PTS[player.pos];pts+=gPts;breakdown.goals=gPts;
  const aPts=s.assists*ASSIST_PTS[player.pos];pts+=aPts;breakdown.assists=aPts;
  if(s.cleanSheet&&s.minutesPlayed>=60){const csPts=CS_PTS[player.pos];pts+=csPts;breakdown.cleanSheet=csPts;}
  if(player.pos==="GK"){const svPts=Math.floor(s.saves/3)*SAVE_BONUS_PTS;pts+=svPts;breakdown.saves=svPts;}
  const gcPts=Math.floor(s.goalsConceded/2)*GOAL_CONCEDED_PTS[player.pos];pts+=gcPts;breakdown.goalsConceded=gcPts;
  if(s.yellowCard){pts+=YELLOW_PTS;breakdown.yellowCard=YELLOW_PTS;}
  if(s.redCard){pts+=RED_PTS;breakdown.redCard=RED_PTS;}
  return{total:Math.max(0,pts),breakdown,stats:s};
}

function calcTotalPlayerPoints(player,scores){
  const relevant=FIXTURES.filter(f=>f.home===player.country||f.away===player.country);
  let total=0;const matchDetails=[];
  relevant.forEach(f=>{
    const sc=scores[f.id];
    if(!sc||sc.status==="NS")return;
    const result=calcPlayerPoints(player,f.id);
    total+=result.total;
    matchDetails.push({fixtureId:f.id,fixture:f,...result});
  });
  return{total,matchDetails};
}

// ── LIVE SCORE FETCHER ────────────────────────────────────────
async function fetchLiveScores(){
  // football-data.org: GET /v4/competitions/WC/matches
  const res=await fetch(
    `https://api.football-data.org/v4/competitions/${WC_COMPETITION_ID}/matches`,
    {headers:{"X-Auth-Token":FOOTBALL_DATA_API_KEY}}
  );
  if(!res.ok) throw new Error(`API error: ${res.status}`);
  const data=await res.json();
  const scoreMap={};
  for(const match of data.matches||[]){
    const home=normalizeName(match.homeTeam?.name||"");
    const away=normalizeName(match.awayTeam?.name||"");
    // Find our fixture by matching home+away names
    const fixture=FIXTURES.find(f=>
      f.home===home&&f.away===away||
      // fallback: partial match
      home.includes(f.home.split(" ")[0])&&away.includes(f.away.split(" ")[0])
    );
    if(!fixture)continue;
    const status=mapStatus(match.status);
    const hs=match.score?.fullTime?.home??match.score?.halfTime?.home??0;
    const as=match.score?.fullTime?.away??match.score?.halfTime?.away??0;
    const minute=match.minute||null;
    scoreMap[fixture.id]={
      homeScore:hs,awayScore:as,status,minute,
      fdMatchId:match.id,lastFetch:Date.now()
    };
  }
  return scoreMap;
}

// ── MOCK FALLBACK ─────────────────────────────────────────────
function genMock(f){
  const s=f.id*7;
  const r=(x,m)=>((x*1234567+89)%m);
  const st=["FT","FT","LIVE","NS","NS"][r(s,5)];
  return{homeScore:r(s,4),awayScore:r(s*3,4),status:st,minute:st==="LIVE"?r(s*2,85)+5:null};
}

const PLAYERS=[
  {id:1,name:"L. Messi",pos:"FWD",country:"Argentina",price:15},
  {id:2,name:"L. Martínez",pos:"FWD",country:"Argentina",price:11},
  {id:3,name:"R. De Paul",pos:"MID",country:"Argentina",price:9},
  {id:4,name:"M. Acuña",pos:"DEF",country:"Argentina",price:7},
  {id:5,name:"E. Martínez",pos:"GK",country:"Argentina",price:9},
  {id:6,name:"Vinicius Jr.",pos:"FWD",country:"Brazil",price:14},
  {id:7,name:"Rodrygo",pos:"FWD",country:"Brazil",price:10},
  {id:8,name:"Marquinhos",pos:"DEF",country:"Brazil",price:8},
  {id:9,name:"Alisson",pos:"GK",country:"Brazil",price:8},
  {id:10,name:"G. Jesus",pos:"FWD",country:"Brazil",price:9},
  {id:11,name:"K. Mbappé",pos:"FWD",country:"France",price:15},
  {id:12,name:"A. Griezmann",pos:"MID",country:"France",price:10},
  {id:13,name:"M. Maignan",pos:"GK",country:"France",price:7},
  {id:14,name:"L. Hernandez",pos:"DEF",country:"France",price:7},
  {id:15,name:"C. Nkunku",pos:"FWD",country:"France",price:8},
  {id:16,name:"J. Bellingham",pos:"MID",country:"England",price:13},
  {id:17,name:"H. Kane",pos:"FWD",country:"England",price:12},
  {id:18,name:"B. Saka",pos:"MID",country:"England",price:11},
  {id:19,name:"T. Alexander-Arnold",pos:"DEF",country:"England",price:9},
  {id:20,name:"J. Pickford",pos:"GK",country:"England",price:6},
  {id:21,name:"Pedri",pos:"MID",country:"Spain",price:11},
  {id:22,name:"Yamal",pos:"FWD",country:"Spain",price:12},
  {id:23,name:"A. Morata",pos:"FWD",country:"Spain",price:9},
  {id:24,name:"D. Carvajal",pos:"DEF",country:"Spain",price:8},
  {id:25,name:"U. Simon",pos:"GK",country:"Spain",price:6},
  {id:26,name:"C. Ronaldo",pos:"FWD",country:"Portugal",price:11},
  {id:27,name:"B. Fernandes",pos:"MID",country:"Portugal",price:9},
  {id:28,name:"R. Leão",pos:"FWD",country:"Portugal",price:10},
  {id:29,name:"R. Dias",pos:"DEF",country:"Portugal",price:8},
  {id:30,name:"D. Costa",pos:"GK",country:"Portugal",price:6},
  {id:31,name:"J. Musiala",pos:"MID",country:"Germany",price:12},
  {id:32,name:"F. Wirtz",pos:"MID",country:"Germany",price:12},
  {id:33,name:"K. Havertz",pos:"FWD",country:"Germany",price:10},
  {id:34,name:"A. Rüdiger",pos:"DEF",country:"Germany",price:7},
  {id:35,name:"M. Neuer",pos:"GK",country:"Germany",price:7},
  {id:36,name:"V. van Dijk",pos:"DEF",country:"Netherlands",price:9},
  {id:37,name:"M. Depay",pos:"FWD",country:"Netherlands",price:8},
  {id:38,name:"X. Simons",pos:"MID",country:"Netherlands",price:10},
  {id:39,name:"C. Gakpo",pos:"FWD",country:"Netherlands",price:9},
  {id:40,name:"B. Flekken",pos:"GK",country:"Netherlands",price:5},
  {id:41,name:"K. De Bruyne",pos:"MID",country:"Belgium",price:13},
  {id:42,name:"R. Lukaku",pos:"FWD",country:"Belgium",price:10},
  {id:43,name:"T. Courtois",pos:"GK",country:"Belgium",price:9},
  {id:44,name:"T. Hazard",pos:"MID",country:"Belgium",price:7},
  {id:45,name:"W. Faes",pos:"DEF",country:"Belgium",price:6},
  {id:46,name:"L. Modrić",pos:"MID",country:"Croatia",price:9},
  {id:47,name:"A. Kramarić",pos:"FWD",country:"Croatia",price:8},
  {id:48,name:"D. Livakovic",pos:"GK",country:"Croatia",price:5},
  {id:49,name:"J. Gvardiol",pos:"DEF",country:"Croatia",price:8},
  {id:50,name:"G. Xhaka",pos:"MID",country:"Switzerland",price:8},
  {id:51,name:"B. Embolo",pos:"FWD",country:"Switzerland",price:7},
  {id:52,name:"Y. Sommer",pos:"GK",country:"Switzerland",price:6},
  {id:53,name:"M. Akanji",pos:"DEF",country:"Switzerland",price:7},
  {id:54,name:"A. Robertson",pos:"DEF",country:"Scotland",price:8},
  {id:55,name:"S. McTominay",pos:"MID",country:"Scotland",price:8},
  {id:56,name:"L. Ferguson",pos:"FWD",country:"Scotland",price:6},
  {id:57,name:"A. Gunn",pos:"GK",country:"Scotland",price:4},
  {id:58,name:"D. Alaba",pos:"DEF",country:"Austria",price:7},
  {id:59,name:"M. Sabitzer",pos:"MID",country:"Austria",price:7},
  {id:60,name:"C. Gregoritsch",pos:"FWD",country:"Austria",price:6},
  {id:61,name:"P. Pentz",pos:"GK",country:"Austria",price:4},
  {id:62,name:"E. Haaland",pos:"FWD",country:"Norway",price:14},
  {id:63,name:"M. Ødegaard",pos:"MID",country:"Norway",price:11},
  {id:64,name:"A. Sørloth",pos:"FWD",country:"Norway",price:8},
  {id:65,name:"R. Nyland",pos:"GK",country:"Norway",price:5},
  {id:66,name:"H. Çalhanoğlu",pos:"MID",country:"Türkiye",price:9},
  {id:67,name:"A. Güler",pos:"MID",country:"Türkiye",price:8},
  {id:68,name:"B. Yılmaz",pos:"FWD",country:"Türkiye",price:7},
  {id:69,name:"A. Bayındır",pos:"GK",country:"Türkiye",price:5},
  {id:70,name:"T. Souček",pos:"MID",country:"Czechia",price:7},
  {id:71,name:"P. Schick",pos:"FWD",country:"Czechia",price:8},
  {id:72,name:"V. Coufal",pos:"DEF",country:"Czechia",price:5},
  {id:73,name:"J. Staněk",pos:"GK",country:"Czechia",price:4},
  {id:74,name:"A. Isak",pos:"FWD",country:"Sweden",price:10},
  {id:75,name:"D. Kulusevski",pos:"MID",country:"Sweden",price:9},
  {id:76,name:"V. Lindelöf",pos:"DEF",country:"Sweden",price:6},
  {id:77,name:"R. Olsen",pos:"GK",country:"Sweden",price:4},
  {id:78,name:"E. Džeko",pos:"FWD",country:"Bosnia & Herz.",price:7},
  {id:79,name:"M. Pjanić",pos:"MID",country:"Bosnia & Herz.",price:6},
  {id:80,name:"S. Kolašinac",pos:"DEF",country:"Bosnia & Herz.",price:5},
  {id:81,name:"I. Šehić",pos:"GK",country:"Bosnia & Herz.",price:4},
  {id:82,name:"C. Pulisic",pos:"MID",country:"USA",price:10},
  {id:83,name:"T. Adams",pos:"MID",country:"USA",price:7},
  {id:84,name:"M. Turner",pos:"GK",country:"USA",price:5},
  {id:85,name:"S. Dest",pos:"DEF",country:"USA",price:6},
  {id:86,name:"H. Lozano",pos:"FWD",country:"Mexico",price:8},
  {id:87,name:"E. Álvarez",pos:"MID",country:"Mexico",price:7},
  {id:88,name:"G. Ochoa",pos:"GK",country:"Mexico",price:6},
  {id:89,name:"C. Salcedo",pos:"DEF",country:"Mexico",price:5},
  {id:90,name:"A. Davies",pos:"DEF",country:"Canada",price:9},
  {id:91,name:"J. David",pos:"FWD",country:"Canada",price:10},
  {id:92,name:"T. Buchanan",pos:"MID",country:"Canada",price:7},
  {id:93,name:"M. Crepeau",pos:"GK",country:"Canada",price:5},
  {id:94,name:"L. Díaz",pos:"FWD",country:"Colombia",price:11},
  {id:95,name:"M. Caicedo",pos:"MID",country:"Colombia",price:9},
  {id:96,name:"F. Valverde",pos:"MID",country:"Uruguay",price:10},
  {id:97,name:"D. Núñez",pos:"FWD",country:"Uruguay",price:10},
  {id:98,name:"R. Araújo",pos:"DEF",country:"Uruguay",price:8},
  {id:99,name:"E. Valencia",pos:"FWD",country:"Ecuador",price:7},
  {id:100,name:"P. Estupiñán",pos:"DEF",country:"Ecuador",price:7},
  {id:101,name:"M. Almirón",pos:"MID",country:"Paraguay",price:8},
  {id:102,name:"R. Sanabria",pos:"FWD",country:"Paraguay",price:6},
  {id:103,name:"M. Salah",pos:"FWD",country:"Egypt",price:13},
  {id:104,name:"R. Mahrez",pos:"FWD",country:"Algeria",price:9},
  {id:105,name:"I. Bennacer",pos:"MID",country:"Algeria",price:7},
  {id:106,name:"H. Ziyech",pos:"MID",country:"Morocco",price:9},
  {id:107,name:"Y. En-Nesyri",pos:"FWD",country:"Morocco",price:8},
  {id:108,name:"A. Hakimi",pos:"DEF",country:"Morocco",price:9},
  {id:109,name:"Y. Bono",pos:"GK",country:"Morocco",price:7},
  {id:110,name:"S. Mané",pos:"FWD",country:"Senegal",price:10},
  {id:111,name:"I. Gueye",pos:"MID",country:"Senegal",price:7},
  {id:112,name:"K. Koulibaly",pos:"DEF",country:"Senegal",price:7},
  {id:113,name:"E. Mendy",pos:"GK",country:"Senegal",price:7},
  {id:114,name:"T. Partey",pos:"MID",country:"Ghana",price:8},
  {id:115,name:"J. Ayew",pos:"FWD",country:"Ghana",price:6},
  {id:116,name:"L. Ati Zigi",pos:"GK",country:"Ghana",price:4},
  {id:117,name:"S. Fofana",pos:"MID",country:"Ivory Coast",price:8},
  {id:118,name:"W. Zaha",pos:"FWD",country:"Ivory Coast",price:7},
  {id:119,name:"P. Tau",pos:"FWD",country:"South Africa",price:6},
  {id:120,name:"M. Taremi",pos:"FWD",country:"Iran",price:8},
  {id:121,name:"S. Al-Dawsari",pos:"MID",country:"Saudi Arabia",price:7},
  {id:122,name:"F. Al-Buraikan",pos:"FWD",country:"Saudi Arabia",price:6},
  {id:123,name:"A. Afif",pos:"MID",country:"Qatar",price:7},
  {id:124,name:"Son Heung-min",pos:"FWD",country:"South Korea",price:12},
  {id:125,name:"Lee Kang-in",pos:"MID",country:"South Korea",price:9},
  {id:126,name:"Kim Min-jae",pos:"DEF",country:"South Korea",price:8},
  {id:127,name:"K. Mitoma",pos:"FWD",country:"Japan",price:9},
  {id:128,name:"T. Minamino",pos:"MID",country:"Japan",price:8},
  {id:129,name:"M. Leckie",pos:"MID",country:"Australia",price:7},
  {id:130,name:"M. Ryan",pos:"GK",country:"Australia",price:5},
  {id:131,name:"C. Wood",pos:"FWD",country:"New Zealand",price:6},
];

const ALL_COUNTRIES=["All",...Array.from(new Set(PLAYERS.map(p=>p.country))).sort()];

function suggestBestXI(scores){
  const scored=PLAYERS.map(p=>({...p,pts:calcTotalPlayerPoints(p,scores).total}));
  const byPos=pos=>scored.filter(p=>p.pos===pos).sort((a,b)=>b.pts/b.price-a.pts/a.price);
  let squad=[...byPos("GK").slice(0,1),...byPos("DEF").slice(0,4),...byPos("MID").slice(0,3),...byPos("FWD").slice(0,3)];
  if(squad.reduce((s,p)=>s+p.price,0)>TEAM_BUDGET){
    const cheapest=pos=>scored.filter(p=>p.pos===pos).sort((a,b)=>a.price-b.price);
    squad=[...cheapest("GK").slice(0,1),...cheapest("DEF").slice(0,4),...cheapest("MID").slice(0,3),...cheapest("FWD").slice(0,3)];
  }
  const captain=squad.reduce((best,p)=>p.pts>(best?.pts||0)?p:best,null);
  return{squad,captain:captain?.id};
}

// ── LOCAL STORAGE HELPERS ─────────────────────────────────────
const store = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; } },
  set: (key, value, _shared) => { try { localStorage.setItem(key, value); return true; } catch { return false; } },
};

// ── AD BANNER COMPONENT ───────────────────────────────────────
// Renders a real AdSense unit. Pass `slot` prop to pick which ad.
// Automatically hidden for users with an active ad-free perk.
// In dev/mock mode shows a placeholder so layout is visible.
function AdBanner({ slot = "banner", adPerk = null, style = {} }) {
  const ref = useRef(null);
  const isAdFree = adPerkValid(adPerk);
  const isReal = ADSENSE_CLIENT !== "ca-pub-XXXXXXXXXXXXXXXX";

  useEffect(() => {
    if (isAdFree || !isReal) return;
    try {
      if (ref.current && !ref.current.dataset.adsbygoogleStatus) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {}
  }, [isAdFree, isReal]);

  // Hide entirely for ad-free users
  if (isAdFree) return null;

  // Placeholder shown in dev before AdSense is set up
  if (!isReal) {
    return (
      <div style={{
        background: "repeating-linear-gradient(45deg,rgba(255,255,255,0.03),rgba(255,255,255,0.03) 10px,transparent 10px,transparent 20px)",
        border: "1px dashed rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: "12px",
        textAlign: "center",
        fontSize: 11,
        color: "var(--color-text-tertiary)",
        margin: "8px 0",
        ...style,
      }}>
        📢 Ad placeholder — replace <code>ADSENSE_CLIENT</code> &amp; slot IDs to go live
      </div>
    );
  }

  // Real AdSense unit
  return (
    <div style={{ margin: "8px 0", textAlign: "center", ...style }}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={AD_SLOTS[slot] || AD_SLOTS.banner}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

const ACHIEVEMENTS=[
  {id:"first_team",label:"First Gaffer",desc:"Submit your first team",emoji:"👔",check:(teams)=>Object.values(teams).some(t=>t?.submitted)},
  {id:"five_teams",label:"Serial Manager",desc:"Submit all 5 teams",emoji:"🎯",check:(teams)=>Object.values(teams).filter(t=>t?.submitted).length>=5},
  {id:"top3",label:"Podium Finisher",desc:"Reach top 3 on leaderboard",emoji:"🥉",check:(teams,lb,username)=>{const r=lb.findIndex(e=>e.name===username)+1;return r>0&&r<=3;}},
  {id:"century",label:"Century Club",desc:"Score 100+ total points",emoji:"💯",check:(teams)=>Object.values(teams).filter(t=>t?.submitted).reduce((s,t)=>s+(t.points||0),0)>=100},
  {id:"top_earner",label:"Stellar King",desc:"Top up FFC via Stellar",emoji:"⭐",check:(t,lb,u,txH)=>txH&&txH.length>0},
];

// ── JERSEY SVG ────────────────────────────────────────────────
function JerseySVG({country,number,pos,size=56}){
  const kit=KITS[country]||KITS.default;
  const {p,s,a,pattern,pText}=kit;
  const isGK=pos==="GK";
  const jc=isGK?["#FF6B35","#00BFFF","#FFD700","#9B59B6"][Math.abs((country||"").charCodeAt(0))%4]:p;
  const id=`j${(country||"").replace(/\W/g,"")}${number}`;
  const renderPat=()=>{
    if(pattern==="stripes_v")return <g clipPath={`url(#c${id})`}>{[0,1,2,3,4,5,6,7].map(i=><rect key={i} x={i*9} y="18" width="4.5" height="46" fill={i%2===0?jc:s}/>)}</g>;
    if(pattern==="stripes_h")return <g clipPath={`url(#c${id})`}>{[0,1,2,3,4,5].map(i=><rect key={i} x="4" y={18+i*8} width="60" height="8" fill={i%2===0?jc:s}/>)}</g>;
    if(pattern==="check"){const ch=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){if((r+c)%2===0)ch.push(<rect key={`${r}${c}`} x={4+c*7} y={18+r*6} width="7" height="6" fill={s}/>);}return <g clipPath={`url(#c${id})`}>{ch}</g>;}
    return null;
  };
  return(
    <svg width={size} height={size*1.18} viewBox="0 0 68 80" xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id={`c${id}`}><path d="M4 18 Q2 22 2 30 L10 34 L10 64 Q10 66 13 66 L55 66 Q58 66 58 64 L58 34 L66 30 Q66 22 64 18 L54 13 Q50 23 34 23 Q18 23 14 13 Z"/></clipPath></defs>
      <path d="M4 18 Q2 22 2 30 L10 34 L10 64 Q10 66 13 66 L55 66 Q58 66 58 64 L58 34 L66 30 Q66 22 64 18 L54 13 Q50 23 34 23 Q18 23 14 13 Z" fill={jc}/>
      {renderPat()}
      <path d="M2 30 L-2 48 Q-2 50 1 50 L10 40 L10 34 Z" fill={s} opacity="0.85"/>
      <path d="M66 30 L70 48 Q70 50 67 50 L58 40 L58 34 Z" fill={s} opacity="0.85"/>
      <path d="M24 13 Q34 21 44 13 Q42 9 34 9 Q26 9 24 13 Z" fill={a}/>
      <text x="34" y="57" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="900" fontFamily="Arial Black,Arial,sans-serif" fill={pText}>{number}</text>
      <rect x="11" y="22" width="11" height="8" rx="2" fill="rgba(255,255,255,0.18)"/>
      <text x="16.5" y="27" textAnchor="middle" dominantBaseline="middle" fontSize="5.5" fill={pText} fontWeight="bold">{(country||"").slice(0,3).toUpperCase()}</text>
    </svg>
  );
}

function AnimFlag({country,size=22}){return <span style={{display:"inline-block",fontSize:size,lineHeight:1}}>{FLAGS[country]||"🏳️"}</span>;}

function PitchView({squad,captain}){
  const byPos=pos=>squad.filter(p=>p.pos===pos);
  const rows=[{pos:"FWD",y:"6%"},{pos:"MID",y:"30%"},{pos:"DEF",y:"55%"},{pos:"GK",y:"78%"}];
  return(
    <div style={{position:"relative",width:"100%",paddingBottom:"140%",background:"linear-gradient(180deg,#1a6b0f,#1e7a12 50%,#1a6b0f)",borderRadius:14,overflow:"hidden"}}>
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 300 420" preserveAspectRatio="none">
        <rect x="8" y="8" width="284" height="404" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5"/>
        <line x1="8" y1="210" x2="292" y2="210" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
        <circle cx="150" cy="210" r="42" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5"/>
        <circle cx="150" cy="210" r="3" fill="rgba(255,255,255,0.6)"/>
        <rect x="75" y="8" width="150" height="65" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5"/>
        <rect x="75" y="347" width="150" height="65" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5"/>
      </svg>
      {rows.map(({pos,y})=>(
        <div key={pos} style={{position:"absolute",top:y,left:0,right:0,display:"flex",justifyContent:"space-around",alignItems:"flex-end",padding:"0 2%"}}>
          {byPos(pos).map(p=>(
            <div key={p.id} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              {captain===p.id&&<div style={{fontSize:12}}>👑</div>}
              <JerseySVG country={p.country} number={SHIRT_NUMBERS[p.name]||p.id%26||1} pos={p.pos} size={44}/>
              <div style={{fontSize:8,color:"#fff",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.9)",textAlign:"center",maxWidth:48,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name.split(" ").pop()}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PointsChart({history}){
  if(!history||history.length<2)return <div style={{color:"var(--color-text-secondary)",fontSize:12,textAlign:"center",padding:"0.5rem"}}>Not enough data yet.</div>;
  const max=Math.max(...history.map(h=>h.pts),1);
  const w=280,h=80,pad=10;
  const pts=history.map((h,i)=>({x:pad+i*(w-pad*2)/(history.length-1),y:pad+(h-pad*2)*(1-h.pts/max)+pad}));
  return(
    <svg width="100%" viewBox={`0 0 ${w} ${h+20}`} style={{overflow:"visible"}}>
      <polyline points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#1565c0" strokeWidth="2.5" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#1565c0"/>
          <text x={p.x} y={p.y-8} textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">{history[i].pts}</text>
          <text x={p.x} y={h+18} textAnchor="middle" fontSize="9" fill="var(--color-text-tertiary)">{history[i].label}</text>
        </g>
      ))}
    </svg>
  );
}

function generateCommentary(fixture,score){
  if(!score||score.status==="NS")return["⏱️ Match not yet started."];
  const{homeScore:h,awayScore:a,status,minute}=score;
  const lines=[];
  if(status==="LIVE"){
    lines.push(`🔴 LIVE${minute?` — ${minute}'`:""}`);
    if(h>a)lines.push(`💪 ${fixture.home} leading — dominant display.`);
    else if(a>h)lines.push(`⚡ ${fixture.away} on top — pushing hard.`);
    else lines.push(`⚖️ Level game — both sides fighting.`);
    if(h+a>=3)lines.push(`🎯 High-scoring affair!`);
    if(minute>80)lines.push(`⏳ Final minutes — nerves shredded.`);
  }else{
    lines.push(`✅ FT: ${fixture.home} ${h}–${a} ${fixture.away}`);
    if(h===a)lines.push(`🤝 Honours even — a fair result.`);
    else{
      const winner=h>a?fixture.home:fixture.away;
      const diff=Math.abs(h-a);
      if(diff>=3)lines.push(`🚀 Emphatic win for ${winner}!`);
      else if(diff===2)lines.push(`💪 Convincing win for ${winner}.`);
      else lines.push(`😤 ${winner} edged it in a tight contest.`);
    }
    if(h===0||a===0)lines.push(`🧤 Clean sheet! Superb defending.`);
  }
  return lines;
}

// ── PLAYER DETAIL MODAL ───────────────────────────────────────
function PlayerDetailModal({player,scores,onClose}){
  const{total,matchDetails}=calcTotalPlayerPoints(player,scores);
  const fixtures=FIXTURES.filter(f=>f.home===player.country||f.away===player.country);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000}} onClick={onClose}>
      <div style={{background:"#1a1a2e",borderRadius:20,padding:"1.25rem",width:"min(94vw,380px)",maxHeight:"85vh",overflowY:"auto",border:"1px solid rgba(255,215,0,0.15)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <JerseySVG country={player.country} number={SHIRT_NUMBERS[player.name]||1} pos={player.pos} size={48}/>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>{player.name}</div>
              <div style={{fontSize:12,color:"#aaa"}}>{FLAGS[player.country]} {player.country} · <span style={{background:POS_COLORS[player.pos],color:"#fff",padding:"1px 6px",borderRadius:4,fontSize:11}}>{player.pos}</span></div>
              <div style={{fontSize:13,color:"#FFD700",fontWeight:700,marginTop:2}}>{total} pts · {player.price}FFC</div>
            </div>
          </div>
          <button onClick={onClose} style={{fontSize:16,background:"rgba(255,255,255,0.1)",color:"#fff",padding:"4px 10px",borderRadius:8,border:"none",cursor:"pointer"}}>✕</button>
        </div>
        <div style={{fontSize:13,fontWeight:600,color:"#ccc",marginBottom:8}}>Match Breakdown</div>
        {fixtures.map(f=>{
          const sc=scores[f.id];
          const md=matchDetails.find(m=>m.fixtureId===f.id);
          return(
            <div key={f.id} style={{background:"#111827",borderRadius:10,padding:"10px 12px",marginBottom:6,border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,color:"#aaa"}}>{f.home} vs {f.away} · {f.date}</span>
                <span style={{fontSize:13,fontWeight:700,color:md?.total>0?"#FFD700":"#666"}}>{md?`${md.total} pts`:"—"}</span>
              </div>
              {md&&md.stats&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {md.stats.goals>0&&<span style={{fontSize:11,background:"rgba(231,76,60,0.2)",color:"#e74c3c",padding:"1px 6px",borderRadius:4}}>⚽ {md.stats.goals}g</span>}
                  {md.stats.assists>0&&<span style={{fontSize:11,background:"rgba(39,174,96,0.2)",color:"#27ae60",padding:"1px 6px",borderRadius:4}}>🅰️ {md.stats.assists}a</span>}
                  {md.stats.cleanSheet&&<span style={{fontSize:11,background:"rgba(52,152,219,0.2)",color:"#3498db",padding:"1px 6px",borderRadius:4}}>🧤 CS</span>}
                  {md.stats.yellowCard&&<span style={{fontSize:11,background:"rgba(241,196,15,0.2)",color:"#f1c40f",padding:"1px 6px",borderRadius:4}}>🟨</span>}
                  {md.stats.redCard&&<span style={{fontSize:11,background:"rgba(231,76,60,0.2)",color:"#e74c3c",padding:"1px 6px",borderRadius:4}}>🟥</span>}
                  {md.stats.saves>0&&player.pos==="GK"&&<span style={{fontSize:11,background:"rgba(155,89,182,0.2)",color:"#9b59b6",padding:"1px 6px",borderRadius:4}}>🖐️ {md.stats.saves}sv</span>}
                  <span style={{fontSize:11,color:"#666"}}>{md.stats.minutesPlayed}'</span>
                </div>
              )}
              {(!md||!sc||sc.status==="NS")&&<span style={{fontSize:11,color:"#555"}}>Not played yet</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TRANSFER MODAL ────────────────────────────────────────────
function TransferModal({team,scores,onSave,onClose}){
  const[squad,setSquad]=useState([...team.squad]);
  const[captain,setCaptain]=useState(team.captain);
  const[search,setSearch]=useState("");
  const[selectedOut,setSelectedOut]=useState(null);
  const spent=squad.reduce((s,p)=>s+p.price,0);
  const remaining=TEAM_BUDGET-spent;
  const filtered=PLAYERS.filter(p=>{
    if(squad.find(x=>x.id===p.id))return false;
    if(!selectedOut)return false;
    if(p.pos!==selectedOut.pos)return false;
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase()))return false;
    if(p.price>remaining+selectedOut.price)return false;
    return true;
  });
  const doTransfer=pIn=>{
    const nq=squad.map(p=>p.id===selectedOut.id?pIn:p);
    setSquad(nq);if(captain===selectedOut.id)setCaptain(pIn.id);
    setSelectedOut(null);setSearch("");
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1500}}>
      <div style={{background:"#1a1a2e",borderRadius:20,padding:"1.25rem",width:"min(96vw,440px)",maxHeight:"90vh",overflowY:"auto",border:"1px solid rgba(255,215,0,0.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div><div style={{fontSize:17,fontWeight:700,color:"#fff"}}>🔄 Transfers</div><div style={{fontSize:12,color:"#aaa"}}>Budget: <span style={{color:remaining<5?"#e74c3c":"#FFD700",fontWeight:700}}>{remaining}/{TEAM_BUDGET}</span></div></div>
          <button onClick={onClose} style={{fontSize:16,background:"rgba(255,255,255,0.1)",color:"#fff",padding:"4px 10px",borderRadius:8,border:"none",cursor:"pointer"}}>✕</button>
        </div>
        {!selectedOut?(
          <>
            <div style={{fontSize:13,color:"#aaa",marginBottom:8}}>Tap a player to swap out:</div>
            {POS_ORDER.map(pos=>squad.filter(p=>p.pos===pos).map(p=>{
              const pts=calcTotalPlayerPoints(p,scores).total;
              return(
                <div key={p.id} onClick={()=>setSelectedOut(p)} style={{display:"flex",alignItems:"center",gap:10,background:"#111827",borderRadius:10,padding:"8px 12px",marginBottom:5,cursor:"pointer",border:"1px solid rgba(255,255,255,0.08)"}}>
                  <JerseySVG country={p.country} number={SHIRT_NUMBERS[p.name]||1} pos={p.pos} size={32}/>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{p.name} {captain===p.id&&"👑"}</div><div style={{fontSize:11,color:"#aaa"}}>{FLAGS[p.country]} · <span style={{background:POS_COLORS[p.pos],color:"#fff",padding:"0 4px",borderRadius:3}}>{p.pos}</span> · {p.price}FFC</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:"#FFD700"}}>{pts}pts</div><div style={{fontSize:11,color:"#e74c3c"}}>Out →</div></div>
                </div>
              );
            }))}
          </>
        ):(
          <>
            <div style={{background:"#111827",borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:"#aaa"}}>Out: <span style={{color:"#e74c3c",fontWeight:700}}>{selectedOut.name}</span></span>
              <button onClick={()=>setSelectedOut(null)} style={{fontSize:12,background:"transparent",color:"#aaa",border:"none",cursor:"pointer"}}>← Back</button>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${selectedOut.pos}...`} style={{width:"100%",fontSize:13,padding:"7px 10px",marginBottom:10,boxSizing:"border-box"}}/>
            <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:300,overflowY:"auto"}}>
              {filtered.map(p=>{
                const pts=calcTotalPlayerPoints(p,scores).total;
                const diff=p.price-selectedOut.price;
                return(
                  <div key={p.id} onClick={()=>doTransfer(p)} style={{display:"flex",alignItems:"center",gap:10,background:"#111827",borderRadius:10,padding:"8px 12px",cursor:"pointer",border:"1px solid rgba(39,174,96,0.3)"}}>
                    <JerseySVG country={p.country} number={SHIRT_NUMBERS[p.name]||1} pos={p.pos} size={32}/>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{p.name}</div><div style={{fontSize:11,color:"#aaa"}}>{FLAGS[p.country]} · {p.price}FFC <span style={{color:diff>0?"#e74c3c":diff<0?"#27ae60":"#666"}}>{diff>0?`+${diff}`:diff}</span></div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:"#FFD700"}}>{pts}pts</div><div style={{fontSize:11,color:"#27ae60"}}>In ✓</div></div>
                  </div>
                );
              })}
              {filtered.length===0&&<div style={{textAlign:"center",color:"#555",fontSize:13,padding:"1rem"}}>No valid replacements.</div>}
            </div>
          </>
        )}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button onClick={onClose} style={{flex:1,padding:"10px",fontSize:13,background:"rgba(255,255,255,0.05)",color:"#aaa",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onSave(squad,captain)} style={{flex:2,padding:"10px",fontSize:13,fontWeight:700,background:"#1565c0",color:"#fff",borderRadius:10,border:"none",cursor:"pointer"}}>Save →</button>
        </div>
      </div>
    </div>
  );
}

// ── WALLET MODAL ──────────────────────────────────────────────
function WalletModal({balance,username,onClose,onTopUp}){
  const[tab,setTab]=useState("topup");
  const[txid,setTxid]=useState("");
  const[verifying,setVerifying]=useState(false);
  const[verifyResult,setVerifyResult]=useState(null);
  const[copied,setCopied]=useState(false);
  const[txHistory,setTxHistory]=useState([]);
  const[adPerk,setAdPerk]=useState(null);
  useEffect(()=>{
    try{const r=store.get(`fifa26_txh_${username}`);if(r)setTxHistory(JSON.parse(r.value));const ap=store.get(`fifa26_ap_${username}`);if(ap){const p=JSON.parse(ap.value);if(adPerkValid(p))setAdPerk(p);}}catch{}
  },[username]);
  const copyAddr=()=>{navigator.clipboard?.writeText(YOUR_STELLAR_ADDRESS).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const verifyTx=async()=>{
    const hash=txid.trim();if(!hash)return;
    setVerifying(true);setVerifyResult(null);
    if(txHistory.find(t=>t.txid===hash)){setVerifyResult({ok:false,error:"Already used."});setVerifying(false);return;}
    try{      const res=await fetch(`https://horizon.stellar.org/transactions/${hash}`);
      if(!res.ok){setVerifyResult({ok:false,error:"Transaction not found on Stellar network."});setVerifying(false);return;}
      const tx=await res.json();
      const memo=tx.memo||"";
      if(memo!=="FIFA26"&&memo!==username){setVerifyResult({ok:false,error:`Memo must be "FIFA26" or your username "${username}".`});setVerifying(false);return;}
      const opsRes=await fetch(`https://horizon.stellar.org/transactions/${hash}/operations`);
      const ops=await opsRes.json();
      let amount=0,asset="";
      for(const op of ops._embedded?.records||[]){
        if(op.type==="payment"&&op.to===YOUR_STELLAR_ADDRESS){
          amount=parseFloat(op.amount);
          asset=op.asset_type==="native"?"XLM":op.asset_code;break;
        }
      }
      if(!amount){setVerifyResult({ok:false,error:"No payment to our Stellar address found."});setVerifying(false);return;}
      let ffc=0;
      if(asset==="USDC")ffc=Math.floor(amount*100);
      else if(asset==="XLM")ffc=Math.floor(amount*10);
      else{setVerifyResult({ok:false,error:`Asset ${asset} not supported. Send XLM or USDC.`});setVerifying(false);return;}
      if(ffc<200){setVerifyResult({ok:false,error:`Too low. Min is 2 USDC or 20 XLM (= 200 FFC).`});setVerifying(false);return;}
      const tier=USDT_TO_FFC.slice().reverse().find(t=>ffc>=t.minUsdt*100)||USDT_TO_FFC[0];
      const newPerk={tier:tier.label,noAds:tier.noAds,adPerkShort:tier.adPerkShort,adPerk:tier.adPerk,ts:Date.now()};
      store.set(`fifa26_ap_${username}`,JSON.stringify(newPerk));
      setAdPerk(newPerk);
      const record={txid:hash,amount,asset,ffc,tier:tier.label,ts:Date.now()};
      const nh=[record,...txHistory].slice(0,50);
      setTxHistory(nh);
      store.set(`fifa26_txh_${username}`,JSON.stringify(nh));
      onTopUp(ffc,newPerk);
      setVerifyResult({ok:true,ffc,tier:tier.label,asset,amount});
      setTxid("");
    }catch(e){setVerifyResult({ok:false,error:"Network error. Try again."});}
    setVerifying(false);
  };
  const tabBtn=k=>({flex:1,padding:"8px 4px",fontSize:13,fontWeight:tab===k?700:500,borderRadius:9,border:"none",cursor:"pointer",background:tab===k?"#1565c0":"#2a2a3e",color:tab===k?"#fff":"#aaa"});
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"#1a1a2e",borderRadius:20,padding:"1.5rem",width:"min(94vw,420px)",maxHeight:"90vh",overflowY:"auto",border:"1px solid rgba(255,215,0,0.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div><div style={{fontSize:19,fontWeight:700,color:"#fff"}}>⭐ Stellar Wallet</div><div style={{fontSize:12,color:"#aaa"}}>XLM / USDC on Stellar · FIFA Fantasy Coin</div></div>
          <button onClick={onClose} style={{fontSize:18,background:"rgba(255,255,255,0.1)",color:"#fff",padding:"4px 12px",borderRadius:8,border:"none",cursor:"pointer"}}>✕</button>
        </div>
        <div style={{background:"linear-gradient(135deg,#0d0d1a,#0f3460)",borderRadius:16,padding:"1.1rem",marginBottom:"1rem",border:"1px solid rgba(255,215,0,0.2)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:1}}>BALANCE</div>
          <div style={{fontSize:30,fontWeight:800,color:"#FFD700"}}>{balance.toLocaleString()} <span style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>FFC</span></div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:3}}>{Math.floor(balance/TEAM_BUDGET)} team slot{Math.floor(balance/TEAM_BUDGET)!==1?"s":""} available</div>
        </div>
        {adPerk&&adPerkValid(adPerk)&&<div style={{background:adPerk.noAds?"rgba(16,185,129,0.1)":"rgba(245,158,11,0.1)",border:`1px solid ${adPerk.noAds?"#10b981":"#f59e0b"}`,borderRadius:10,padding:"6px 12px",marginBottom:"1rem",fontSize:12,color:adPerk.noAds?"#6ee7b7":"#fcd34d"}}>{adPerk.noAds?"🚫":"📉"} {adPerkLabel(adPerk)}</div>}
        <div style={{display:"flex",gap:4,marginBottom:"1.1rem",background:"#111",borderRadius:10,padding:4}}>
          {[{k:"topup",l:"⭐ Top Up"},{k:"verify",l:"🔍 Verify"},{k:"history",l:"📋 History"}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={tabBtn(t.k)}>{t.l}</button>
          ))}
        </div>
        {tab==="topup"&&(
          <>
            <div style={{fontSize:14,fontWeight:600,color:"#fff",marginBottom:8}}>Send XLM or USDC to:</div>
            <div style={{background:"#111827",borderRadius:12,padding:"1rem",marginBottom:"1rem",textAlign:"center",border:"1px solid rgba(255,255,255,0.08)"}}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${YOUR_STELLAR_ADDRESS}&bgcolor=ffffff&color=000000&margin=8`} alt="QR" style={{width:140,height:140,borderRadius:10,display:"block",margin:"0 auto 10px"}} onError={e=>{e.target.style.display="none";}}/>
              <div style={{fontFamily:"monospace",fontSize:11,wordBreak:"break-all",color:"#e0e0e0",background:"#0d0d1a",borderRadius:8,padding:"8px",marginBottom:8}}>{YOUR_STELLAR_ADDRESS}</div>
              <button onClick={copyAddr} style={{fontSize:13,padding:"6px 18px",background:copied?"#4CAF50":"#1565c0",color:"#fff",borderRadius:8,border:"none",cursor:"pointer"}}>{copied?"✓ Copied!":"📋 Copy"}</button>
            </div>
            <div style={{background:"#0d2137",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#90caf9",marginBottom:10,border:"1px solid rgba(144,202,249,0.15)"}}>
              ⚠️ <strong>Include memo:</strong> <code style={{background:"rgba(255,255,255,0.1)",padding:"1px 5px",borderRadius:3}}>FIFA26</code> or <code style={{background:"rgba(255,255,255,0.1)",padding:"1px 5px",borderRadius:3}}>{username}</code><br/><br/>
              <strong>Rate:</strong> 1 USDC = 100 FFC · 10 XLM ≈ 100 FFC<br/>
              After sending, paste your Transaction Hash in <strong>Verify</strong>.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {USDT_TO_FFC.map(t=>(
                <div key={t.label} style={{background:"#111827",borderRadius:12,padding:"10px",textAlign:"center",border:"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{fontSize:22,marginBottom:3}}>{t.emoji}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{t.label}</div>
                  <div style={{fontSize:15,fontWeight:800,color:"#FFD700",margin:"3px 0"}}>{Math.floor(t.minUsdt*100)} FFC</div>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>{t.minUsdt} USDC min</div>
                  <div style={{background:t.noAds?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)",border:`1px solid ${t.adColor}`,borderRadius:5,padding:"2px 5px",display:"inline-block"}}>
                    <span style={{fontSize:10,fontWeight:700,color:t.adColor}}>{t.noAds?"🚫":"📉"} {t.adPerk}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {tab==="verify"&&(
          <>
            <div style={{fontSize:13,color:"#aaa",marginBottom:8}}>Paste your Stellar Transaction Hash:</div>
            <textarea value={txid} onChange={e=>setTxid(e.target.value)} placeholder="64-char transaction hash..." rows={3} style={{width:"100%",fontSize:12,fontFamily:"monospace",padding:"10px",borderRadius:10,border:"1px solid rgba(255,255,255,0.12)",background:"#111827",resize:"none",boxSizing:"border-box",marginBottom:10,color:"#e0e0e0"}}/>
            <button onClick={verifyTx} disabled={verifying||!txid.trim()} style={{width:"100%",padding:"11px",fontWeight:700,fontSize:14,marginBottom:10,background:verifying?"#333":"#1565c0",color:verifying?"#aaa":"#fff",borderRadius:12,border:"none",cursor:verifying?"not-allowed":"pointer"}}>
              {verifying?"🔍 Checking Stellar Horizon...":"🔍 Verify Transaction"}
            </button>
            {verifyResult&&(verifyResult.ok?(
              <div style={{background:"#1b3a1f",border:"1px solid #4CAF50",borderRadius:12,padding:"1rem",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:700,color:"#81c784"}}>✅ +{verifyResult.ffc.toLocaleString()} FFC added!</div>
                <div style={{fontSize:12,color:"#a5d6a7"}}>{verifyResult.amount} {verifyResult.asset} · {verifyResult.tier} tier</div>
              </div>
            ):(
              <div style={{background:"#3b1212",border:"1px solid #ef9a9a",borderRadius:12,padding:"1rem"}}>
                <div style={{fontSize:13,fontWeight:600,color:"#ef9a9a"}}>❌ {verifyResult.error}</div>
                <div style={{fontSize:11,color:"#ef5350",marginTop:6}}>Check on <a href="https://stellar.expert" target="_blank" rel="noreferrer" style={{color:"#90caf9"}}>stellar.expert</a></div>
              </div>
            ))}
          </>
        )}
        {tab==="history"&&(
          txHistory.length===0?<div style={{textAlign:"center",padding:"2rem",color:"#aaa"}}>No transactions yet.</div>:txHistory.map((t,i)=>(
            <div key={i} style={{background:"#111827",borderRadius:10,padding:"10px 12px",marginBottom:6,border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:14,fontWeight:700,color:"#FFD700"}}>+{t.ffc} FFC</span><span style={{fontSize:11,color:"#888"}}>{new Date(t.ts).toLocaleDateString()}</span></div>
              <div style={{fontSize:12,color:"#aaa"}}>{t.amount} {t.asset} · {t.tier}</div>
              <div style={{fontSize:10,fontFamily:"monospace",color:"#555",marginTop:2,wordBreak:"break-all"}}>{t.txid.slice(0,20)}...{t.txid.slice(-8)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App(){
  const[screen,setScreen]=useState("name");
  const[username,setUsername]=useState("");
  const[nameInput,setNameInput]=useState("");
  const[balance,setBalance]=useState(200);
  const[adPerk,setAdPerk]=useState(null);
  const[showWallet,setShowWallet]=useState(false);
  const[teams,setTeams]=useState({});
  const[activeTeamIdx,setActiveTeamIdx]=useState(0);
  const[draft,setDraft]=useState([]);
  const[draftCaptain,setDraftCaptain]=useState(null);
  const[posFilter,setPosFilter]=useState("ALL");
  const[countryFilter,setCountryFilter]=useState("All");
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState("grid");
  const[scores,setScores]=useState(()=>{const m={};FIXTURES.forEach(f=>{m[f.id]=genMock(f);});return m;});
  const[scoreSource,setScoreSource]=useState("mock"); // "mock" | "live" | "error"
  const[lastUpdated,setLastUpdated]=useState(null);
  const[leaderboard,setLeaderboard]=useState([]);
  const[groupFilter,setGroupFilter]=useState("All");
  const[selectedPlayer,setSelectedPlayer]=useState(null);
  const[transferTeamIdx,setTransferTeamIdx]=useState(null);
  const[notifications,setNotifications]=useState([]);
  const[showNotifs,setShowNotifs]=useState(false);
  const[achievements,setAchievements]=useState([]);
  const[txHistory,setTxHistory]=useState([]);
  const[hubTab,setHubTab]=useState("teams");
  const[showAutoSuggest,setShowAutoSuggest]=useState(false);
  const pollRef=useRef(null);
  const prevScoresRef=useRef({});

  useEffect(()=>{
    const s=document.createElement("style");
    s.textContent=`@keyframes pf{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes su{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes notif{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}`;
    document.head.appendChild(s);return()=>document.head.removeChild(s);
  },[]);

  useEffect(()=>{
    if(!username)return;
    (()=>{
      try{
        const d=store.get(`fifa26_user_${username}`);
        if(d){const p=JSON.parse(d.value);if(p.balance!==undefined)setBalance(p.balance);if(p.teams)setTeams(p.teams);}
        const lb=store.get("fifa26_lb4");if(lb)setLeaderboard(JSON.parse(lb.value));
        const ap=store.get(`fifa26_ap_${username}`);if(ap){const p=JSON.parse(ap.value);if(adPerkValid(p))setAdPerk(p);}
        const th=store.get(`fifa26_txh_${username}`);if(th)setTxHistory(JSON.parse(th.value));
      }catch{}
    })();
  },[username]);

  useEffect(()=>{
    if(!username)return;
    store.set(`fifa26_user_${username}`,JSON.stringify({balance,teams}));
  },[balance,teams,username]);

  useEffect(()=>{
    if(!username)return;
    const earned=ACHIEVEMENTS.filter(a=>a.check(teams,leaderboard,username,txHistory)).map(a=>a.id);
    setAchievements(earned);
  },[teams,leaderboard,username,txHistory]);

  // ── SCORE FETCH — live or mock ────────────────────────────
  const fetchScores=useCallback(async()=>{
    if(USE_LIVE_SCORES){
      try{
        const liveMap=await fetchLiveScores();
        setScores(prev=>{
          const next={...prev};
          const newNotifs=[];
          Object.entries(liveMap).forEach(([fid,sc])=>{
            const prev=prevScoresRef.current[fid];
            if(prev&&sc.status==="LIVE"){
              if(sc.homeScore>prev.homeScore){const f=FIXTURES.find(x=>x.id===Number(fid));if(f)newNotifs.push({id:Date.now()+Number(fid),msg:`⚽ GOAL! ${f.home}`,sub:`${f.home} ${sc.homeScore}–${sc.awayScore} ${f.away}`,ts:Date.now()});}
              if(sc.awayScore>prev.awayScore){const f=FIXTURES.find(x=>x.id===Number(fid));if(f)newNotifs.push({id:Date.now()+Number(fid)+1,msg:`⚽ GOAL! ${f.away}`,sub:`${f.home} ${sc.homeScore}–${sc.awayScore} ${f.away}`,ts:Date.now()});}
            }
            if(prev&&prev.status==="LIVE"&&sc.status==="FT"){const f=FIXTURES.find(x=>x.id===Number(fid));if(f)newNotifs.push({id:Date.now()+Number(fid)+2,msg:`✅ FT: ${f.home} ${sc.homeScore}–${sc.awayScore} ${f.away}`,sub:"Full time!",ts:Date.now()});}
            next[Number(fid)]=sc;
          });
          prevScoresRef.current={...next};
          if(newNotifs.length)setNotifications(n=>[...newNotifs,...n].slice(0,20));
          return next;
        });
        setScoreSource("live");
      }catch(e){
        setScoreSource("error");
        // fall back to mock animation
        setScores(prev=>{
          const next={...prev};
          FIXTURES.forEach(f=>{const sc=next[f.id];if(!sc||sc.status!=="LIVE")return;const nm=Math.min((sc.minute||0)+1,90);next[f.id]={...sc,minute:nm,homeScore:sc.homeScore+(Math.random()<0.015?1:0),awayScore:sc.awayScore+(Math.random()<0.015?1:0),status:nm>=90?"FT":"LIVE"};});
          return next;
        });
      }
    }else{
      // Mock mode
      setScores(prev=>{
        const next={...prev};
        FIXTURES.forEach(f=>{const sc=next[f.id];if(!sc||sc.status!=="LIVE")return;const nm=Math.min((sc.minute||0)+1,90);const hg=Math.random()<0.015,ag=Math.random()<0.015;const nhs=sc.homeScore+(hg?1:0),nas=sc.awayScore+(ag?1:0);next[f.id]={...sc,minute:nm,homeScore:nhs,awayScore:nas,status:nm>=90?"FT":"LIVE"};if(hg){const newN={id:Date.now()+f.id,msg:`⚽ GOAL! ${f.home}`,sub:`${f.home} ${nhs}–${nas} ${f.away}`,ts:Date.now()};setNotifications(n=>[newN,...n].slice(0,20));}if(ag){const newN={id:Date.now()+f.id+1,msg:`⚽ GOAL! ${f.away}`,sub:`${f.home} ${nhs}–${nas} ${f.away}`,ts:Date.now()};setNotifications(n=>[newN,...n].slice(0,20));}});
        return next;
      });
      setScoreSource("mock");
    }
    setLastUpdated(new Date());
  },[]);

  useEffect(()=>{
    if(screen==="name")return;
    fetchScores();
    pollRef.current=setInterval(fetchScores, USE_LIVE_SCORES ? POLL_INTERVAL_MS : 8000);
    return()=>clearInterval(pollRef.current);
  },[screen,fetchScores]);

  useEffect(()=>{
    setTeams(prev=>{
      const next={...prev};
      Object.keys(next).forEach(i=>{
        const t=next[i];if(!t||!t.submitted||!t.squad||!t.captain)return;
        const pts={};t.squad.forEach(p=>{const{total}=calcTotalPlayerPoints(p,scores);pts[p.id]=total*(p.id===t.captain?2:1);});
        const total=Object.values(pts).reduce((a,b)=>a+b,0);
        const history=t.pointsHistory||[];
        const last=history[history.length-1];
        const newHist=last&&last.pts===total?history:[...history,{pts:total,label:"Upd"}].slice(-8);
        next[i]={...t,points:total,pts,pointsHistory:newHist};
      });
      return next;
    });
  },[scores]);

  const posCount=pos=>draft.filter(p=>p.pos===pos).length;
  const draftSpent=draft.reduce((s,p)=>s+p.price,0);
  const draftRemaining=TEAM_BUDGET-draftSpent;
  const canAdd=player=>{
    if(draft.find(p=>p.id===player.id))return false;
    if(draft.length>=11)return false;
    if(posCount(player.pos)>=FORMATION[player.pos])return false;
    if(draftRemaining<player.price)return false;
    return true;
  };
  const toggleDraft=player=>{
    if(draft.find(p=>p.id===player.id)){setDraft(d=>d.filter(p=>p.id!==player.id));if(draftCaptain===player.id)setDraftCaptain(null);}
    else if(canAdd(player))setDraft(d=>[...d,player]);
  };
  const draftComplete=draft.length===11;

  const startPickingTeam=idx=>{
    if(balance<TEAM_BUDGET&&!teams[idx]?.submitted){setShowWallet(true);return;}
    setActiveTeamIdx(idx);setDraft(teams[idx]?.squad||[]);setDraftCaptain(teams[idx]?.captain||null);
    setPosFilter("ALL");setCountryFilter("All");setSearch("");setViewMode("grid");setScreen("pick");
  };

  const submitTeam=async()=>{
    if(!draftComplete||!draftCaptain)return;
    const already=teams[activeTeamIdx]?.submitted;
    if(!already)setBalance(b=>b-TEAM_BUDGET);
    const pts={};draft.forEach(p=>{const{total}=calcTotalPlayerPoints(p,scores);pts[p.id]=total*(p.id===draftCaptain?2:1);});
    const total=Object.values(pts).reduce((a,b)=>a+b,0);
    const prev=teams[activeTeamIdx];
    const newTeam={squad:draft,captain:draftCaptain,points:total,pts,submitted:true,pointsHistory:prev?.pointsHistory||[{pts:total,label:"Start"}]};
    const newTeams={...teams,[activeTeamIdx]:newTeam};
    setTeams(newTeams);
    const best=Math.max(...Object.values(newTeams).filter(t=>t?.submitted).map(t=>t.points||0),0);
    const nb=[...leaderboard.filter(e=>e.name!==username),{name:username,points:best,teams:Object.values(newTeams).filter(t=>t?.submitted).length}].sort((a,b)=>b.points-a.points).slice(0,30);
    setLeaderboard(nb);
    store.set("fifa26_lb4",JSON.stringify(nb));
    setNotifications(n=>[{id:Date.now(),msg:`✅ ${TEAM_NAMES[activeTeamIdx]} submitted!`,sub:`${total} pts · Cap: ${draft.find(p=>p.id===draftCaptain)?.name}`,ts:Date.now()},...n]);
    setScreen("hub");setHubTab("teams");
  };

  const handleTransferSave=(teamIdx,sq,cap)=>{
    const pts={};sq.forEach(p=>{const{total}=calcTotalPlayerPoints(p,scores);pts[p.id]=total*(p.id===cap?2:1);});
    const total=Object.values(pts).reduce((a,b)=>a+b,0);
    const prev=teams[teamIdx];
    setTeams(t=>({...t,[teamIdx]:{...prev,squad:sq,captain:cap,points:total,pts,pointsHistory:[...(prev.pointsHistory||[]),{pts:total,label:"Transfer"}].slice(-8)}}));
    setTransferTeamIdx(null);
    setNotifications(n=>[{id:Date.now(),msg:`🔄 ${TEAM_NAMES[teamIdx]} updated!`,sub:`New: ${total} pts`,ts:Date.now()},...n]);
  };

  const filtered=PLAYERS.filter(p=>{
    if(posFilter!=="ALL"&&p.pos!==posFilter)return false;
    if(countryFilter!=="All"&&p.country!==countryFilter)return false;
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase())&&!p.country.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }).map(p=>({...p,pts:calcTotalPlayerPoints(p,scores).total})).sort((a,b)=>b.pts-a.pts);

  const navTab=(k,active)=>({flex:1,padding:"9px 0",fontSize:12,fontWeight:active?700:500,borderRadius:9,border:"none",cursor:"pointer",background:active?"#1565c0":"#1e1e2e",color:active?"#fff":"#aaa"});
  const hubTabBtn=k=>({padding:"7px 14px",fontSize:13,fontWeight:hubTab===k?700:400,borderRadius:8,border:"none",cursor:"pointer",background:hubTab===k?"#1565c0":"transparent",color:hubTab===k?"#fff":"var(--color-text-secondary)"});
  const submittedTeams=Object.keys(teams).filter(i=>teams[i]&&teams[i].submitted);
  const totalPts=submittedTeams.reduce((s,i)=>s+(teams[i].points||0),0);
  const myRank=leaderboard.findIndex(e=>e.name===username)+1;
  const unreadNotifs=notifications.filter(n=>!n.read).length;

  // ── NAME SCREEN ──
  if(screen==="name")return(
    <div style={{maxWidth:420,margin:"0 auto",padding:"2rem 1rem",animation:"su 0.5s ease"}}>
      <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
        <div style={{fontSize:52,animation:"pf 2s ease-in-out infinite"}}>🏆</div>
        <h1 style={{fontSize:22,fontWeight:700,margin:"8px 0 4px"}}>FIFA World Cup 2026</h1>
        <p style={{color:"var(--color-text-secondary)",margin:0,fontSize:14}}>Fantasy · Stellar Wallet · Live Scores</p>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:4,marginBottom:"1.25rem",flexWrap:"wrap",background:"var(--color-background-secondary)",borderRadius:14,padding:"0.75rem 0.5rem"}}>
        {[{c:"Argentina",n:10,p:"FWD"},{c:"Brazil",n:7,p:"FWD"},{c:"France",n:10,p:"FWD"},{c:"England",n:9,p:"FWD"},{c:"Spain",n:10,p:"MID"},{c:"Germany",n:1,p:"GK"},{c:"Portugal",n:7,p:"FWD"}].map((t,i)=>(
          <div key={t.c} style={{animation:`pf ${2+i*0.25}s ease-in-out ${i*0.15}s infinite`,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <JerseySVG country={t.c} number={t.n} pos={t.p} size={38}/>
            <AnimFlag country={t.c} size={12}/>
          </div>
        ))}
      </div>
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:14,padding:"1.25rem"}}>
        <label style={{fontSize:14,color:"var(--color-text-secondary)",display:"block",marginBottom:6}}>Manager name</label>
        <input value={nameInput} onChange={e=>setNameInput(e.target.value)} placeholder="e.g. Gurpreet FC" onKeyDown={e=>e.key==="Enter"&&nameInput.trim()&&(setUsername(nameInput.trim()),setScreen("hub"))} style={{width:"100%",marginBottom:12,fontSize:15,boxSizing:"border-box"}}/>
        <button onClick={()=>{if(nameInput.trim()){setUsername(nameInput.trim());setScreen("hub");}}} style={{width:"100%",fontSize:15}} disabled={!nameInput.trim()}>Enter →</button>
      </div>
      {USE_LIVE_SCORES&&<div style={{marginTop:"0.75rem",background:"rgba(39,174,96,0.1)",border:"0.5px solid #27ae60",borderRadius:10,padding:"8px 12px",fontSize:12,color:"#27ae60",textAlign:"center"}}>🟢 Live scores active via football-data.org</div>}
    </div>
  );

  // ── HUB ──
  if(screen==="hub"||screen==="scores"||screen==="leaderboard")return(
    <div style={{maxWidth:520,margin:"0 auto",padding:"0.75rem",animation:"su 0.4s ease"}}>
      {showWallet&&<WalletModal balance={balance} username={username} onClose={()=>setShowWallet(false)} onTopUp={(c,perk)=>{setBalance(b=>b+c);if(perk)setAdPerk(perk);}}/>}
      {selectedPlayer&&<PlayerDetailModal player={selectedPlayer} scores={scores} onClose={()=>setSelectedPlayer(null)}/>}
      {transferTeamIdx!==null&&teams[transferTeamIdx]?.submitted&&<TransferModal team={teams[transferTeamIdx]} scores={scores} onSave={(sq,cap)=>handleTransferSave(transferTeamIdx,sq,cap)} onClose={()=>setTransferTeamIdx(null)}/>}

      {notifications.slice(0,3).map((n,i)=>(
        <div key={n.id} style={{position:"fixed",bottom:16+i*70,right:12,background:"#1a1a2e",border:"1px solid rgba(255,215,0,0.3)",borderRadius:12,padding:"10px 14px",zIndex:3000,maxWidth:260,animation:"notif 0.3s ease",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{n.msg}</div>
          <div style={{fontSize:11,color:"#aaa"}}>{n.sub}</div>
        </div>
      ))}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
        <div>
          <div style={{fontWeight:700,fontSize:16}}>{username}</div>
          <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>#{myRank||"—"} · {submittedTeams.length} team{submittedTeams.length!==1?"s":""} · {totalPts}pts</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <div onClick={()=>{setShowNotifs(s=>!s);setNotifications(n=>n.map(x=>({...x,read:true})));}} style={{position:"relative",background:"var(--color-background-secondary)",borderRadius:10,padding:"6px 10px",cursor:"pointer"}}>
            🔔{unreadNotifs>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#e74c3c",color:"#fff",fontSize:9,borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{unreadNotifs}</span>}
          </div>
          <div onClick={()=>setShowWallet(true)} style={{background:"linear-gradient(135deg,#1a1a2e,#0f3460)",borderRadius:12,padding:"6px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,border:"1px solid rgba(255,215,0,0.3)"}}>
            <span style={{fontSize:16}}>⭐</span>
            <div><div style={{fontSize:14,fontWeight:800,color:"#FFD700",lineHeight:1}}>{balance.toLocaleString()}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>FFC</div></div>
          </div>
        </div>
      </div>

      {showNotifs&&(
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"0.75rem",marginBottom:"0.75rem",maxHeight:200,overflowY:"auto"}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>🔔 Notifications</div>
          {notifications.length===0?<div style={{fontSize:12,color:"var(--color-text-secondary)"}}>No notifications yet.</div>:notifications.map((n,i)=>(
            <div key={i} style={{padding:"5px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:12}}>
              <div style={{fontWeight:600}}>{n.msg}</div><div style={{color:"var(--color-text-secondary)",fontSize:11}}>{n.sub}</div>
            </div>
          ))}
        </div>
      )}

      {adPerk&&adPerkValid(adPerk)&&(
        <div style={{background:adPerk.noAds?"rgba(16,185,129,0.08)":"rgba(245,158,11,0.08)",border:`1px solid ${adPerk.noAds?"#10b981":"#f59e0b"}`,borderRadius:10,padding:"5px 12px",marginBottom:"0.75rem"}}>
          <span style={{fontSize:12,color:adPerk.noAds?"#6ee7b7":"#fcd34d"}}>{adPerk.noAds?"🚫":"📉"} {adPerkLabel(adPerk)} · {adPerk.tier}</span>
        </div>
      )}

      <div style={{display:"flex",gap:4,marginBottom:"0.75rem",background:"#111",borderRadius:12,padding:4}}>
        {[{k:"hub",l:"👥 Teams"},{k:"scores",l:"📺 Scores"},{k:"leaderboard",l:"🏆 Board"}].map(t=>(
          <button key={t.k} onClick={()=>setScreen(t.k)} style={navTab(t.k,screen===t.k)}>{t.l}</button>
        ))}
      </div>
      {/* ── BANNER AD — below nav, hidden for paying users ── */}
      <AdBanner slot="banner" adPerk={adPerk}/>

      {/* TEAMS */}
      {screen==="hub"&&(
        <>
          <div style={{display:"flex",gap:4,marginBottom:"0.75rem",overflowX:"auto"}}>
            {["teams","achievements","stats"].map(t=>(
              <button key={t} onClick={()=>setHubTab(t)} style={hubTabBtn(t)}>{t==="teams"?"👥 Teams":t==="achievements"?"🏅 Achievements":"📊 Stats"}</button>
            ))}
          </div>
          {hubTab==="teams"&&(
            <>
              {submittedTeams.length>0&&(
                <div style={{background:"linear-gradient(135deg,#0f3460,#16213e)",borderRadius:14,padding:"10px 14px",marginBottom:"0.75rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>TOTAL POINTS</div><div style={{fontSize:24,fontWeight:800,color:"#FFD700"}}>{totalPts}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>RANK</div><div style={{fontSize:20,fontWeight:700,color:"#fff"}}>{myRank?`#${myRank}`:"—"}</div></div>
                </div>
              )}
              {TEAM_NAMES.map((name,i)=>{
                const t=teams[i];const locked=!t&&balance<TEAM_BUDGET;
                return(
                  <div key={i} style={{background:"var(--color-background-primary)",border:`1.5px solid ${t?.submitted?"#1565c0":"var(--color-border-tertiary)"}`,borderRadius:14,padding:"12px 14px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:38,height:38,borderRadius:10,background:t?.submitted?"linear-gradient(135deg,#1565c0,#0d47a1)":"var(--color-background-secondary)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{t?.submitted?"⚽":locked?"🔒":"➕"}</div>
                        <div>
                          <div style={{fontWeight:600,fontSize:14}}>{name}</div>
                          <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{t?.submitted?`Cap: ${t.squad.find(p=>p.id===t.captain)?.name?.split(" ").pop()||"—"}`:locked?`Need ${TEAM_BUDGET} FFC`:"Empty slot"}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        {t?.submitted&&<div style={{marginRight:4}}><div style={{fontSize:18,fontWeight:800,color:"#FFD700"}}>{t.points}pts</div></div>}
                        {t?.submitted&&<button onClick={()=>setTransferTeamIdx(i)} style={{fontSize:11,padding:"4px 8px",background:"rgba(255,255,255,0.08)",color:"var(--color-text-secondary)",borderRadius:6,border:"1px solid var(--color-border-tertiary)",cursor:"pointer"}}>🔄</button>}
                        <button onClick={()=>startPickingTeam(i)} style={{fontSize:12,padding:"5px 12px",background:!t?.submitted&&!locked?"#1565c0":"var(--color-background-secondary)",color:!t?.submitted&&!locked?"#fff":"var(--color-text-primary)",borderRadius:8,border:"none",cursor:locked?"not-allowed":"pointer",opacity:locked?0.5:1,fontWeight:600}}>{t?.submitted?"Edit":"Create"}</button>
                      </div>
                    </div>
                    {t?.submitted&&(
                      <>
                        <div style={{display:"flex",gap:3,marginTop:8,overflowX:"auto",paddingBottom:2}}>
                          {t.squad.map(p=>(
                            <div key={p.id} onClick={()=>setSelectedPlayer(p)} style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,cursor:"pointer"}}>
                              {t.captain===p.id&&<div style={{fontSize:8}}>👑</div>}
                              <JerseySVG country={p.country} number={SHIRT_NUMBERS[p.name]||1} pos={p.pos} size={26}/>
                              <div style={{fontSize:7,color:"var(--color-text-secondary)",textAlign:"center",maxWidth:28,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name.split(" ").pop()}</div>
                              <div style={{fontSize:7,color:"#FFD700",fontWeight:700}}>{t.pts[p.id]||0}p</div>
                            </div>
                          ))}
                        </div>
                        {t.pointsHistory&&t.pointsHistory.length>=2&&<div style={{marginTop:8}}><div style={{fontSize:11,color:"var(--color-text-tertiary)",marginBottom:2}}>Points history</div><PointsChart history={t.pointsHistory}/></div>}
                      </>
                    )}
                  </div>
                );
              })}
              {balance<TEAM_BUDGET&&submittedTeams.length===0&&<div style={{background:"var(--color-background-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:10,padding:"8px 12px",fontSize:13,color:"var(--color-text-warning)",textAlign:"center"}}>💰 <span onClick={()=>setShowWallet(true)} style={{fontWeight:700,textDecoration:"underline",cursor:"pointer"}}>Top up FFC</span> to create a team.</div>}
            </>
          )}
          {hubTab==="achievements"&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {ACHIEVEMENTS.map(a=>{
                const earned=achievements.includes(a.id);
                return(
                  <div key={a.id} style={{background:"var(--color-background-primary)",border:`1px solid ${earned?"#FFD700":"var(--color-border-tertiary)"}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,opacity:earned?1:0.5}}>
                    <div style={{fontSize:28,filter:earned?"none":"grayscale(1)"}}>{a.emoji}</div>
                    <div><div style={{fontSize:14,fontWeight:600,color:earned?"#FFD700":"var(--color-text-primary)"}}>{a.label}</div><div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{a.desc}</div></div>
                    {earned&&<div style={{marginLeft:"auto",fontSize:20}}>✅</div>}
                  </div>
                );
              })}
            </div>
          )}
          {hubTab==="stats"&&(
            <div>
              <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>Top scorers this tournament</div>
              {PLAYERS.map(p=>({...p,pts:calcTotalPlayerPoints(p,scores).total})).sort((a,b)=>b.pts-a.pts).slice(0,15).map((p,i)=>(
                <div key={p.id} onClick={()=>setSelectedPlayer(p)} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",marginBottom:4,background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:10,cursor:"pointer"}}>
                  <div style={{fontSize:14,fontWeight:700,minWidth:22,color:"var(--color-text-tertiary)"}}>{i+1}</div>
                  <JerseySVG country={p.country} number={SHIRT_NUMBERS[p.name]||1} pos={p.pos} size={28}/>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{p.name}</div><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{FLAGS[p.country]} · <span style={{background:POS_COLORS[p.pos],color:"#fff",padding:"0 4px",borderRadius:3,fontSize:10}}>{p.pos}</span> · {p.price}FFC</div></div>
                  <div style={{fontSize:16,fontWeight:700,color:"#FFD700"}}>{p.pts}pts</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* SCORES */}
      {screen==="scores"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,fontWeight:600,background:scoreSource==="live"?"rgba(39,174,96,0.15)":scoreSource==="error"?"rgba(231,76,60,0.15)":"rgba(255,193,7,0.15)",color:scoreSource==="live"?"#27ae60":scoreSource==="error"?"#e74c3c":"#f39c12"}}>
                {scoreSource==="live"?"🟢 Live":"scoreSource"==="error"?"🔴 API error — mock mode":"🟡 Mock mode"}
              </span>
              {lastUpdated&&<span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>Updated {lastUpdated.toLocaleTimeString()}</span>}
            </div>
            <button onClick={fetchScores} style={{fontSize:12,padding:"4px 10px"}}>↻</button>
          </div>
          {!USE_LIVE_SCORES&&<div style={{background:"rgba(255,193,7,0.08)",border:"0.5px solid #f39c12",borderRadius:10,padding:"8px 12px",fontSize:12,color:"#f39c12",marginBottom:8}}>ℹ️ Add your football-data.org API key to enable live scores. Free at <a href="https://www.football-data.org/client/register" target="_blank" rel="noreferrer" style={{color:"#90caf9"}}>football-data.org</a></div>}
          <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:8}}>
            {["All","A","B","C","D","E","F","G","H","I","J","K","L"].map(g=>(
              <button key={g} onClick={()=>setGroupFilter(g)} style={{padding:"3px 8px",fontSize:12,background:groupFilter===g?"#1565c0":"var(--color-background-secondary)",color:groupFilter===g?"#fff":"var(--color-text-primary)",borderRadius:6,border:"none",cursor:"pointer",fontWeight:groupFilter===g?700:400}}>{g==="All"?"All":g}</button>
            ))}
          </div>
          {/* ── IN-FEED AD — top of scores, hidden for paying users ── */}
          <AdBanner slot="feed" adPerk={adPerk}/>
          {FIXTURES.filter(f=>groupFilter==="All"||f.group===groupFilter).map((f,fi)=>(
            <div key={f.id}>
            {(()=>{const sc=scores[f.id];const live=sc&&sc.status==="LIVE";return(<>
            return(
              <div key={f.id} style={{background:"var(--color-background-primary)",border:`1px solid ${live?"#4caf50":"var(--color-border-tertiary)"}`,borderRadius:12,padding:"10px 12px",marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>Grp {f.group} · {f.date}</span>
                  {live?<span style={{fontSize:11,fontWeight:700,color:"#2e7d32",background:"var(--color-background-success)",padding:"1px 7px",borderRadius:4}}>🔴 {sc.minute?`${sc.minute}'`:"LIVE"}</span>:sc?.status==="FT"?<span style={{fontSize:11,background:"var(--color-background-secondary)",padding:"1px 7px",borderRadius:4}}>FT</span>:<span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>Upcoming</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 56px 1fr",alignItems:"center",gap:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}><span style={{fontSize:12,fontWeight:500,textAlign:"right"}}>{f.home}</span><AnimFlag country={f.home} size={16}/></div>
                  <div style={{textAlign:"center",fontWeight:800,fontSize:20,color:live?"#2e7d32":"var(--color-text-primary)"}}>{sc&&sc.status!=="NS"?`${sc.homeScore}–${sc.awayScore}`:"vs"}</div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}><AnimFlag country={f.away} size={16}/><span style={{fontSize:12,fontWeight:500}}>{f.away}</span></div>
                </div>
                <div style={{marginTop:6,fontSize:11,color:"var(--color-text-secondary)",borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:5}}>
                  {generateCommentary(f,sc).map((c,i)=><div key={i}>{c}</div>)}
                </div>
              </div>
              {(fi+1)%4===0&&<AdBanner slot="feed" adPerk={adPerk}/>}
            </>);})()}
            </div>
          ))}
        </>
      )}

      {/* LEADERBOARD */}
      {screen==="leaderboard"&&(
        <>
          <div style={{fontSize:15,fontWeight:600,marginBottom:"0.75rem"}}>🏆 Global Leaderboard</div>
          {leaderboard.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"var(--color-text-secondary)"}}><div style={{fontSize:48}}>🏆</div><p>No entries yet!</p></div>}
          {leaderboard.map((e,i)=>(
            <div key={e.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",marginBottom:4,borderRadius:12,background:e.name===username?"var(--color-background-info)":"var(--color-background-primary)",border:`0.5px solid ${e.name===username?"var(--color-border-info)":"var(--color-border-tertiary)"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18,minWidth:26}}>{MEDALS[i]||`${i+1}.`}</span>
                <div><div style={{fontSize:13,fontWeight:e.name===username?700:400}}>{e.name}{e.name===username?" 👤":""}</div><div style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{e.teams||1} team{e.teams!==1?"s":""}</div></div>
              </div>
              <span style={{fontSize:16,fontWeight:700}}>{e.points}pts</span>
            </div>
          ))}
        </>
      )}
    </div>
  );

  // ── PICK SCREEN ──
  if(screen==="pick")return(
    <div style={{maxWidth:600,margin:"0 auto",padding:"0.5rem",animation:"su 0.3s ease"}}>
      {showWallet&&<WalletModal balance={balance} username={username} onClose={()=>setShowWallet(false)} onTopUp={c=>setBalance(b=>b+c)}/>}
      {selectedPlayer&&<PlayerDetailModal player={selectedPlayer} scores={scores} onClose={()=>setSelectedPlayer(null)}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>setScreen("hub")} style={{fontSize:13,background:"transparent",padding:"4px 6px"}}>←</button>
          <span style={{fontWeight:700,fontSize:14}}>{TEAM_NAMES[activeTeamIdx]}</span>
          <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{draft.length}/11</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>setShowAutoSuggest(true)} style={{fontSize:12,padding:"5px 10px",background:"rgba(21,101,192,0.15)",color:"#1565c0",borderRadius:8,border:"1px solid rgba(21,101,192,0.3)",cursor:"pointer",fontWeight:600}}>⚡ Auto XI</button>
          <span style={{fontSize:12,fontWeight:600,color:draftRemaining<10?"var(--color-text-danger)":"var(--color-text-success)"}}>💰{draftRemaining}FFC</span>
        </div>
      </div>
      {showAutoSuggest&&(
        <div style={{background:"var(--color-background-info)",border:"0.5px solid var(--color-border-info)",borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13}}>⚡ Auto-pick best value XI?</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{const{squad,captain}=suggestBestXI(scores);setDraft(squad);setDraftCaptain(captain);setShowAutoSuggest(false);}} style={{fontSize:12,padding:"5px 10px",background:"#1565c0",color:"#fff",borderRadius:7,border:"none",cursor:"pointer"}}>Yes →</button>
            <button onClick={()=>setShowAutoSuggest(false)} style={{fontSize:12,padding:"5px 8px",background:"transparent",color:"var(--color-text-secondary)",border:"none",cursor:"pointer"}}>✕</button>
          </div>
        </div>
      )}
      {draft.length===11&&(
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          {["grid","pitch"].map(v=>(
            <button key={v} onClick={()=>setViewMode(v)} style={{flex:1,fontSize:12,padding:"5px",background:viewMode===v?"#1565c0":"var(--color-background-secondary)",color:viewMode===v?"#fff":"var(--color-text-primary)",borderRadius:7,border:"none",cursor:"pointer",fontWeight:viewMode===v?700:400}}>{v==="grid"?"📋 List":"🏟️ Pitch"}</button>
          ))}
        </div>
      )}
      {viewMode==="pitch"&&draft.length===11?(
        <div>
          <PitchView squad={draft} captain={draftCaptain}/>
          {draftCaptain?<button onClick={submitTeam} style={{width:"100%",marginTop:8,padding:"11px",fontWeight:600,fontSize:14}}>Submit {TEAM_NAMES[activeTeamIdx]} →</button>:<div style={{textAlign:"center",fontSize:13,marginTop:6,color:"var(--color-text-secondary)"}}>Switch to List to set captain</div>}
          <button onClick={()=>setViewMode("grid")} style={{width:"100%",marginTop:5,fontSize:13,background:"transparent"}}>← Back to list</button>
        </div>
      ):(
        <>
          <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:5}}>
            {["ALL","GK","DEF","MID","FWD"].map(p=>(
              <button key={p} onClick={()=>setPosFilter(p)} style={{padding:"4px 9px",fontSize:12,background:posFilter===p?"#1565c0":"var(--color-background-secondary)",color:posFilter===p?"#fff":"var(--color-text-primary)",borderRadius:6,border:"none",cursor:"pointer",fontWeight:posFilter===p?700:400}}>{p}{p!=="ALL"?` ${posCount(p)}/${FORMATION[p]}`:""}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:4,marginBottom:6}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search player / country..." style={{flex:1,fontSize:13,padding:"6px 10px"}}/>
            <select value={countryFilter} onChange={e=>setCountryFilter(e.target.value)} style={{fontSize:12,padding:"6px"}}>{ALL_COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>
          </div>
          {draftComplete&&(
            <div style={{background:"var(--color-background-success)",border:"0.5px solid var(--color-border-success)",borderRadius:8,padding:"6px 10px",marginBottom:6,fontSize:12,color:"var(--color-text-success)"}}>
              {!draftCaptain?"✅ Squad full! Tap a player to set captain (2× pts).":
                `👑 Captain: ${draft.find(p=>p.id===draftCaptain)?.name} — ready to submit!`}
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:6}}>
            {filtered.map(player=>{
              const inDraft=!!draft.find(p=>p.id===player.id);
              const isCap=draftCaptain===player.id;
              const disabled=!inDraft&&!canAdd(player);
              return(
                <div key={player.id}
                  style={{background:inDraft?"linear-gradient(135deg,var(--color-background-info),var(--color-background-primary))":"var(--color-background-primary)",border:`1.5px solid ${isCap?"#FFD700":inDraft?"var(--color-border-info)":"var(--color-border-tertiary)"}`,borderRadius:10,padding:"8px 4px 5px",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.3:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,transform:inDraft?"scale(1.02)":"scale(1)",position:"relative"}}
                  onClick={()=>{if(disabled)return;if(draftComplete&&inDraft)setDraftCaptain(player.id);else if(!draftComplete)toggleDraft(player);}}>
                  <div style={{position:"absolute",top:3,right:3,cursor:"pointer",fontSize:11,color:"var(--color-text-tertiary)"}} onClick={e=>{e.stopPropagation();setSelectedPlayer(player);}}>ℹ</div>
                  {isCap&&<div style={{position:"absolute",top:-7,left:"50%",transform:"translateX(-50%)",fontSize:13}}>👑</div>}
                  <JerseySVG country={player.country} number={SHIRT_NUMBERS[player.name]||player.id%26||1} pos={player.pos} size={48}/>
                  <div style={{fontSize:10,fontWeight:700,textAlign:"center",maxWidth:58,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{player.name.split(" ").pop()}</div>
                  <div style={{display:"flex",alignItems:"center",gap:3}}>
                    <span style={{fontSize:9,background:POS_COLORS[player.pos],color:"#fff",padding:"1px 4px",borderRadius:3,fontWeight:600}}>{player.pos}</span>
                    <span style={{fontSize:10,color:"var(--color-text-secondary)"}}>{player.price}FFC</span>
                  </div>
                  <div style={{fontSize:11,color:"#FFD700",fontWeight:700}}>{player.pts}pts</div>
                  <div style={{fontSize:11}}>{FLAGS[player.country]||""}</div>
                </div>
              );
            })}
            {filtered.length===0&&<div style={{gridColumn:"span 3",textAlign:"center",padding:"1.5rem",fontSize:13,color:"var(--color-text-secondary)"}}>No players match.</div>}
          </div>
          {draftComplete&&draftCaptain&&(
            <>
              {/* ── POST-SUBMIT AD — shown after squad is complete ── */}
              <AdBanner slot="sidebar" adPerk={adPerk} style={{marginBottom:6}}/>
              <button onClick={submitTeam} style={{width:"100%",padding:"11px",fontWeight:700,fontSize:14}}>
                Submit {TEAM_NAMES[activeTeamIdx]} {!teams[activeTeamIdx]?.submitted?`(−${TEAM_BUDGET} FFC)`:""} →
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  return null;
}